import Link from "next/link"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { getStripe } from "@/lib/stripe"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { PlaidLinkButton } from "@/components/plaid-link-button"
import { PlaidLinkCashButton } from "@/components/plaid-link-cash-button"
import { PlaidResyncButton } from "@/components/plaid-resync-button"
import { CashResyncButton } from "@/components/cash-resync-button"
import { OverviewRefreshButton } from "@/components/overview-refresh-button"
import { HoldingsTable } from "@/components/holdings-table"
import { RecommendedAllocationCard } from "@/components/recommended-allocation-card"
import { PortfolioCopilotChat } from "@/components/portfolio-copilot-chat"
import { StatCard } from "@/components/stat-card"
import { DeleteBrokerageButton } from "@/components/delete-brokerage-button"
import { DeleteCashAccountButton } from "@/components/delete-cash-account-button"
import { BillingSection } from "@/components/billing-section"
import { DeleteAccountSection } from "@/components/delete-account-section"
import { aggregateHoldings } from "@/lib/holdings"
import { normalizeTicker } from "@/lib/normalize"
import {
  getRecommendedAllocation,
  calculateAllocationVariance,
  getRecommendationSummary,
  type AssetAllocation,
} from "@/lib/allocation-recommendations"
import {
  getEffectiveClassification,
  type ClassificationMaps,
} from "@/lib/classification"

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
  checkout?: string
}

function getSyncStatus(lastSyncedAt: Date | null): { label: string; variant: "synced" | "stale" | "error" } {
  if (!lastSyncedAt) return { label: "Never synced", variant: "error" }

  const now = new Date()
  const hoursSinceSync = (now.getTime() - lastSyncedAt.getTime()) / (1000 * 60 * 60)

  if (hoursSinceSync < 24) return { label: "Synced", variant: "synced" }
  if (hoursSinceSync < 72) return { label: "Needs refresh", variant: "stale" }
  return { label: "Needs relink", variant: "error" }
}

