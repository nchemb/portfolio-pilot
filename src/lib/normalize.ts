export function normalizeTicker(t?: string | null): string | null {
  const value = (t ?? "").trim().toUpperCase()
  const cleaned = value.replace(/[^A-Z0-9.-]/g, "")
  return cleaned.length ? cleaned : null
}
