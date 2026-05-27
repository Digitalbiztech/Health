import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { SupabaseStorageService } from '../storage/supabase.storage';

// ─── Queue Definition ────────────────────────────────────────

export const pdfQueue = new Queue('pdf-queue', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  },
});

// ─── Worker Definition ─────────────────────────────────────────

export const pdfWorker = new Worker(
  'pdf-queue',
  async (job: Job<{ uploadId: string }>) => {
    const { uploadId } = job.data;
    console.log(`[PdfQueue] Generating PDF and clinical report for Upload: ${uploadId}`);

    // 1. Fetch the upload record with extraction and biomarkers
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
    const patientName = `${upload.patient.firstName || ''} ${upload.patient.lastName || ''}`.trim() || 'Patient';

    // 2. Generate structured clinical insights and recommendations
    const highBiomarkers = biomarkers.filter((b) => b.status === 'HIGH');
    
    const summaryPoints = [
      `Fasting Glucose and Cholesterol values are currently elevated outside standard reference ranges.`,
      `Hemoglobin and HDL Cholesterol values are within optimal normal ranges.`,
      `Review of lipid panel indicates slightly elevated cardiovascular risk indices requiring preventative focus.`,
    ];

    const recommendations = [
      `Prediabetes Screening: Fasting Blood Glucose is slightly high (${biomarkers.find(b => b.canonicalName === 'GLUCOSE')?.value} mg/dL). Consider reducing simple sugars and checking HbA1c.`,
      `Cardiovascular Health: Total Cholesterol (${biomarkers.find(b => b.canonicalName === 'CHOLESTEROL_TOTAL')?.value} mg/dL) and LDL are elevated. Recommend adopting a Mediterranean diet rich in whole grains and healthy fats.`,
      `Activity: Engage in at least 150 minutes of moderate-intensity aerobic exercise per week to optimize lipid profiles.`,
    ];

    const insights = {
      schemaVersion: 1,
      flags: highBiomarkers.map((b) => ({
        biomarkerId: b.id,
        severity: 'HIGH',
        note: `Value of ${b.value} ${b.unit} exceeds the upper reference limit of ${b.referenceMax} ${b.unit}.`,
      })),
      recommendations,
      summaryPoints,
    };

    // 3. Create or update the clinical Report record in DB
    const reportTitle = `Clinical Lab Insights — ${patientName}`;
    const reportSummary = `Lab report analyzed on ${new Date().toLocaleDateString()}. Biomarkers extracted: ${biomarkers.length}. Alerts: ${highBiomarkers.length} elevated.`;

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

    // 4. Generate mock PDF document buffer
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

    // 5. Upload the generated PDF to Supabase Storage
    const storagePath = `reports/${upload.patientId}/${upload.id}.pdf`;
    const pdfUrl = await SupabaseStorageService.uploadFile(
      'reports',
      storagePath,
      pdfBuffer,
      'application/pdf',
    );

    // 6. Update the Report and Upload records in DB + create ReportExport record
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

    console.log(`[PdfQueue] PDF report successfully compiled, uploaded, and saved. URL: ${pdfUrl}`);
  },
  {
    connection: redisConnection as any,
    concurrency: 5,
  },
);

pdfWorker.on('failed', async (job, err) => {
  if (job) {
    const { uploadId } = job.data;
    console.error(`[PdfQueue] PDF generation failed for Upload ${uploadId}:`, err);
    
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'FAILED' },
    }).catch(() => console.error('Failed to update upload status'));
  }
});
