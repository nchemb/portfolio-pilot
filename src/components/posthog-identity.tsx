"use client"

import { useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import posthog from "posthog-js"

export function PostHogIdentify() {
  const { user, isLoaded, isSignedIn } = useUser()

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn && user) {
      // Identify the user with PostHog
      posthog.identify(user.id, {
        email: user.emailAddresses?.[0]?.emailAddress ?? null,
        name: user.fullName ?? null,
        created_at: user.createdAt?.toISOString() ?? null,
      })
    } else {
      // Reset PostHog identity when user logs out
      posthog.reset()
    }
  }, [isLoaded, isSignedIn, user])

  return null
}
