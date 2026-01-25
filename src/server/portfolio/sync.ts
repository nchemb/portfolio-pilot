/**
 * Shared Portfolio Sync Function
 *
 * Server-only utility for syncing user portfolio data from Plaid
 * and writing user-level daily snapshots.
 *
 * Features:
 * - Sync locking to prevent concurrent syncs
 * - Freshness checks to avoid unnecessary API calls
 * - Rate-limit backoff handling
 * - Atomic snapshot upserts
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { syncPlaidAccounts } from "@/lib/plaid-sync"
import { getPortfolioSummary } from "@/lib/portfolio-summary"

// ===== ERROR TYPES =====

/** Base error class for sync errors with typed codes */
export class SyncError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = "SyncError"
  }
}

export type SyncErrorCode =
  | "RATE_LIMITED"
  | "SYNC_IN_PROGRESS"
  | "NO_PLAID_ITEMS"
  | "PLAID_ERROR"
  | "INTERNAL_ERROR"

/** Thrown when sync is rate-limited */
export class RateLimitedError extends SyncError {
  constructor(
    public readonly retryAfterSeconds: number,
    message = "Sync temporarily rate-limited"
  ) {
    super("RATE_LIMITED", message, { retryAfterSeconds })
  }
}

/** Thrown when another sync is already in progress */
export class SyncInProgressError extends SyncError {
  constructor(message = "Sync already in progress") {
    super("SYNC_IN_PROGRESS", message)
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Returns the start of day in UTC (00:00:00.000Z).
 * Used to normalize snapshot dates.
 */
export function startOfDayUTC(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

/**
 * Sleep for a given number of milliseconds.
 * Useful for throttling between user syncs.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if a lock is stale (older than 5 minutes).
 * Stale locks are automatically released.
 */
function isLockStale(lockAt: Date | null): boolean {
  if (!lockAt) return true
  const LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
  return Date.now() - lockAt.getTime() > LOCK_TIMEOUT_MS
}

/**
 * Check if last sync is fresh (within 15 minutes).
 */
function isSyncFresh(lastSyncAt: Date | null): boolean {
  if (!lastSyncAt) return false
  const FRESHNESS_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
  return Date.now() - lastSyncAt.getTime() < FRESHNESS_WINDOW_MS
}

/**
 * Convert dollars to cents (BigInt).
 */
function dollarsToCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100))
}

// ===== SYNC OPTIONS =====

export type SyncOptions = {
  /** Force sync even if fresh or rate-limited */
  force?: boolean
}

export type SyncResult = {
  snapshotId: string
  date: Date
  totalValueCents: bigint
  holdingsCount: number
  plaidCalled: boolean
}

// ===== MAIN SYNC FUNCTION =====

/**
 * Run portfolio sync for a user.
 *
 * This function:
 * 1. Checks rate-limit backoff (throws RateLimitedError if blocked)
 * 2. Checks lock status (throws SyncInProgressError if locked)
 * 3. Checks freshness (skips Plaid if recent sync, writes snapshot from cached data)
 * 4. Acquires lock
 * 5. Calls Plaid API via syncPlaidAccounts
 * 6. Computes portfolio summary
 * 7. Upserts UserDailySnapshot
 * 8. Releases lock in finally
 *
 * @param userId - Clerk user ID
 * @param opts - Optional sync options
 * @returns Sync result with snapshot details
 * @throws {RateLimitedError} If rate-limited
 * @throws {SyncInProgressError} If another sync is running
 * @throws {SyncError} For other errors
 */
