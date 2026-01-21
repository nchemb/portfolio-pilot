import Link from "next/link"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { PlaidLinkButton } from "@/components/plaid-link-button"
import { PlaidResyncButton } from "@/components/plaid-resync-button"
import { OverviewRefreshButton } from "@/components/overview-refresh-button"
import { HoldingBreakdownRow } from "@/components/holding-breakdown-row"
import { RecommendedAllocationCard } from "@/components/recommended-allocation-card"
import { aggregateHoldings } from "@/lib/holdings"
import {
  getRecommendedAllocation,
  calculateAllocationVariance,
  getRecommendationSummary,
  type AssetAllocation,
} from "@/lib/allocation-recommendations"

export const dynamic = "force-dynamic"

const AGE_RANGES = ["20-29", "30-39", "40-49", "50+"] as const
const RISK_LEVELS = ["low", "medium", "high"] as const
const HORIZONS = ["short", "medium", "long"] as const

const ASSET_CLASS_LABELS: Record<string, string> = {
  us_equity: "US Equity",
  intl_equity: "International Equity",
  bonds: "Bonds",
  cash: "Cash",
  other: "Other",
}

type SearchParams = {
  tab?: string
  saved?: string
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value) {
    const maybeDecimal = value as { toNumber: () => number }
    return maybeDecimal.toNumber()
  }
  return 0
}

