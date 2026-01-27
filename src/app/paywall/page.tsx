import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { PaywallContent } from "./paywall-content"

export default async function PaywallPage() {
  // If payments are disabled, redirect to dashboard (free access for all)
  const paymentsEnabled = process.env.PAYMENTS_ENABLED === "true"
  if (!paymentsEnabled) {
    redirect("/dashboard")
  }

  const { userId } = await auth()

  if (userId) {
    // Ensure user record exists (handles race condition if webhook hasn't fired yet)
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
      select: { subscriptionStatus: true },
    })

    const isSubscribed =
      user?.subscriptionStatus === "active" ||
      user?.subscriptionStatus === "trialing" ||
      user?.subscriptionStatus === "canceling"

    if (isSubscribed) {
      redirect("/dashboard")
    }
  }

  return <PaywallContent />
}
