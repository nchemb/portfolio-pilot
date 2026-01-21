import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { plaidConfigReady } from "@/lib/plaid"
import { syncPlaidAccounts } from "@/lib/plaid-sync"

export async function POST() {
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

  const accounts = await prisma.brokerageAccount.findMany({
    where: { userId },
    include: { plaidItem: true },
  })

  if (accounts.length === 0) {
    return NextResponse.json({
      ok: true,
      syncedAccounts: 0,
      holdingsUpserted: 0,
      snapshotWritten: false,
      errors: [],
    })
  }

  const result = await syncPlaidAccounts({
    userId,
    accounts,
    continueOnError: true,
  })

  return NextResponse.json({
    ok: result.errors.length === 0,
    error: result.errors.length > 0 ? "Some accounts failed to sync." : null,
    ...result,
  })
}
