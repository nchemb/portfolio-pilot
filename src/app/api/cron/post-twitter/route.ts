/**
 * Cron API Route: Post to Twitter
 *
 * Triggered 3x daily by Vercel Cron (8 AM, 1 PM, 7 PM UTC).
 * Posts approved content from the queue to Twitter.
 *
 * Security: Requires CRON_SECRET in Authorization header.
 *
 * Usage:
 * ```bash
 * curl -X POST http://localhost:3000/api/cron/post-twitter \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 * ```
 */

import { NextRequest, NextResponse } from "next/server"
import {
  postNextApprovedContent,
  getTwitterChannelStatus,
} from "@/server/distribution/twitter-poster"

// ===== TYPES =====

type CronResult = {
  posted: boolean
  contentId?: string
  tweetId?: string
  error?: string
  channelStatus: {
    enabled: boolean
    postsToday: number
    dailyLimit: number
  }
  startedAt: string
  completedAt: string
  durationMs: number
}

// ===== SECURITY =====

/**
 * Verify the cron secret from Authorization header.
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[cron/post-twitter] CRON_SECRET not configured")
    return false
  }

  const authHeader = request.headers.get("authorization")

  if (!authHeader) {
    return false
  }

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[cron/post-twitter] Starting Twitter posting...")

    // 2. Get channel status
    const status = await getTwitterChannelStatus()

    // 3. Attempt to post
    const postResult = await postNextApprovedContent()

    const completedAt = new Date()

    const result: CronResult = {
      posted: postResult.posted,
      contentId: postResult.contentId,
      tweetId: postResult.tweetId,
      error: postResult.error,
      channelStatus: {
        enabled: status.enabled,
        postsToday: postResult.posted ? status.postsToday + 1 : status.postsToday,
        dailyLimit: status.dailyLimit,
      },
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
    }

    console.log("[cron/post-twitter] Completed:", {
      posted: result.posted,
      contentId: result.contentId,
      tweetId: result.tweetId,
      error: result.error,
      durationMs: result.durationMs,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("[cron/post-twitter] Unexpected error:", error)

    const completedAt = new Date()

    return NextResponse.json(
      {
        posted: false,
        error: `Unexpected error: ${error instanceof Error ? error.message : "Unknown"}`,
        channelStatus: {
          enabled: false,
          postsToday: 0,
          dailyLimit: 3,
        },
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
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
