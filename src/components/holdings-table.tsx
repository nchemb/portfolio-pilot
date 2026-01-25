"use client"

import { useMemo, useState } from "react"

import type { AggregatedHolding } from "@/lib/holdings"
import { HoldingBreakdownRow } from "@/components/holding-breakdown-row"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type SortKey = "ticker" | "quantity" | "price" | "value" | "securityType"
type SortDirection = "asc" | "desc"

type ClassifiedHolding = AggregatedHolding & {
  tickerNormalized: string | null
  effectiveAssetClass: string
  effectiveSource: "override" | "fundProfile" | "securityType" | "holding" | "fallback"
  hasOverride: boolean
}

type HoldingsTableProps = {
  holdings: ClassifiedHolding[]
}

const defaultSort: { key: SortKey; direction: SortDirection } = {
  key: "value",
  direction: "desc",
}

function normalizeString(value: string | null | undefined) {
  return (value ?? "").toLowerCase()
}

function getTickerLabel(holding: ClassifiedHolding) {
  return holding.ticker ?? holding.name ?? ""
}

function getSortValue(holding: ClassifiedHolding, key: SortKey) {
  switch (key) {
    case "ticker":
      return normalizeString(getTickerLabel(holding))
    case "quantity":
      return holding.totalQuantity ?? 0
    case "price":
      return holding.price ?? 0
    case "value":
      return holding.totalValue ?? 0
    case "securityType":
      return normalizeString(holding.securityType)
    default:
      return 0
  }
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort.key)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    defaultSort.direction
  )
  const [query, setQuery] = useState("")

  const filteredHoldings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return holdings
    return holdings.filter((holding) => {
      const tickerLabel = getTickerLabel(holding).toLowerCase()
      const nameLabel = holding.name?.toLowerCase() ?? ""
      return tickerLabel.includes(normalizedQuery) || nameLabel.includes(normalizedQuery)
    })
  }, [holdings, query])

  const sortedHoldings = useMemo(() => {
    const next = [...filteredHoldings]
    next.sort((a, b) => {
      const aVal = getSortValue(a, sortKey)
      const bVal = getSortValue(b, sortKey)

      if (typeof aVal === "string" && typeof bVal === "string") {
        const result = aVal.localeCompare(bVal)
        return sortDirection === "asc" ? result : -result
      }

      const result = (aVal as number) - (bVal as number)
      return sortDirection === "asc" ? result : -result
    })
    return next
  }, [filteredHoldings, sortKey, sortDirection])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(key)
    setSortDirection(key === "value" ? "desc" : "asc")
  }

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return null
    return sortDirection === "asc" ? "▲" : "▼"
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ticker or name"
          className="h-9 max-w-sm"
        />
      </div>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background [&_th]:bg-background">
        <TableRow>
          <TableHead>
            <button
              type="button"
              onClick={() => handleSort("ticker")}
              className="flex items-center gap-1 text-left"
            >
              Ticker / Name <span className="text-[10px] text-muted-foreground">{sortIndicator("ticker")}</span>
            </button>
          </TableHead>
          <TableHead className="text-right">
            <button
              type="button"
              onClick={() => handleSort("quantity")}
              className="ml-auto flex items-center gap-1"
            >
              Quantity <span className="text-[10px] text-muted-foreground">{sortIndicator("quantity")}</span>
            </button>
          </TableHead>
          <TableHead className="text-right">
            <button
              type="button"
              onClick={() => handleSort("price")}
              className="ml-auto flex items-center gap-1"
            >
              Price <span className="text-[10px] text-muted-foreground">{sortIndicator("price")}</span>
            </button>
          </TableHead>
          <TableHead className="text-right">
            <button
              type="button"
              onClick={() => handleSort("value")}
              className="ml-auto flex items-center gap-1"
            >
              Value <span className="text-[10px] text-muted-foreground">{sortIndicator("value")}</span>
              {sortKey === "value" ? (
                <span className="text-[10px] text-muted-foreground">sorted</span>
              ) : null}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => handleSort("securityType")}
              className="flex items-center gap-1 text-left"
            >
              Security Type <span className="text-[10px] text-muted-foreground">{sortIndicator("securityType")}</span>
            </button>
          </TableHead>
          <TableHead>Account(s)</TableHead>
          <TableHead>Asset Class</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedHoldings.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center">
              No holdings to display.
            </TableCell>
          </TableRow>
        ) : (
          sortedHoldings.map((holding) => (
            <HoldingBreakdownRow
              key={holding.key}
              holding={holding}
              tickerNormalized={holding.tickerNormalized}
              effectiveAssetClass={holding.effectiveAssetClass}
              effectiveSource={holding.effectiveSource}
              hasOverride={holding.hasOverride}
            />
          ))
        )}
      </TableBody>
    </Table>
    </div>
  )
}
