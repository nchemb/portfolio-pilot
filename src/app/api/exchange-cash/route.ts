import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { plaidClient, plaidConfigReady } from "@/lib/plaid"

type PlaidMetadata = {
  institution?: {
    name?: string
    institution_id?: string
  }
  accounts?: Array<{
    id: string
    name?: string
    mask?: string
    type?: string
    subtype?: string
  }>
}

function toDecimal(value?: number | null) {
  return new Prisma.Decimal(value ?? 0)
}

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!plaidConfigReady()) {
    return NextResponse.json(
      { error: "Plaid env vars are missing." },
      { status: 500 }
    )
  }

  const body = await request.json().catch(() => null)
  const publicToken = body?.public_token as string | undefined
  const metadata = body?.metadata as PlaidMetadata | undefined

  if (!publicToken) {
    return NextResponse.json(
      { error: "Missing public_token." },
      { status: 400 }
    )
  }

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    })

    const accessToken = exchange.data.access_token
    const itemId = exchange.data.item_id
    const institutionName = metadata?.institution?.name ?? null
    const institutionId = metadata?.institution?.institution_id ?? null
    let accounts = metadata?.accounts ?? []

    // If no accounts in metadata, fetch them from Plaid
    if (accounts.length === 0) {
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      })
      accounts = accountsResponse.data.accounts
        .filter((account) => account.type === "depository")
        .map((account) => ({
          id: account.account_id,
          name: account.name ?? undefined,
          mask: account.mask ?? undefined,
          type: account.type ?? undefined,
          subtype: account.subtype ?? undefined,
        }))
    }

    // Filter to only depository accounts (checking/savings)
    const depositoryAccounts = accounts.filter(
      (account) =>
        account.type === "depository" ||
        account.subtype === "checking" ||
        account.subtype === "savings"
    )

    if (depositoryAccounts.length === 0) {
      return NextResponse.json(
        { error: "No checking or savings accounts found." },
        { status: 400 }
      )
    }

    // Get balances for the accounts
    const balancesResponse = await plaidClient.accountsBalanceGet({
      access_token: accessToken,
    })
    const balancesByAccountId = new Map(
      balancesResponse.data.accounts.map((account) => [
        account.account_id,
        account.balances.current ?? 0,
      ])
    )

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: null },
    })

    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const plaidItem = await tx.plaidItem.upsert({
        where: { plaidItemId: itemId },
        update: {
          userId,
          accessToken,
          institutionId,
          institutionName,
        },
        create: {
          userId,
          plaidItemId: itemId,
          accessToken,
          institutionId,
          institutionName,
        },
      })

      await Promise.all(
        depositoryAccounts.map((account) =>
          tx.cashAccount.upsert({
            where: { plaidAccountId: account.id },
            update: {
              userId,
              institution: institutionName,
              name: account.name ?? null,
              mask: account.mask ?? null,
              type: account.subtype ?? account.type ?? null,
              currency: "USD",
              balance: toDecimal(balancesByAccountId.get(account.id)),
              lastSyncedAt: now,
              plaidItemId: plaidItem.plaidItemId,
            },
            create: {
              userId,
              institution: institutionName,
              name: account.name ?? null,
              mask: account.mask ?? null,
              type: account.subtype ?? account.type ?? null,
              currency: "USD",
              balance: toDecimal(balancesByAccountId.get(account.id)),
              lastSyncedAt: now,
              plaidItemId: plaidItem.plaidItemId,
              plaidAccountId: account.id,
            },
          })
        )
      )
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const plaidError = error as {
      response?: {
        data?: {
          error_type?: string
          error_code?: string
          error_message?: string
          display_message?: string
        }
      }
      message?: string
      stack?: string
    }
    const errorCode = plaidError.response?.data?.error_code
    const errorMessage =
      plaidError.response?.data?.display_message ??
      plaidError.response?.data?.error_message
    const fallbackMessage = plaidError.message

    console.error("Plaid exchange (cash) error:", {
      error,
      errorCode,
      errorMessage,
      fallbackMessage,
      errorData: plaidError.response?.data ?? null,
    })

    return NextResponse.json(
      {
        error: errorMessage ?? fallbackMessage ?? "Unable to exchange token.",
        code: errorCode ?? null,
      },
      { status: 500 }
    )
  }
}
