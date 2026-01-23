/**
 * Shared classification logic
 *
 * Determines effective asset class for a holding using a priority hierarchy:
 * 1. UserSecurityOverride (manual user overrides)
 * 2. FundProfile (pre-seeded fund classifications)
 * 3. SecurityType (cash/bond inference)
 * 4. Holding field values (from Plaid)
 * 5. Fallback to "other"
 */

import { normalizeTicker } from "@/lib/normalize"

export type AssetClassBucket = "us_equity" | "intl_equity" | "bonds" | "cash" | "other"

export type ClassificationSource =
  | "override"
  | "fundProfile"
  | "securityType"
  | "holding"
  | "fallback"

export type ClassificationResult = {
  assetClass: string
  geography: string | null
  style: string | null
  source: ClassificationSource
  needsReview: boolean
}

export type ClassificationMaps = {
  fundProfileMap: Map<
    string,
    { assetClass: string | null; geography: string | null; style: string | null }
  >
  overrideMap: Map<string, { assetClass: string; geography: string | null; style: string | null }>
}

/**
 * Get effective classification for a holding
 */
export function getEffectiveClassification(
  holding: {
    ticker?: string | null
    assetClass?: string | null
    geography?: string | null
    style?: string | null
    securityType?: string | null
  },
  maps: ClassificationMaps
): ClassificationResult {
  const normalized = normalizeTicker(holding.ticker ?? null)
  const override = normalized ? maps.overrideMap.get(normalized) : undefined
  if (override) {
    return {
      assetClass: override.assetClass,
      geography: override.geography ?? null,
      style: override.style ?? null,
      source: "override",
      needsReview: false,
    }
  }

  const fundProfile = normalized ? maps.fundProfileMap.get(normalized) : undefined
  if (fundProfile?.assetClass) {
    return {
      assetClass: fundProfile.assetClass,
      geography: fundProfile.geography ?? null,
      style: fundProfile.style ?? null,
      source: "fundProfile",
      needsReview: false,
    }
  }

  if (holding.securityType === "cash") {
    return {
      assetClass: "cash",
      geography: holding.geography ?? null,
      style: holding.style ?? null,
      source: "securityType",
      needsReview: false,
    }
  }

  if (holding.securityType === "bond") {
    return {
      assetClass: "bonds",
      geography: holding.geography ?? null,
      style: holding.style ?? null,
      source: "securityType",
      needsReview: false,
    }
  }

  if (holding.assetClass) {
    return {
      assetClass: holding.assetClass,
      geography: holding.geography ?? null,
      style: holding.style ?? null,
      source: "holding",
      needsReview: false,
    }
  }

  return {
    assetClass: "other",
    geography: holding.geography ?? null,
    style: holding.style ?? null,
    source: "fallback",
    needsReview: true,
  }
}

/**
 * Convert asset class string to bucket type
 */
export function assetClassBucket(assetClass?: string | null): AssetClassBucket {
  if (assetClass === "us_equity") return "us_equity"
  if (assetClass === "intl_equity") return "intl_equity"
  if (assetClass === "bonds") return "bonds"
  if (assetClass === "cash") return "cash"
  return "other"
}

/**
 * Helper to convert unknown value to number (handles Prisma Decimal)
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value) {
    const maybeDecimal = value as { toNumber: () => number }
    return maybeDecimal.toNumber()
  }
  return 0
}

/**
 * Compute market value for a holding
 */
export function holdingMarketValue(holding: {
  value?: unknown
  price?: unknown
  quantity?: unknown
  securityType?: unknown
  assetClass?: unknown
}): number {
  const direct = toNumber(holding.value)
  const price = toNumber(holding.price)
  const qty = toNumber(holding.quantity)
  const derived = price * qty
  const isCash = holding.securityType === "cash" || holding.assetClass === "cash"

  const directOk = Number.isFinite(direct) && direct > 0
  const derivedOk = Number.isFinite(derived) && derived > 0

  if (isCash && directOk) {
    return direct
  }

  if (derivedOk && (!directOk || Math.abs(derived - direct) > 0.01)) {
    return derived
  }

  if (directOk) return direct
  if (derivedOk) return derived
  return 0
}

/**
 * Generate a stable aggregation key for a holding
 * Handles holdings without tickers (cash, unknown)
 */
export function getHoldingAggregationKey(holding: {
  ticker?: string | null
  name?: string | null
  securityType?: string | null
  assetClass?: string | null
}): string {
  const normalized = normalizeTicker(holding.ticker ?? null)

  // If we have a normalized ticker, use it
  if (normalized) {
    return normalized
  }

  // For cash holdings without ticker
  if (holding.securityType === "cash" || holding.assetClass === "cash") {
    return "__CASH__"
  }

  // For unknown/other holdings without ticker, use name or fallback
  const safeName = (holding.name ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "_")
  if (safeName) {
    return `__UNKNOWN_${safeName}__`
  }

  return "__UNKNOWN__"
}
