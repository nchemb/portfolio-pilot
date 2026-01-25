/**
 * AI Usage Limits
 *
 * Server-only utilities for enforcing daily AI request limits.
 * Uses atomic database operations to prevent race conditions.
 */

import { prisma } from "@/lib/prisma"

// ===== ERROR TYPES =====

/** Thrown when AI daily limit is exceeded */
export class AiDailyLimitError extends Error {
  constructor(
    public readonly resetAt: Date,
    public readonly currentRequests: number,
    public readonly limit: number
  ) {
    super(`Daily AI limit exceeded (${currentRequests}/${limit}). Resets at ${resetAt.toISOString()}`)
    this.name = "AiDailyLimitError"
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Returns the start of day in UTC (00:00:00.000Z).
 */
function startOfDayUTC(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

/**
 * Returns the start of tomorrow in UTC.
 */
function tomorrowStartUTC(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  )
}

// ===== MAIN FUNCTIONS =====

/**
 * Enforce AI daily request limit for a user.
 *
 * This function:
 * 1. Computes start-of-day UTC
 * 2. Upserts row in AiUsageDaily for (userId, date)
 * 3. Atomically increments requests if < limit
 * 4. Throws AiDailyLimitError if limit exceeded
 *
 * Uses atomic increment to prevent race conditions in concurrent requests.
 *
 * @param userId - Clerk user ID
 * @param limit - Maximum requests per day (default: 25)
 * @throws {AiDailyLimitError} If daily limit exceeded
 */
export async function enforceAiDailyLimit(
  userId: string,
  limit: number = 25
): Promise<void> {
  const today = startOfDayUTC()

  // First, try to find existing record
  const existing = await prisma.aiUsageDaily.findUnique({
    where: { userId_date: { userId, date: today } },
  })

  if (existing) {
    // Check if already at or over limit
    if (existing.requests >= limit) {
      throw new AiDailyLimitError(tomorrowStartUTC(), existing.requests, limit)
    }

    // Atomically increment using conditional update
    // This prevents race conditions
    const updated = await prisma.aiUsageDaily.updateMany({
      where: {
        userId,
        date: today,
        requests: { lt: limit }, // Only update if still under limit
      },
      data: {
        requests: { increment: 1 },
        updatedAt: new Date(),
      },
    })

    // If no rows were updated, another request beat us to the limit
    if (updated.count === 0) {
      const current = await prisma.aiUsageDaily.findUnique({
        where: { userId_date: { userId, date: today } },
      })
      throw new AiDailyLimitError(
        tomorrowStartUTC(),
        current?.requests ?? limit,
        limit
      )
    }

    return
  }

  // No existing record - create one with requests = 1
  try {
    await prisma.aiUsageDaily.create({
      data: {
        userId,
        date: today,
        requests: 1,
      },
    })
  } catch (error) {
    // Handle race condition: another request created the record
    // Check if it's a unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      // Retry with update path
      await enforceAiDailyLimit(userId, limit)
      return
    }
    throw error
  }
}

/**
 * Record token usage for a user (optional tracking).
 * Does not enforce any limits, just records for analytics.
 *
 * @param userId - Clerk user ID
 * @param tokens - Number of tokens used
 */
export async function recordTokenUsage(
  userId: string,
  tokens: number
): Promise<void> {
  const today = startOfDayUTC()

  await prisma.aiUsageDaily.upsert({
    where: { userId_date: { userId, date: today } },
    update: {
      tokens: { increment: tokens },
      updatedAt: new Date(),
    },
    create: {
      userId,
      date: today,
      requests: 0, // Don't count as a request
      tokens,
    },
  })
}

/**
 * Get current AI usage for a user today.
 * Useful for showing remaining requests in UI.
 *
 * @param userId - Clerk user ID
 * @param limit - Daily limit to calculate remaining
 */
export async function getAiUsageToday(
  userId: string,
  limit: number = 25
): Promise<{
  requests: number
  tokens: number
  remaining: number
  resetAt: Date
}> {
  const today = startOfDayUTC()

  const usage = await prisma.aiUsageDaily.findUnique({
    where: { userId_date: { userId, date: today } },
  })

  const requests = usage?.requests ?? 0
  const tokens = usage?.tokens ?? 0

  return {
    requests,
    tokens,
    remaining: Math.max(0, limit - requests),
    resetAt: tomorrowStartUTC(),
  }
}