export async function runPortfolioSyncForUser(
  userId: string,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  const { force = false } = opts
  const today = startOfDayUTC()
  let plaidCalled = false

  // 1. Get or create SyncState
  let syncState = await prisma.syncState.findUnique({
    where: { userId },
  })

  if (!syncState) {
    syncState = await prisma.syncState.create({
      data: { userId },
    })
  }

  // 2. Check rate-limit backoff (unless forced)
  if (!force && syncState.nextAllowedSyncAt) {
    const now = new Date()
    if (syncState.nextAllowedSyncAt > now) {
      const retryAfterSeconds = Math.ceil(
        (syncState.nextAllowedSyncAt.getTime() - now.getTime()) / 1000
      )
      throw new RateLimitedError(retryAfterSeconds)
    }
  }

  // 3. Check lock status (unless forced or lock is stale)
  if (!force && syncState.syncInProgress && !isLockStale(syncState.syncLockAt)) {
    throw new SyncInProgressError()
  }

  // 4. Check freshness (unless forced)
  const isFresh = !force && isSyncFresh(syncState.lastPlaidSyncAt)

  // 5. Check if we have an existing snapshot for today that we can return early
  if (isFresh) {
    const existingSnapshot = await prisma.userDailySnapshot.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (existingSnapshot) {
      // Fresh and snapshot exists - return without doing anything
      return {
        snapshotId: existingSnapshot.id,
        date: existingSnapshot.date,
        totalValueCents: existingSnapshot.totalValueCents,
        holdingsCount: existingSnapshot.holdingsCount,
        plaidCalled: false,
      }
    }
    // Fresh but no snapshot - we'll write one without calling Plaid
  }

  // 6. Acquire lock
  await prisma.syncState.update({
    where: { userId },
    data: {
      syncInProgress: true,
      syncLockAt: new Date(),
    },
  })

  try {
    // 7. Get user's Plaid-connected brokerage accounts
    const brokerageAccounts = await prisma.brokerageAccount.findMany({
      where: { userId },
      include: { plaidItem: true },
    })

    const plaidConnectedAccounts = brokerageAccounts.filter(
      (acc) => acc.plaidItem?.accessToken && acc.plaidAccountId
    )

    // 8. Call Plaid if not fresh (and we have connected accounts)
    if (!isFresh && plaidConnectedAccounts.length > 0) {
      try {
        await syncPlaidAccounts({
          userId,
          accounts: plaidConnectedAccounts,
          continueOnError: true, // Don't fail entire sync for one account
        })
        plaidCalled = true
      } catch (error) {
        // Check for rate limit error
        if (isPlaidRateLimitError(error)) {
          // Set backoff and release lock
          await prisma.syncState.update({
            where: { userId },
            data: {
              syncInProgress: false,
              syncLockAt: null,
              nextAllowedSyncAt: new Date(Date.now() + 60 * 1000), // 60 second backoff
              lastSyncStatus: "rate_limited",
              lastSyncError: "Plaid rate limit exceeded",
            },
          })
          throw new RateLimitedError(60, "Plaid rate limit exceeded")
        }

        // Log but continue - we can still write snapshot from cached holdings
        console.error("[runPortfolioSyncForUser] Plaid sync error:", error)
      }
    }

    // 9. Get portfolio summary (uses existing holdings in DB)
    const summary = await getPortfolioSummary(userId)

    // 10. Build allocation JSON
    const allocationJson: Record<string, number> = {}
    for (const [bucket, data] of Object.entries(summary.allocation)) {
      allocationJson[bucket] = data.pct
    }

    // 11. Compute daily change from previous snapshot
    const previousSnapshot = await prisma.userDailySnapshot.findFirst({
      where: {
        userId,
        date: { lt: today },
      },
      orderBy: { date: "desc" },
    })

    const totalValueCents = dollarsToCents(summary.totalValue)
    const dailyChangeCents = previousSnapshot
      ? totalValueCents - previousSnapshot.totalValueCents
      : null

    // 12. Upsert UserDailySnapshot
    const snapshot = await prisma.userDailySnapshot.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        totalValueCents,
        dailyChangeCents,
        allocationJson,
        holdingsCount: summary.holdings.length,
        updatedAt: new Date(),
      },
      create: {
        userId,
        date: today,
        totalValueCents,
        dailyChangeCents,
        allocationJson,
        holdingsCount: summary.holdings.length,
      },
    })

    // 13. Update SyncState success
    await prisma.syncState.update({
      where: { userId },
      data: {
        syncInProgress: false,
        syncLockAt: null,
        lastPlaidSyncAt: plaidCalled ? new Date() : syncState.lastPlaidSyncAt,
        nextAllowedSyncAt: null, // Clear any backoff
        lastSyncStatus: "success",
        lastSyncError: null,
      },
    })

    return {
      snapshotId: snapshot.id,
      date: snapshot.date,
      totalValueCents: snapshot.totalValueCents,
      holdingsCount: snapshot.holdingsCount,
      plaidCalled,
    }
  } catch (error) {
    // Handle errors that weren't already handled
    if (error instanceof SyncError) {
      throw error // Re-throw typed errors
    }

    // 14. Update SyncState with error
    await prisma.syncState.update({
      where: { userId },
      data: {
        syncInProgress: false,
        syncLockAt: null,
        lastSyncStatus: "error",
        lastSyncError:
          error instanceof Error ? error.message : "Unknown error during sync",
      },
    })

    throw new SyncError(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Unknown error during sync"
    )
  }
}

/**
 * Check if an error is a Plaid rate limit error (HTTP 429).
 */
function isPlaidRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  // Check for Plaid error structure
  const plaidError = error as {
    response?: {
      status?: number
      data?: {
        error_code?: string
      }
    }
  }

  // HTTP 429 status
  if (plaidError.response?.status === 429) return true

  // Plaid-specific rate limit error codes
  const errorCode = plaidError.response?.data?.error_code
  if (errorCode === "RATE_LIMIT_EXCEEDED" || errorCode === "TOO_MANY_REQUESTS") {
    return true
  }

  return false
}

/**
 * Get the current sync state for a user.
 * Useful for UI to show sync status.
 */
export async function getSyncState(userId: string) {
  return prisma.syncState.findUnique({
    where: { userId },
  })
}
