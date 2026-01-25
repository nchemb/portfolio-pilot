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

type PlaidExitError = {
  display_message?: string | null
  error_code?: string | null
  error_type?: string | null
  error_message?: string | null
  request_id?: string | null
}

type PlaidEventName = string

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string
        onSuccess: (public_token: string, metadata: PlaidSuccessMetadata) => void
        onExit?: (err?: PlaidExitError | null, metadata?: PlaidSuccessMetadata) => void
        onEvent?: (eventName: PlaidEventName, metadata?: Record<string, unknown>) => void
        onLoad?: () => void
      }) => PlaidHandler
    }
  }
}

const PLAID_SCRIPT_SRC =
  "https://cdn.plaid.com/link/v2/stable/link-initialize.js"

export function PlaidLinkButton() {
  const router = useRouter()
  const handlerRef = useRef<PlaidHandler | null>(null)
  const openTimeRef = useRef<number | null>(null)
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.Plaid)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null)
  const [shouldForceRefresh, setShouldForceRefresh] = useState(false)
  const [isFlashCloseIssue, setIsFlashCloseIssue] = useState(false)

  useEffect(() => {
    if (window.Plaid) return

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
        onLoad: () => {
          // Helpful when debugging “modal flashes then closes”
          console.debug("[Plaid Link] onLoad")
        },
        onEvent: (eventName, metadata) => {
          console.debug("[Plaid Link] onEvent", eventName, metadata)
        },
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

          // Success! Reset the force refresh flag
          setShouldForceRefresh(false)
          router.refresh()
        },
        onExit: (err, metadata) => {
          // In your normal browser, Plaid may auto-start a remembered phone flow then immediately exit.
          // Often err.display_message is null; the useful fields are error_code / error_message.
          console.warn("[Plaid Link] onExit", { err, metadata })

          const errorCode = err?.error_code ?? undefined
          const errorMessage =
            err?.display_message ?? err?.error_message ?? err?.error_code ?? null

          // Detect "flash and close" - modal exits within 3 seconds of opening
          const timeSinceOpen = openTimeRef.current ? Date.now() - openTimeRef.current : null
          const isRapidExit = timeSinceOpen !== null && timeSinceOpen < 3000

          if (errorCode === "RATE_LIMIT_EXCEEDED") {
            setRateLimitNotice("Plaid rate limit reached—try again shortly.")
          }

          // If modal exits with an error, force a fresh token on next attempt
          if (err) {
            setShouldForceRefresh(true)
          }

          if (errorMessage) {
            setError(String(errorMessage))
            return
          }

          // If the modal closed very quickly, it's likely the remembered device issue
          if (isRapidExit) {
            setIsFlashCloseIssue(true)
            setShouldForceRefresh(true)
            setError("Plaid detected a previously linked device and closed automatically. This is a browser storage issue.")
            return
          }

          // If the user closes the modal manually, err can be null.
          setError(null)
          setIsFlashCloseIssue(false)
        },
      })
    },
    [router]
  )

  const handleConnect = useCallback(async () => {
    setError(null)
    setRateLimitNotice(null)
    setLoading(true)

    const response = await fetch("/api/link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceRefresh: shouldForceRefresh }),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setLoading(false)
      if (response.status === 429) {
        setRateLimitNotice("Plaid rate limit reached—try again in 60s.")
      }
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
    if (!handlerRef.current) {
      setLoading(false)
      setError("Plaid failed to initialize. Try refreshing, then clear Plaid site data if it persists.")
      return
    }

    openTimeRef.current = Date.now()
    handlerRef.current.open()
    setLoading(false)
  }, [createLinkHandler, shouldForceRefresh])

  const handleTryAgain = useCallback(() => {
    setShouldForceRefresh(true)
    setIsFlashCloseIssue(false)
    handleConnect()
  }, [handleConnect])

  const handleClearAndRetry = useCallback(() => {
    // We can't programmatically clear Plaid's storage, but we can reset our state
    // and force a fresh token, which sometimes helps
    setShouldForceRefresh(true)
    setIsFlashCloseIssue(false)
    setError(null)
  }, [])

  return (
    <div className="space-y-2">
      {rateLimitNotice ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          {rateLimitNotice}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={handleConnect} disabled={!ready || loading}>
          {loading ? "Connecting..." : "Connect via Plaid"}
        </Button>
        {error && (
          <Button onClick={handleTryAgain} disabled={!ready || loading} variant="outline">
            Try Again
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        Read-only access. We never trade or move money.
      </p>
      {isFlashCloseIssue ? (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">
            Modal closing immediately? Clear Plaid browser data:
          </p>
          <div className="text-amber-700 space-y-2">
            <p className="font-medium">Chrome/Edge:</p>
            <ol className="list-decimal list-inside space-y-1 pl-2 text-xs">
              <li>Open DevTools (F12 or Cmd+Option+I)</li>
              <li>Go to Application tab → Storage</li>
              <li>Expand &quot;Cookies&quot; and find &quot;cdn.plaid.com&quot;</li>
              <li>Right-click → Clear</li>
              <li>Also clear Local/Session Storage for plaid.com</li>
              <li>Refresh this page</li>
            </ol>
            <p className="font-medium mt-2">Or use incognito/private browsing mode.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAndRetry}
            className="mt-2"
          >
            I&apos;ve cleared the data
          </Button>
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-rose-600">{error}</p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Still not working? Clear Plaid browser data →
            </summary>
            <div className="mt-2 space-y-2 pl-2 border-l-2 border-muted">
              <p className="font-medium">Chrome/Edge:</p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Open DevTools (F12 or Cmd+Option+I)</li>
                <li>Go to Application tab → Storage</li>
                <li>Expand &quot;Cookies&quot; and find &quot;cdn.plaid.com&quot;</li>
                <li>Right-click → Clear</li>
                <li>Also clear &quot;Local Storage&quot; and &quot;Session Storage&quot; for plaid.com domains</li>
                <li>Refresh this page and try again</li>
              </ol>
              <p className="font-medium mt-3">Firefox:</p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Open DevTools (F12)</li>
                <li>Go to Storage tab</li>
                <li>Find and delete cookies/storage for plaid.com</li>
                <li>Refresh and try again</li>
              </ol>
              <p className="font-medium mt-3">Safari:</p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Preferences → Privacy → Manage Website Data</li>
                <li>Search &quot;plaid&quot; and remove all entries</li>
                <li>Refresh and try again</li>
              </ol>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  )
}
