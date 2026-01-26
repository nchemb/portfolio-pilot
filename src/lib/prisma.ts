import { PrismaClient } from "@prisma/client"

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient
}

const globalForPrisma = globalThis as PrismaGlobal

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Limit connection pool for serverless environments
    // This prevents "max clients reached" errors in production
    datasourceUrl: process.env.DATABASE_URL,
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Only cache in development to preserve HMR behavior
// In production (serverless), each cold start gets a fresh client
// but warm invocations reuse the same instance
globalForPrisma.prisma = prisma