function holdingMarketValue(holding: {
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
  const isCash =
    holding.securityType === "cash" || holding.assetClass === "cash"

  const directOk = Number.isFinite(direct) && direct > 0
  const derivedOk = Number.isFinite(derived) && derived > 0

  // Prefer an explicit value when it looks sane, but if we can derive a value
  // from price * quantity and it materially differs (common for cash rows where
  // quantity is the balance and price is 1), prefer the derived value.
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

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function assetClassBucket(assetClass?: string | null) {
  if (assetClass === "us_equity") return "us_equity"
  if (assetClass === "intl_equity") return "intl_equity"
  if (assetClass === "bonds") return "bonds"
  if (assetClass === "cash") return "cash"
  return "other"
}

function normalizeTicker(ticker?: string | null) {
  const trimmed = ticker?.trim()
  return trimmed ? trimmed.toUpperCase() : null
}

function resolveAssetClass(
  fundProfileByTicker: Map<string, { assetClass: string | null }>,
  ticker?: string | null,
  fallback?: string | null
) {
  const normalized = normalizeTicker(ticker)
  const profile = normalized ? fundProfileByTicker.get(normalized) : undefined
  return profile?.assetClass ?? fallback ?? null
}

function resolveGeography(
  fundProfileByTicker: Map<string, { geography: string | null }>,
  ticker?: string | null,
  fallback?: string | null
) {
  const normalized = normalizeTicker(ticker)
  const profile = normalized ? fundProfileByTicker.get(normalized) : undefined
  return profile?.geography ?? fallback ?? null
}

function resolveStyle(
  fundProfileByTicker: Map<string, { style: string | null }>,
  ticker?: string | null,
  fallback?: string | null
) {
  const normalized = normalizeTicker(ticker)
  const profile = normalized ? fundProfileByTicker.get(normalized) : undefined
  return profile?.style ?? fallback ?? null
}

function isSameUtcDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

async function updateProfile(formData: FormData) {
  "use server"
  const { userId } = await auth()
  if (!userId) {
    redirect("/dashboard")
  }

  const ageRange = formData.get("ageRange")?.toString() ?? ""
  const riskTolerance = formData.get("riskTolerance")?.toString() ?? ""
  const timeHorizon = formData.get("timeHorizon")?.toString() ?? ""

  const nextAgeRange = AGE_RANGES.includes(ageRange as (typeof AGE_RANGES)[number])
    ? ageRange
    : null
  const nextRisk = RISK_LEVELS.includes(riskTolerance as (typeof RISK_LEVELS)[number])
    ? riskTolerance
    : null
  const nextHorizon = HORIZONS.includes(timeHorizon as (typeof HORIZONS)[number])
    ? timeHorizon
    : null

  await prisma.profile.upsert({
    where: { userId },
    update: {
      ageRange: nextAgeRange,
      riskTolerance: nextRisk,
      timeHorizon: nextHorizon,
    },
    create: {
      userId,
      ageRange: nextAgeRange,
      riskTolerance: nextRisk,
      timeHorizon: nextHorizon,
    },
  })

  revalidatePath("/dashboard")
  redirect("/dashboard?saved=1&tab=settings")
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const { userId } = await auth()

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Please sign in to view your dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/sign-in">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeTab = resolvedSearchParams?.tab ?? "overview"
  const saved = resolvedSearchParams?.saved === "1"

  const [accounts, profile, user] = await Promise.all([
    prisma.brokerageAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ])

  const accountIds = accounts.map((a) => a.id)

  const [holdings, latestSnapshot] = accountIds.length
    ? await Promise.all([
        prisma.holding.findMany({
          where: { brokerageAccountId: { in: accountIds } },
        }),
        prisma.dailySnapshot.findFirst({
          where: { brokerageAccountId: { in: accountIds } },
          orderBy: { date: "desc" },
        }),
      ])
    : [[], null]

  const fundProfiles =
    holdings.length > 0
      ? await prisma.fundProfile.findMany({
          where: {
            ticker: {
              in: Array.from(
                new Set(
                  holdings
                    .map((holding) => normalizeTicker(holding.ticker))
                    .filter((ticker): ticker is string => Boolean(ticker))
                )
              ),
            },
          },
      })
    : []

  const fundProfileByTicker = new Map(
    fundProfiles.map((profile) => [profile.ticker.toUpperCase(), profile])
  )

  const latestSyncAt = accounts.reduce<Date | null>((latest, acct) => {
    if (!acct.lastSyncedAt) return latest
    if (!latest || acct.lastSyncedAt > latest) return acct.lastSyncedAt
    return latest
  }, null)

  const holdingsWithValue = holdings
    .map((holding) => {
      const assetClass = resolveAssetClass(
        fundProfileByTicker,
        holding.ticker,
        holding.assetClass
      )
      const geography = resolveGeography(
        fundProfileByTicker,
        holding.ticker,
        holding.geography
      )
      const style = resolveStyle(
        fundProfileByTicker,
        holding.ticker,
        holding.style
      )

      return {
        holding: {
          ...holding,
          assetClass,
          geography,
          style,
        },
        marketValue: holdingMarketValue(holding),
      }
    })
    .sort((a, b) => b.marketValue - a.marketValue)

  const aggregatedHoldings = aggregateHoldings(
    holdingsWithValue.map((row) => ({
      ...row.holding,
      marketValue: row.marketValue,
    })),
    accounts
  ).map((holding) => ({
    ...holding,
    assetClass: resolveAssetClass(
      fundProfileByTicker,
      holding.ticker,
      holding.assetClass
    ),
    geography: resolveGeography(
      fundProfileByTicker,
      holding.ticker,
      holding.geography
    ),
    style: resolveStyle(
      fundProfileByTicker,
      holding.ticker,
      holding.style
    ),
  }))

  const totalHoldingsValue = holdingsWithValue.reduce(
    (sum, row) => sum + row.marketValue,
    0
  )

  const snapshotTotalValue = latestSnapshot ? toNumber(latestSnapshot.totalValue) : null
  const displayTotalValue = totalHoldingsValue > 0 ? totalHoldingsValue : snapshotTotalValue ?? 0
  const totalsDelta =
    snapshotTotalValue != null && totalHoldingsValue > 0
      ? totalHoldingsValue - snapshotTotalValue
      : null
  const snapshotMatchesSync =
    latestSnapshot && latestSyncAt ? isSameUtcDate(latestSnapshot.date, latestSyncAt) : false
  const snapshotMissingOrStale =
    totalHoldingsValue > 0 && (!latestSnapshot || !snapshotMatchesSync)

  const allocationBuckets = holdingsWithValue.reduce(
    (acc, row) => {
      const bucket = assetClassBucket(row.holding.assetClass)
      acc[bucket] += row.marketValue
      return acc
    },
    {
      us_equity: 0,
      intl_equity: 0,
      bonds: 0,
      cash: 0,
      other: 0,
    }
  )

  const allocationRows = (Object.keys(allocationBuckets) as Array<
    keyof typeof allocationBuckets
  >).map((bucket) => {
    const value = allocationBuckets[bucket]
    const pct = totalHoldingsValue > 0 ? value / totalHoldingsValue : 0
    return { bucket, value, pct }
  }).sort((a, b) => b.value - a.value)

  // Calculate recommended allocation based on user profile
  const actualAllocation: AssetAllocation = {
    us_equity: allocationBuckets.us_equity / (totalHoldingsValue || 1),
    intl_equity: allocationBuckets.intl_equity / (totalHoldingsValue || 1),
    bonds: allocationBuckets.bonds / (totalHoldingsValue || 1),
    cash: allocationBuckets.cash / (totalHoldingsValue || 1),
    other: allocationBuckets.other / (totalHoldingsValue || 1),
  }

  const recommendedAllocation = getRecommendedAllocation({
    ageRange: profile?.ageRange,
    riskTolerance: profile?.riskTolerance,
    timeHorizon: profile?.timeHorizon,
  })

  const allocationVariance = calculateAllocationVariance(
    actualAllocation,
    recommendedAllocation
  )

  const recommendationSummary = getRecommendationSummary(
    profile ?? {},
    recommendedAllocation
  )

  const allHoldings = aggregatedHoldings

  const summaryParts = {
    us: allocationRows.find((row) => row.bucket === "us_equity")?.pct ?? 0,
    intl: allocationRows.find((row) => row.bucket === "intl_equity")?.pct ?? 0,
    bonds: allocationRows.find((row) => row.bucket === "bonds")?.pct ?? 0,
    cash: allocationRows.find((row) => row.bucket === "cash")?.pct ?? 0,
  }

  const topPositions = allHoldings
    .slice(0, 3)
    .map((row) => row.ticker ?? row.name)
    .join(", ")

  const summaryText =
    totalHoldingsValue > 0
      ? `You're mostly in US equities (${formatPct(summaryParts.us)}). International (${formatPct(
          summaryParts.intl
        )}), bonds (${formatPct(summaryParts.bonds)}), cash (${formatPct(
          summaryParts.cash
        )}). Top positions: ${topPositions || "--"}.`
      : accounts.length > 0
        ? "Sync your brokerage to see a portfolio summary."
        : "Add a brokerage account to see a portfolio summary."

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-muted-foreground">
              A quick look at your portfolio health and preferences.
            </p>
          </div>
        </div>

        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="brokerage">Brokerage</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
            {accounts.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No brokerage connected</CardTitle>
                  <CardDescription>
                    Connect an account to view holdings, allocation, and daily
                    performance.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link href="/dashboard?tab=brokerage">
                      Go to Brokerage
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    Keep your holdings up to date.
                  </div>
                  <OverviewRefreshButton />
                </div>

                {accounts.length > 0 && totalHoldingsValue === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>No holdings yet</CardTitle>
                      <CardDescription>
                        Run a refresh to pull in your latest positions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <OverviewRefreshButton />
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardDescription>Total Value</CardDescription>
                      <CardTitle>
                        {accounts.length ? formatCurrency(displayTotalValue) : "--"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {latestSnapshot ? (
                        <p className="text-muted-foreground text-sm">
                          Snapshot as of {latestSnapshot.date.toLocaleDateString()}
                        </p>
                      ) : (
                        <Skeleton className="h-4 w-32" />
                      )}

                      {snapshotMissingOrStale ? (
                        <p className="text-muted-foreground text-xs">
                          Snapshot not available yet.
                        </p>
                      ) : null}

                      {snapshotMatchesSync &&
                      totalsDelta != null &&
                      Math.abs(totalsDelta) > 0.01 ? (
                        <p className="text-xs text-muted-foreground">
                          Holdings sum differs by {formatCurrency(totalsDelta)}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardDescription>Daily Change</CardDescription>
                      <CardTitle className="flex flex-wrap items-baseline gap-x-2">
                        {latestSnapshot?.changeAbs != null
                          ? formatCurrency(toNumber(latestSnapshot.changeAbs))
                          : "--"}
                        <span className="text-sm text-muted-foreground">
                          {latestSnapshot?.changePct != null
                            ? formatPct(toNumber(latestSnapshot.changePct))
                            : "--"}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestSnapshot?.changeAbs != null ? (
                        <p
                          className={`text-sm ${
                            toNumber(latestSnapshot.changeAbs) >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {toNumber(latestSnapshot.changeAbs) >= 0
                            ? "Up"
                            : "Down"} {formatCurrency(Math.abs(toNumber(latestSnapshot.changeAbs)))}
                          {latestSnapshot?.changePct != null
                            ? ` (${formatPct(Math.abs(toNumber(latestSnapshot.changePct)))})`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">--</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Current allocation breakdown</CardTitle>
                      <CardDescription>
                        Based on your current holdings.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {totalHoldingsValue === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No holdings yet. Sync a brokerage account to see
                          allocation details.
                        </p>
                      ) : (
                        allocationRows.map((row) => (
                          <div
                            key={row.bucket}
                            className="flex items-center justify-between"
                          >
                            <span className="text-sm">
                              {ASSET_CLASS_LABELS[row.bucket]}
                            </span>
                            <span className="text-sm font-medium">
                              {formatPct(row.pct)}
                            </span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Plain-English summary</CardTitle>
                      <CardDescription>
                        A quick narrative of your current mix.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {summaryText}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <RecommendedAllocationCard
                  actualAllocation={actualAllocation}
                  recommendedAllocation={recommendedAllocation}
                  allocationVariance={allocationVariance}
                  recommendationSummary={recommendationSummary}
                  totalHoldingsValue={totalHoldingsValue}
                  hasProfile={!!(profile?.ageRange || profile?.riskTolerance || profile?.timeHorizon)}
                  ASSET_CLASS_LABELS={ASSET_CLASS_LABELS}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>All holdings</CardTitle>
                    <CardDescription>
                      Full list of positions across linked accounts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticker / Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Security Type</TableHead>
                          <TableHead>Asset Class</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allHoldings.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center">
                              No holdings to display.
                            </TableCell>
                          </TableRow>
                        ) : (
                          allHoldings.map((holding) => {
                            const bucket = assetClassBucket(holding.assetClass)
                            return (
                              <HoldingBreakdownRow
                                key={holding.key}
                                holding={holding}
                                bucketLabel={ASSET_CLASS_LABELS[bucket]}
                              />
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="brokerage" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connect a brokerage</CardTitle>
                <CardDescription>
                  Link a read-only account to sync holdings and performance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PlaidLinkButton />
                {accounts.length > 0 && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="space-y-2">
                      {accounts.map((acct) => (
                        <div
                          key={acct.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span>{acct.institution ?? "Brokerage"}</span>
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {acct.name ?? "Account"}
                              {acct.mask ? ` ****${acct.mask}` : ""}
                            </div>
                          </div>
                          <PlaidResyncButton
                            brokerageAccountId={acct.id}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile settings</CardTitle>
                <CardDescription>
                  Update your preferences so recommendations fit your goals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={updateProfile} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="userId">
                        User ID
                      </label>
                      <Input id="userId" value={userId} readOnly />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="email">
                        Email
                      </label>
                      <Input
                        id="email"
                        value={user?.email ?? "--"}
                        readOnly
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor="ageRange"
                      >
                        Age range
                      </label>
                      <Select
                        id="ageRange"
                        name="ageRange"
                        defaultValue={profile?.ageRange ?? ""}
                      >
                        <option value="" disabled>
                          Select range
                        </option>
                        {AGE_RANGES.map((range) => (
                          <option key={range} value={range}>
                            {range}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor="riskTolerance"
                      >
                        Risk tolerance
                      </label>
                      <Select
                        id="riskTolerance"
                        name="riskTolerance"
                        defaultValue={profile?.riskTolerance ?? ""}
                      >
                        <option value="" disabled>
                          Select level
                        </option>
                        {RISK_LEVELS.map((risk) => (
                          <option key={risk} value={risk}>
                            {risk}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor="timeHorizon"
                      >
                        Time horizon
                      </label>
                      <Select
                        id="timeHorizon"
                        name="timeHorizon"
                        defaultValue={profile?.timeHorizon ?? ""}
                      >
                        <option value="" disabled>
                          Select horizon
                        </option>
                        {HORIZONS.map((horizon) => (
                          <option key={horizon} value={horizon}>
                            {horizon}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button type="submit">Save settings</Button>
                    {saved && (
                      <span className="text-sm text-emerald-600">Saved</span>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
