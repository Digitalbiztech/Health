import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { AppError } from './errorHandler.js';
import type { AuthenticatedPrincipal } from '../types/index.js';
import type { AccountType, StaffRole } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';

export const BYPASS_AUTH = true; // Set to false to restore Supabase/Passport authentication

// Mock principals are derived from static seed data that never changes during a
// process lifetime. Without a cache, BYPASS_AUTH forces an organization.findFirst()
// + patient/user.findFirst() round-trip to the (remote) database on EVERY request,
// adding ~2 sequential round-trips of latency to each call. Cache them once per
// account type so subsequent requests skip the DB entirely.
const mockPrincipalCache = new Map<'STAFF' | 'PATIENT', AuthenticatedPrincipal>();

async function getOrCreateMockPrincipal(accountType: 'STAFF' | 'PATIENT'): Promise<AuthenticatedPrincipal> {
  const cached = mockPrincipalCache.get(accountType);
  if (cached) {
    return cached;
  }

  const principal = await resolveMockPrincipal(accountType);
  mockPrincipalCache.set(accountType, principal);
  return principal;
}

async function resolveMockPrincipal(accountType: 'STAFF' | 'PATIENT'): Promise<AuthenticatedPrincipal> {
  // Find or create default organization
  let org = await prisma.organization.findFirst({
    include: { branding: true },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Mock Organization',
        slug: 'mock-organization',
        branding: {
          create: {
            brandName: 'Health Dashboard',
            tagline: 'AI-Powered Clinical Insights',
            logoMainUrl: '/logo/041323 YC LogoDeck_Main-WG copy.png',
            logoIconUrl: '/logo/040523 YC LogoDeck_Icon-GS.jpg',
            logoLetterformUrl: '/logo/YC_Letterform_WH.png',
            faviconUrl: '/logo/040523 YC LogoDeck_Icon-GS.jpg',
            showPoweredBy: true,
            poweredByText: 'POWERED BY HUUMANIZE',
          },
        },
      },
      include: { branding: true },
    });
  } else if (!org.branding) {
    await prisma.organizationBranding.create({
      data: {
        organizationId: org.id,
        brandName: 'Health Dashboard',
        tagline: 'AI-Powered Clinical Insights',
        logoMainUrl: '/logo/041323 YC LogoDeck_Main-WG copy.png',
        logoIconUrl: '/logo/040523 YC LogoDeck_Icon-GS.jpg',
        logoLetterformUrl: '/logo/YC_Letterform_WH.png',
        faviconUrl: '/logo/040523 YC LogoDeck_Icon-GS.jpg',
        showPoweredBy: true,
        poweredByText: 'POWERED BY HUUMANIZE',
      },
    });
  }

  if (accountType === 'STAFF') {
    let staffUser = await prisma.user.findFirst({
      where: { email: 'mock.staff@example.com' },
    });
    if (!staffUser) {
      staffUser = await prisma.user.create({
        data: {
          email: 'mock.staff@example.com',
          firstName: 'Mock',
          lastName: 'Staff',
          role: 'ADMIN',
          supabaseId: 'mock-staff-supabase-id-1234',
          organizationId: org.id,
        },
      });
    }
    return {
      accountType: 'STAFF',
      id: staffUser.id,
      email: staffUser.email,
      firstName: staffUser.firstName,
      lastName: staffUser.lastName,
      role: staffUser.role,
      supabaseId: staffUser.supabaseId!,
      organizationId: staffUser.organizationId,
    };
  } else {
    let patient = await prisma.patient.findFirst({
      where: { email: 'mock.patient@example.com' },
    });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          email: 'mock.patient@example.com',
          firstName: 'Mock',
          lastName: 'Patient',
          dateOfBirth: new Date('1990-01-01'),
          gender: 'MALE',
          supabaseId: 'mock-patient-supabase-id-1234',
          organizationId: org.id,
        },
      });
    }
    return {
      accountType: 'PATIENT',
      id: patient.id,
      email: patient.email,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      supabaseId: patient.supabaseId!,
      organizationId: patient.organizationId,
    };
  }
}

/**
 * Middleware: Authenticate via Supabase JWT.
 * Attaches `req.principal` on success.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (BYPASS_AUTH) {
    try {
      let accountType: 'STAFF' | 'PATIENT' = 'STAFF';
      if (req.path.includes('/patient/') || req.originalUrl.includes('/patient/')) {
        accountType = 'PATIENT';
      } else if (req.headers['x-mock-account-type'] === 'PATIENT') {
        accountType = 'PATIENT';
      }
      const principal = await getOrCreateMockPrincipal(accountType);
      req.principal = principal;
      return next();
    } catch (err) {
      return next(err);
    }
  }

  passport.authenticate(
    'supabase-jwt',
    { session: false },
    (err: Error | null, principal: AuthenticatedPrincipal | false, info: { message?: string }) => {
      if (err) return next(err);
      if (!principal) {
        return next(new AppError(info?.message || 'Unauthorized', 401));
      }
      req.principal = principal;
      next();
    },
  )(req, res, next);
}

/**
 * Middleware: Require the principal to be a specific account type (STAFF or PATIENT).
 */
export function requireAccountType(...allowed: AccountType[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const principal = req.principal;
    if (!principal) {
      return next(new AppError('Unauthorized', 401));
    }
    if (!allowed.includes(principal.accountType as AccountType)) {
      return next(new AppError('Forbidden: insufficient account type', 403));
    }
    next();
  };
}

/**
 * Middleware: Require the staff principal to have one of the specified roles.
 * Only applies to STAFF accounts — patients are automatically rejected.
 */
export function requireRole(...roles: StaffRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const principal = req.principal;
    if (!principal) {
      return next(new AppError('Unauthorized', 401));
    }
    if (principal.accountType !== 'STAFF') {
      return next(new AppError('Forbidden: staff access required', 403));
    }
    if (!roles.includes(principal.role as StaffRole)) {
      return next(new AppError('Forbidden: insufficient role', 403));
    }
    next();
  };
}
