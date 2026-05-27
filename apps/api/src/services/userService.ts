import { prisma } from '../lib/prisma.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { Gender } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';

// ─── Staff (User) Operations ─────────────────────────────────

export async function getStaffBySupabaseId(supabaseId: string) {
  return prisma.user.findUnique({ where: { supabaseId } });
}

export async function getStaffByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findOrCreateStaff(
  supabaseId: string,
  email: string,
  metadata?: { firstName?: string; lastName?: string },
) {
  return prisma.user.upsert({
    where: { supabaseId },
    update: {},
    create: {
      email,
      supabaseId,
      firstName: metadata?.firstName || null,
      lastName: metadata?.lastName || null,
      role: 'USER',
    },
  });
}

// ─── Patient Operations ──────────────────────────────────────

export async function getPatientBySupabaseId(supabaseId: string) {
  return prisma.patient.findUnique({ where: { supabaseId } });
}

export async function getPatientByEmail(email: string) {
  return prisma.patient.findUnique({ where: { email } });
}

/**
 * Create a patient: first in Supabase Auth, then in the Prisma Patient table.
 * Returns the Supabase session (access + refresh tokens) so the frontend
 * can immediately set the session without a separate login call.
 */
export async function createPatient(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
}) {
  // Check if patient already exists in our DB
  const existing = await getPatientByEmail(data.email);
  if (existing) {
    throw new AppError('A patient with this email already exists', 409);
  }

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true, // Auto-confirm for now
    user_metadata: {
      account_type: 'PATIENT',
      first_name: data.firstName,
      last_name: data.lastName,
    },
  });

  if (authError) {
    throw new AppError(authError.message, 400);
  }

  const supabaseUser = authData.user;

  // Create Prisma Patient record
  const patient = await prisma.patient.create({
    data: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      supabaseId: supabaseUser.id,
    },
  });

  // Generate session tokens so the patient is logged in immediately
  const { data: sessionData, error: sessionError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: data.email,
    });

  // For immediate sign-in, we sign in on behalf of the user
  // The frontend will use these tokens to set the session
  const { data: signInData, error: signInError } =
    await supabaseAdmin.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

  if (signInError) {
    // Patient was created but sign-in failed — they can still login manually
    console.warn('Auto sign-in after signup failed:', signInError.message);
    return { patient, session: null };
  }

  return { patient, session: signInData.session };
}
