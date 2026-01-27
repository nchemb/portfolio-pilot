/**
 * Stripe Webhook Handler
 *
 * Note on idempotency: All operations use updateMany which is naturally idempotent.
 * Duplicate events will result in the same data being written, which is safe.
 * For production at scale, consider adding a ProcessedWebhookEvent table to track
 * event.id and skip duplicates explicitly.
 */

import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { getPostHogClient } from "@/lib/posthog-server"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // Log event for debugging and duplicate detection
  console.log(`[stripe-webhook] Processing event ${event.id} (${event.type})`)

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)

          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: subscription.status,
              subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
            },
          })

          // Track successful subscription checkout with PostHog
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId },
            select: { id: true },
          })
          if (user) {
            const posthog = getPostHogClient()
            posthog.capture({
              distinctId: user.id,
              event: "subscription_checkout_completed",
              properties: {
                subscription_id: subscriptionId,
                subscription_status: subscription.status,
                customer_id: customerId,
              },
            })
          }
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: subscription.status,
            subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
          },
        })
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: "canceled",
            stripeSubscriptionId: null,
          },
        })

        // Track subscription deleted with PostHog
        const userDeleted = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        })
        if (userDeleted) {
          const posthog = getPostHogClient()
          posthog.capture({
            distinctId: userDeleted.id,
            event: "subscription_deleted",
            properties: {
              subscription_id: subscription.id,
              customer_id: customerId,
            },
          })
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: "past_due",
          },
        })

        // Track payment failure with PostHog
        const userPaymentFailed = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true },
        })
        if (userPaymentFailed) {
          const posthog = getPostHogClient()
          posthog.capture({
            distinctId: userPaymentFailed.id,
            event: "payment_failed",
            properties: {
              invoice_id: invoice.id,
              customer_id: customerId,
              amount_due: invoice.amount_due,
            },
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}
