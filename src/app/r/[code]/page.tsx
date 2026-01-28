/**
 * Referral Landing Page
 *
 * Handles referral links: /r/ABC123
 * Tracks the referral and redirects to sign up.
 */

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

type PageProps = {
  params: Promise<{ code: string }>
}

export default async function ReferralPage({ params }: PageProps) {
  const { code } = await params

  // Validate the referral code
  const referrer = await prisma.user.findFirst({
    where: { referralCode: code.toUpperCase() },
    select: { id: true },
  })

  if (!referrer) {
    // Invalid code, redirect to home
    redirect("/")
  }

  // Store referral code in cookie for later attribution
  const cookieStore = await cookies()
  cookieStore.set("referral_code", code.toUpperCase(), {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  })

  // Track the referral click
  // Check if we already have a pending referral for this code
  const existingPending = await prisma.referral.findFirst({
    where: {
      code: code.toUpperCase(),
      status: "pending",
      refereeId: null,
    },
  })

  if (!existingPending) {
    // Create a new referral tracking entry
    await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        code: code.toUpperCase(),
        status: "pending",
        signupSource: "direct_link",
      },
    })
  }

  // Redirect to sign up with referral parameter
  redirect(`/sign-up?ref=${code.toUpperCase()}`)
}
