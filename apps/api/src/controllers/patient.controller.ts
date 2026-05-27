import { type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { supabaseAdmin } from '../lib/supabase.js';

/**
 * GET /patients
 * Protected — Fetches all patients in the organization of the logged-in staff member.
 */
export async function getPatients(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal || principal.accountType !== 'STAFF') {
      throw new AppError('Unauthorized: Clinician access required', 401);
    }

    let organizationId = principal.organizationId;
    if (!organizationId) {
      // Find or create default organization
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

      // Update staff user organization
      await prisma.user.update({
        where: { id: principal.id },
        data: { organizationId },
      });
    }

    const patients = await prisma.patient.findMany({
      where: { organizationId },
      orderBy: { lastName: 'asc' },
      include: {
        uploads: {
          orderBy: { createdAt: 'desc' },
          include: {
            reports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { patients },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /patients
 * Protected — Creates/onboards a new patient under the staff's organization.
 */
export async function createPatientForStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal || principal.accountType !== 'STAFF') {
      throw new AppError('Unauthorized: Clinician access required', 401);
    }

    let organizationId = principal.organizationId;
    if (!organizationId) {
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
      await prisma.user.update({
        where: { id: principal.id },
        data: { organizationId },
      });
    }

    const { email, firstName, lastName, dateOfBirth, gender, note } = req.body;

    if (!email || !firstName || !lastName || !dateOfBirth || !gender) {
      throw new AppError('Missing required patient onboarding parameters', 400);
    }

    // Check if patient already exists in our DB
    const existing = await prisma.patient.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('A patient with this email already exists', 409);
    }

    // 1. Create Supabase Auth user
    const tempPassword = crypto.randomUUID();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        account_type: 'PATIENT',
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authError) {
      throw new AppError(authError.message, 400);
    }

    const supabaseUser = authData.user;

    // 2. Create Prisma Patient record
    const patient = await prisma.patient.create({
      data: {
        email,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        note: note || null,
        supabaseId: supabaseUser.id,
        organizationId,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { patient },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /patients/stats
 * Protected — Returns cumulative patient counts per month split by gender,
 * for the Overview patient-growth line graph.
 * Shape: [{ month: 'Jan 2026', male, female, other, total }]
 */
export async function getPatientStats(req: Request, res: Response, next: NextFunction) {
  try {
    const principal = req.principal;
    if (!principal || principal.accountType !== 'STAFF') {
      throw new AppError('Unauthorized: Clinician access required', 401);
    }

    let organizationId = principal.organizationId;
    if (!organizationId) {
      let org = await prisma.organization.findFirst();
      if (!org) {
        org = await prisma.organization.create({
          data: { name: 'Auriem Suite', slug: 'auriem-suite' },
        });
      }
      organizationId = org.id;
      await prisma.user.update({
        where: { id: principal.id },
        data: { organizationId },
      });
    }

    const patients = await prisma.patient.findMany({
      where: { organizationId },
      select: { gender: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Bucket signups per calendar month, then accumulate into running totals.
    type Bucket = { key: string; month: string; male: number; female: number; other: number };
    const buckets = new Map<string, Bucket>();

    for (const p of patients) {
      const d = p.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { key, month: label, male: 0, female: 0, other: 0 };
        buckets.set(key, bucket);
      }
      if (p.gender === 'MALE') bucket.male++;
      else if (p.gender === 'FEMALE') bucket.female++;
      else bucket.other++;
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));

    let male = 0;
    let female = 0;
    let other = 0;
    const stats = sorted.map((b) => {
      male += b.male;
      female += b.female;
      other += b.other;
      return { month: b.month, male, female, other, total: male + female + other };
    });

    res.status(200).json({
      status: 'success',
      data: { stats },
    });
  } catch (err) {
    next(err);
  }
}
