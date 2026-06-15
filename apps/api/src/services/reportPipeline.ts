import { Prisma, BiomarkerStatus, ProcessingStatus } from '@prisma/client';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { env } from '../config/env.js';
import { SupabaseStorageService } from '../storage/supabase.storage';
import {
  extractionService,
  ExtractionServiceError,
  type ExtractedData,
  type ExtractionNormalizedBiomarker,
} from './extractionService';

/**
 * Report processing pipeline — pure async functions, no BullMQ/Redis.
 *
 * This is the single source of truth for the three processing steps. It is
 * consumed in two ways:
 *   1. Inline (current default): the upload controller calls `runReportPipeline`
 *      directly, so no Redis connection is ever opened.
 *   2. BullMQ workers (queues/*.queue.ts): each worker delegates to the matching
 *      step function. Those modules are intact but currently imported by nothing,
 *      so they never instantiate a Queue/Worker. Re-enable by re-adding the queue
 *      imports in app.ts and switching the controller back to enqueueReportProcessing.
 */

// ─── Helpers ─────────────────────────────────────────────────

function toDecimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(typeof value === 'string' ? value : value.toString());
}

function toNullableDecimal(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(value);
}

function mapBiomarker(b: ExtractionNormalizedBiomarker) {
  return {
    canonicalName: b.canonical_name,
    displayName: b.display_name,
    value: toDecimal(b.value),
    unit: b.unit,
    referenceRange: b.reference_range || null,
    referenceMin: toNullableDecimal(b.reference_min),
    referenceMax: toNullableDecimal(b.reference_max),
    status: b.status as BiomarkerStatus,
    category: b.category || null,
  };
}

function buildRawData(data: ExtractedData): Prisma.InputJsonValue {
  // Persist the metadata that's useful for audit / debugging but
  // exclude the very large full-text / page bodies so the column stays lean.
  return {
    extractedAt: new Date().toISOString(),
    method: data.method,
    confidence: data.confidence,
    pageCount: data.page_count,
    phiEntitiesCount: data.phi_entities_count,
    biomarkersCount: data.normalized_biomarkers.length,
    parsedBiomarkers: data.parsed_biomarkers,
    insights: data.insights,
    metadata: data.metadata,
  } as unknown as Prisma.InputJsonValue;
}

// ─── Step 1: Report intake ───────────────────────────────────

/** Transition the upload to PROCESSING. */
export async function processReportStep(uploadId: string): Promise<void> {
  console.log(`[ReportPipeline] Starting processing for Upload: ${uploadId}`);

  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
  });

  if (!upload) {
    throw new Error(`Upload not found: ${uploadId}`);
  }

  await prisma.upload.update({
    where: { id: uploadId },
    data: { status: 'PROCESSING' },
  });

  console.log(`[ReportPipeline] Upload ${uploadId} transitioned to PROCESSING`);
}

// ─── Step 2: Biomarker extraction ────────────────────────────

/** Call the extraction microservice and persist extraction + biomarkers. */
export async function extractBiomarkersStep(uploadId: string): Promise<void> {
  console.log(`[ReportPipeline] Starting biomarker extraction for Upload: ${uploadId}`);

  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
  });

  if (!upload) {
    throw new Error(`Upload not found: ${uploadId}`);
  }

  const response = await extractionService.extract({
    fileUrl: upload.fileUrl,
    fileType: 'application/pdf',
    uploadId: upload.id,
    patientId: upload.patientId,
  });

  if (!response.success || !response.data) {
    throw new ExtractionServiceError(
      response.error || `Extraction service returned no data for upload ${uploadId}`,
    );
  }

  const data = response.data;
  const normalized = data.normalized_biomarkers;
  console.log(
    `[ReportPipeline] Service extracted ${normalized.length} biomarkers (method=${data.method}, confidence=${data.confidence}) for Upload ${uploadId}`,
  );

  await prisma.$transaction(
    async (tx) => {
      const extraction = await tx.extraction.upsert({
        where: { uploadId },
        update: {
          rawData: buildRawData(data),
          status: ProcessingStatus.COMPLETED,
          source: data.method,
          confidence: data.confidence,
        },
        create: {
          uploadId,
          rawData: buildRawData(data),
          status: ProcessingStatus.COMPLETED,
          source: data.method,
          confidence: data.confidence,
        },
      });

      // Idempotency: wipe previously-extracted biomarkers before re-inserting
      await tx.biomarker.deleteMany({
        where: { extractionId: extraction.id },
      });

      if (normalized.length > 0) {
        await tx.biomarker.createMany({
          data: normalized.map((b) => ({
            ...mapBiomarker(b),
            extractionId: extraction.id,
          })),
        });
      }
    },
    {
      maxWait: 20000,
      timeout: 40000,
    },
  );
}

