import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { stripe, PRICE_ID } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress

    // Ensure user exists in database (handles race condition if webhook hasn't fired yet)
    const dbUser = await prisma.user.upsert({
      where: { id: userId },
      update: { email: email ?? undefined },
      create: { id: userId, email: email ?? undefined },
      select: { stripeCustomerId: true },
    })

    let customerId = dbUser.stripeCustomerId

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { clerkUserId: userId },
      })
      customerId = customer.id

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/paywall?checkout=canceled`,
      metadata: { clerkUserId: userId },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
