import { Prisma } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

import { plaidClient } from "@/lib/plaid"
import { prisma } from "@/lib/prisma"

export type CashSyncError = {
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
  errors: CashSyncError[]
}

type CashAccountWithPlaid = Prisma.CashAccountGetPayload<{
  include: { plaidItem: true }
}>

type SyncOptions = {
  userId: string
  accounts: CashAccountWithPlaid[]
  continueOnError: boolean
}

function toDecimal(value?: number | null) {
  return new Decimal(value ?? 0)
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

export async function syncCashAccounts({
  userId,
  accounts,
  continueOnError,
}: SyncOptions): Promise<SyncResult> {
  const balancesCache = new Map<
    string,
    Awaited<ReturnType<typeof plaidClient.accountsBalanceGet>>["data"]
  >()

  const now = new Date()
  let syncedAccounts = 0
  const errors: CashSyncError[] = []

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
      let balancesData = balancesCache.get(accessToken)
      if (!balancesData) {
        const balancesResponse = await plaidClient.accountsBalanceGet({
          access_token: accessToken,
        })
        balancesData = balancesResponse.data
        balancesCache.set(accessToken, balancesData)
      }

      const plaidAccount = balancesData.accounts.find(
        (a) => a.account_id === account.plaidAccountId
      )

      if (!plaidAccount) {
        errors.push({
          accountId: account.id,
          code: "ACCOUNT_NOT_FOUND",
          message: "Account not found in Plaid response.",
        })
        if (!continueOnError) break
        continue
      }

      const balance = plaidAccount.balances.current ?? 0

      await prisma.cashAccount.update({
        where: { id: account.id },
        data: {
          balance: toDecimal(balance),
          lastSyncedAt: now,
        },
      })

      syncedAccounts += 1
    } catch (error) {
      console.error("[syncCashAccounts] error", error)
      const parsed = parsePlaidError(error as PlaidError)

      errors.push({
        accountId: account.id,
        code: parsed.code,
        message: parsed.message,
      })

      if (!continueOnError) break
    }
  }

  return { syncedAccounts, errors }
}
