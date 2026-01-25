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

    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress

    // Get or create Stripe customer with race condition protection
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })

    let customerId = dbUser?.stripeCustomerId

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { clerkUserId: userId },
      })
      customerId = customer.id

      // Use conditional update to prevent race condition:
      // Only update if stripeCustomerId is still null (no other request beat us)
      const updateResult = await prisma.user.updateMany({
        where: { id: userId, stripeCustomerId: null },
        data: { stripeCustomerId: customerId, email },
      })

      // If no rows updated, another request already set stripeCustomerId
      // Refetch to get the existing customer ID
      if (updateResult.count === 0) {
        const existingUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { stripeCustomerId: true },
        })
        if (existingUser?.stripeCustomerId) {
          customerId = existingUser.stripeCustomerId
          // Note: We created an orphaned Stripe customer (customer.id)
          // This is rare and acceptable for MVP. Could add cleanup later.
        } else {
          // User doesn't exist yet, create them
          await prisma.user.create({
            data: { id: userId, stripeCustomerId: customerId, email },
          })
        }
      }
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
