"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

import type { AggregatedHolding } from "@/lib/holdings"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type HoldingBreakdownRowProps = {
  holding: AggregatedHolding
  tickerNormalized: string | null
  effectiveAssetClass: string
  effectiveSource: "override" | "fundProfile" | "securityType" | "holding" | "fallback"
  hasOverride: boolean
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

export function HoldingBreakdownRow({
  holding,
  tickerNormalized,
  effectiveAssetClass,
  effectiveSource,
  hasOverride,
}: HoldingBreakdownRowProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draftAssetClass, setDraftAssetClass] = useState(effectiveAssetClass)

  useEffect(() => {
    if (!isEditing) {
      setDraftAssetClass(effectiveAssetClass)
    }
  }, [effectiveAssetClass, isEditing])

  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        toggle()
      }
    },
    [toggle]
  )

  const handleAssetClassSave = async () => {
    if (!tickerNormalized) {
      setError("Missing ticker.")
      return
    }
    const nextValue = draftAssetClass
    if (nextValue === effectiveAssetClass) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    setError(null)

    const response = await fetch("/api/overrides/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: tickerNormalized,
        assetClass: nextValue,
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "Unable to save override.")
      setSaving(false)
      return
    }

    setSaving(false)
    setIsEditing(false)
    router.refresh()
  }

  const handleCancelEdit = () => {
    setDraftAssetClass(effectiveAssetClass)
    setIsEditing(false)
  }

  const handleReset = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!tickerNormalized) return
    setSaving(true)
    setError(null)

    const response = await fetch("/api/overrides/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: tickerNormalized }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "Unable to reset override.")
      setSaving(false)
      return
    }

    setSaving(false)
    router.refresh()
  }

  const sourceLabel =
    effectiveSource === "override"
      ? "Override"
      : effectiveSource === "fundProfile"
        ? "FundProfile"
        : effectiveSource === "securityType"
          ? "SecurityType"
          : effectiveSource === "holding"
            ? "Holding"
            : "Fallback"

  const canEdit = Boolean(tickerNormalized)
  const dropdownDisabled = !isEditing || !canEdit

  return (
    <>
      <TableRow
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        className={`cursor-pointer transition-colors ${open ? "bg-muted/40" : "hover:bg-muted/30"
          }`}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <ChevronRight
              className={`h-4 w-4 transition-transform ${open ? "rotate-90" : "rotate-0"
                }`}
            />
            <div>
              <div className="font-medium">
                {holding.assetClass === "cash"
                  ? "Cash"
                  : holding.ticker ?? "--"}
              </div>
              <div className="text-muted-foreground text-xs">{holding.name}</div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {holding.totalQuantity.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {holding.price != null ? formatCurrency(holding.price) : "--"}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCurrency(holding.totalValue)}
        </TableCell>
        <TableCell>{holding.securityType ?? "--"}</TableCell>
        <TableCell>
          <div className="text-xs text-muted-foreground max-w-[120px] truncate" title={
            holding.breakdown.length === 1
              ? holding.breakdown[0].accountLabel
              : holding.breakdown.map((b) => b.accountLabel).join(", ")
          }>
            {holding.breakdown.length === 1
              ? holding.breakdown[0].accountLabel
              : `${holding.breakdown.length} accounts`}
          </div>
        </TableCell>
        <TableCell>
          <div
            className="flex flex-col gap-1"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {isEditing ? (
                <Select
                  value={draftAssetClass}
                  onChange={(event) => setDraftAssetClass(event.target.value)}
                  disabled={dropdownDisabled || saving}
                >
                  <option value="us_equity">US Equity</option>
                  <option value="intl_equity">International Equity</option>
                  <option value="bonds">Bonds</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </Select>
              ) : (
                <span className="text-sm">{effectiveAssetClass.replace(/_/g, " ")}</span>
              )}
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAssetClassSave}
                    disabled={saving || dropdownDisabled}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={saving || !canEdit}
                >
                  Edit
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{sourceLabel}</span>
              {hasOverride ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={saving}
                >
                  Reset
                </Button>
              ) : null}
            </div>
            {error ? <span className="text-xs text-rose-600">{error}</span> : null}
            {!tickerNormalized && effectiveAssetClass !== "cash" ? (
              <span className="text-xs text-muted-foreground">Missing ticker</span>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
      <TableRow className={open ? "bg-muted/10" : ""}>
        <TableCell colSpan={7} className="p-0">
          <div
            className={`overflow-hidden transition-all duration-200 ${open ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0"
              }`}
          >
            <div className="px-4 pb-4 pt-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holding.breakdown.map((entry) => (
                    <TableRow key={entry.accountId}>
                      <TableCell>{entry.accountLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.quantity.toLocaleString("en-US", {
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.price != null
                          ? formatCurrency(entry.price)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(entry.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TableCell>
      </TableRow>
    </>
  )
}
