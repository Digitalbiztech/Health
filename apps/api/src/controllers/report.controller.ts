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

    // 2. Save the PDF to Supabase Storage bucket: "uploads"
    const uniqueId = crypto.randomUUID();
    const storagePath = `uploads/${patientId}/${uniqueId}-${file.originalname}`;
    const fileUrl = await SupabaseStorageService.uploadFile(
      'uploads',
      storagePath,
      file.buffer,
      file.mimetype,
    );

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

    // 4. Enqueue the BullMQ processing Job asynchronously
    await enqueueReportProcessing(upload.id);

    // 5. Return success response
    res.status(201).json({
      status: 'success',
      message: 'Report uploaded successfully and enqueued for processing',
      data: {
        upload,
      },
    });
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

    // Security check: ensure user is authorized to view this report
    if (
      principal.accountType === 'PATIENT' &&
      upload.patientId !== principal.id
    ) {
      throw new AppError('Forbidden: Access denied', 403);
    }

    res.status(200).json({
      status: 'success',
      data: { upload },
    });
  } catch (err) {
    next(err);
  }
}
