/** Account type discriminator — maps to separate DB tables (User vs Patient) */
export const ACCOUNT_TYPE = {
  STAFF: 'STAFF',
  PATIENT: 'PATIENT',
} as const;

export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE];

/** Staff role levels (mirrors Prisma Role enum) */
export const STAFF_ROLE = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
} as const;

export type StaffRole = (typeof STAFF_ROLE)[keyof typeof STAFF_ROLE];

/** Token / session constants */
export const AUTH = {
  /** Header name for Bearer tokens */
  HEADER: 'authorization',
  /** JWT algorithm used by Supabase */
  ALGORITHM: 'HS256' as const,
  /** Cookie name if we ever switch to cookie-based auth */
  COOKIE_NAME: 'sb-access-token',
};
