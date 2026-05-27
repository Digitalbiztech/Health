import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Singleton Prisma client — reuses the same connection pool across hot-reloads
 * during development. In production there's only one instance anyway.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
