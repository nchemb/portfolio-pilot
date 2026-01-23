/**
 * Deterministic Monthly Contribution Rebalancer Engine
 *
 * Given a user's current holdings, target allocation, and monthly contribution,
 * generates a production-grade rebalance plan answering:
 * "What should I buy this month to stay balanced?"
 *
 * NO LLMs. NO UI polish. Just logic.
 */

import { prisma } from "@/lib/prisma"
import { normalizeTicker } from "@/lib/normalize"
import { getRecommendedAllocation, type AssetAllocation } from "@/lib/allocation-recommendations"
import {
  getEffectiveClassification,
  assetClassBucket,
  holdingMarketValue,
  type AssetClassBucket,
  type ClassificationMaps,
} from "@/lib/classification"

// ===== TYPES =====

export type RebalancerMode = "monthly_contribution" | "invest_cash_balance"

export type RebalancerInput = {
  monthlyContribution?: number // required for monthly_contribution mode
  mode?: RebalancerMode // default "monthly_contribution"
  maxInvestAmount?: number // optional cap when investing cash
  preferInvestingCash?: boolean // default true
  minBuyAmount?: number // default $25
}

export type TickerRecommendation = {
  ticker: string
  reason: "existing_holding" | "default" | "low_fee_alternative"
  weight: number // 0-1, must sum to 1 for a bucket
}

export type BucketSuggestion = {
  bucket: AssetClassBucket
  currentPct: number
  targetPct: number
  gapToTargetPct: number
  gapToTargetDollar: number
  recommendedBuyAmount: number
  recommendedTickers: TickerRecommendation[]
  bucketReason: string // deterministic explanation
}

export type RebalancePlan = {
  timestamp: string // ISO
  mode: RebalancerMode
  investAmount: number // actual amount being allocated
  currentTotalValue: number
  projectedTotalValue: number
  currentAllocation: AssetAllocation
  targetAllocation: AssetAllocation
  projectedAllocation: AssetAllocation
  suggestions: BucketSuggestion[]
  warnings: string[]
  planSummary: string
}

type HoldingWithValue = {
  ticker: string | null
  assetClass: string
  marketValue: number
}

// ===== DEFAULT TICKER RECOMMENDATIONS =====

const DEFAULT_TICKERS: Record<AssetClassBucket, string> = {
  us_equity: "VTI",
  intl_equity: "VXUS",
  bonds: "BND",
  cash: "CASH",
  other: "VTI", // fallback
}

// Low-fee alternatives (Schwab equivalents)
const LOW_FEE_ALTERNATIVES: Record<AssetClassBucket, string | null> = {
  us_equity: "SCHB", // Schwab US Broad Market ETF
  intl_equity: "SCHF", // Schwab International Equity ETF
  bonds: "SCHZ", // Schwab US Aggregate Bond ETF
  cash: null,
  other: null,
}

// Common ETFs that should typically be classified as US equity
const COMMON_US_EQUITY_ETFS = ["VOO", "IVV", "SPY", "VTI", "QQQ"]
const COMMON_INTL_EQUITY_ETFS = ["VXUS"]
const COMMON_BOND_ETFS = ["BND"]

// ===== CORE REBALANCER LOGIC =====

/**
 * Allocate contribution across underweight buckets
 */
