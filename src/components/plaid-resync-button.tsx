"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

type PlaidResyncButtonProps = {
  brokerageAccountId: string
  needsRelink?: boolean
}

export function PlaidResyncButton({
  brokerageAccountId,
  needsRelink = false,
}: PlaidResyncButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleResync = async () => {
    if (loading || needsRelink) return
    setLoading(true)
    setMessage(null)
    setError(null)

    const response = await fetch("/api/plaid/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brokerageAccountId }),
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
        disabled={loading || needsRelink}
      >
        {needsRelink ? "Reconnect" : loading ? "Syncing..." : "Resync"}
      </Button>
      {needsRelink ? (
        <p className="text-rose-600 text-xs mt-1">Reconnect via Plaid</p>
      ) : error ? (
        <p className="text-rose-600 text-xs mt-1">{error}</p>
      ) : message ? (
        <p className="text-emerald-600 text-xs mt-1">{message}</p>
      ) : null}
    </div>
  )
}
