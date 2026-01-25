/**
 * Environment variable validation
 * Import this file early in the app to catch missing env vars at startup
 */

type EnvConfig = {
  name: string
  required: boolean
  isPublic?: boolean
}

const envConfig: EnvConfig[] = [
  // Clerk (required for auth)
  { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true, isPublic: true },
  { name: "CLERK_SECRET_KEY", required: true },
  { name: "CLERK_WEBHOOK_SECRET", required: true },

  // Database (required)
  { name: "DATABASE_URL", required: true },

  // Plaid (required for core functionality)
  { name: "PLAID_CLIENT_ID", required: true },
  { name: "PLAID_SECRET", required: true },
  { name: "PLAID_ENV", required: true },

  // OpenAI (required for AI chat)
  { name: "OPENAI_API_KEY", required: true },

  // Stripe (optional - for subscriptions)
  { name: "STRIPE_SECRET_KEY", required: false },
  { name: "STRIPE_WEBHOOK_SECRET", required: false },
  { name: "STRIPE_PRICE_ID", required: false },

  // Cron (required for scheduled jobs)
  { name: "CRON_SECRET", required: true },

  // App URL (required for Stripe redirects in production)
  { name: "NEXT_PUBLIC_APP_URL", required: true, isPublic: true },
]

export type EnvValidationResult = {
  valid: boolean
  missing: string[]
  warnings: string[]
}

export function validateEnv(): EnvValidationResult {
  const missing: string[] = []
  const warnings: string[] = []

  for (const config of envConfig) {
    const value = config.isPublic
      ? process.env[config.name]
      : process.env[config.name]

    if (!value || value.trim() === "") {
      if (config.required) {
        missing.push(config.name)
      } else {
        warnings.push(`Optional env var ${config.name} is not set`)
      }
    }
  }

  // Validate Stripe configuration consistency
  const stripeVars = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"]
  const stripeSet = stripeVars.filter((v) => process.env[v])
  if (stripeSet.length > 0 && stripeSet.length < stripeVars.length) {
    const stripeNotSet = stripeVars.filter((v) => !process.env[v])
    warnings.push(
      `Partial Stripe configuration detected. Missing: ${stripeNotSet.join(", ")}`
    )
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

// Validate and log on module load (only on server, not during build)
// NEXT_PHASE is set during build/export phases
const isBuilding = process.env.NEXT_PHASE === "phase-production-build"

if (typeof window === "undefined" && !isBuilding) {
  const result = validateEnv()

  if (result.warnings.length > 0) {
    console.warn("[env] Warnings:")
    result.warnings.forEach((w) => console.warn(`  - ${w}`))
  }

  if (!result.valid) {
    console.error("[env] Missing required environment variables:")
    result.missing.forEach((m) => console.error(`  - ${m}`))

    // In production runtime, fail fast
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Missing required environment variables: ${result.missing.join(", ")}`
      )
    }
  }
}

// Type-safe env access for commonly used variables
export const env = {
  // Clerk
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  clerkSecretKey: process.env.CLERK_SECRET_KEY!,
  clerkWebhookSecret: process.env.CLERK_WEBHOOK_SECRET!,

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // Plaid
  plaidClientId: process.env.PLAID_CLIENT_ID!,
  plaidSecret: process.env.PLAID_SECRET!,
  plaidEnv: process.env.PLAID_ENV as "sandbox" | "development" | "production",

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY!,
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",

  // Stripe (optional)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePriceId: process.env.STRIPE_PRICE_ID,

  // Cron
  cronSecret: process.env.CRON_SECRET!,

  // App
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
} as const
