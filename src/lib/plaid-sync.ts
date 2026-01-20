import { Prisma, type BrokerageAccount } from "@prisma/client"

import { plaidClient } from "@/lib/plaid"
import { prisma } from "@/lib/prisma"

type PlaidSecurity = {
  security_id: string
  name?: string | null
  ticker_symbol?: string | null
  type?: string | null
  is_cash_equivalent?: boolean | null
}

export type PlaidSyncError = {
  accountId: string
  code: string | null
  message: string
}

type PlaidError = {
  response?: {
    data?: {
      error_code?: string
      error_message?: string
      display_message?: string
    }
  }
  message?: string
}

type SyncResult = {
  syncedAccounts: number
  holdingsUpserted: number
  snapshotWritten: boolean
  errors: PlaidSyncError[]
}

type SyncOptions = {
  userId: string
  accounts: BrokerageAccount[]
  continueOnError: boolean
}

const RELINK_CODES = new Set([
  "ITEM_LOGIN_REQUIRED",
  "ITEM_ERROR",
  "ITEM_LOCKED",
  "ITEM_NOT_SUPPORTED",
  "USER_SETUP_REQUIRED",
])

function toDecimal(value?: number | null) {
  return new Prisma.Decimal(value ?? 0)
}

function assetClassForSecurity(security?: PlaidSecurity | null) {
  if (!security) return "other"
  if (security.is_cash_equivalent) return "cash"

  const type = security.type?.toLowerCase() ?? ""
  if (type.includes("cash")) return "cash"
  if (type.includes("bond") || type.includes("fixed")) return "bonds"
  if (type.includes("etf") || type.includes("equity") || type.includes("stock")) {
    return "us_equity"
  }
  if (type.includes("mutual")) return "us_equity"
  return "other"
}

function securityTypeForSecurity(security?: PlaidSecurity | null) {
  if (!security) return "unknown"
  const type = security.type?.toLowerCase() ?? ""
  if (type.includes("etf")) return "etf"
  if (type.includes("mutual")) return "fund"
  if (type.includes("bond") || type.includes("fixed")) return "bond"
  if (type.includes("stock") || type.includes("equity")) return "stock"
  if (type.includes("cash")) return "cash"
  return "unknown"
}

