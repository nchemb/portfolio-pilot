#!/usr/bin/env tsx
/**
 * Smoke test for the rebalancer engine
 *
 * Usage:
 *   npx tsx scripts/test-rebalancer.ts <userId> [monthlyContribution]
 *
 * Examples:
 *   npx tsx scripts/test-rebalancer.ts user_abc123 1000
 *   npx tsx scripts/test-rebalancer.ts user_abc123  (tests invest_cash_balance mode only)
 */

import { buildMonthlyRebalancePlan } from "../src/lib/rebalancer"
import { prisma } from "../src/lib/prisma"

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

async function testMonthlyContribution(userId: string, contribution: number) {
  console.log("\n" + "=".repeat(80))
  console.log("TEST: MONTHLY CONTRIBUTION MODE")
  console.log("=".repeat(80))
  console.log(`User ID: ${userId}`)
  console.log(`Monthly Contribution: ${formatCurrency(contribution)}`)
  console.log()

  const plan = await buildMonthlyRebalancePlan(userId, {
    mode: "monthly_contribution",
    monthlyContribution: contribution,
    preferInvestingCash: true,
    minBuyAmount: 25,
  })

  console.log("===== PLAN SUMMARY =====")
  console.log(plan.planSummary)
  console.log()

  console.log("===== CURRENT ALLOCATION =====")
  console.log(`Total Value: ${formatCurrency(plan.currentTotalValue)}`)
  console.log(`  US Equity:       ${formatPct(plan.currentAllocation.us_equity)}`)
  console.log(`  Intl Equity:     ${formatPct(plan.currentAllocation.intl_equity)}`)
  console.log(`  Bonds:           ${formatPct(plan.currentAllocation.bonds)}`)
  console.log(`  Cash:            ${formatPct(plan.currentAllocation.cash)}`)
  console.log(`  Other:           ${formatPct(plan.currentAllocation.other)}`)
  console.log()

  console.log("===== TARGET ALLOCATION =====")
  console.log(`  US Equity:       ${formatPct(plan.targetAllocation.us_equity)}`)
  console.log(`  Intl Equity:     ${formatPct(plan.targetAllocation.intl_equity)}`)
  console.log(`  Bonds:           ${formatPct(plan.targetAllocation.bonds)}`)
  console.log(`  Cash:            ${formatPct(plan.targetAllocation.cash)}`)
  console.log(`  Other:           ${formatPct(plan.targetAllocation.other)}`)
  console.log()

  console.log("===== SUGGESTED BUYS =====")
  if (plan.suggestions.length === 0) {
    console.log("  No suggestions (all buckets at or above target)")
  } else {
    for (const suggestion of plan.suggestions) {
      console.log(`  ${suggestion.bucket.toUpperCase()}:`)
      console.log(`    Current:         ${formatPct(suggestion.currentPct)}`)
      console.log(`    Target:          ${formatPct(suggestion.targetPct)}`)
      console.log(`    Gap (pct):       ${formatPct(suggestion.gapToTargetPct)}`)
      console.log(`    Gap (dollar):    ${formatCurrency(suggestion.gapToTargetDollar)}`)
      console.log(`    Buy Amount:      ${formatCurrency(suggestion.recommendedBuyAmount)}`)
      console.log(`    Reason:          ${suggestion.bucketReason}`)
      console.log(`    Tickers:`)
      for (const ticker of suggestion.recommendedTickers) {
        console.log(
          `      ${ticker.ticker.padEnd(8)} (${ticker.reason.padEnd(20)}, weight: ${(ticker.weight * 100).toFixed(0)}%)`
        )
      }
      console.log()
    }
  }

  console.log("===== PROJECTED ALLOCATION (after contribution) =====")
  console.log(`Total Value: ${formatCurrency(plan.projectedTotalValue)}`)
  console.log(`  US Equity:       ${formatPct(plan.projectedAllocation.us_equity)}`)
  console.log(`  Intl Equity:     ${formatPct(plan.projectedAllocation.intl_equity)}`)
  console.log(`  Bonds:           ${formatPct(plan.projectedAllocation.bonds)}`)
  console.log(`  Cash:            ${formatPct(plan.projectedAllocation.cash)}`)
  console.log(`  Other:           ${formatPct(plan.projectedAllocation.other)}`)
  console.log()

  if (plan.warnings.length > 0) {
    console.log("===== WARNINGS =====")
    for (const warning of plan.warnings) {
      console.log(`  ⚠️  ${warning}`)
    }
    console.log()
  }

  console.log("===== VERIFICATION =====")
  const totalBuyAmount = plan.suggestions.reduce((sum, s) => sum + s.recommendedBuyAmount, 0)
  const diff = Math.abs(totalBuyAmount - plan.investAmount)
  console.log(`Total Suggested Buys: ${formatCurrency(totalBuyAmount)}`)
  console.log(`Invest Amount:        ${formatCurrency(plan.investAmount)}`)
  console.log(`Difference:           ${formatCurrency(diff)}`)
  if (diff > 0.01) {
    console.log("  ⚠️  WARNING: Buy amounts do not match invest amount!")
    return false
  } else {
    console.log("  ✅ Buy amounts match invest amount (within 1 cent)")
    return true
  }
}

