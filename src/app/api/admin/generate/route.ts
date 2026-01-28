/**
 * Admin API: Generate Tweets
 *
 * Generates 3 new tweets using AI and adds them to the queue.
 * Protected by auth - only accessible to authenticated users.
 */

import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { generateDailyContent } from "@/server/distribution/content-generator"

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await generateDailyContent()

    if (result.generated === 0 && result.errors.length > 0) {
      return NextResponse.json(
        { error: result.errors[0], errors: result.errors },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      generated: result.generated,
      errors: result.errors,
    })
  } catch (error) {
    console.error("[api/admin/generate] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate content" },
      { status: 500 }
    )
  }
}
