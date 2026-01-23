import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { normalizeTicker } from "@/lib/normalize"

type DeleteBody = {
  ticker?: string
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as DeleteBody | null
  const tickerNormalized = normalizeTicker(body?.ticker ?? null)

  if (!tickerNormalized) {
    return NextResponse.json({ error: "Missing ticker." }, { status: 400 })
  }

  await prisma.userSecurityOverride.deleteMany({
    where: { userId, tickerNormalized },
  })

  return NextResponse.json({ ok: true })
}
