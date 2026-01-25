"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

type RefreshState = "idle" | "loading" | "success" | "error" | "rate_limited"

type RefreshResponse = {
  ok?: boolean
  error?: string
  retryAfterSeconds?: number
  message?: string
}

export function OverviewRefreshButton() {
  const router = useRouter()
  const [state, setState] = useState<RefreshState>("idle")
  const [message, setMessage] = useState<string | null>(null)

  const handleRefresh = async () => {
    if (state === "loading") return
    setState("loading")
    setMessage(null)

    try {
      const response = await fetch("/api/refresh-dashboard", { method: "POST" })
      const data: RefreshResponse = await response.json()

      if (response.ok) {
        router.refresh()
        setState("success")
        setMessage("Updated")
        setTimeout(() => {
          setState("idle")
          setMessage(null)
        }, 2000)
      } else if (response.status === 429) {
        // Rate limited
        setState("rate_limited")
        const retrySeconds = data.retryAfterSeconds || 60
        setMessage(`Sync temporarily rate-limited—try again in ${retrySeconds}s.`)
        setTimeout(() => {
          setState("idle")
          setMessage(null)
        }, Math.min(retrySeconds * 1000, 10000)) // Clear message after retry period or 10s max
      } else if (response.status === 409) {
        // Sync in progress
        setState("error")
        setMessage("Sync already in progress. Please wait.")
        setTimeout(() => {
          setState("idle")
          setMessage(null)
        }, 3000)
      } else {
        // Other error
        setState("error")
        setMessage(data.message || "Unable to refresh.")
        setTimeout(() => {
          setState("idle")
          setMessage(null)
        }, 2500)
      }
    } catch {
      setState("error")
      setMessage("Unable to refresh.")
      setTimeout(() => {
        setState("idle")
        setMessage(null)
      }, 2500)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={state === "loading"}
      >
        {state === "loading" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : state === "success" ? (
          <Check className="mr-2 h-4 w-4 text-emerald-600" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        {state === "loading" ? "Refreshing..." : "Refresh holdings"}
      </Button>
      {state === "error" ? (
        <span className="text-xs text-rose-600">{message}</span>
      ) : state === "rate_limited" ? (
        <span className="text-xs text-amber-600">{message}</span>
      ) : state === "success" ? (
        <span className="text-xs text-emerald-600">{message}</span>
      ) : null}
    </div>
  )
}
