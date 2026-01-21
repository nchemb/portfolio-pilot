import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { plaidConfigReady } from "@/lib/plaid"
import { syncPlaidAccounts } from "@/lib/plaid-sync"

type SyncInput = {
  brokerageAccountId?: string
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
  const brokerageAccountId = body?.brokerageAccountId ?? null
  const plaidItemId = body?.plaidItemId ?? null

  if (!brokerageAccountId && !plaidItemId) {
    return NextResponse.json(
      { error: "Missing brokerageAccountId or plaidItemId." },
      { status: 400 }
    )
  }

  const accounts = await prisma.brokerageAccount.findMany({
    where: {
      userId,
      ...(brokerageAccountId ? { id: brokerageAccountId } : { plaidItemId }),
    },
    include: { plaidItem: true },
  })

  if (accounts.length === 0) {
    return NextResponse.json({ error: "No matching accounts." }, { status: 404 })
  }

  const result = await syncPlaidAccounts({
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
