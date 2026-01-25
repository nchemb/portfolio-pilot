import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

/**
 * Manually sync subscription status from Stripe.
 * Useful when webhooks haven't fired (e.g., local development).
 */
export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, subscriptionStatus: true },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 404 }
      )
    }

    // Get the latest subscription from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      // No subscription found - mark as canceled
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null,
          subscriptionEndsAt: null,
        },
      })

      return NextResponse.json({
        synced: true,
        status: "canceled",
        message: "No active subscription found",
      })
    }

    const subscription = subscriptions.data[0]

    // Update database with current Stripe status
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      },
    })

    return NextResponse.json({
      synced: true,
      status: subscription.status,
      endsAt: new Date(subscription.current_period_end * 1000).toISOString(),
    })
  } catch (error) {
    console.error("Stripe sync error:", error)
    return NextResponse.json(
      { error: "Failed to sync subscription" },
      { status: 500 }
    )
  }
}
