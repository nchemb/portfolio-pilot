"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

type PlaidSuccessMetadata = {
  institution?: {
    name?: string
    institution_id?: string
  }
  accounts?: Array<{
    id: string
    name?: string
    mask?: string
    type?: string
    subtype?: string
  }>
}

type PlaidHandler = {
  open: () => void
  destroy: () => void
}

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string
        onSuccess: (public_token: string, metadata: PlaidSuccessMetadata) => void
        onExit?: (err?: { display_message?: string } | null) => void
      }) => PlaidHandler
    }
  }
}

const PLAID_SCRIPT_SRC =
  "https://cdn.plaid.com/link/v2/stable/link-initialize.js"

export function PlaidLinkButton() {
  const router = useRouter()
  const handlerRef = useRef<PlaidHandler | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (window.Plaid) {
      setReady(true)
      return
    }

    const script = document.createElement("script")
    script.src = PLAID_SCRIPT_SRC
    script.async = true
    script.onload = () => setReady(true)
    script.onerror = () => setError("Unable to load Plaid.")
    document.body.appendChild(script)

    return () => {
      script.onload = null
      script.onerror = null
    }
  }, [])

  useEffect(() => {
    return () => {
      handlerRef.current?.destroy()
    }
  }, [])

  const createLinkHandler = useCallback(
    async (linkToken: string) => {
      if (!window.Plaid) {
        setError("Plaid is not available yet.")
        return
      }

      handlerRef.current?.destroy()
      handlerRef.current = window.Plaid.create({
        token: linkToken,
        onSuccess: async (public_token, metadata) => {
          const response = await fetch("/api/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_token, metadata }),
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null)
            setError(payload?.error ?? "Unable to sync brokerage.")
            return
          }

          router.refresh()
        },
        onExit: (err) => {
          if (err?.display_message) {
            setError(err.display_message)
          }
        },
      })
    },
    [router]
  )

  const handleConnect = useCallback(async () => {
    setError(null)
    setLoading(true)

    const response = await fetch("/api/link-token", { method: "POST" })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setLoading(false)
      setError(payload?.error ?? "Unable to start Plaid.")
      return
    }

    const linkToken = payload?.link_token as string | undefined
    if (!linkToken) {
      setLoading(false)
      setError("Missing Plaid link token.")
      return
    }

    await createLinkHandler(linkToken)
    handlerRef.current?.open()
    setLoading(false)
  }, [createLinkHandler])

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={!ready || loading}>
        {loading ? "Connecting..." : "Connect via Plaid"}
      </Button>
      <p className="text-muted-foreground text-sm">
        Read-only access. We never trade or move money.
      </p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  )
}
