import { Queue, Worker, Job } from 'bullmq';
import { Prisma, BiomarkerStatus, ProcessingStatus } from '@prisma/client';
import { redisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { pdfQueue } from './pdf.queue';
import {
  extractionService,
  ExtractionServiceError,
  type ExtractedData,
  type ExtractionNormalizedBiomarker,
} from '../services/extractionService';

// ─── Queue Definition ────────────────────────────────────────

export const extractionQueue = new Queue('extraction-queue', {
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

// ─── Worker Definition ─────────────────────────────────────────

export const extractionWorker = new Worker(
  'extraction-queue',
  async (job: Job<{ uploadId: string }>) => {
    const { uploadId } = job.data;
    console.log(`[ExtractionQueue] Starting biomarker extraction for Upload: ${uploadId}`);

    // 1. Fetch the upload record
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    // 2. Call the Python extraction microservice
    const response = await extractionService.extract({
      fileUrl: upload.fileUrl,
      fileType: 'application/pdf',
      uploadId: upload.id,
    });

    if (!response.success || !response.data) {
      throw new ExtractionServiceError(
        response.error || `Extraction service returned no data for upload ${uploadId}`,
      );
    }

    const data = response.data;
    const normalized = data.normalized_biomarkers;
    console.log(
      `[ExtractionQueue] Service extracted ${normalized.length} biomarkers (method=${data.method}, confidence=${data.confidence}) for Upload ${uploadId}`,
    );

    // 3. Persist Extraction + Biomarkers in a single transaction
    await prisma.$transaction(async (tx) => {
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
    });

    // 4. Trigger the final pipeline step (Report + PDF export)
    await pdfQueue.add('generate-pdf-report', { uploadId });
  },
  {
    connection: redisConnection as any,
    concurrency: 5,
  },
);

extractionWorker.on('failed', async (job, err) => {
  if (job) {
    const { uploadId } = job.data;
    console.error(`[ExtractionQueue] Extraction job ${job.id} failed for Upload ${uploadId}:`, err);

    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: ProcessingStatus.FAILED },
    }).catch(() => console.error('Failed to update upload status'));

    await prisma.extraction.upsert({
      where: { uploadId },
      update: {
        status: ProcessingStatus.FAILED,
        rawData: { error: err.message },
      },
      create: {
        uploadId,
        status: ProcessingStatus.FAILED,
        rawData: { error: err.message },
      },
    }).catch(() => console.error('Failed to record extraction failure'));
  }
});
