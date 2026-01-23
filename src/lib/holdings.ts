import type { BrokerageAccount } from "@prisma/client"

type HoldingWithValue = {
  id: string
  brokerageAccountId: string
  ticker: string | null
  name: string
  quantity: unknown
  price: unknown
  value: unknown
  securityType: string | null
  assetClass: string | null
  geography: string | null
  style: string | null
  marketValue: number
}

export type AggregatedHoldingBreakdown = {
  accountId: string
  accountLabel: string
  quantity: number
  price: number | null
  value: number
}

export type AggregatedHolding = {
  key: string
  ticker: string | null
  name: string
  securityType: string | null
  assetClass: string | null
  geography: string | null
  style: string | null
  totalQuantity: number
  totalValue: number
  price: number | null
  breakdown: AggregatedHoldingBreakdown[]
}

type AccountLabel = Pick<
  BrokerageAccount,
  "id" | "institution" | "name" | "mask"
>

function accountDisplayName(account?: AccountLabel) {
  if (!account) return "Unknown account"
  const parts = [account.institution, account.name].filter(Boolean)
  const label = parts.join(" • ") || "Account"
  return account.mask ? `${label} ****${account.mask}` : label
}

function holdingKey(holding: HoldingWithValue) {
  const ticker = holding.ticker ?? "unknown"
  const name = holding.name ?? "Holding"
  const securityType = holding.securityType ?? "unknown"
  const assetClass = holding.assetClass ?? "other"
  return `fallback:${ticker}|${name}|${securityType}|${assetClass}`
}

export function aggregateHoldings(
  holdings: HoldingWithValue[],
  accounts: AccountLabel[]
): AggregatedHolding[] {
  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  const grouped = new Map<string, AggregatedHolding>()

  for (const holding of holdings) {
    const key = holdingKey(holding)
    const existing = grouped.get(key)

    const quantity = Number(holding.quantity ?? 0)
    const price = holding.price != null ? Number(holding.price) : null
    const value = holding.marketValue
    const accountLabel = accountDisplayName(accountMap.get(holding.brokerageAccountId))

    if (!existing) {
      grouped.set(key, {
        key,
        ticker: holding.ticker ?? null,
        name: holding.name ?? "Holding",
        securityType: holding.securityType ?? null,
        assetClass: holding.assetClass ?? null,
        geography: holding.geography ?? null,
        style: holding.style ?? null,
        totalQuantity: quantity,
        totalValue: value,
        price: null,
        breakdown: [
          {
            accountId: holding.brokerageAccountId,
            accountLabel,
            quantity,
            price,
            value,
          },
        ],
      })
      continue
    }

    existing.totalQuantity += quantity
    existing.totalValue += value
    if (!existing.securityType && holding.securityType) {
      existing.securityType = holding.securityType
    }
    if (!existing.assetClass && holding.assetClass) {
      existing.assetClass = holding.assetClass
    }
    if (!existing.geography && holding.geography) {
      existing.geography = holding.geography
    }
    if (!existing.style && holding.style) {
      existing.style = holding.style
    }

    existing.breakdown.push({
      accountId: holding.brokerageAccountId,
      accountLabel,
      quantity,
      price,
      value,
    })
  }

  for (const aggregated of grouped.values()) {
    if (aggregated.totalQuantity > 0) {
      aggregated.price = aggregated.totalValue / aggregated.totalQuantity
    }
    aggregated.breakdown.sort((a, b) => b.value - a.value)
  }

  return Array.from(grouped.values()).sort((a, b) => b.totalValue - a.totalValue)
}
