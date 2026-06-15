import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { generatePdfReportStep } from '../services/reportPipeline';

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

    // Build report, render + upload PDF, mark COMPLETED (shared pipeline step)
    await generatePdfReportStep(uploadId);
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
