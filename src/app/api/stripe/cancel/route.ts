import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
        subscriptionStatus: true,
      },
    })

    if (!user?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      )
    }

    // Check if already canceled or canceling
    if (user.subscriptionStatus === "canceled") {
      return NextResponse.json(
        { error: "Subscription is already canceled" },
        { status: 400 }
      )
    }

    // Cancel at period end (user keeps access until their billing period ends)
    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true }
    )

    // Update user record to reflect canceling status
    // The webhook will handle the final "canceled" status when the period ends
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: "canceling",
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      },
    })

    return NextResponse.json({
      status: "canceling",
      cancelAt: new Date(subscription.current_period_end * 1000).toISOString(),
    })
  } catch (error) {
    console.error("Stripe cancel subscription error:", error)
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    )
  }
}
