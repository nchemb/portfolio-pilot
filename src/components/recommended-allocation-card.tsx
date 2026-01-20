import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AssetAllocation } from "@/lib/allocation-recommendations"

type RecommendedAllocationCardProps = {
  actualAllocation: AssetAllocation
  recommendedAllocation: AssetAllocation
  allocationVariance: AssetAllocation
  recommendationSummary: string
  totalHoldingsValue: number
  hasProfile: boolean
  ASSET_CLASS_LABELS: Record<string, string>
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function RecommendedAllocationCard({
  actualAllocation,
  recommendedAllocation,
  allocationVariance,
  recommendationSummary,
  totalHoldingsValue,
  hasProfile,
  ASSET_CLASS_LABELS,
}: RecommendedAllocationCardProps) {
  // Calculate at-a-glance metrics
  const buckets = (["us_equity", "intl_equity", "bonds", "cash", "other"] as const)
    .map((bucket) => ({
      bucket,
      variance: allocationVariance[bucket] * 100,
      recommended: recommendedAllocation[bucket],
    }))
    .filter((item) => item.recommended > 0)

  const overweightBuckets = buckets
    .filter((item) => item.variance > 2)
    .sort((a, b) => b.variance - a.variance)

  const underweightBuckets = buckets
    .filter((item) => item.variance < -2)
    .sort((a, b) => a.variance - b.variance)

  const balancedCount = buckets.filter(
    (item) => Math.abs(item.variance) <= 2
  ).length

  const mostOverweight = overweightBuckets[0]
  const mostUnderweight = underweightBuckets[0]

  // Generate actionable hint
  let actionHint = "You're roughly aligned with your target mix."
  const extremeVariances = buckets.filter((item) => Math.abs(item.variance) > 10)

  if (extremeVariances.length > 0) {
    const extreme = extremeVariances[0]
    if (extreme.variance > 10) {
      if (extreme.bucket === "cash") {
        actionHint = "Consider deploying excess cash according to target mix."
      } else {
        actionHint = `${ASSET_CLASS_LABELS[extreme.bucket]} is materially above target.`
      }
    } else if (extreme.variance < -10) {
      actionHint = `${ASSET_CLASS_LABELS[extreme.bucket]} is materially below target.`
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended allocation</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {hasProfile
            ? recommendationSummary
            : "Complete your profile in Settings to see personalized recommendations."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasProfile ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Set your age range, risk tolerance, and time horizon to get
              tailored allocation guidance.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard?tab=settings">Go to Settings</Link>
            </Button>
          </div>
        ) : totalHoldingsValue === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sync your holdings to see how your allocation compares to the
            recommendation.
          </p>
        ) : (
          <div className="space-y-6">
            {/* At-a-glance summary */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b pb-4 text-xs">
              {mostOverweight && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Most overweight:</span>
                  <span className="font-medium">
                    {ASSET_CLASS_LABELS[mostOverweight.bucket]}
                  </span>
                  <span className="text-amber-600">
                    +{mostOverweight.variance.toFixed(1)}%
                  </span>
                </div>
              )}
              {mostUnderweight && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Most underweight:</span>
                  <span className="font-medium">
                    {ASSET_CLASS_LABELS[mostUnderweight.bucket]}
                  </span>
                  <span className="text-blue-600">
                    {mostUnderweight.variance.toFixed(1)}%
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Balanced:</span>
                <span className="font-medium">
                  {balancedCount} of {buckets.length}
                </span>
              </div>
            </div>

            {/* Asset allocation rows */}
            <div className="space-y-4">
              {buckets
                .sort(
                  (a, b) => actualAllocation[b.bucket] - actualAllocation[a.bucket]
                )
                .map(({ bucket }) => {
                  const recommended = recommendedAllocation[bucket]
                  const actual = actualAllocation[bucket]
                  const variance = allocationVariance[bucket] * 100

                  const isOverweight = variance > 2
                  const isUnderweight = variance < -2
                  const isExtreme = Math.abs(variance) > 10

                  const deltaColor = isOverweight
                    ? "text-amber-600"
                    : isUnderweight
                      ? "text-blue-600"
                      : "text-muted-foreground"

                  return (
                    <div key={bucket} className="space-y-2">
                      {/* Row header */}
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">
                          {ASSET_CLASS_LABELS[bucket]}
                        </span>
                        <div className="flex items-baseline gap-2 font-mono text-xs">
                          <span className="text-muted-foreground">
                            Actual {formatPct(actual)}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            Target {formatPct(recommended)}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className={deltaColor}>
                            Δ {variance >= 0 ? "+" : ""}
                            {variance.toFixed(1)}%
                          </span>
                          {isExtreme && (
                            <span
                              className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                isOverweight
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {isOverweight ? "High" : "Low"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dual-layer bar */}
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
                        {/* Filled bar (actual allocation) */}
                        <div
                          className="h-full bg-foreground/20 transition-all"
                          style={{
                            width: `${Math.min(actual * 100, 100)}%`,
                          }}
                        />
                        {/* Target marker */}
                        <div
                          className="absolute top-0 h-full w-0.5 bg-foreground transition-all"
                          style={{
                            left: `${Math.min(recommended * 100, 100)}%`,
                          }}
                          aria-label={`Target: ${formatPct(recommended)}`}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Action hint */}
            <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">What to do next:</span> {actionHint}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