async function testInvestCashBalance(userId: string) {
  console.log("\n" + "=".repeat(80))
  console.log("TEST: INVEST CASH BALANCE MODE")
  console.log("=".repeat(80))
  console.log(`User ID: ${userId}`)
  console.log()

  const plan = await buildMonthlyRebalancePlan(userId, {
    mode: "invest_cash_balance",
    preferInvestingCash: false, // don't prefer cash in this mode
    minBuyAmount: 25,
  })

  console.log("===== PLAN SUMMARY =====")
  console.log(plan.planSummary)
  console.log()

  console.log(`Available Cash: ${formatCurrency(plan.currentAllocation.cash * plan.currentTotalValue)}`)
  console.log(`Invest Amount:  ${formatCurrency(plan.investAmount)}`)
  console.log()

  if (plan.investAmount === 0) {
    console.log("No cash balance available to invest.")
    return true
  }

  console.log("===== CURRENT ALLOCATION =====")
  console.log(`Total Value: ${formatCurrency(plan.currentTotalValue)}`)
  console.log(`  US Equity:       ${formatPct(plan.currentAllocation.us_equity)}`)
  console.log(`  Intl Equity:     ${formatPct(plan.currentAllocation.intl_equity)}`)
  console.log(`  Bonds:           ${formatPct(plan.currentAllocation.bonds)}`)
  console.log(`  Cash:            ${formatPct(plan.currentAllocation.cash)}`)
  console.log(`  Other:           ${formatPct(plan.currentAllocation.other)}`)
  console.log()

  console.log("===== TARGET ALLOCATION =====")
  console.log(`  US Equity:       ${formatPct(plan.targetAllocation.us_equity)}`)
  console.log(`  Intl Equity:     ${formatPct(plan.targetAllocation.intl_equity)}`)
  console.log(`  Bonds:           ${formatPct(plan.targetAllocation.bonds)}`)
  console.log(`  Cash:            ${formatPct(plan.targetAllocation.cash)}`)
  console.log(`  Other:           ${formatPct(plan.targetAllocation.other)}`)
  console.log()

  console.log("===== SUGGESTED BUYS =====")
  if (plan.suggestions.length === 0) {
    console.log("  No suggestions")
  } else {
    for (const suggestion of plan.suggestions) {
      console.log(`  ${suggestion.bucket.toUpperCase()}:`)
      console.log(`    Buy Amount:      ${formatCurrency(suggestion.recommendedBuyAmount)}`)
      console.log(`    Reason:          ${suggestion.bucketReason}`)
      console.log(`    Tickers:`)
      for (const ticker of suggestion.recommendedTickers) {
        console.log(
          `      ${ticker.ticker.padEnd(8)} (${ticker.reason.padEnd(20)}, weight: ${(ticker.weight * 100).toFixed(0)}%)`
        )
      }
      console.log()
    }
  }

  console.log("===== PROJECTED ALLOCATION (after investing cash) =====")
  console.log(`Total Value: ${formatCurrency(plan.projectedTotalValue)}`)
  console.log(`  US Equity:       ${formatPct(plan.projectedAllocation.us_equity)}`)
  console.log(`  Intl Equity:     ${formatPct(plan.projectedAllocation.intl_equity)}`)
  console.log(`  Bonds:           ${formatPct(plan.projectedAllocation.bonds)}`)
  console.log(`  Cash:            ${formatPct(plan.projectedAllocation.cash)}`)
  console.log(`  Other:           ${formatPct(plan.projectedAllocation.other)}`)
  console.log()

  if (plan.warnings.length > 0) {
    console.log("===== WARNINGS =====")
    for (const warning of plan.warnings) {
      console.log(`  ⚠️  ${warning}`)
    }
    console.log()
  }

  console.log("===== VERIFICATION =====")
  const totalBuyAmount = plan.suggestions.reduce((sum, s) => sum + s.recommendedBuyAmount, 0)
  const diff = Math.abs(totalBuyAmount - plan.investAmount)
  console.log(`Total Suggested Buys: ${formatCurrency(totalBuyAmount)}`)
  console.log(`Invest Amount:        ${formatCurrency(plan.investAmount)}`)
  console.log(`Difference:           ${formatCurrency(diff)}`)
  if (diff > 0.01) {
    console.log("  ⚠️  WARNING: Buy amounts do not match invest amount!")
    return false
  } else {
    console.log("  ✅ Buy amounts match invest amount (within 1 cent)")
    return true
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error("Usage: npx tsx scripts/test-rebalancer.ts <userId> [monthlyContribution]")
    console.error("Examples:")
    console.error("  npx tsx scripts/test-rebalancer.ts user_abc123 1000")
    console.error("  npx tsx scripts/test-rebalancer.ts user_abc123  (tests invest_cash_balance mode only)")
    process.exit(1)
  }

  const userId = args[0]
  const monthlyContribution = args.length >= 2 ? parseFloat(args[1]) : null

  console.log("===== REBALANCER SMOKE TEST =====")

  const results: boolean[] = []

  try {
    // Test monthly contribution mode if provided
    if (monthlyContribution !== null) {
      if (isNaN(monthlyContribution) || monthlyContribution <= 0) {
        console.error("Error: monthlyContribution must be a positive number")
        process.exit(1)
      }
      const success = await testMonthlyContribution(userId, monthlyContribution)
      results.push(success)
    }

    // Test invest cash balance mode
    const success = await testInvestCashBalance(userId)
    results.push(success)

    console.log("\n" + "=".repeat(80))
    console.log("ALL TESTS SUMMARY")
    console.log("=".repeat(80))
    const allPassed = results.every((r) => r)
    if (allPassed) {
      console.log("✅ All tests passed!")
    } else {
      console.log("⚠️  Some tests failed. Review output above.")
      await prisma.$disconnect()
      process.exit(1)
    }
  } catch (error) {
    console.error("\n" + "=".repeat(80))
    console.error("ERROR")
    console.error("=".repeat(80))
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
      console.error(error.stack)
    } else {
      console.error("Unknown error:", error)
    }
    await prisma.$disconnect()
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
