/**
 * User Preferences API
 *
 * Manages user profile preferences including monthly contribution default.
 */

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type PreferencesRequest = {
  monthlyContributionDollars?: number
}

export async function POST(request: NextRequest) {
  try {
    // 1. AUTH
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. PARSE REQUEST
    const body: PreferencesRequest = await request.json()
    const { monthlyContributionDollars } = body

    if (
      monthlyContributionDollars === undefined ||
      typeof monthlyContributionDollars !== "number"
    ) {
      return NextResponse.json(
        { error: "monthlyContributionDollars is required and must be a number" },
        { status: 400 }
      )
    }

    if (monthlyContributionDollars < 0) {
      return NextResponse.json(
        { error: "monthlyContributionDollars must be non-negative" },
        { status: 400 }
      )
    }

    // 3. CONVERT TO CENTS
    const monthlyContributionCents = Math.round(monthlyContributionDollars * 100)

    // 4. UPSERT PROFILE
    const profile = await prisma.profile.upsert({
      where: { userId },
      update: {
        monthlyContributionCents,
      },
      create: {
        userId,
        monthlyContributionCents,
      },
    })

    // 5. RETURN SUCCESS
    return NextResponse.json({
      success: true,
      monthlyContributionCents: profile.monthlyContributionCents,
      monthlyContributionDollars: profile.monthlyContributionCents
        ? profile.monthlyContributionCents / 100
        : 0,
    })
  } catch (error) {
    console.error("Preferences API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. AUTH
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. FETCH PROFILE
    const profile = await prisma.profile.findUnique({
      where: { userId },
    })

    // 3. RETURN PREFERENCES
    return NextResponse.json({
      monthlyContributionCents: profile?.monthlyContributionCents || null,
      monthlyContributionDollars: profile?.monthlyContributionCents
        ? profile.monthlyContributionCents / 100
        : null,
    })
  } catch (error) {
    console.error("Preferences API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
