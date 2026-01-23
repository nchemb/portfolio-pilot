/**
 * Plaid Client Factory
 *
 * Centralized Plaid API client configuration.
 * All Plaid API calls should use the exported `plaidClient` or `getPlaidClient()`.
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid"

// ===== TYPES =====

type PlaidEnvironment = keyof typeof PlaidEnvironments

// ===== SINGLETON CLIENT =====

let _plaidClientInstance: PlaidApi | null = null

/**
 * Get or create the Plaid client instance (singleton pattern)
 */
function getPlaidClient(): PlaidApi {
  if (_plaidClientInstance) {
    return _plaidClientInstance
  }

  // Validate environment variables
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  const envName = (process.env.PLAID_ENV as PlaidEnvironment | undefined) || "sandbox"

  if (!clientId || !secret) {
    throw new Error(
      "PLAID_CLIENT_ID and PLAID_SECRET must be set in environment variables"
    )
  }

  // Validate environment
  if (!PlaidEnvironments[envName]) {
    console.warn(
      `Invalid PLAID_ENV "${envName}". Falling back to sandbox. Valid values: ${Object.keys(
        PlaidEnvironments
      ).join(", ")}`
    )
  }

  const basePath = PlaidEnvironments[envName] || PlaidEnvironments.sandbox

  const config = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  })

  _plaidClientInstance = new PlaidApi(config)

  // Log initialization (helpful for debugging environment issues)
  console.log(`[Plaid] Initialized in ${envName} mode`)
  console.log(`[Plaid] Base path: ${basePath}`)

  return _plaidClientInstance
}

/**
 * Check if Plaid environment variables are properly configured
 */
export function plaidConfigReady(): boolean {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  const hasConfig = Boolean(clientId && secret)

  if (!hasConfig) {
    console.error("[Plaid] Configuration check failed:")
    console.error("  PLAID_CLIENT_ID:", clientId ? "✓ Set" : "✗ Missing")
    console.error("  PLAID_SECRET:", secret ? "✓ Set" : "✗ Missing")
    console.error("  PLAID_ENV:", process.env.PLAID_ENV || "(not set, will use sandbox)")
  }

  return hasConfig
}

/**
 * Get current Plaid environment name
 */
export function getPlaidEnvironment(): PlaidEnvironment {
  return (process.env.PLAID_ENV as PlaidEnvironment) || "sandbox"
}

/**
 * Check if running in production environment
 */
export function isPlaidProduction(): boolean {
  return getPlaidEnvironment() === "production"
}

/**
 * Check if running in development environment
 */
export function isPlaidDevelopment(): boolean {
  return getPlaidEnvironment() === "development"
}

/**
 * Check if running in sandbox environment
 */
export function isPlaidSandbox(): boolean {
  const env = getPlaidEnvironment()
  return env === "sandbox" || !PlaidEnvironments[env]
}

/**
 * Reset the client instance (useful for testing)
 * @internal
 */
export function _resetPlaidClient(): void {
  _plaidClientInstance = null
}

// ===== EXPORTS =====

/**
 * Main Plaid API client (singleton)
 *
 * Usage:
 * ```typescript
 * import { plaidClient } from "@/lib/plaid"
 *
 * const response = await plaidClient.linkTokenCreate({...})
 * ```
 */
export const plaidClient = new Proxy({} as PlaidApi, {
  get(target, prop) {
    const client = getPlaidClient()
    const value = (client as any)[prop]
    return typeof value === "function" ? value.bind(client) : value
  },
})

/**
 * Alternative: Get Plaid client explicitly
 *
 * Use this if you need to handle initialization errors yourself:
 * ```typescript
 * try {
 *   const client = getPlaidClient()
 *   await client.linkTokenCreate({...})
 * } catch (error) {
 *   // Handle missing config
 * }
 * ```
 */
export { getPlaidClient }
