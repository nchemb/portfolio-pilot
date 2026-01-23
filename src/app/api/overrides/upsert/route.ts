import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import { normalizeTicker } from "@/lib/normalize"

type UpsertBody = {
  ticker?: string
  assetClass?: string
  geography?: string | null
  style?: string | null
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as UpsertBody | null
  const tickerNormalized = normalizeTicker(body?.ticker ?? null)
  const assetClass = body?.assetClass ?? null
  const geography = body?.geography ?? null
  const style = body?.style ?? null

  if (!tickerNormalized) {
    return NextResponse.json({ error: "Missing ticker." }, { status: 400 })
  }

  if (!assetClass) {
    return NextResponse.json({ error: "Missing assetClass." }, { status: 400 })
  }

  const allowedAssetClasses = new Set([
    "us_equity",
    "intl_equity",
    "bonds",
    "cash",
    "other",
  ])

  if (!allowedAssetClasses.has(assetClass)) {
    return NextResponse.json({ error: "Invalid assetClass." }, { status: 400 })
  }

  await prisma.userSecurityOverride.upsert({
    where: { userId_tickerNormalized: { userId, tickerNormalized } },
    update: {
      assetClass,
      geography,
      style,
    },
    create: {
      userId,
      tickerNormalized,
      assetClass,
      geography,
      style,
    },
  })

  return NextResponse.json({ ok: true })
}
