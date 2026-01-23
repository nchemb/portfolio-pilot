"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

type CashResyncButtonProps = {
  cashAccountId: string
}

export function CashResyncButton({ cashAccountId }: CashResyncButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleResync = async () => {
    if (loading) return
    setLoading(true)
    setMessage(null)
    setError(null)

    const response = await fetch("/api/plaid/sync-cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashAccountId }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error ?? "Unable to sync.")
      setLoading(false)
      return
    }

    setMessage("Synced")
    setLoading(false)
    router.refresh()

    setTimeout(() => {
      setMessage(null)
    }, 2000)
  }

  return (
    <div className="text-right">
      <Button
        variant="outline"
        size="sm"
        onClick={handleResync}
        disabled={loading}
      >
        {loading ? "Syncing..." : "Resync"}
      </Button>
      {error ? (
        <p className="text-rose-600 text-xs mt-1">{error}</p>
      ) : message ? (
        <p className="text-emerald-600 text-xs mt-1">{message}</p>
      ) : null}
    </div>
  )
}
