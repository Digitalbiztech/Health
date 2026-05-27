import type { User, Patient, Role } from '@prisma/client';
import type { AccountType } from '../config/constants.js';

// ─── Authenticated Principal ─────────────────────────────────

export interface StaffPrincipal {
  accountType: 'STAFF';
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  supabaseId: string;
  organizationId: string | null;
}

export interface PatientPrincipal {
  accountType: 'PATIENT';
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: Date;
  gender: string;
  supabaseId: string;
  organizationId: string | null;
}

export type AuthenticatedPrincipal = StaffPrincipal | PatientPrincipal;

// ─── Express Augmentation ────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
    }
  }
}

// ─── Supabase JWT Payload ────────────────────────────────────

export interface SupabaseJwtPayload {
  sub: string;          // Supabase user ID
  email?: string;
  role?: string;        // 'authenticated'
  aud?: string;
  exp?: number;
  iat?: number;
  user_metadata?: Record<string, unknown>;
}

// ─── API Response Envelope ───────────────────────────────────

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}
