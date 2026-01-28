/**
 * Cron API Route: Generate Content
 *
 * Triggered daily by Vercel Cron (6 AM UTC).
 * Generates tweets and threads using AI, storing them in the content queue
 * with "pending" status for review.
 *
 * Security: Requires CRON_SECRET in Authorization header.
 *
 * Usage:
 * ```bash
 * curl -X POST http://localhost:3000/api/cron/generate-content \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 * ```
 */

import { NextRequest, NextResponse } from "next/server"
import { generateDailyContent } from "@/server/distribution/content-generator"

// ===== TYPES =====

type CronResult = {
  generated: number
  errors: string[]
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
    console.error("[cron/generate-content] CRON_SECRET not configured")
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

  const result: CronResult = {
    generated: 0,
    errors: [],
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
  }

  try {
    console.log("[cron/generate-content] Starting content generation...")

    // 2. Generate daily content
    const generationResult = await generateDailyContent()

    result.generated = generationResult.generated
    result.errors = generationResult.errors

    const completedAt = new Date()
    result.completedAt = completedAt.toISOString()
    result.durationMs = completedAt.getTime() - startedAt.getTime()

    console.log("[cron/generate-content] Completed:", {
      generated: result.generated,
      errors: result.errors.length,
      durationMs: result.durationMs,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("[cron/generate-content] Unexpected error:", error)

    const completedAt = new Date()
    result.completedAt = completedAt.toISOString()
    result.durationMs = completedAt.getTime() - startedAt.getTime()
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : "Unknown"}`
    )

    return NextResponse.json(
      {
        ...result,
        error: "Content generation failed unexpectedly",
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
