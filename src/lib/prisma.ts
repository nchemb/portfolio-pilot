import { PrismaClient } from "@prisma/client"

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient
}

const globalForPrisma = globalThis as PrismaGlobal

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

// Always store globally to prevent connection pool exhaustion in serverless
globalForPrisma.prisma = prisma
