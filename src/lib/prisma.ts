import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.gbawvrwdgkbrlskegrtz:05241209Ab-1%2B@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
