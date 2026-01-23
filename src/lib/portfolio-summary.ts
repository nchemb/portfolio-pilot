/**
 * Portfolio Summary Truth Layer
 *
 * Single source of truth for portfolio state.
 * Used by dashboard, rebalancer, and AI chatbot.
 */

import { prisma } from "@/lib/prisma"
import { normalizeTicker } from "@/lib/normalize"
import {
  getEffectiveClassification,
  assetClassBucket,
  holdingMarketValue,
  getHoldingAggregationKey,
  type AssetClassBucket,
  type ClassificationSource,
  type ClassificationMaps,
} from "@/lib/classification"

// ===== TYPES =====

export type AllocationBucket = {
  dollarValue: number
  pct: number
}

export type TopHolding = {
  ticker: string | null
  name: string
  securityType: string | null
  effectiveAssetClass: string
  classificationSource: ClassificationSource
  value: number
  pctOfPortfolio: number
}

export type AccountSummary = {
  id: string
  institution: string | null
  name: string | null
  mask: string | null
  totalValue: number
  allocation: Record<AssetClassBucket, AllocationBucket>
}

export type ClassificationStats = {
  countBySource: Record<ClassificationSource, number>
  needsReviewCount: number
}

export type PortfolioSummary = {
  userId: string
  asOf: string // ISO timestamp
  totalValue: number
  allocation: Record<AssetClassBucket, AllocationBucket>
  holdings: TopHolding[] // all holdings, aggregated and sorted by value
  accounts: AccountSummary[]
  classificationStats: ClassificationStats
  warnings: string[]
}

// ===== HELPER TYPES =====

type HoldingWithClassification = {
  aggregationKey: string
  ticker: string | null
  name: string
  securityType: string | null
  effectiveAssetClass: string
  classificationSource: ClassificationSource
  needsReview: boolean
  marketValue: number
  accountId: string
}

// ===== MAIN FUNCTION =====