function dailySnapshotDate(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function parsePlaidError(error: PlaidError) {
  const code = error.response?.data?.error_code ?? null
  const message =
    error.response?.data?.display_message ??
    error.response?.data?.error_message ??
    error.message ??
    "Unable to sync."
  return { code, message }
}

export async function syncPlaidAccounts({
  userId,
  accounts,
  continueOnError,
}: SyncOptions): Promise<SyncResult> {
  const holdingsCache = new Map<
    string,
    Awaited<ReturnType<typeof plaidClient.investmentsHoldingsGet>>["data"]
  >()
  const balancesCache = new Map<
    string,
    Awaited<ReturnType<typeof plaidClient.accountsBalanceGet>>["data"]
  >()

  const now = new Date()
  let syncedAccounts = 0
  let holdingsUpserted = 0
  let snapshotWritten = false
  const errors: PlaidSyncError[] = []

  for (const account of accounts) {
    if (!account.plaidAccessToken || !account.plaidAccountId) {
      errors.push({
        accountId: account.id,
        code: "MISSING_PLAID_CREDENTIALS",
        message: "Missing Plaid credentials.",
      })
      if (!continueOnError) break
      continue
    }

    try {
      let holdingsData = holdingsCache.get(account.plaidAccessToken)
      if (!holdingsData) {
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: account.plaidAccessToken,
        })
        holdingsData = holdingsResponse.data
        holdingsCache.set(account.plaidAccessToken, holdingsData)
      }

      let balancesData = balancesCache.get(account.plaidAccessToken)
      if (!balancesData) {
        const balancesResponse = await plaidClient.accountsBalanceGet({
          access_token: account.plaidAccessToken,
        })
        balancesData = balancesResponse.data
        balancesCache.set(account.plaidAccessToken, balancesData)
      }

      const securityById = new Map(
        (holdingsData.securities ?? []).map((security) => [
          security.security_id,
          security,
        ])
      )

      const accountHoldings = (holdingsData.holdings ?? []).filter(
        (holding) => holding.account_id === account.plaidAccountId
      )

      let totalValue = 0
      const seenSecurityIds: string[] = []

      for (const holding of accountHoldings) {
        const security = holding.security_id
          ? (securityById.get(holding.security_id) as PlaidSecurity | undefined)
          : undefined
        const plaidSecurityId =
          holding.security_id ?? `cash:${account.plaidAccountId}`

        const securityRecord = await prisma.security.upsert({
          where: { plaidSecurityId },
          update: {
            symbol: security?.ticker_symbol ?? null,
            name: security?.name ?? null,
            type: security?.type ?? null,
          },
          create: {
            plaidSecurityId,
            symbol: security?.ticker_symbol ?? null,
            name: security?.name ?? "Holding",
            type: security?.type ?? null,
          },
        })

        const price = holding.institution_price ?? null
        const value =
          holding.institution_value ??
          (price != null ? price * holding.quantity : 0)

        totalValue += value ?? 0
        seenSecurityIds.push(securityRecord.id)

        await prisma.holding.upsert({
          where: {
            brokerageAccountId_securityId: {
              brokerageAccountId: account.id,
              securityId: securityRecord.id,
            },
          },
          update: {
            ticker: security?.ticker_symbol ?? null,
            name: security?.name ?? "Holding",
            quantity: toDecimal(holding.quantity),
            price: price == null ? null : toDecimal(price),
            value: toDecimal(value),
            assetClass: assetClassForSecurity(security),
            securityType: securityTypeForSecurity(security),
            updatedAt: now,
          },
          create: {
            brokerageAccountId: account.id,
            securityId: securityRecord.id,
            ticker: security?.ticker_symbol ?? null,
            name: security?.name ?? "Holding",
            quantity: toDecimal(holding.quantity),
            price: price == null ? null : toDecimal(price),
            value: toDecimal(value),
            assetClass: assetClassForSecurity(security),
            securityType: securityTypeForSecurity(security),
            asOf: now,
          },
        })

        holdingsUpserted += 1
      }

      if (accountHoldings.length === 0) {
        const balanceAccount = balancesData.accounts.find(
          (acct) => acct.account_id === account.plaidAccountId
        )
        const balanceValue = balanceAccount?.balances?.current ?? null
        totalValue = balanceValue ?? 0
      }

      if (seenSecurityIds.length > 0) {
        await prisma.holding.deleteMany({
          where: {
            brokerageAccountId: account.id,
            securityId: { notIn: seenSecurityIds },
          },
        })
      }

      const snapshotDate = dailySnapshotDate(now)

      // Calculate yesterday's date to fetch previous snapshot
      const yesterdayDate = new Date(snapshotDate)
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)

      // Fetch yesterday's snapshot to calculate daily change
      const yesterdaySnapshot = await prisma.dailySnapshot.findUnique({
        where: {
          brokerageAccountId_date: {
            brokerageAccountId: account.id,
            date: yesterdayDate,
          },
        },
      })

      // Calculate change metrics compared to yesterday
      let changeAbs: Prisma.Decimal | null = null
      let changePct: Prisma.Decimal | null = null

      if (yesterdaySnapshot) {
        const todayValue = new Prisma.Decimal(totalValue)
        const yesterdayValue = yesterdaySnapshot.totalValue

        changeAbs = todayValue.minus(yesterdayValue)

        // Only calculate percentage if yesterday's value is not zero
        if (!yesterdayValue.isZero()) {
          changePct = changeAbs.dividedBy(yesterdayValue)
        }
      }

      await prisma.dailySnapshot.upsert({
        where: {
          brokerageAccountId_date: {
            brokerageAccountId: account.id,
            date: snapshotDate,
          },
        },
        update: {
          totalValue: toDecimal(totalValue),
          changeAbs,
          changePct,
        },
        create: {
          brokerageAccountId: account.id,
          date: snapshotDate,
          totalValue: toDecimal(totalValue),
          changeAbs,
          changePct,
        },
      })

      await prisma.brokerageAccount.update({
        where: { id: account.id },
        data: {
          lastSyncedAt: now,
          needsRelink: false,
        },
      })

      syncedAccounts += 1
      snapshotWritten = true
    } catch (error) {
      const parsed = parsePlaidError(error as PlaidError)

      if (parsed.code && account.plaidItemId && RELINK_CODES.has(parsed.code)) {
        await prisma.brokerageAccount.updateMany({
          where: { userId, plaidItemId: account.plaidItemId },
          data: { needsRelink: true },
        })
      }

      errors.push({
        accountId: account.id,
        code: parsed.code,
        message: parsed.message,
      })

      if (!continueOnError) break
    }
  }

  return { syncedAccounts, holdingsUpserted, snapshotWritten, errors }
}
