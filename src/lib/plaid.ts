import { Configuration, PlaidApi, PlaidEnvironments } from "plaid"

const plaidEnv =
  (process.env.PLAID_ENV as keyof typeof PlaidEnvironments | undefined) ??
  "sandbox"

const plaidBasePath =
  PlaidEnvironments[plaidEnv] ?? PlaidEnvironments.sandbox

const plaidConfig = new Configuration({
  basePath: plaidBasePath,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
      "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
    },
  },
})

export const plaidClient = new PlaidApi(plaidConfig)

export function plaidConfigReady() {
  console.log("PLAID_CLIENT_ID loaded:", !!process.env.PLAID_CLIENT_ID)
  console.log("PLAID_SECRET loaded:", !!process.env.PLAID_SECRET)
  console.log("PLAID_ENV:", process.env.PLAID_ENV)
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET)
}
