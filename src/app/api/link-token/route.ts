import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { Products, CountryCode } from "plaid"
import { isAxiosError } from "axios"

import { plaidClient, plaidConfigReady } from "@/lib/plaid"

// Simple in-memory cache to avoid creating multiple link tokens in rapid succession.
// IMPORTANT: In Vercel serverless, this cache is per-instance and may not be shared
// across invocations. This is acceptable for reducing duplicate requests within a
// single instance's lifetime. For production at scale, consider Redis caching.
const linkTokenCache = new Map<string, { token: string; expiresAt: number }>()

// Plaid link tokens typically expire after ~30 minutes. We cache for a shorter window to reduce spam.
const LINK_TOKEN_TTL_MS = 10 * 60 * 1000 // 10 minutes

function getCachedLinkToken(userId: string): string | null {
  const cached = linkTokenCache.get(userId)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) {
    linkTokenCache.delete(userId)
    return null
  }
  return cached.token
}

function setCachedLinkToken(userId: string, token: string) {
  linkTokenCache.set(userId, { token, expiresAt: Date.now() + LINK_TOKEN_TTL_MS })
}

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!plaidConfigReady()) {
    return NextResponse.json(
      { error: "Plaid env vars are missing." },
      { status: 500 }
    )
  }

  // Allow clients to force-refresh the token by passing { forceRefresh: true }
  let forceRefresh = false
  try {
    const body = await request.json().catch(() => ({}))
    forceRefresh = body?.forceRefresh === true
  } catch {
    // Body parsing failed, continue without forceRefresh
  }

  // If the user already has a recently-created link token, reuse it to avoid rate limiting.
  const cachedToken = !forceRefresh ? getCachedLinkToken(userId) : null
  if (cachedToken) {
    return NextResponse.json({ link_token: cachedToken, cached: true })
  }

  // Clear any stale cached token when creating a fresh one
  if (forceRefresh) {
    linkTokenCache.delete(userId)
  }

  try {
    // In development, when forceRefresh is true, append a timestamp to bypass
    // Plaid's device recognition which can cause the modal to auto-close.
    // This creates a "new" user from Plaid's perspective.
    const isDev = process.env.NODE_ENV !== "production"
    const clientUserId = isDev && forceRefresh
      ? `${userId}_${Date.now()}`
      : userId

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: clientUserId,
      },
      client_name: "Portfolio Flow",
      products: [Products.Investments],
      language: "en",
      country_codes: [CountryCode.Us],
      redirect_uri: process.env.PLAID_REDIRECT_URI || undefined,
    })

    const token = response.data.link_token
    setCachedLinkToken(userId, token)
    return NextResponse.json({ link_token: token })
  } catch (error) {
    // Plaid SDK uses axios under the hood; surface useful error details in dev.
    let plaidError: Record<string, unknown> | null = null

    if (isAxiosError(error)) {
      plaidError = error.response?.data ?? {
        message: error.message,
        code: error.code,
        status: error.response?.status,
      }
    } else if (error instanceof Error) {
      plaidError = { message: error.message }
    } else {
      plaidError = { message: "Unknown error" }
    }

    console.error("Plaid link token error:", plaidError)

    // If Plaid rate limits us, return a 429 so the client can back off instead of instantly closing.
    const errorCode =
      plaidError && typeof plaidError === "object"
        ? (plaidError as { error_code?: string }).error_code
        : undefined
    if (errorCode === "RATE_LIMIT_EXCEEDED" || errorCode === "RATE_LIMIT") {
      const retryAfterSeconds = 60
      return NextResponse.json(
        {
          error: "Rate limited by Plaid. Please wait a moment and try again.",
          retry_after_seconds: retryAfterSeconds,
          ...(process.env.NODE_ENV !== "production" ? { plaidError } : {}),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        }
      )
    }

    // Avoid leaking sensitive details in production responses.
    const isDev = process.env.NODE_ENV !== "production"
    return NextResponse.json(
      {
        error: "Unable to create link token.",
        ...(isDev ? { plaidError } : {}),
      },
      { status: 500 }
    )
  }
}