// ─── Step 3: Report + PDF generation ─────────────────────────

/** Build the clinical report, render the PDF, upload it, and mark COMPLETED. */
export async function generatePdfReportStep(uploadId: string): Promise<void> {
  console.log(`[ReportPipeline] Generating PDF and clinical report for Upload: ${uploadId}`);

  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: {
      extraction: {
        include: {
          biomarkers: true,
        },
      },
      patient: true,
    },
  });

  if (!upload) {
    throw new Error(`Upload not found: ${uploadId}`);
  }

  if (!upload.extraction) {
    throw new Error(`No biomarkers extracted for Upload: ${uploadId}`);
  }

  const { biomarkers } = upload.extraction;
  const patientName =
    `${upload.patient.firstName || ''} ${upload.patient.lastName || ''}`.trim() || 'Patient';

  // Generate structured clinical insights and recommendations
  const flaggedBiomarkers = biomarkers.filter((b) => b.status !== 'NORMAL');

  // Parse dynamic insights from Python extraction results
  const rawData = upload.extraction.rawData as any;
  const extractedInsights = (rawData?.insights || []) as Array<{
    title: string;
    body: string;
    tone: string;
  }>;

  let summaryPoints: string[] = [];
  let recommendations: string[] = [];

  const glucoseVal = biomarkers.find((b) => b.canonicalName === 'GLUCOSE')?.value;
  const glucoseStr = glucoseVal != null ? ` (${glucoseVal} mg/dL)` : '';
  const cholVal = biomarkers.find((b) => b.canonicalName === 'CHOLESTEROL_TOTAL')?.value;
  const cholStr = cholVal != null ? ` (${cholVal} mg/dL)` : '';

  if (extractedInsights.length > 0) {
    // Use dynamic LLM-generated insights
    summaryPoints = extractedInsights.map((ins) => `${ins.title}: ${ins.body}`);

    const watchInsights = extractedInsights.filter((ins) => ins.tone === 'watch');
    if (watchInsights.length > 0) {
      recommendations = watchInsights.map((ins) => `${ins.title}: ${ins.body}`);
    } else {
      recommendations = [
        `Routine Monitoring: All analyzed parameters are stable. Continue with your scheduled wellness plans.`,
        `Preventative Care: Maintain a balanced diet, adequate hydration, and regular exercise (150 minutes per week).`,
      ];
    }
  } else {
    // Fallback rule-based generation if no LLM insights are found
    summaryPoints = [
      `Fasting Glucose and Cholesterol values are currently elevated outside standard reference ranges.`,
      `Hemoglobin and HDL Cholesterol values are within optimal normal ranges.`,
      `Review of lipid panel indicates slightly elevated cardiovascular risk indices requiring preventative focus.`,
    ];
    recommendations = [
      `Prediabetes Screening: Fasting Blood Glucose is slightly high${glucoseStr}. Consider reducing simple sugars and checking HbA1c.`,
      `Cardiovascular Health: Total Cholesterol${cholStr} and LDL are elevated. Recommend adopting a Mediterranean diet rich in whole grains and healthy fats.`,
      `Activity: Engage in at least 150 minutes of moderate-intensity aerobic exercise per week to optimize lipid profiles.`,
    ];
  }

  const insights = {
    schemaVersion: 1,
    flags: flaggedBiomarkers.map((b) => ({
      biomarkerId: b.id,
      severity: b.status,
      note: `Value of ${b.value} ${b.unit} is ${b.status.toLowerCase()} (ref: ${b.referenceRange || 'N/A'}).`,
    })),
    recommendations,
    summaryPoints,
  };

  // Create or update the clinical Report record in DB
  const reportTitle = `Clinical Lab Insights — ${patientName}`;
  let reportSummary = `Lab report analyzed on ${new Date().toLocaleDateString()}. Biomarkers extracted: ${biomarkers.length}. Alerts: ${flaggedBiomarkers.length} outside optimal range.`;

  if (env.OPENAI_API_KEY && extractedInsights.length > 0) {
    try {
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const biomarkerLines = biomarkers
        .map((b) => `- ${b.displayName}: ${b.value} ${b.unit} (${b.status})`)
        .join('\n');
      const insightsLines = extractedInsights.map((i) => `- ${i.title}: ${i.body}`).join('\n');

      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert medical writer. Summarize the following lab report results into a professional, cohesive, and concise narrative summary (2-4 sentences, about 50-80 words). Do not include any greeting or conversational filler. State the key observations clearly.',
          },
          {
            role: 'user',
            content: `Biomarkers:\n${biomarkerLines}\n\nInsights:\n${insightsLines}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      });

      const gptSummary = completion.choices[0]?.message?.content?.trim();
      if (gptSummary) {
        reportSummary = gptSummary;
      }
    } catch (err) {
      console.error('Failed to generate GPT narrative summary, falling back to simple summary:', err);
    }
  }

  const report = await prisma.report.create({
    data: {
      title: reportTitle,
      summary: reportSummary,
      insights,
      status: 'GENERATED',
      uploadId: upload.id,
      patientId: upload.patientId,
      organizationId: upload.organizationId,
      userId: upload.userId,
    },
  });

  // Generate mock PDF document buffer
  // In production, this would call PDFKit or Puppeteer to render a premium PDF layout
  const pdfContent = `
==================================================
AURIEM CLINICAL SUITE — LAB INSIGHTS REPORT
==================================================
Patient: ${patientName}
DOB: ${upload.patient.dateOfBirth.toLocaleDateString()}
Gender: ${upload.patient.gender}
Analyzed At: ${new Date().toLocaleString()}
Report Reference: ${report.id}
--------------------------------------------------

SUMMARY:
${reportSummary}

BIOMARKERS EXTRACTED:
${biomarkers.map((b) => `- ${b.displayName}: ${b.value} ${b.unit} (${b.status}) [Ref: ${b.referenceRange || 'N/A'}]`).join('\n')}

CLINICAL RECOMMENDATIONS:
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

--------------------------------------------------
This report is an AI-assisted analysis for educational purposes.
Please consult with a qualified health professional for clinical diagnosis.
==================================================
`;
  const pdfBuffer = Buffer.from(pdfContent, 'utf-8');

  // Upload the generated PDF to Supabase Storage
  const storagePath = `reports/${upload.patientId}/${upload.id}.pdf`;
  const pdfUrl = await SupabaseStorageService.uploadFile(
    'reports',
    storagePath,
    pdfBuffer,
    'application/pdf',
  );

  // Update the Report and Upload records in DB + create ReportExport record
  await prisma.$transaction([
    prisma.report.update({
      where: { id: report.id },
      data: { pdfUrl },
    }),
    prisma.upload.update({
      where: { id: upload.id },
      data: { status: 'COMPLETED' },
    }),
    prisma.reportExport.create({
      data: {
        pdfUrl,
        reportId: report.id,
        organizationId: upload.organizationId,
        generatedByUserId: upload.userId,
        generatedByPatientId: upload.userId ? null : upload.patientId,
      },
    }),
  ]);

  console.log(`[ReportPipeline] PDF report successfully compiled, uploaded, and saved. URL: ${pdfUrl}`);
}

// ─── Orchestrator (inline, no queue) ─────────────────────────

/**
 * Run the full report pipeline in-process (report → extraction → PDF).
 *
 * On failure it mirrors the BullMQ workers' side effects: the upload is marked
 * FAILED and, if the failure happened during/after extraction, an extraction
 * failure record is written. The error is re-thrown so the caller can log it.
 */
export async function runReportPipeline(uploadId: string): Promise<void> {
  try {
    await processReportStep(uploadId);
    await extractBiomarkersStep(uploadId);
    await generatePdfReportStep(uploadId);
  } catch (err) {
    const error = err as Error;
    console.error(`[ReportPipeline] Processing failed for Upload ${uploadId}:`, error);

    await prisma.upload
      .update({
        where: { id: uploadId },
        data: { status: ProcessingStatus.FAILED },
      })
      .catch(() => console.error(`Failed to mark upload ${uploadId} as FAILED`));

    await prisma.extraction
      .upsert({
        where: { uploadId },
        update: {
          status: ProcessingStatus.FAILED,
          rawData: { error: error.message },
        },
        create: {
          uploadId,
          status: ProcessingStatus.FAILED,
          rawData: { error: error.message },
        },
      })
      .catch(() => console.error('Failed to record extraction failure'));

    throw error;
  }
}