function allocateContribution(
  currentDollar: Record<AssetClassBucket, number>,
  targetPct: AssetAllocation,
  investAmount: number,
  preferInvestingCash: boolean,
  minBuyAmount: number
): Record<AssetClassBucket, number> {
  const currentTotal = Object.values(currentDollar).reduce((sum, v) => sum + v, 0)
  const projectedTotal = currentTotal + investAmount

  const buckets: AssetClassBucket[] = ["us_equity", "intl_equity", "bonds", "cash", "other"]

  // Compute target dollars after contribution
  const targetDollar: Record<AssetClassBucket, number> = {
    us_equity: targetPct.us_equity * projectedTotal,
    intl_equity: targetPct.intl_equity * projectedTotal,
    bonds: targetPct.bonds * projectedTotal,
    cash: targetPct.cash * projectedTotal,
    other: targetPct.other * projectedTotal,
  }

  // Compute dollars needed per bucket
  const needed: Record<AssetClassBucket, number> = {
    us_equity: Math.max(0, targetDollar.us_equity - currentDollar.us_equity),
    intl_equity: Math.max(0, targetDollar.intl_equity - currentDollar.intl_equity),
    bonds: Math.max(0, targetDollar.bonds - currentDollar.bonds),
    cash: Math.max(0, targetDollar.cash - currentDollar.cash),
    other: Math.max(0, targetDollar.other - currentDollar.other),
  }

  // If preferInvestingCash, set cash needed to 0 unless all other buckets are satisfied
  if (preferInvestingCash) {
    const otherNeeded = needed.us_equity + needed.intl_equity + needed.bonds + needed.other
    if (otherNeeded > 0) {
      needed.cash = 0
    }
  }

  const totalNeeded = Object.values(needed).reduce((sum, v) => sum + v, 0)

  // Initialize allocation result
  const allocated: Record<AssetClassBucket, number> = {
    us_equity: 0,
    intl_equity: 0,
    bonds: 0,
    cash: 0,
    other: 0,
  }

  if (totalNeeded === 0) {
    // All buckets are at or above target; allocate proportionally to target percentages
    for (const bucket of buckets) {
      allocated[bucket] = targetPct[bucket] * investAmount
    }
  } else {
    // Allocate proportionally based on need
    for (const bucket of buckets) {
      allocated[bucket] = (needed[bucket] / totalNeeded) * investAmount
    }
  }

  // Round to cents
  for (const bucket of buckets) {
    allocated[bucket] = Math.round(allocated[bucket] * 100) / 100
  }

  // Handle rounding error: adjust largest allocation to match exact total
  const allocatedTotal = Object.values(allocated).reduce((sum, v) => sum + v, 0)
  const diff = investAmount - allocatedTotal

  if (Math.abs(diff) > 0.01) {
    const sortedBuckets = buckets.sort((a, b) => allocated[b] - allocated[a])
    allocated[sortedBuckets[0]] += diff
    allocated[sortedBuckets[0]] = Math.round(allocated[sortedBuckets[0]] * 100) / 100
  }

  // Apply minimum buy threshold
  const sortedByNeed = buckets
    .map((bucket) => ({ bucket, need: needed[bucket], allocated: allocated[bucket] }))
    .sort((a, b) => b.need - a.need)

  for (let i = sortedByNeed.length - 1; i >= 0; i--) {
    const item = sortedByNeed[i]
    if (item.allocated > 0 && item.allocated < minBuyAmount) {
      const targetBucket = sortedByNeed.find(
        (x) => x.bucket !== item.bucket && x.allocated >= minBuyAmount
      )
      if (targetBucket) {
        allocated[targetBucket.bucket] += allocated[item.bucket]
        allocated[targetBucket.bucket] = Math.round(allocated[targetBucket.bucket] * 100) / 100
        allocated[item.bucket] = 0
      } else {
        const largestBucket = sortedByNeed.find((x) => x.bucket !== item.bucket)
        if (largestBucket) {
          allocated[largestBucket.bucket] += allocated[item.bucket]
          allocated[largestBucket.bucket] =
            Math.round(allocated[largestBucket.bucket] * 100) / 100
          allocated[item.bucket] = 0
        }
      }
    }
  }

  return allocated
}

/**
 * Recommend 2-3 tickers for a bucket
 */
