"use client"

import { useCallback, useState } from "react"
import { ChevronRight } from "lucide-react"

import type { AggregatedHolding } from "@/lib/holdings"
import { Badge } from "@/components/ui/badge"
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
  bucketLabel: string
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
  bucketLabel,
}: HoldingBreakdownRowProps) {
  const [open, setOpen] = useState(false)

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
        <TableCell>
          {holding.totalQuantity.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })}
        </TableCell>
        <TableCell>
          {holding.price != null ? formatCurrency(holding.price) : "--"}
        </TableCell>
        <TableCell className="text-right">
          {formatCurrency(holding.totalValue)}
        </TableCell>
        <TableCell>{holding.securityType ?? "--"}</TableCell>
        <TableCell>
          <Badge variant="secondary">{bucketLabel}</Badge>
        </TableCell>
      </TableRow>
      <TableRow className={open ? "bg-muted/10" : ""}>
        <TableCell colSpan={6} className="p-0">
          <div
            className={`overflow-hidden transition-all duration-200 ${open ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0"
              }`}
          >
            <div className="px-4 pb-4 pt-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holding.breakdown.map((entry) => (
                    <TableRow key={entry.accountId}>
                      <TableCell>{entry.accountLabel}</TableCell>
                      <TableCell>
                        {entry.quantity.toLocaleString("en-US", {
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell>
                        {entry.price != null
                          ? formatCurrency(entry.price)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right">
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
