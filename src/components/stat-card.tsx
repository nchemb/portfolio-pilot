import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type StatCardProps = {
  label: string
  value: ReactNode
  badge?: ReactNode
  helper?: ReactNode
  className?: string
}

export function StatCard({ label, value, badge, helper, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-2xl font-semibold leading-none">{value}</CardTitle>
          {badge ? (
            <div className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {badge}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xs text-muted-foreground min-h-[1rem]">{helper ?? ""}</div>
      </CardContent>
    </Card>
  )
}
