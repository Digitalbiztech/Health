import { type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { SupabaseStorageService } from '../storage/supabase.storage';
import { enqueueReportProcessing } from '../queues/report.queue';
import { AppError } from '../middleware/errorHandler';
import { FileType } from '@prisma/client';

/**
 * Handle report PDF uploading, Supabase Storage saving, DB insertion,
 * and enqueuing BullMQ processing.
 */
export async function uploadReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    if (file.mimetype !== 'application/pdf') {
      throw new AppError('Only PDF files are supported', 400);
    }

    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }

    // 1. Determine patient and organization context
    let patientId: string;
    let userId: string | null = null;

    if (principal.accountType === 'PATIENT') {
      patientId = principal.id;
    } else if (principal.accountType === 'STAFF') {
      // Clinician uploading on behalf of a patient
      userId = principal.id;
      const bodyPatientId = req.body.patientId;
      if (!bodyPatientId) {
        throw new AppError('patientId is required in the body for staff uploads', 400);
      }
      
      const patientExists = await prisma.patient.findUnique({
        where: { id: bodyPatientId },
      });
      
      if (!patientExists) {
        throw new AppError('Patient not found', 404);
      }
      patientId = bodyPatientId;
    } else {
      throw new AppError('Invalid account type principal', 403);
    }

    // Ensure we have a valid Organization
    let organizationId = principal.organizationId;
    if (!organizationId) {
      // Look up first available or create a default one
      let org = await prisma.organization.findFirst();
      if (!org) {
        org = await prisma.organization.create({
          data: {
            name: 'Auriem Suite',
            slug: 'auriem-suite',
          },
        });
      }
      organizationId = org.id;

      // Assign the organization to the principal (in db) for subsequent actions
      if (principal.accountType === 'PATIENT') {
        await prisma.patient.update({
          where: { id: principal.id },
          data: { organizationId },
        });
      } else {
        await prisma.user.update({
          where: { id: principal.id },
          data: { organizationId },
        });
      }
    }

    // 2. Compute the deterministic storage path + public URL up front.
    //    The public URL does not depend on the object existing yet, so we can
    //    persist it and respond before the (slow, ~seconds) storage upload runs.
    const uniqueId = crypto.randomUUID();
    const storagePath = `uploads/${patientId}/${uniqueId}-${file.originalname}`;
    const fileUrl = SupabaseStorageService.getPublicUrl('uploads', storagePath);

    // 3. Create a DB record in the "uploads" table with status "PENDING"
    const upload = await prisma.upload.create({
      data: {
        fileName: file.originalname,
        fileUrl,
        fileType: FileType.PDF,
        fileSize: file.size,
        status: 'PENDING',
        patientId,
        userId,
        organizationId,
      },
    });

    // 4. Respond immediately — the client now polls the PENDING upload for status.
    res.status(201).json({
      status: 'success',
      message: 'Report uploaded successfully and enqueued for processing',
      data: {
        upload,
      },
    });

    // 5. Push bytes to storage, THEN enqueue processing — in the background.
    //    Ordering matters: the extraction worker downloads the file from fileUrl,
    //    so the upload must land before the job is queued. Errors here can no
    //    longer reach the HTTP response, so we mark the upload FAILED instead.
    const fileBuffer = file.buffer;
    const fileMimetype = file.mimetype;
    void (async () => {
      try {
        await SupabaseStorageService.uploadFile(
          'uploads',
          storagePath,
          fileBuffer,
          fileMimetype,
        );
        await enqueueReportProcessing(upload.id);
      } catch (bgErr) {
        console.error(
          `[uploadReport] Background storage/enqueue failed for upload ${upload.id}:`,
          bgErr,
        );
        await prisma.upload
          .update({ where: { id: upload.id }, data: { status: 'FAILED' } })
          .catch(() => console.error(`Failed to mark upload ${upload.id} as FAILED`));
      }
    })();
  } catch (err) {
    next(err);
  }
}

/**
 * Get all uploads for the logged-in patient or all uploads under a clinician's organization.
 */
export async function getUploads(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }

    let uploads;
    if (principal.accountType === 'PATIENT') {
      uploads = await prisma.upload.findMany({
        where: { patientId: principal.id },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      uploads = await prisma.upload.findMany({
        where: { organizationId: principal.organizationId || undefined },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.status(200).json({
      status: 'success',
      data: { uploads },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get full report data for a specific upload (including biomarkers and insights).
 */
export async function getReportByUploadId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { uploadId } = req.params;
    const principal = req.principal;
    if (!principal) {
      throw new AppError('Unauthorized', 401);
    }

    // ── Cheap freshness pre-check ────────────────────────────────
    // The full report (upload + extraction + biomarkers + reports + patient) is
    // several sequential round-trips. Most calls are conditional GETs that end in
    // 304, so first do a lightweight lookup to build a version tag from the rows
    // that can actually change. If it matches the client's If-None-Match we return
    // 304 immediately and skip the expensive nested query entirely.
    const head = await prisma.upload.findUnique({
      where: { id: uploadId },
      select: {
        patientId: true,
        updatedAt: true,
        extraction: { select: { updatedAt: true } },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { updatedAt: true },
        },
      },
    });

    if (!head) {
      throw new AppError('Upload not found', 404);
    }

    // Security check: ensure user is authorized to view this report
    if (principal.accountType === 'PATIENT' && head.patientId !== principal.id) {
      throw new AppError('Forbidden: Access denied', 403);
    }

    const versionTag = `"${uploadId}:${head.updatedAt.getTime()}:${
      head.extraction?.updatedAt.getTime() ?? 0
    }:${head.reports[0]?.updatedAt.getTime() ?? 0}"`;

    res.setHeader('ETag', versionTag);
    res.setHeader('Cache-Control', 'private, no-cache');

    if (req.headers['if-none-match'] === versionTag) {
      res.status(304).end();
      return;
    }

    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        extraction: {
          include: {
            biomarkers: true,
          },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        patient: true,
      },
    });

    if (!upload) {
      throw new AppError('Upload not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { upload },
    });
  } catch (err) {
    next(err);
  }
}