function recommendTickers(
  bucket: AssetClassBucket,
  holdingsInBucket: HoldingWithValue[]
): TickerRecommendation[] {
  const recommendations: TickerRecommendation[] = []

  // First: existing holding with largest market value
  if (holdingsInBucket.length > 0) {
    const sorted = holdingsInBucket
      .filter((h) => h.ticker && h.ticker.trim() !== "")
      .sort((a, b) => b.marketValue - a.marketValue)

    if (sorted.length > 0) {
      recommendations.push({
        ticker: sorted[0].ticker!,
        reason: "existing_holding",
        weight: 0.5, // 50% to existing
      })
    }
  }

  // Second: default ETF
  const defaultTicker = DEFAULT_TICKERS[bucket]
  if (defaultTicker !== "CASH") {
    const weight = recommendations.length > 0 ? 0.3 : 0.7
    recommendations.push({
      ticker: defaultTicker,
      reason: "default",
      weight,
    })
  } else if (bucket === "cash") {
    // Special case for cash
    return [{ ticker: "CASH", reason: "default", weight: 1.0 }]
  }

  // Third: low-fee alternative
  const alternative = LOW_FEE_ALTERNATIVES[bucket]
  if (alternative && bucket !== "cash" && bucket !== "other") {
    const weight = recommendations.length > 0 ? 0.2 : 0.3
    recommendations.push({
      ticker: alternative,
      reason: "low_fee_alternative",
      weight,
    })
  }

  // Normalize weights to sum to 1
  const totalWeight = recommendations.reduce((sum, r) => sum + r.weight, 0)
  if (totalWeight > 0) {
    for (const rec of recommendations) {
      rec.weight = rec.weight / totalWeight
    }
  }

  return recommendations.length > 0 ? recommendations : [{ ticker: defaultTicker, reason: "default", weight: 1.0 }]
}

/**
 * Generate deterministic bucket reason
 */
function generateBucketReason(
  _bucket: AssetClassBucket,
  gapToTargetPct: number,
  currentPct: number,
  targetPct: number
): string {
  if (gapToTargetPct > 0.05) {
    return `Significantly underweight (${(currentPct * 100).toFixed(1)}% vs ${(targetPct * 100).toFixed(1)}% target)`
  } else if (gapToTargetPct > 0.02) {
    return `Moderately underweight (${(currentPct * 100).toFixed(1)}% vs ${(targetPct * 100).toFixed(1)}% target)`
  } else if (gapToTargetPct > 0) {
    return `Slightly underweight (${(currentPct * 100).toFixed(1)}% vs ${(targetPct * 100).toFixed(1)}% target)`
  } else {
    return `At or above target (${(currentPct * 100).toFixed(1)}% vs ${(targetPct * 100).toFixed(1)}% target)`
  }
}

/**
 * Generate deterministic plan summary
 */
function generatePlanSummary(
  mode: RebalancerMode,
  investAmount: number,
  suggestions: BucketSuggestion[],
  currentAllocation: AssetAllocation,
  targetAllocation: AssetAllocation
): string {
  const lines: string[] = []

  if (mode === "monthly_contribution") {
    lines.push(`Allocating $${investAmount.toFixed(2)} monthly contribution across ${suggestions.length} asset class${suggestions.length === 1 ? "" : "es"}.`)
  } else {
    lines.push(`Investing $${investAmount.toFixed(2)} from cash balance across ${suggestions.length} asset class${suggestions.length === 1 ? "" : "es"}.`)
  }

  if (suggestions.length > 0) {
    const topBucket = suggestions[0]
    lines.push(
      `Primary allocation: $${topBucket.recommendedBuyAmount.toFixed(2)} to ${topBucket.bucket.replace("_", " ")} (${topBucket.recommendedTickers[0].ticker}).`
    )
  }

  // Calculate largest gap
  const gaps = [
    { bucket: "us_equity", gap: Math.abs(targetAllocation.us_equity - currentAllocation.us_equity) },
    { bucket: "intl_equity", gap: Math.abs(targetAllocation.intl_equity - currentAllocation.intl_equity) },
    { bucket: "bonds", gap: Math.abs(targetAllocation.bonds - currentAllocation.bonds) },
    { bucket: "cash", gap: Math.abs(targetAllocation.cash - currentAllocation.cash) },
    { bucket: "other", gap: Math.abs(targetAllocation.other - currentAllocation.other) },
  ].sort((a, b) => b.gap - a.gap)

  if (gaps[0].gap > 0.05) {
    lines.push(`Largest variance: ${gaps[0].bucket.replace("_", " ")} (${(gaps[0].gap * 100).toFixed(1)}% from target).`)
  } else {
    lines.push("Portfolio allocation is well-balanced relative to target.")
  }

  return lines.join(" ")
}

