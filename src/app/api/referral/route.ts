/**
 * Referral API
 *
 * Generate and manage referral codes for viral growth.
 */

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { nanoid } from "nanoid"

// ===== GET: Get user's referral code and stats =====

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get user's referral code
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })

  // If no code exists, create one
  let referralCode = user?.referralCode
  if (!referralCode) {
    referralCode = nanoid(8).toUpperCase()
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode },
    })
  }

  // Get referral stats
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      convertedAt: true,
    },
  })

  type ReferralRow = { id: string; status: string; createdAt: Date; convertedAt: Date | null }
  const stats = {
    total: referrals.length,
    pending: referrals.filter((r: ReferralRow) => r.status === "pending").length,
    converted: referrals.filter((r: ReferralRow) => r.status === "converted").length,
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://portfolioflow.ai"

  return NextResponse.json({
    code: referralCode,
    shareUrl: `${baseUrl}/r/${referralCode}`,
    stats,
    shareText:
      "I use Portfolio Flow to track my investments across all my brokerages. See your full allocation in one place!",
  })
}

// ===== POST: Create a referral tracking entry =====
// Called when someone clicks a referral link

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { code, source } = body

  if (!code) {
    return NextResponse.json({ error: "Missing referral code" }, { status: 400 })
  }

  // Find the referrer by code
  const referrer = await prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true },
  })

  if (!referrer) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 404 })
  }

  // Check if this code already has an unconverted referral
  // (prevents creating multiple pending referrals)
  const existingPending = await prisma.referral.findFirst({
    where: {
      code,
      status: "pending",
      refereeId: null,
    },
  })

  if (existingPending) {
    // Return the existing referral
    return NextResponse.json({
      referralId: existingPending.id,
      message: "Referral already tracked",
    })
  }

  // Create new referral tracking entry
  const referral = await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      code,
      status: "pending",
      signupSource: source || null,
    },
  })

  return NextResponse.json({
    referralId: referral.id,
    message: "Referral tracked successfully",
  })
}
