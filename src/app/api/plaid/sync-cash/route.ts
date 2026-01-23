import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { plaidConfigReady } from "@/lib/plaid"
import { syncCashAccounts } from "@/lib/cash-sync"

type SyncInput = {
  cashAccountId?: string
  plaidItemId?: string
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

  const body = (await request.json().catch(() => null)) as SyncInput | null
  const cashAccountId = body?.cashAccountId ?? null
  const plaidItemId = body?.plaidItemId ?? null

  if (!cashAccountId && !plaidItemId) {
    return NextResponse.json(
      { error: "Missing cashAccountId or plaidItemId." },
      { status: 400 }
    )
  }

  const accounts = await prisma.cashAccount.findMany({
    where: {
      userId,
      ...(cashAccountId ? { id: cashAccountId } : { plaidItemId }),
    },
    include: { plaidItem: true },
  })

  if (accounts.length === 0) {
    return NextResponse.json({ error: "No matching accounts." }, { status: 404 })
  }

  const result = await syncCashAccounts({
    userId,
    accounts,
    continueOnError: false,
  })

  if (result.errors.length > 0) {
    const firstError = result.errors[0]
    return NextResponse.json(
      { error: firstError.message, code: firstError.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, ...result })
}
