import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { plaidClient, plaidConfigReady } from "@/lib/plaid"
import { syncPlaidAccounts } from "@/lib/plaid-sync"

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

    if (accounts.length === 0) {
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      })
      accounts = accountsResponse.data.accounts.map((account) => ({
        id: account.account_id,
        name: account.name ?? undefined,
        mask: account.mask ?? undefined,
        type: account.type ?? undefined,
        subtype: account.subtype ?? undefined,
      }))
    }

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No accounts returned from Plaid." },
        { status: 400 }
      )
    }

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: null },
    })

    await prisma.$transaction(
      accounts.map((account) =>
        prisma.brokerageAccount.upsert({
          where: { plaidAccountId: account.id },
          update: {
            userId,
            institution: institutionName,
            name: account.name ?? null,
            mask: account.mask ?? null,
            type: account.subtype ?? account.type ?? null,
            currency: "USD",
            lastSyncedAt: new Date(),
            needsRelink: false,
            plaidAccessToken: accessToken,
            plaidItemId: itemId,
            plaidInstitutionId: institutionId,
          },
          create: {
            userId,
            institution: institutionName,
            name: account.name ?? null,
            mask: account.mask ?? null,
            type: account.subtype ?? account.type ?? null,
            currency: "USD",
            lastSyncedAt: new Date(),
            needsRelink: false,
            plaidAccessToken: accessToken,
            plaidItemId: itemId,
            plaidInstitutionId: institutionId,
            plaidAccountId: account.id,
          },
        })
      )
    )

    const linkedAccounts = await prisma.brokerageAccount.findMany({
      where: { userId, plaidItemId: itemId },
    })

    if (linkedAccounts.length > 0) {
      const syncResult = await syncPlaidAccounts({
        userId,
        accounts: linkedAccounts,
        continueOnError: false,
      })

      if (syncResult.errors.length > 0) {
        const firstError = syncResult.errors[0]
        return NextResponse.json(
          { error: firstError.message, code: firstError.code },
          { status: 500 }
        )
      }
    }

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

    console.error("Plaid exchange error:", {
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
