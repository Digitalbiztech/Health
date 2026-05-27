import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { extractionQueue } from './extraction.queue';

// ─── Queue Definition ────────────────────────────────────────

export const reportQueue = new Queue('report-queue', {
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

// ─── Producer Helper ─────────────────────────────────────────

export async function enqueueReportProcessing(uploadId: string) {
  return reportQueue.add('process-report', { uploadId });
}

// ─── Worker Definition ─────────────────────────────────────────

export const reportWorker = new Worker(
  'report-queue',
  async (job: Job<{ uploadId: string }>) => {
    const { uploadId } = job.data;
    console.log(`[ReportQueue] Starting processing for Upload: ${uploadId}`);

    // 1. Fetch the upload record
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error(`Upload not found: ${uploadId}`);
    }

    // 2. Transition state to PROCESSING
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING' },
    });

    // 3. Trigger the next step in the pipeline (Biomarker Extraction)
    await extractionQueue.add('extract-biomarkers', { uploadId });

    console.log(`[ReportQueue] Upload ${uploadId} transitioned to PROCESSING and extraction queued`);
  },
  {
    connection: redisConnection as any,
    concurrency: 5,
  },
);

reportWorker.on('failed', async (job, err) => {
  if (job) {
    const { uploadId } = job.data;
    console.error(`[ReportQueue] Job ${job.id} failed for Upload ${uploadId}:`, err);
    
    // Set status to FAILED in database
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'FAILED' },
    }).catch(() => console.error('Failed to update upload status to FAILED'));
  }
});
