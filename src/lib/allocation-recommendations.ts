/**
 * Allocation recommendation engine
 *
 * Generates recommended portfolio allocation based on:
 * - Age range (20-29, 30-39, 40-49, 50+)
 * - Risk tolerance (low, medium, high)
 * - Time horizon (short, medium, long)
 */

export type AssetAllocation = {
  us_equity: number      // US stocks/ETFs
  intl_equity: number    // International stocks/ETFs
  bonds: number          // Fixed income
  cash: number           // Cash equivalents
  other: number          // Alternative assets
}

export type ProfileInput = {
  ageRange?: string | null
  riskTolerance?: string | null
  timeHorizon?: string | null
}

/**
 * Base allocations by age using the rule of thumb:
 * Stock allocation = 110 - age (midpoint of range)
 */
const BASE_ALLOCATIONS_BY_AGE: Record<string, AssetAllocation> = {
  "20-29": {
    us_equity: 0.70,    // 70% stocks (aggressive growth phase)
    intl_equity: 0.15,  // 15% international diversification
    bonds: 0.10,        // 10% bonds (some stability)
    cash: 0.05,         // 5% cash
    other: 0.00,
  },
  "30-39": {
    us_equity: 0.60,    // 60% stocks
    intl_equity: 0.15,  // 15% international
    bonds: 0.20,        // 20% bonds (increasing stability)
    cash: 0.05,         // 5% cash
    other: 0.00,
  },
  "40-49": {
    us_equity: 0.50,    // 50% stocks
    intl_equity: 0.10,  // 10% international
    bonds: 0.30,        // 30% bonds
    cash: 0.10,         // 10% cash
    other: 0.00,
  },
  "50+": {
    us_equity: 0.35,    // 35% stocks (capital preservation)
    intl_equity: 0.10,  // 10% international
    bonds: 0.45,        // 45% bonds (focus on income)
    cash: 0.10,         // 10% cash
    other: 0.00,
  },
}

/**
 * Default allocation if no age specified
 */
const DEFAULT_ALLOCATION: AssetAllocation = {
  us_equity: 0.50,
  intl_equity: 0.15,
  bonds: 0.25,
  cash: 0.10,
  other: 0.00,
}

/**
 * Adjust allocation based on risk tolerance
 */
function applyRiskAdjustment(
  allocation: AssetAllocation,
  riskTolerance?: string | null
): AssetAllocation {
  if (!riskTolerance) return allocation

  const result = { ...allocation }

  switch (riskTolerance) {
    case "low":
      // Reduce equity, increase bonds and cash
      const equityReduction = 0.15
      const usEquityReduction = result.us_equity * 0.2 // 20% of US equity
      const intlEquityReduction = result.intl_equity * 0.2 // 20% of intl equity

      result.us_equity = Math.max(0, result.us_equity - usEquityReduction)
      result.intl_equity = Math.max(0, result.intl_equity - intlEquityReduction)
      result.bonds += equityReduction * 0.7 // 70% to bonds
      result.cash += equityReduction * 0.3 // 30% to cash
      break

    case "high":
      // Increase equity, reduce bonds and cash
      const bondsReduction = result.bonds * 0.3 // 30% of bonds
      const cashReduction = result.cash * 0.5 // 50% of cash

      result.bonds = Math.max(0, result.bonds - bondsReduction)
      result.cash = Math.max(0, result.cash - cashReduction)
      result.us_equity += (bondsReduction + cashReduction) * 0.7 // 70% to US equity
      result.intl_equity += (bondsReduction + cashReduction) * 0.3 // 30% to intl equity
      break

    case "medium":
    default:
      // No adjustment for medium risk
      break
  }

  return result
}

/**
 * Adjust allocation based on time horizon
 */
