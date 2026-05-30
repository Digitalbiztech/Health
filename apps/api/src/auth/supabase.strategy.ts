import { Strategy as JwtStrategy, ExtractJwt, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import type { SupabaseJwtPayload, AuthenticatedPrincipal } from '../types/index.js';

const isBase64 = env.SUPABASE_JWT_SECRET.includes('==') || env.SUPABASE_JWT_SECRET.length > 40;
const jwtSecret = isBase64
  ? Buffer.from(env.SUPABASE_JWT_SECRET, 'base64')
  : env.SUPABASE_JWT_SECRET;

const options: StrategyOptionsWithoutRequest = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: jwtSecret,
  algorithms: ['HS256'],
};

/**
 * Passport strategy that verifies Supabase-issued JWTs and resolves
 * the authenticated principal from either the User or Patient table.
 */
export const supabaseJwtStrategy = new JwtStrategy(options, async (payload: SupabaseJwtPayload, done) => {
  try {
    const supabaseId = payload.sub;
    if (!supabaseId) {
      return done(null, false, { message: 'Invalid token: missing sub claim' });
    }

    // Try staff (User) first
    const staffUser = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (staffUser) {
      const principal: AuthenticatedPrincipal = {
        accountType: 'STAFF',
        id: staffUser.id,
        email: staffUser.email,
        firstName: staffUser.firstName,
        lastName: staffUser.lastName,
        role: staffUser.role,
        supabaseId: staffUser.supabaseId!,
        organizationId: staffUser.organizationId,
      };
      return done(null, principal);
    }

    // Try Patient
    const patient = await prisma.patient.findUnique({
      where: { supabaseId },
    });

    if (patient) {
      const principal: AuthenticatedPrincipal = {
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
      return done(null, principal);
    }

    // No matching record in either table — might be a new staff user
    // who signed up via Supabase directly. Auto-create a User record.
    if (payload.email) {
      const newUser = await prisma.user.create({
        data: {
          email: payload.email,
          supabaseId,
          firstName: (payload.user_metadata?.first_name as string) || null,
          lastName: (payload.user_metadata?.last_name as string) || null,
          role: 'USER',
        },
      });

      const principal: AuthenticatedPrincipal = {
        accountType: 'STAFF',
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        supabaseId: newUser.supabaseId!,
        organizationId: newUser.organizationId,
      };
      return done(null, principal);
    }

    return done(null, false, { message: 'No user found for this token' });
  } catch (error) {
    return done(error, false);
  }
});