/**
 * Get complete portfolio summary for a user
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const asOf = new Date().toISOString()
  const warnings: string[] = []

  // 1. FETCH USER DATA
  const accounts = await prisma.brokerageAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  })

  const accountIds = accounts.map((a) => a.id)

  if (accountIds.length === 0) {
    return {
      userId,
      asOf,
      totalValue: 0,
      allocation: {
        us_equity: { dollarValue: 0, pct: 0 },
        intl_equity: { dollarValue: 0, pct: 0 },
        bonds: { dollarValue: 0, pct: 0 },
        cash: { dollarValue: 0, pct: 0 },
        other: { dollarValue: 0, pct: 0 },
      },
      holdings: [],
      accounts: [],
      classificationStats: {
        countBySource: {
          override: 0,
          fundProfile: 0,
          securityType: 0,
          holding: 0,
          fallback: 0,
        },
        needsReviewCount: 0,
      },
      warnings: ["No brokerage accounts found"],
    }
  }

  // 2. FETCH HOLDINGS
  const holdings = await prisma.holding.findMany({
    where: { brokerageAccountId: { in: accountIds } },
  })

  if (holdings.length === 0) {
    warnings.push("No holdings found. Connect and sync a brokerage account.")
  }

  // 3. FETCH CLASSIFICATION MAPS
  const tickers = Array.from(
    new Set(
      holdings
        .map((holding) => normalizeTicker(holding.ticker ?? null))
        .filter((ticker): ticker is string => Boolean(ticker))
    )
  )

  const [overrides, fundProfiles] = tickers.length
    ? await Promise.all([
        prisma.userSecurityOverride.findMany({
          where: { userId, tickerNormalized: { in: tickers } },
        }),
        prisma.fundProfile.findMany({
          where: { ticker: { in: tickers } },
        }),
      ])
    : [[], []]

  const maps: ClassificationMaps = {
    overrideMap: new Map(
      overrides.map((override) => [normalizeTicker(override.tickerNormalized)!, override])
    ),
    fundProfileMap: new Map(
      fundProfiles.map((profile) => [normalizeTicker(profile.ticker)!, profile])
    ),
  }

  // 4. CLASSIFY HOLDINGS
  const holdingsWithClassification: HoldingWithClassification[] = holdings.map((holding) => {
    const classification = getEffectiveClassification(holding, maps)
    const aggregationKey = getHoldingAggregationKey(holding)

    return {
      aggregationKey,
      ticker: holding.ticker,
      name: holding.name,
      securityType: holding.securityType,
      effectiveAssetClass: classification.assetClass,
      classificationSource: classification.source,
      needsReview: classification.needsReview,
      marketValue: holdingMarketValue(holding),
      accountId: holding.brokerageAccountId,
    }
  })

  // 5. COMPUTE TOTAL VALUE
  const totalValue = holdingsWithClassification.reduce((sum, h) => sum + h.marketValue, 0)

  // 6. COMPUTE ALLOCATION
  const allocationDollars: Record<AssetClassBucket, number> = {
    us_equity: 0,
    intl_equity: 0,
    bonds: 0,
    cash: 0,
    other: 0,
  }

  for (const holding of holdingsWithClassification) {
    const bucket = assetClassBucket(holding.effectiveAssetClass)
    allocationDollars[bucket] += holding.marketValue
  }

  const allocation: Record<AssetClassBucket, AllocationBucket> = {
    us_equity: {
      dollarValue: allocationDollars.us_equity,
      pct: totalValue > 0 ? allocationDollars.us_equity / totalValue : 0,
    },
    intl_equity: {
      dollarValue: allocationDollars.intl_equity,
      pct: totalValue > 0 ? allocationDollars.intl_equity / totalValue : 0,
    },
    bonds: {
      dollarValue: allocationDollars.bonds,
      pct: totalValue > 0 ? allocationDollars.bonds / totalValue : 0,
    },
    cash: {
      dollarValue: allocationDollars.cash,
      pct: totalValue > 0 ? allocationDollars.cash / totalValue : 0,
    },
    other: {
      dollarValue: allocationDollars.other,
      pct: totalValue > 0 ? allocationDollars.other / totalValue : 0,
    },
  }

  // 7. AGGREGATE TOP HOLDINGS
  const aggregatedHoldingsMap = new Map<
    string,
    {
      aggregationKey: string
      ticker: string | null
      name: string
      securityType: string | null
      effectiveAssetClass: string
      classificationSource: ClassificationSource
      value: number
    }
  >()

  for (const holding of holdingsWithClassification) {
    const existing = aggregatedHoldingsMap.get(holding.aggregationKey)
    if (existing) {
      existing.value += holding.marketValue
    } else {
      aggregatedHoldingsMap.set(holding.aggregationKey, {
        aggregationKey: holding.aggregationKey,
        ticker: holding.ticker,
        name: holding.name,
        securityType: holding.securityType,
        effectiveAssetClass: holding.effectiveAssetClass,
        classificationSource: holding.classificationSource,
        value: holding.marketValue,
      })
    }
  }

  const aggregatedHoldings: TopHolding[] = Array.from(aggregatedHoldingsMap.values())
    .map((h) => ({
      ticker: h.ticker,
      name: h.name,
      securityType: h.securityType,
      effectiveAssetClass: h.effectiveAssetClass,
      classificationSource: h.classificationSource,
      value: h.value,
      pctOfPortfolio: totalValue > 0 ? h.value / totalValue : 0,
    }))
    .sort((a, b) => b.value - a.value)

  // 8. COMPUTE PER-ACCOUNT SUMMARIES
  const accountSummaries: AccountSummary[] = accounts.map((account) => {
    const accountHoldings = holdingsWithClassification.filter(
      (h) => h.accountId === account.id
    )

    const accountTotal = accountHoldings.reduce((sum, h) => sum + h.marketValue, 0)

    const accountAllocationDollars: Record<AssetClassBucket, number> = {
      us_equity: 0,
      intl_equity: 0,
      bonds: 0,
      cash: 0,
      other: 0,
    }

    for (const holding of accountHoldings) {
      const bucket = assetClassBucket(holding.effectiveAssetClass)
      accountAllocationDollars[bucket] += holding.marketValue
    }

    return {
      id: account.id,
      institution: account.institution,
      name: account.name,
      mask: account.mask,
      totalValue: accountTotal,
      allocation: {
        us_equity: {
          dollarValue: accountAllocationDollars.us_equity,
          pct: accountTotal > 0 ? accountAllocationDollars.us_equity / accountTotal : 0,
        },
        intl_equity: {
          dollarValue: accountAllocationDollars.intl_equity,
          pct: accountTotal > 0 ? accountAllocationDollars.intl_equity / accountTotal : 0,
        },
        bonds: {
          dollarValue: accountAllocationDollars.bonds,
          pct: accountTotal > 0 ? accountAllocationDollars.bonds / accountTotal : 0,
        },
        cash: {
          dollarValue: accountAllocationDollars.cash,
          pct: accountTotal > 0 ? accountAllocationDollars.cash / accountTotal : 0,
        },
        other: {
          dollarValue: accountAllocationDollars.other,
          pct: accountTotal > 0 ? accountAllocationDollars.other / accountTotal : 0,
        },
      },
    }
  })

  // 9. COMPUTE CLASSIFICATION STATS
  const countBySource: Record<ClassificationSource, number> = {
    override: 0,
    fundProfile: 0,
    securityType: 0,
    holding: 0,
    fallback: 0,
  }

  let needsReviewCount = 0

  for (const holding of holdingsWithClassification) {
    countBySource[holding.classificationSource]++
    if (holding.needsReview) {
      needsReviewCount++
    }
  }

  const classificationStats: ClassificationStats = {
    countBySource,
    needsReviewCount,
  }

  // 10. GENERATE WARNINGS
  if (needsReviewCount > 0) {
    warnings.push(
      `${needsReviewCount} holding(s) need classification review. Consider adding overrides.`
    )
  }

  if (allocation.other.pct > 0.05) {
    warnings.push(
      `${(allocation.other.pct * 100).toFixed(1)}% allocated to "other" bucket. Review classifications for more precise allocation.`
    )
  }

  if (totalValue === 0 && holdings.length > 0) {
    warnings.push("Holdings detected but total value is $0. Check holding data quality.")
  }

  // 11. RETURN SUMMARY
  return {
    userId,
    asOf,
    totalValue,
    allocation,
    holdings: aggregatedHoldings,
    accounts: accountSummaries,
    classificationStats,
    warnings,
  }
}
