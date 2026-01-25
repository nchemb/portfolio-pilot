import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { Webhook } from "svix"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

type WebhookEvent = {
  type: string
  data: {
    id: string
    email_addresses?: Array<{ email_address: string }>
    [key: string]: unknown
  }
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not configured")
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    )
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    )
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Verify the webhook
  const wh = new Webhook(WEBHOOK_SECRET)
  let event: WebhookEvent

  try {
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error("Webhook verification failed:", err)
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    )
  }

  // Handle user deletion
  if (event.type === "user.deleted") {
    const userId = event.data.id

    try {
      // Get the user's subscription info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          stripeSubscriptionId: true,
          stripeCustomerId: true,
          subscriptionStatus: true,
        },
      })

      // Cancel active subscription if one exists
      if (
        user?.stripeSubscriptionId &&
        (user.subscriptionStatus === "active" ||
          user.subscriptionStatus === "trialing")
      ) {
        try {
          // Cancel immediately (not at period end) since user is deleting account
          await stripe.subscriptions.cancel(user.stripeSubscriptionId)
          console.log(
            `Canceled subscription ${user.stripeSubscriptionId} for deleted user ${userId}`
          )
        } catch (stripeError) {
          // Log but don't fail - the subscription may already be canceled
          console.error(
            `Failed to cancel subscription for user ${userId}:`,
            stripeError
          )
        }
      }

      // The user data will be cascade deleted by Prisma due to onDelete: Cascade
      // on related models, but we should explicitly delete the user record
      await prisma.user.delete({
        where: { id: userId },
      })

      console.log(`Deleted user data for ${userId}`)
    } catch (error) {
      console.error(`Error handling user deletion for ${userId}:`, error)
      // Return 500 to trigger Clerk retry - data deletion is critical
      return NextResponse.json(
        { error: "Failed to delete user data" },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ received: true })
}
