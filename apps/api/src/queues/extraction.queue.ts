import { Queue, Worker, Job } from 'bullmq';
import { ProcessingStatus } from '@prisma/client';
import { redisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { pdfQueue } from './pdf.queue';
import { extractBiomarkersStep } from '../services/reportPipeline';

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

// ─── Worker Definition ─────────────────────────────────────────

export const extractionWorker = new Worker(
  'extraction-queue',
  async (job: Job<{ uploadId: string }>) => {
    const { uploadId } = job.data;

    // 1. Extract + persist biomarkers (shared pipeline step)
    await extractBiomarkersStep(uploadId);

    // 2. Trigger the final pipeline step (Report + PDF export)
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
