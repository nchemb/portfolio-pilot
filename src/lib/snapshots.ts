import { type DailySnapshot } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

import { prisma } from "@/lib/prisma"

/**
 * Normalizes a Date to midnight UTC (00:00:00.000 UTC).
 * Used to create consistent snapshot dates across the application.
 */
export function normalizeUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

/**
 * Converts a value to Prisma Decimal, handling various input types.
 */
function toDecimal(value?: number | null): Decimal {
  return new Decimal(value ?? 0)
}

/**
 * Converts a Prisma Decimal or other numeric value to a number.
 */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object" && "toNumber" in value) {
    const maybeDecimal = value as { toNumber: () => number }
    return maybeDecimal.toNumber()
  }
  return 0
}

/**
 * Computes the total market value for a brokerage account based on its holdings.
 *
 * Market value logic per holding:
 * - If holding.value is present and > 0, use it
 * - Otherwise, fallback to quantity * price
 * - If both fail, contribute 0
 *
 * Uses Prisma Decimal math for precision.
 */
export async function computeAccountTotalValue(
  accountId: string
): Promise<Decimal> {
  const holdings = await prisma.holding.findMany({
    where: { brokerageAccountId: accountId },
  })

  let total = new Decimal(0)

  for (const holding of holdings) {
    const directValue = toNumber(holding.value)
    const price = toNumber(holding.price)
    const quantity = toNumber(holding.quantity)
    const derivedValue = price * quantity

    // Prefer direct value if sane, otherwise use derived
    if (Number.isFinite(directValue) && directValue > 0) {
      total = total.plus(new Decimal(directValue))
    } else if (Number.isFinite(derivedValue) && derivedValue > 0) {
      total = total.plus(new Decimal(derivedValue))
    }
    // else contribute 0
  }

  return total
}

/**
 * Upserts a daily snapshot for a brokerage account.
 *
 * - Computes today's total value from holdings
 * - Finds the most recent snapshot strictly before today
 * - Calculates changeAbs and changePct based on that previous snapshot
 * - Upserts the snapshot for today (creates if new, updates if exists)
 *
 * This ensures:
 * - No duplicate snapshots (unique constraint on brokerageAccountId + date)
 * - Deterministic daily change calculations
 * - computedAt is updated on each upsert
 *
 * Phase 1 Note: Snapshots represent the value at the last sync time that day.
 * To lock values at market close (4:00 PM ET), a cron job can be added later
 * that calls the refresh + snapshot flow at 4:10 PM ET. This is not implemented
 * here; only the comment is added per requirements.
 */
export async function upsertDailySnapshotForAccount(
  accountId: string
): Promise<DailySnapshot> {
  const now = new Date()
  const today = normalizeUtcDay(now)

  console.log("[upsertDailySnapshotForAccount] Starting for account:", accountId)
  console.log("[upsertDailySnapshotForAccount] Today (normalized):", today.toISOString())

  // Compute today's total value from holdings
  const totalValue = await computeAccountTotalValue(accountId)
  console.log("[upsertDailySnapshotForAccount] Computed totalValue:", totalValue.toString())

  // Find the most recent snapshot strictly before today
  const previousSnapshot = await prisma.dailySnapshot.findFirst({
    where: {
      brokerageAccountId: accountId,
      date: { lt: today },
    },
    orderBy: { date: "desc" },
  })

  // Calculate change metrics
  let changeAbs: Decimal | null = null
  let changePct: Decimal | null = null

  if (previousSnapshot) {
    const prevValue = previousSnapshot.totalValue
    changeAbs = totalValue.minus(prevValue)

    // Only calculate percentage if previous value is not zero
    if (!prevValue.isZero()) {
      changePct = changeAbs.dividedBy(prevValue)
    }
  }

  // Upsert snapshot for today
  console.log("[upsertDailySnapshotForAccount] About to upsert snapshot with:", {
    accountId,
    date: today.toISOString(),
    totalValue: totalValue.toString(),
    changeAbs: changeAbs?.toString() ?? null,
    changePct: changePct?.toString() ?? null,
  })

  try {
    const snapshot = await prisma.dailySnapshot.upsert({
      where: {
        brokerageAccountId_date: {
          brokerageAccountId: accountId,
          date: today,
        },
      },
      update: {
        totalValue,
        changeAbs,
        changePct,
        computedAt: now,
      },
      create: {
        brokerageAccountId: accountId,
        date: today,
        totalValue,
        changeAbs,
        changePct,
        computedAt: now,
      },
    })

    console.log("[upsertDailySnapshotForAccount] Snapshot upserted successfully:", snapshot.id)
    return snapshot
  } catch (error) {
    console.error("[upsertDailySnapshotForAccount] Error upserting snapshot:", error)
    throw error
  }
}

/**
 * Upserts daily snapshots for multiple brokerage accounts.
 * Returns an array of the created/updated snapshots.
 */
export async function upsertDailySnapshotsForAccounts(
  accountIds: string[]
): Promise<DailySnapshot[]> {
  const snapshots: DailySnapshot[] = []

  for (const accountId of accountIds) {
    const snapshot = await upsertDailySnapshotForAccount(accountId)
    snapshots.push(snapshot)
  }

  return snapshots
}
