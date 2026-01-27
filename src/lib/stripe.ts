import Stripe from "stripe"

// Lazy initialization to avoid build-time errors when env vars aren't set
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured")
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Note: Using newer API version than SDK types support. Consider upgrading stripe package.
      apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
      typescript: true,
    })
  }
  return stripeInstance
}

// For backward compatibility
export const stripe = {
  get customers() { return getStripe().customers },
  get checkout() { return getStripe().checkout },
  get subscriptions() { return getStripe().subscriptions },
  get billingPortal() { return getStripe().billingPortal },
  get webhooks() { return getStripe().webhooks },
}

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? ""
export const MONTHLY_PRICE = 19 // $19/month - displayed on landing page
