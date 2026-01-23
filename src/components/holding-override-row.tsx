"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { normalizeTicker } from "@/lib/normalize"

type HoldingOverrideControlsProps = {
  userId: string
  ticker: string | null
}

const ASSET_CLASS_OPTIONS = [
  { value: "", label: "Select asset class" },
  { value: "us_equity", label: "US Equity" },
  { value: "intl_equity", label: "International Equity" },
  { value: "bonds", label: "Bonds" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
]

const GEOGRAPHY_OPTIONS = [
  { value: "", label: "Geography (optional)" },
  { value: "us", label: "US" },
  { value: "intl", label: "International" },
  { value: "global", label: "Global" },
]

const STYLE_OPTIONS = [
  { value: "", label: "Style (optional)" },
  { value: "growth", label: "Growth" },
  { value: "value", label: "Value" },
  { value: "blend", label: "Blend" },
]

export function HoldingOverrideControls({
  userId,
  ticker,
}: HoldingOverrideControlsProps) {
  const router = useRouter()
  const [assetClass, setAssetClass] = useState("")
  const [geography, setGeography] = useState("")
  const [style, setStyle] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalizedTicker = useMemo(() => normalizeTicker(ticker), [ticker])

  const handleSave = async () => {
    if (!normalizedTicker) {
      setError("Ticker required.")
      return
    }
    if (!assetClass) {
      setError("Select an asset class.")
      return
    }

    setSaving(true)
    setSaved(false)
    setError(null)

    const response = await fetch("/api/overrides/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        ticker: normalizedTicker,
        assetClass,
        geography: geography || undefined,
        style: style || undefined,
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "Unable to save override.")
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    router.refresh()

    setTimeout(() => {
      setSaved(false)
    }, 1500)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={assetClass} onChange={(event) => setAssetClass(event.target.value)}>
        {ASSET_CLASS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={geography} onChange={(event) => setGeography(event.target.value)}>
        {GEOGRAPHY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={style} onChange={(event) => setStyle(event.target.value)}>
        {STYLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
      {saved ? <span className="text-xs text-emerald-600">Saved</span> : null}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  )
}
