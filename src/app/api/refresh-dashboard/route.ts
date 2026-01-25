/**
 * Refresh Dashboard API Route
 *
 * Triggers a full portfolio sync for the current user.
 * Uses the shared sync function with proper locking and rate limiting.
 */

import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

import {
  runPortfolioSyncForUser,
  RateLimitedError,
  SyncInProgressError,
  SyncError,
} from "@/server/portfolio/sync"

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Force sync to always get fresh Plaid data when user clicks refresh
    const result = await runPortfolioSyncForUser(userId, { force: true })

    revalidatePath("/dashboard")

    return NextResponse.json({
      ok: true,
      snapshotId: result.snapshotId,
      date: result.date.toISOString(),
      plaidCalled: result.plaidCalled,
    })
  } catch (error) {
    // Handle typed sync errors with appropriate HTTP status codes

    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 }
      )
    }

    if (error instanceof SyncInProgressError) {
      return NextResponse.json(
        {
          error: "sync_in_progress",
          message: error.message,
        },
        { status: 409 }
      )
    }

    if (error instanceof SyncError) {
      console.error("[refresh-dashboard] Sync error:", error.code, error.message)
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: 500 }
      )
    }

    // Unknown error
    console.error("[refresh-dashboard] Unexpected error:", error)
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Unable to refresh portfolio",
      },
      { status: 500 }
    )
  }
}
