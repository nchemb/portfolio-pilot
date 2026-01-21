import { Prisma } from "@prisma/client"

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

type BrokerageAccountWithPlaid = Prisma.BrokerageAccountGetPayload<{
  include: { plaidItem: true }
}>

type FundProfileRecord = Prisma.FundProfileGetPayload<{}>

type SyncOptions = {
  userId: string
  accounts: BrokerageAccountWithPlaid[]
  continueOnError: boolean
}

function toDecimal(value?: number | null) {
  return new Prisma.Decimal(value ?? 0)
}

function normalizeTicker(ticker?: string | null) {
  const trimmed = ticker?.trim()
  return trimmed ? trimmed.toUpperCase() : null
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

async function buildFundProfileMap(
  tickers: string[]
): Promise<Map<string, FundProfileRecord>> {
  const uniqueTickers = Array.from(new Set(tickers))
  if (uniqueTickers.length === 0) {
    return new Map()
  }

  const profiles = await prisma.fundProfile.findMany({
    where: { ticker: { in: uniqueTickers } },
  })

  return new Map(
    profiles.map((profile) => [profile.ticker.toUpperCase(), profile])
  )
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
  const fundProfileCache = new Map<string, Map<string, FundProfileRecord>>()

  const now = new Date()
  let syncedAccounts = 0
  let holdingsUpserted = 0
  let snapshotWritten = false
  const errors: PlaidSyncError[] = []

  for (const account of accounts) {
    const accessToken = account.plaidItem?.accessToken
    if (!accessToken || !account.plaidAccountId) {
      errors.push({
        accountId: account.id,
        code: "MISSING_PLAID_CREDENTIALS",
        message: "Missing Plaid credentials.",
      })
      if (!continueOnError) break
      continue
    }

    try {
      let holdingsData = holdingsCache.get(accessToken)
      if (!holdingsData) {
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: accessToken,
        })
        holdingsData = holdingsResponse.data
        holdingsCache.set(accessToken, holdingsData)
      }

      let balancesData = balancesCache.get(accessToken)
      if (!balancesData) {
        const balancesResponse = await plaidClient.accountsBalanceGet({
          access_token: accessToken,
        })
        balancesData = balancesResponse.data
        balancesCache.set(accessToken, balancesData)
      }

      const securityById = new Map(
        (holdingsData.securities ?? []).map((security) => [
          security.security_id,
          security,
        ])
      )

      let fundProfileMap = fundProfileCache.get(accessToken)
      if (!fundProfileMap) {
        const tickers = (holdingsData.holdings ?? [])
          .map((holding) => {
            const security = holding.security_id
              ? (securityById.get(holding.security_id) as
                  | PlaidSecurity
                  | undefined)
              : undefined
            return normalizeTicker(security?.ticker_symbol)
          })
          .filter((ticker): ticker is string => Boolean(ticker))

        fundProfileMap = await buildFundProfileMap(tickers)
        fundProfileCache.set(accessToken, fundProfileMap)
      }

      const accountHoldings = (holdingsData.holdings ?? []).filter(
        (holding) => holding.account_id === account.plaidAccountId
      )

      let totalValue = 0
      const holdingsToCreate: Prisma.HoldingCreateManyInput[] = []

      for (const holding of accountHoldings) {
        const security = holding.security_id
          ? (securityById.get(holding.security_id) as PlaidSecurity | undefined)
          : undefined
        const tickerSymbol = normalizeTicker(security?.ticker_symbol)
        const fundProfile = tickerSymbol
          ? fundProfileMap.get(tickerSymbol)
          : undefined

        const price = holding.institution_price ?? null
        const value =
          holding.institution_value ??
          (price != null ? price * holding.quantity : 0)

        totalValue += value ?? 0

        holdingsToCreate.push({
          brokerageAccountId: account.id,
          ticker: tickerSymbol,
          name: security?.name ?? holding.name ?? "Holding",
          quantity: toDecimal(holding.quantity),
          price: price == null ? null : toDecimal(price),
          value: toDecimal(value),
          assetClass: fundProfile?.assetClass ?? assetClassForSecurity(security),
          geography: fundProfile?.geography ?? null,
          style: fundProfile?.style ?? null,
          securityType: securityTypeForSecurity(security),
          asOf: now,
        })
      }

      if (accountHoldings.length === 0) {
        const balanceAccount = balancesData.accounts.find(
          (acct) => acct.account_id === account.plaidAccountId
        )
        const balanceValue = balanceAccount?.balances?.current ?? null
        totalValue = balanceValue ?? 0
      }

      await prisma.holding.deleteMany({
        where: { brokerageAccountId: account.id },
      })

      if (holdingsToCreate.length > 0) {
        await prisma.holding.createMany({
          data: holdingsToCreate,
        })
        holdingsUpserted += holdingsToCreate.length
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
        },
      })

      syncedAccounts += 1
      snapshotWritten = true
    } catch (error) {
      const parsed = parsePlaidError(error as PlaidError)

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
