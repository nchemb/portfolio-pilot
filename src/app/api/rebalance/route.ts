import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { buildMonthlyRebalancePlan, type RebalancerInput } from "@/lib/rebalancer"
import { getPostHogClient } from "@/lib/posthog-server"

/**
 * POST /api/rebalance
 *
 * Generates a deterministic monthly contribution or cash investment rebalance plan.
 *
 * Request body:
 * {
 *   mode?: "monthly_contribution" | "invest_cash_balance" (default: "monthly_contribution")
 *   monthlyContribution?: number (required for monthly_contribution mode, > 0)
 *   maxInvestAmount?: number (optional cap when investing cash)
 *   preferInvestingCash?: boolean (default: true)
 *   minBuyAmount?: number (default: 25)
 * }
 *
 * Returns: RebalancePlan (see rebalancer.ts for full structure)
 */
export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    const {
      mode = "monthly_contribution",
      monthlyContribution,
      maxInvestAmount,
      preferInvestingCash,
      minBuyAmount,
    } = body

    // Validation
    if (mode === "monthly_contribution") {
      if (!monthlyContribution || typeof monthlyContribution !== "number") {
        return NextResponse.json(
          { error: "monthlyContribution is required and must be a number for monthly_contribution mode" },
          { status: 400 }
        )
      }

      if (monthlyContribution <= 0) {
        return NextResponse.json(
          { error: "monthlyContribution must be greater than 0" },
          { status: 400 }
        )
      }
    }

    if (mode !== "monthly_contribution" && mode !== "invest_cash_balance") {
      return NextResponse.json(
        { error: "mode must be 'monthly_contribution' or 'invest_cash_balance'" },
        { status: 400 }
      )
    }

    const input: RebalancerInput = {
      mode,
      monthlyContribution,
      maxInvestAmount,
      preferInvestingCash: preferInvestingCash ?? true,
      minBuyAmount: minBuyAmount ?? 25,
    }

    const plan = await buildMonthlyRebalancePlan(userId, input)

    // Track rebalance plan generation with PostHog
    const posthog = getPostHogClient()
    posthog.capture({
      distinctId: userId,
      event: "rebalance_plan_generated",
      properties: {
        mode,
        monthly_contribution: monthlyContribution ?? null,
        max_invest_amount: maxInvestAmount ?? null,
        suggestions_count: plan.suggestions?.length ?? 0,
        invest_amount: plan.investAmount ?? 0,
      },
    })

    return NextResponse.json(plan)
  } catch (error) {
    console.error("Rebalance API error:", error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
