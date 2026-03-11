import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'

// En @prisma/adapter-neon v7, PrismaNeon es una factory que recibe { connectionString }
// y crea el Pool internamente. NO se le pasa un Pool directamente.
// Usar DIRECT_URL (sin pgbouncer) para el driver WebSocket de Neon.

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
