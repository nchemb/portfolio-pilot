#!/usr/bin/env tsx
/**
 * Smoke test for the portfolio summary truth layer
 *
 * Usage:
 *   npx tsx scripts/test-portfolio-summary.ts <userId>
 *
 * Example:
 *   npx tsx scripts/test-portfolio-summary.ts user_abc123
 */

import { getPortfolioSummary } from "../src/lib/portfolio-summary"
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

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error("Usage: npx tsx scripts/test-portfolio-summary.ts <userId>")
    console.error("Example: npx tsx scripts/test-portfolio-summary.ts user_abc123")
    process.exit(1)
  }

  const userId = args[0]

  console.log("===== PORTFOLIO SUMMARY TEST =====")
  console.log(`User ID: ${userId}`)
  console.log()

  try {
    const summary = await getPortfolioSummary(userId)

    console.log("===== PORTFOLIO OVERVIEW =====")
    console.log(`As of: ${new Date(summary.asOf).toLocaleString()}`)
    console.log(`Total Value: ${formatCurrency(summary.totalValue)}`)
    console.log()

    console.log("===== ALLOCATION =====")
    console.log(`  US Equity:       ${formatCurrency(summary.allocation.us_equity.dollarValue).padStart(15)} (${formatPct(summary.allocation.us_equity.pct)})`)
    console.log(`  Intl Equity:     ${formatCurrency(summary.allocation.intl_equity.dollarValue).padStart(15)} (${formatPct(summary.allocation.intl_equity.pct)})`)
    console.log(`  Bonds:           ${formatCurrency(summary.allocation.bonds.dollarValue).padStart(15)} (${formatPct(summary.allocation.bonds.pct)})`)
    console.log(`  Cash:            ${formatCurrency(summary.allocation.cash.dollarValue).padStart(15)} (${formatPct(summary.allocation.cash.pct)})`)
    console.log(`  Other:           ${formatCurrency(summary.allocation.other.dollarValue).padStart(15)} (${formatPct(summary.allocation.other.pct)})`)
    console.log()

    console.log("===== ALL HOLDINGS =====")
    if (summary.holdings.length === 0) {
      console.log("  No holdings found")
    } else {
      for (const holding of summary.holdings) {
        const ticker = holding.ticker || "__NO_TICKER__"
        const value = formatCurrency(holding.value)
        const pct = formatPct(holding.pctOfPortfolio)
        const assetClass = holding.effectiveAssetClass.padEnd(12)
        const source = `(${holding.classificationSource})`.padEnd(14)
        console.log(`  ${ticker.padEnd(10)} ${value.padStart(15)} ${pct.padStart(8)} ${assetClass} ${source}`)
      }
    }
    console.log()

    console.log("===== ACCOUNTS =====")
    if (summary.accounts.length === 0) {
      console.log("  No accounts found")
    } else {
      for (const account of summary.accounts) {
        const institutionName = account.institution || "Unknown"
        const accountName = account.name || "Account"
        const mask = account.mask ? `****${account.mask}` : ""
        console.log(`  ${institutionName} - ${accountName} ${mask}`)
        console.log(`    Total: ${formatCurrency(account.totalValue)}`)
        console.log(`    Allocation:`)
        console.log(`      US Equity:   ${formatPct(account.allocation.us_equity.pct).padStart(8)}`)
        console.log(`      Intl Equity: ${formatPct(account.allocation.intl_equity.pct).padStart(8)}`)
        console.log(`      Bonds:       ${formatPct(account.allocation.bonds.pct).padStart(8)}`)
        console.log(`      Cash:        ${formatPct(account.allocation.cash.pct).padStart(8)}`)
        console.log(`      Other:       ${formatPct(account.allocation.other.pct).padStart(8)}`)
        console.log()
      }
    }

    console.log("===== CLASSIFICATION STATS =====")
    console.log(`  Override:        ${summary.classificationStats.countBySource.override}`)
    console.log(`  Fund Profile:    ${summary.classificationStats.countBySource.fundProfile}`)
    console.log(`  Security Type:   ${summary.classificationStats.countBySource.securityType}`)
    console.log(`  Holding:         ${summary.classificationStats.countBySource.holding}`)
    console.log(`  Fallback:        ${summary.classificationStats.countBySource.fallback}`)
    console.log(`  Needs Review:    ${summary.classificationStats.needsReviewCount}`)
    console.log()

    if (summary.warnings.length > 0) {
      console.log("===== WARNINGS =====")
      for (const warning of summary.warnings) {
        console.log(`  ⚠️  ${warning}`)
      }
      console.log()
    }

    console.log("===== SUCCESS =====")
    console.log("Portfolio summary test completed successfully.")
  } catch (error) {
    console.error("===== ERROR =====")
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
