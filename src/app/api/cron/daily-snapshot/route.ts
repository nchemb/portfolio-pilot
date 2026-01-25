/**
 * Cron API Route: Daily Snapshot
 *
 * Triggered by a cron job (e.g., Vercel Cron or external scheduler).
 * Iterates through all users with Plaid connections and creates
 * daily snapshots of their portfolio.
 *
 * Security: Requires CRON_SECRET in Authorization header.
 *
 * Usage:
 * ```bash
 * curl -X POST http://localhost:3000/api/cron/daily-snapshot \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 * ```
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  runPortfolioSyncForUser,
  sleep,
  SyncError,
} from "@/server/portfolio/sync"

// ===== TYPES =====

type CronResult = {
  processed: number
  succeeded: number
  failed: number
  failures: Array<{ userId: string; error: string }>
  startedAt: string
  completedAt: string
  durationMs: number
}

// ===== SECURITY =====

/**
 * Verify the cron secret from Authorization header.
 * Returns true if valid, false otherwise.
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[cron/daily-snapshot] CRON_SECRET not configured")
    return false
  }

  const authHeader = request.headers.get("authorization")

  if (!authHeader) {
    return false
  }

  // Expected format: "Bearer <secret>"
  const [scheme, token] = authHeader.split(" ")

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return false
  }

  return token === cronSecret
}

// ===== MAIN HANDLER =====

export async function POST(request: NextRequest) {
  const startedAt = new Date()

  // 1. Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const result: CronResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    failures: [],
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
  }

  try {
    // 2. Get all users with at least one Plaid item connected
    const usersWithPlaid = await prisma.user.findMany({
      where: {
        plaidItems: {
          some: {}, // Has at least one PlaidItem
        },
      },
      select: {
        id: true,
      },
    })

    console.log(
      `[cron/daily-snapshot] Found ${usersWithPlaid.length} users with Plaid connections`
    )

    // 3. Process each user
    for (const user of usersWithPlaid) {
      result.processed++

      try {
        // Force sync to ensure we get fresh data
        const syncResult = await runPortfolioSyncForUser(user.id, { force: true })

        console.log(
          `[cron/daily-snapshot] User ${user.id.slice(0, 8)}... synced:`,
          {
            snapshotId: syncResult.snapshotId,
            plaidCalled: syncResult.plaidCalled,
            holdingsCount: syncResult.holdingsCount,
          }
        )

        result.succeeded++
      } catch (error) {
        // Log error (never log access tokens)
        const errorMessage =
          error instanceof SyncError
            ? `${error.code}: ${error.message}`
            : error instanceof Error
              ? error.message
              : "Unknown error"

        console.error(
          `[cron/daily-snapshot] User ${user.id.slice(0, 8)}... failed:`,
          errorMessage
        )

        result.failed++
        result.failures.push({
          userId: user.id.slice(0, 8) + "...", // Truncate for security
          error: errorMessage,
        })
      }

      // 4. Throttle between users (250-500ms random delay)
      // Skip delay for the last user
      if (result.processed < usersWithPlaid.length) {
        const delayMs = 250 + Math.random() * 250
        await sleep(delayMs)
      }
    }

    const completedAt = new Date()
    result.completedAt = completedAt.toISOString()
    result.durationMs = completedAt.getTime() - startedAt.getTime()

    console.log("[cron/daily-snapshot] Completed:", {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      durationMs: result.durationMs,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("[cron/daily-snapshot] Unexpected error:", error)

    const completedAt = new Date()
    result.completedAt = completedAt.toISOString()
    result.durationMs = completedAt.getTime() - startedAt.getTime()

    return NextResponse.json(
      {
        ...result,
        error: "Cron job failed unexpectedly",
      },
      { status: 500 }
    )
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  )
}