function SyncStatusBadge({ lastSyncedAt }: { lastSyncedAt: Date | null }) {
  const { label, variant } = getSyncStatus(lastSyncedAt)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        variant === "synced"
          ? "bg-emerald-100 text-emerald-700"
          : variant === "stale"
          ? "bg-amber-100 text-amber-700"
          : "bg-rose-100 text-rose-700"
      }`}
    >
      {label}
    </span>
  )
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

// Classification logic now imported from @/lib/classification

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
  const checkoutStatus = resolvedSearchParams?.checkout

  const [accounts, cashAccounts, profile, user] = await Promise.all([
    prisma.brokerageAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cashAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        subscriptionEndsAt: true,
        stripeSubscriptionId: true,
      },
    }),
  ])

  // Subscription gating: redirect to paywall if not an active subscriber
  // "canceling" means user canceled but still has access until period ends
  let isSubscribed =
    user?.subscriptionStatus === "active" ||
    user?.subscriptionStatus === "trialing" ||
    user?.subscriptionStatus === "canceling"

  // Handle race condition: if coming from checkout success but webhook hasn't updated yet,
  // verify subscription directly with Stripe
  if (!isSubscribed && checkoutStatus === "success" && user?.stripeCustomerId) {
    try {
      const stripe = getStripe()
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      })

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0]
        // Update the database with the subscription info
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
          },
        })
        isSubscribed = true
      }
    } catch (error) {
      console.error("Error verifying subscription with Stripe:", error)
    }
  }

  if (!isSubscribed && process.env.STRIPE_PRICE_ID) {
    redirect("/paywall")
  }

  const accountIds = accounts.map((a: { id: string }) => a.id)

  // Fetch holdings and latest snapshot for each account
  // We need per-account latest snapshots to properly aggregate daily change
  const [holdings, latestSnapshots] = accountIds.length
    ? await Promise.all([
        prisma.holding.findMany({
          where: { brokerageAccountId: { in: accountIds } },
        }),
        // Get the most recent snapshot for each account
        // Using a raw query approach via multiple queries grouped by account
        Promise.all(
          accountIds.map((accountId: string) =>
            prisma.dailySnapshot.findFirst({
              where: { brokerageAccountId: accountId },
              orderBy: { date: "desc" },
            })
          )
        ),
      ])
    : [[], []]

  // Filter out null snapshots and find the most recent date across all accounts
  const validSnapshots = latestSnapshots.filter(
    (s): s is NonNullable<typeof s> => s !== null
  )
  const latestSnapshotDate = validSnapshots.length > 0
    ? validSnapshots.reduce((latest, s) => (s.date > latest ? s.date : latest), validSnapshots[0].date)
    : null
  const latestSnapshot = validSnapshots.length > 0
    ? validSnapshots.find((s) => s.date.getTime() === latestSnapshotDate?.getTime()) ?? validSnapshots[0]
    : null

  const tickers = Array.from(
    new Set(
      holdings
        .map((holding: { ticker: string | null }) => normalizeTicker(holding.ticker ?? null))
        .filter((ticker): ticker is string => Boolean(ticker))
    )
  )

  const overrides = tickers.length
    ? await prisma.userSecurityOverride.findMany({
        where: { userId, tickerNormalized: { in: tickers } },
      })
    : []

  const fundProfiles = tickers.length
    ? await prisma.fundProfile.findMany({
        where: { ticker: { in: tickers } },
      })
    : []

  const classificationMaps: ClassificationMaps = {
    overrideMap: new Map(
      overrides.map((override: { tickerNormalized: string; assetClass: string; geography: string | null; style: string | null }) => [normalizeTicker(override.tickerNormalized)!, override])
    ),
    fundProfileMap: new Map(
      fundProfiles.map((profile: { ticker: string; assetClass: string | null; geography: string | null; style: string | null }) => [normalizeTicker(profile.ticker)!, profile])
    ),
  }

  const latestSyncAt = accounts.reduce<Date | null>((latest, acct) => {
    if (!acct.lastSyncedAt) return latest
    if (!latest || acct.lastSyncedAt > latest) return acct.lastSyncedAt
    return latest
  }, null)

  const holdingsWithValue = holdings
    .map((holding) => {
      const classification = getEffectiveClassification(
        holding,
        classificationMaps
      )
      const normalizedTicker = normalizeTicker(holding.ticker ?? null)

      return {
        holding: {
          ...holding,
          assetClass: classification.assetClass,
          geography: classification.geography,
          style: classification.style,
        },
        normalizedTicker,
        classificationSource: classification.source,
        needsReview: classification.needsReview,
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
  )

  const aggregatedHoldingsWithClassification = aggregatedHoldings.map((holding) => {
    const classification = getEffectiveClassification(
      {
        ticker: holding.ticker,
        assetClass: holding.assetClass,
        geography: holding.geography,
        style: holding.style,
        securityType: holding.securityType,
      },
      classificationMaps
    )

    return {
      ...holding,
      effectiveAssetClass: classification.assetClass,
      effectiveSource: classification.source,
      hasOverride: classification.source === "override",
      needsReview: classification.needsReview,
      tickerNormalized: normalizeTicker(holding.ticker ?? null),
    }
  })

  const totalHoldingsValue = holdingsWithValue.reduce(
    (sum, row) => sum + row.marketValue,
    0
  )

  const totalRawValue = holdingsWithValue.reduce(
    (sum, row) => sum + toNumber(row.holding.value),
    0
  )
  const classifiedValue = holdingsWithValue.reduce(
    (sum, row) => (row.needsReview ? sum : sum + toNumber(row.holding.value)),
    0
  )
  const needsReviewValue = Math.max(totalRawValue - classifiedValue, 0)
  const classifiedPct = totalRawValue > 0 ? classifiedValue / totalRawValue : 0
  const needsReviewPct = totalRawValue > 0 ? needsReviewValue / totalRawValue : 0
  const needsReviewHoldings = holdingsWithValue.filter(
    (row) => row.needsReview
  )

  // Aggregate snapshot values across all accounts
  const aggregatedSnapshotTotalValue = validSnapshots.reduce(
    (sum, s) => sum + toNumber(s.totalValue),
    0
  )
  const aggregatedChangeAbs = validSnapshots.reduce(
    (sum, s) => (s.changeAbs != null ? sum + toNumber(s.changeAbs) : sum),
    0
  )
  // For percentage, we need to compute based on previous total value
  // If any snapshot has changeAbs but missing changePct, we handle gracefully
  const hasAnyPreviousSnapshot = validSnapshots.some((s) => s.changeAbs != null)
  const aggregatedPrevTotalValue = hasAnyPreviousSnapshot
    ? aggregatedSnapshotTotalValue - aggregatedChangeAbs
    : null
  const aggregatedChangePct =
    aggregatedPrevTotalValue != null && aggregatedPrevTotalValue > 0
      ? aggregatedChangeAbs / aggregatedPrevTotalValue
      : null

  const snapshotTotalValue = aggregatedSnapshotTotalValue > 0 ? aggregatedSnapshotTotalValue : null
  const snapshotMatchesSync =
    latestSnapshot && latestSyncAt ? isSameUtcDate(latestSnapshot.date, latestSyncAt) : false
  const snapshotMissingOrStale =
    totalHoldingsValue > 0 && (!latestSnapshot || !snapshotMatchesSync)

  // Calculate total cash account balance (checking/savings accounts)
  const totalCashAccountBalance = cashAccounts.reduce(
    (sum, account) => sum + toNumber(account.balance),
    0
  )

  // Total portfolio value includes holdings + cash accounts
  const totalPortfolioValue = totalHoldingsValue + totalCashAccountBalance
  const displayTotalValue = totalPortfolioValue > 0 ? totalPortfolioValue : snapshotTotalValue ?? 0
  const totalsDelta =
    snapshotTotalValue != null && totalHoldingsValue > 0
      ? totalHoldingsValue - snapshotTotalValue
      : null

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

  // Add cash account balances to the cash bucket
  allocationBuckets.cash += totalCashAccountBalance

  const allocationRows = (Object.keys(allocationBuckets) as Array<
    keyof typeof allocationBuckets
  >).map((bucket) => {
    const value = allocationBuckets[bucket]
    const pct = totalPortfolioValue > 0 ? value / totalPortfolioValue : 0
    return { bucket, value, pct }
  }).sort((a, b) => b.value - a.value)

  // Calculate recommended allocation based on user profile
  const actualAllocation: AssetAllocation = {
    us_equity: allocationBuckets.us_equity / (totalPortfolioValue || 1),
    intl_equity: allocationBuckets.intl_equity / (totalPortfolioValue || 1),
    bonds: allocationBuckets.bonds / (totalPortfolioValue || 1),
    cash: allocationBuckets.cash / (totalPortfolioValue || 1),
    other: allocationBuckets.other / (totalPortfolioValue || 1),
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

  const allHoldings = aggregatedHoldingsWithClassification

  // Calculate total value per brokerage account
  const brokerageAccountTotals = new Map<string, number>()
  holdingsWithValue.forEach((row) => {
    const accountId = row.holding.brokerageAccountId
    const currentTotal = brokerageAccountTotals.get(accountId) || 0
    brokerageAccountTotals.set(accountId, currentTotal + row.marketValue)
  })

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-muted-foreground">Portfolio summary and insights.</p>
            {latestSyncAt && (
              <p className="text-xs text-muted-foreground">
                Last updated: {latestSyncAt.toLocaleString()}
              </p>
            )}
          </div>
          {checkoutStatus === "success" && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
              Welcome! Your subscription is now active.
            </div>
          )}
        </div>

        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="brokerage">Brokerage</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 min-w-0">
            {accounts.length === 0 && cashAccounts.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Connect your accounts</CardTitle>
                  <CardDescription>
                    Link brokerage or cash accounts to unlock holdings, allocation, and performance insights.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href="/dashboard?tab=brokerage"
                    className={buttonVariants({ variant: "default", size: "default" })}
                  >
                    Connect an account
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-12">
                  <StatCard
                    className="lg:col-span-4"
                    label="Total Value"
                    value={(accounts.length || cashAccounts.length) ? formatCurrency(displayTotalValue) : "--"}
                    helper={
                      snapshotMatchesSync &&
                      totalsDelta != null &&
                      Math.abs(totalsDelta) > 0.01
                        ? `Holdings sum differs by ${formatCurrency(totalsDelta)}`
                        : ""
                    }
                  />

                  <StatCard
                    className="lg:col-span-4"
                    label="Daily Change"
                    value={
                      hasAnyPreviousSnapshot
                        ? formatCurrency(aggregatedChangeAbs)
                        : "--"
                    }
                    badge={
                      hasAnyPreviousSnapshot && aggregatedChangePct != null
                        ? formatPct(aggregatedChangePct)
                        : null
                    }
                    helper={
                      hasAnyPreviousSnapshot
                        ? `${aggregatedChangeAbs >= 0 ? "Up" : "Down"} ${formatCurrency(
                          Math.abs(aggregatedChangeAbs)
                        )}`
                        : "No previous snapshot to compare"
                    }
                  />

                  <Card className="lg:col-span-4">
                    <CardHeader>
                      <CardDescription>Actions</CardDescription>
                      <CardTitle>Refresh holdings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <OverviewRefreshButton />
                      {latestSnapshot ? (
                        <p className="text-xs text-muted-foreground">
                          Last snapshot: {latestSnapshot.date.toLocaleDateString()}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                {accounts.length > 0 && totalHoldingsValue === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Sync in progress</CardTitle>
                      <CardDescription>
                        We’re pulling in your latest positions. Check back in a few minutes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <OverviewRefreshButton />
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-12 min-w-0">
                  <div className="lg:col-span-8 space-y-4 min-w-0">
                    <Card>
                      <CardHeader>
                        <CardTitle>Allocation (current)</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {totalPortfolioValue === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            No holdings yet. Sync a brokerage or cash account to see
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

                    <RecommendedAllocationCard
                      actualAllocation={actualAllocation}
                      recommendedAllocation={recommendedAllocation}
                      allocationVariance={allocationVariance}
                      recommendationSummary={recommendationSummary}
                      totalHoldingsValue={totalPortfolioValue}
                      hasProfile={!!(profile?.ageRange || profile?.riskTolerance || profile?.timeHorizon)}
                      ASSET_CLASS_LABELS={ASSET_CLASS_LABELS}
                    />
                  </div>

                  <div className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start min-w-0">
                    <PortfolioCopilotChat />
                  </div>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>All holdings</CardTitle>
                      <CardDescription>
                        Full list of positions across linked accounts.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <HoldingsTable holdings={allHoldings} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Classification coverage</CardTitle>
                      <CardDescription>
                        Review holdings missing a trusted classification.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div>
                          Classified:{" "}
                          <span className="font-medium">
                            {formatPct(classifiedPct)}
                          </span>
                        </div>
                        <div>
                          Needs review:{" "}
                          <span className="font-medium">
                            {formatPct(needsReviewPct)}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            ({formatCurrency(needsReviewValue)})
                          </span>
                        </div>
                      </div>

                      {needsReviewHoldings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          All holdings are classified.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Holding</TableHead>
                              <TableHead>Ticker</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {needsReviewHoldings.map((row) => (
                              <TableRow key={row.holding.id}>
                                <TableCell>
                                  <div className="text-sm font-medium">
                                    {row.holding.name}
                                  </div>
                                </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {row.normalizedTicker ?? "--"}
                                  </TableCell>
                                <TableCell className="text-sm">
                                  {formatCurrency(toNumber(row.holding.value))}
                                </TableCell>
                                <TableCell>
                                  {row.classificationSource === "override" ? (
                                    <span className="text-xs text-emerald-600">
                                      Overridden
                                    </span>
                                  ) : row.needsReview ? (
                                    row.normalizedTicker ? (
                                      <span className="text-xs text-rose-600">
                                        Needs review
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        Needs review (no ticker)
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Classified
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="brokerage" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  Connect a brokerage
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Beta
                  </span>
                </CardTitle>
                <CardDescription>
                  Link accounts to unlock holdings, allocation, and performance insights.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PlaidLinkButton />
                <p className="text-xs text-muted-foreground">
                  Note: Some institutions may not connect reliably yet.
                </p>
                {accounts.length > 0 && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="space-y-2">
                      {accounts.map((acct) => {
                        const accountTotal = brokerageAccountTotals.get(acct.id) || 0
                        return (
                          <div
                            key={acct.id}
                            className="flex items-center justify-between rounded-md border px-3 py-2"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <span>{acct.institution ?? "Brokerage"}</span>
                                <SyncStatusBadge lastSyncedAt={acct.lastSyncedAt} />
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {acct.name ?? "Account"}
                                {acct.mask ? ` ****${acct.mask}` : ""}
                              </div>
                              {accountTotal > 0 && (
                                <div className="mt-1 text-sm font-semibold">
                                  {formatCurrency(accountTotal)}
                                </div>
                              )}
                              {acct.lastSyncedAt && (
                                <div className="text-[10px] text-muted-foreground">
                                  Last synced: {acct.lastSyncedAt.toLocaleString()}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <PlaidResyncButton
                                brokerageAccountId={acct.id}
                              />
                              <DeleteBrokerageButton
                                brokerageAccountId={acct.id}
                                institutionName={acct.institution}
                                accountName={acct.name}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="cash" className="border-b-0">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-2">
                      <div className="text-left">
                        <div className="flex items-center gap-2 text-base font-semibold">
                          Cash (optional)
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Beta
                          </span>
                        </div>
                        <p className="text-sm font-normal text-muted-foreground">
                          Include checking/savings balances in allocation
                        </p>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {totalCashAccountBalance > 0
                          ? `Cash included: ${formatCurrency(totalCashAccountBalance)}`
                          : "Cash not included"}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-4">
                      <PlaidLinkCashButton />
                      <p className="text-xs text-muted-foreground">
                        Cash account balances are added to your portfolio's "Cash" allocation.
                      </p>
                      {cashAccounts.length > 0 && (
                        <div className="space-y-3">
                          <Separator />
                          <div className="space-y-2">
                            {cashAccounts.map((acct) => {
                              const balance = toNumber(acct.balance)
                              return (
                                <div
                                  key={acct.id}
                                  className="flex items-center justify-between rounded-md border px-3 py-2"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                      <span>{acct.institution ?? "Cash Account"}</span>
                                      <SyncStatusBadge lastSyncedAt={acct.lastSyncedAt} />
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                      {acct.name ?? "Account"}
                                      {acct.mask ? ` ****${acct.mask}` : ""}
                                      {acct.type ? ` (${acct.type})` : ""}
                                    </div>
                                    {balance > 0 && (
                                      <div className="mt-1 text-sm font-semibold">
                                        {formatCurrency(balance)}
                                      </div>
                                    )}
                                    {acct.lastSyncedAt && (
                                      <div className="text-[10px] text-muted-foreground">
                                        Last synced: {acct.lastSyncedAt.toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <CashResyncButton cashAccountId={acct.id} />
                                    <DeleteCashAccountButton
                                      cashAccountId={acct.id}
                                      institutionName={acct.institution}
                                      accountName={acct.name}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-6">
            <BillingSection
              subscriptionStatus={
                user?.subscriptionStatus as
                  | "active"
                  | "trialing"
                  | "canceling"
                  | "canceled"
                  | "past_due"
                  | null
              }
              subscriptionEndsAt={user?.subscriptionEndsAt ?? null}
              hasStripeCustomer={!!user?.stripeCustomerId}
            />

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

            <DeleteAccountSection
              hasActiveSubscription={
                user?.subscriptionStatus === "active" ||
                user?.subscriptionStatus === "trialing"
              }
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
