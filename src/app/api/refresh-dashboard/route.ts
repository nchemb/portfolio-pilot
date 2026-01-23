import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { upsertDailySnapshotsForAccounts } from "@/lib/snapshots"

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accounts = await prisma.brokerageAccount.findMany({
    where: { userId },
    select: { id: true },
  })

  if (accounts.length > 0) {
    await upsertDailySnapshotsForAccounts(accounts.map((account) => account.id))
  }

  revalidatePath("/dashboard")
  return NextResponse.json({ ok: true })
}