// ===== MAIN ENGINE =====

/**
 * Build a deterministic monthly rebalance plan
 */
export async function buildMonthlyRebalancePlan(
  userId: string,
  input: RebalancerInput
): Promise<RebalancePlan> {
  const {
    monthlyContribution,
    mode = "monthly_contribution",
    maxInvestAmount,
    preferInvestingCash = true,
    minBuyAmount = 25,
  } = input

  // Validation
  if (mode === "monthly_contribution") {
    if (!monthlyContribution || monthlyContribution <= 0) {
      throw new Error("monthlyContribution must be greater than 0 for monthly_contribution mode")
    }
  }

  const timestamp = new Date().toISOString()
  const warnings: string[] = []

  // 1. FETCH USER DATA
  const [profile, accounts] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.brokerageAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const accountIds = accounts.map((a) => a.id)

  if (accountIds.length === 0) {
    throw new Error("No brokerage accounts found for user")
  }

  // 2. FETCH HOLDINGS
  const holdings = await prisma.holding.findMany({
    where: { brokerageAccountId: { in: accountIds } },
  })

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
      overrides.map((override: { tickerNormalized: string; assetClass: string; geography: string | null; style: string | null }) => [normalizeTicker(override.tickerNormalized)!, override])
    ),
    fundProfileMap: new Map(
      fundProfiles.map((fundProfile: { ticker: string; assetClass: string | null; geography: string | null; style: string | null }) => [normalizeTicker(fundProfile.ticker)!, fundProfile])
    ),
  }

  // 4. CLASSIFY HOLDINGS AND COMPUTE CURRENT ALLOCATION
  const holdingsWithValue: HoldingWithValue[] = holdings.map((holding) => {
    const classification = getEffectiveClassification(holding, maps)
    return {
      ticker: holding.ticker,
      assetClass: classification.assetClass,
      marketValue: holdingMarketValue(holding),
    }
  })

  const currentDollar: Record<AssetClassBucket, number> = {
    us_equity: 0,
    intl_equity: 0,
    bonds: 0,
    cash: 0,
    other: 0,
  }

  for (const holding of holdingsWithValue) {
    const bucket = assetClassBucket(holding.assetClass)
    currentDollar[bucket] += holding.marketValue
  }

  const currentTotalValue = Object.values(currentDollar).reduce((sum, v) => sum + v, 0)

  const currentAllocation: AssetAllocation = {
    us_equity: currentTotalValue > 0 ? currentDollar.us_equity / currentTotalValue : 0,
    intl_equity: currentTotalValue > 0 ? currentDollar.intl_equity / currentTotalValue : 0,
    bonds: currentTotalValue > 0 ? currentDollar.bonds / currentTotalValue : 0,
    cash: currentTotalValue > 0 ? currentDollar.cash / currentTotalValue : 0,
    other: currentTotalValue > 0 ? currentDollar.other / currentTotalValue : 0,
  }

  // 5. DETERMINE INVEST AMOUNT
  let investAmount: number

  if (mode === "monthly_contribution") {
    investAmount = monthlyContribution!
  } else {
    // invest_cash_balance mode
    investAmount = currentDollar.cash
    if (maxInvestAmount && investAmount > maxInvestAmount) {
      investAmount = maxInvestAmount
    }
    if (investAmount <= 0) {
      warnings.push("No cash balance available to invest.")
      investAmount = 0
    }
  }

  // 6. COMPUTE TARGET ALLOCATION
  const targetAllocation = getRecommendedAllocation({
    ageRange: profile?.ageRange,
    riskTolerance: profile?.riskTolerance,
    timeHorizon: profile?.timeHorizon,
  })

  // 7. ALLOCATE INVEST AMOUNT
  const allocated = allocateContribution(
    currentDollar,
    targetAllocation,
    investAmount,
    mode === "monthly_contribution" ? preferInvestingCash : false, // don't prefer cash when investing cash
    minBuyAmount
  )

  // 8. COMPUTE PROJECTED ALLOCATION
  const projectedDollar: Record<AssetClassBucket, number> = {
    us_equity: currentDollar.us_equity + allocated.us_equity,
    intl_equity: currentDollar.intl_equity + allocated.intl_equity,
    bonds: currentDollar.bonds + allocated.bonds,
    cash: mode === "invest_cash_balance"
      ? currentDollar.cash - investAmount + allocated.cash
      : currentDollar.cash + allocated.cash,
    other: currentDollar.other + allocated.other,
  }

  const projectedTotalValue = mode === "invest_cash_balance"
    ? currentTotalValue
    : currentTotalValue + investAmount

  const projectedAllocation: AssetAllocation = {
    us_equity: projectedDollar.us_equity / projectedTotalValue,
    intl_equity: projectedDollar.intl_equity / projectedTotalValue,
    bonds: projectedDollar.bonds / projectedTotalValue,
    cash: projectedDollar.cash / projectedTotalValue,
    other: projectedDollar.other / projectedTotalValue,
  }

  // 9. BUILD SUGGESTIONS
  const buckets: AssetClassBucket[] = ["us_equity", "intl_equity", "bonds", "cash", "other"]
  const suggestions: BucketSuggestion[] = []

  for (const bucket of buckets) {
    if (allocated[bucket] > 0) {
      const holdingsInBucket = holdingsWithValue.filter(
        (h) => assetClassBucket(h.assetClass) === bucket
      )
      const tickers = recommendTickers(bucket, holdingsInBucket)
      const gapToTargetPct = targetAllocation[bucket] - currentAllocation[bucket]
      const projectedTotal = mode === "invest_cash_balance"
        ? currentTotalValue
        : currentTotalValue + investAmount
      const gapToTargetDollar = gapToTargetPct * projectedTotal

      suggestions.push({
        bucket,
        currentPct: currentAllocation[bucket],
        targetPct: targetAllocation[bucket],
        gapToTargetPct,
        gapToTargetDollar,
        recommendedBuyAmount: allocated[bucket],
        recommendedTickers: tickers,
        bucketReason: generateBucketReason(bucket, gapToTargetPct, currentAllocation[bucket], targetAllocation[bucket]),
      })

      // Warnings for "other" bucket
      if (bucket === "other" && tickers[0].reason === "default") {
        warnings.push(
          `Allocating to "other" bucket. Consider reclassifying holdings for more precise allocation.`
        )
      }
    }
  }

  // Sort suggestions by buy amount descending
  suggestions.sort((a, b) => b.recommendedBuyAmount - a.recommendedBuyAmount)

  // 10. CHECK FOR COMMON ETF MISCLASSIFICATIONS
  for (const override of overrides) {
    const normalizedTicker = normalizeTicker(override.tickerNormalized)
    if (!normalizedTicker) continue

    const expectedBucket =
      COMMON_US_EQUITY_ETFS.includes(normalizedTicker) ? "us_equity" :
      COMMON_INTL_EQUITY_ETFS.includes(normalizedTicker) ? "intl_equity" :
      COMMON_BOND_ETFS.includes(normalizedTicker) ? "bonds" :
      null

    if (expectedBucket && override.assetClass !== expectedBucket) {
      warnings.push(
        `${normalizedTicker} is overridden to ${override.assetClass} but is typically classified as ${expectedBucket}. Verify this is intentional.`
      )
    }
  }

  // 11. GENERATE PLAN SUMMARY
  const planSummary = generatePlanSummary(mode, investAmount, suggestions, currentAllocation, targetAllocation)

  // 12. RETURN PLAN
  return {
    timestamp,
    mode,
    investAmount,
    currentTotalValue,
    projectedTotalValue,
    currentAllocation,
    targetAllocation,
    projectedAllocation,
    suggestions,
    warnings,
    planSummary,
  }
}
