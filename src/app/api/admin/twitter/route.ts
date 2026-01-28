/**
 * Admin API: Twitter Channel Management
 *
 * Endpoints for managing Twitter posting settings.
 */

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import {
  getTwitterChannelStatus,
  setTwitterEnabled,
} from "@/server/distribution/twitter-poster"

// ===== GET: Get Twitter channel status =====

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = await getTwitterChannelStatus()

  return NextResponse.json({
    ...status,
    apiKeyConfigured: !!process.env.TWITTER_API_IO_KEY,
  })
}

// ===== POST: Update Twitter settings =====

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { enabled } = body

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 }
    )
  }

  await setTwitterEnabled(enabled)

  return NextResponse.json({ success: true, enabled })
}