function applyTimeHorizonAdjustment(
  allocation: AssetAllocation,
  timeHorizon?: string | null
): AssetAllocation {
  if (!timeHorizon) return allocation

  const result = { ...allocation }

  switch (timeHorizon) {
    case "short":
      // Short-term: reduce volatility, increase bonds and cash
      const equityToMove = 0.10
      const usEquityMove = result.us_equity * 0.15
      const intlEquityMove = result.intl_equity * 0.15

      result.us_equity = Math.max(0, result.us_equity - usEquityMove)
      result.intl_equity = Math.max(0, result.intl_equity - intlEquityMove)
      result.bonds += equityToMove * 0.6
      result.cash += equityToMove * 0.4
      break

    case "long":
      // Long-term: can take more risk, increase equity
      const bondsToMove = result.bonds * 0.2
      const cashToMove = result.cash * 0.3

      result.bonds = Math.max(0, result.bonds - bondsToMove)
      result.cash = Math.max(0, result.cash - cashToMove)
      result.us_equity += (bondsToMove + cashToMove) * 0.6
      result.intl_equity += (bondsToMove + cashToMove) * 0.4
      break

    case "medium":
    default:
      // No adjustment for medium horizon
      break
  }

  return result
}

/**
 * Normalize allocation to ensure it sums to 100%
 */
function normalizeAllocation(allocation: AssetAllocation): AssetAllocation {
  const total =
    allocation.us_equity +
    allocation.intl_equity +
    allocation.bonds +
    allocation.cash +
    allocation.other

  if (total === 0) return DEFAULT_ALLOCATION

  return {
    us_equity: allocation.us_equity / total,
    intl_equity: allocation.intl_equity / total,
    bonds: allocation.bonds / total,
    cash: allocation.cash / total,
    other: allocation.other / total,
  }
}

/**
 * Generate recommended allocation based on user profile
 */
export function getRecommendedAllocation(profile: ProfileInput): AssetAllocation {
  // Start with age-based allocation
  const baseAllocation = profile.ageRange && profile.ageRange in BASE_ALLOCATIONS_BY_AGE
    ? { ...BASE_ALLOCATIONS_BY_AGE[profile.ageRange] }
    : { ...DEFAULT_ALLOCATION }

  // Apply risk tolerance adjustment
  const afterRisk = applyRiskAdjustment(baseAllocation, profile.riskTolerance)

  // Apply time horizon adjustment
  const afterHorizon = applyTimeHorizonAdjustment(afterRisk, profile.timeHorizon)

  // Normalize to ensure sum is 100%
  return normalizeAllocation(afterHorizon)
}

/**
 * Calculate variance between actual and recommended allocation
 * Returns the deviation for each asset class
 */
export function calculateAllocationVariance(
  actual: AssetAllocation,
  recommended: AssetAllocation
): AssetAllocation {
  return {
    us_equity: actual.us_equity - recommended.us_equity,
    intl_equity: actual.intl_equity - recommended.intl_equity,
    bonds: actual.bonds - recommended.bonds,
    cash: actual.cash - recommended.cash,
    other: actual.other - recommended.other,
  }
}

/**
 * Get a human-readable summary of the recommendation
 */
export function getRecommendationSummary(
  profile: ProfileInput,
  recommended: AssetAllocation
): string {
  const parts: string[] = []

  // Profile context
  if (profile.ageRange) {
    parts.push(`For someone in the ${profile.ageRange} age range`)
  }

  if (profile.riskTolerance) {
    parts.push(`with ${profile.riskTolerance} risk tolerance`)
  }

  if (profile.timeHorizon) {
    parts.push(`and a ${profile.timeHorizon}-term investment horizon`)
  }

  const context = parts.length > 0 ? parts.join(" ") : "Based on your profile"

  // Allocation breakdown
  const allocParts: string[] = []

  const totalEquity = recommended.us_equity + recommended.intl_equity
  if (totalEquity > 0) {
    allocParts.push(`${(totalEquity * 100).toFixed(0)}% stocks`)
  }

  if (recommended.bonds > 0) {
    allocParts.push(`${(recommended.bonds * 100).toFixed(0)}% bonds`)
  }

  if (recommended.cash > 0) {
    allocParts.push(`${(recommended.cash * 100).toFixed(0)}% cash`)
  }

  return `${context}, we recommend: ${allocParts.join(", ")}.`
}
