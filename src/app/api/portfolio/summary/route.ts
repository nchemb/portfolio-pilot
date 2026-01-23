import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { getPortfolioSummary } from "@/lib/portfolio-summary"

/**
 * GET /api/portfolio/summary
 *
 * Returns complete portfolio summary (truth layer).
 *
 * Response: PortfolioSummary (see portfolio-summary.ts for full structure)
 */
export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await getPortfolioSummary(userId)
    return NextResponse.json(summary)
  } catch (error) {
    console.error("Portfolio summary API error:", error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
