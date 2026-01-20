"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

type RefreshState = "idle" | "loading" | "success" | "error"

export function OverviewRefreshButton() {
  const router = useRouter()
  const [state, setState] = useState<RefreshState>("idle")
  const [message, setMessage] = useState<string | null>(null)

  const handleRefresh = async () => {
    if (state === "loading") return
    setState("loading")
    setMessage(null)

    try {
      router.refresh()
      setState("success")
      setMessage("Updated")
      setTimeout(() => {
        setState("idle")
        setMessage(null)
      }, 2000)
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
      ) : state === "success" ? (
        <span className="text-xs text-emerald-600">{message}</span>
      ) : null}
    </div>
  )
}
