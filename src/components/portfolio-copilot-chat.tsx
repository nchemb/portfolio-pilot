"use client"

/**
 * Portfolio Flow Chat Widget
 *
 * Client-side chat component grounded in deterministic portfolio truth layer.
 */

import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import posthog from "posthog-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Message = {
  role: "user" | "assistant"
  content: string
  factsUsed?: FactsUsed
}

type FactsUsed = {
  asOf: string
  totalValue: number
  allocation: Record<string, number>
  topHoldings: Array<{ ticker: string | null; name: string; value: number }>
  targetAllocation?: Record<string, number>
  rebalanceSuggestions?: Array<{ bucket: string; buyAmount: number; tickers: string[] }>
}

type ChatResponse = {
  reply: string
  factsUsed: FactsUsed
  usedRebalance: boolean
  usedContribution?: number
}

const QUICK_PROMPTS = [
  "What should I buy with $500?",
  "Why is cash so high?",
  "Biggest positions?",
  "Am I diversified?",
]

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function PortfolioCopilotChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthlyContribution, setMonthlyContribution] = useState("")
  const [savedContribution, setSavedContribution] = useState<number | null>(null)
  const [savingContribution, setSavingContribution] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const quickPrompts = [
    `What should I buy with ${formatCurrency(savedContribution ?? 500)}?`,
    ...QUICK_PROMPTS.slice(1),
  ]

  // Load saved contribution on mount
  useEffect(() => {
    loadSavedContribution()
  }, [])

  // Auto-scroll to bottom when the message pane itself is scrollable
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const canScroll = container.scrollHeight > container.clientHeight + 1
    if (canScroll) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, isLoading])

  async function loadSavedContribution() {
    try {
      const response = await fetch("/api/preferences")
      if (response.ok) {
        const data = await response.json()
        if (data.monthlyContributionDollars !== null) {
          setSavedContribution(data.monthlyContributionDollars)
        }
      }
    } catch (err) {
      console.error("Failed to load saved contribution:", err)
    }
  }

  async function saveMonthlyContribution() {
    const amount = parseFloat(monthlyContribution)
    if (isNaN(amount) || amount < 0) {
      setError("Please enter a valid amount")
      return
    }

    setSavingContribution(true)
    setError(null)

    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyContributionDollars: amount }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save contribution")
      }

      const data = await response.json()
      setSavedContribution(data.monthlyContributionDollars)
      setMonthlyContribution("")

      // Track monthly contribution saved
      posthog.capture("monthly_contribution_saved", {
        amount: data.monthlyContributionDollars,
        currency: "USD",
      })
    } catch (err) {
      posthog.captureException(err)
      setError(err instanceof Error ? err.message : "Failed to save contribution")
    } finally {
      setSavingContribution(false)
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim()) return

    const userMessage: Message = { role: "user", content }
    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)
    setError(null)

    // Track chat message sent
    posthog.capture("portfolio_chat_message_sent", {
      message_length: content.length,
      message_count: messages.length + 1,
    })

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          overrideMonthlyContribution: savedContribution ?? undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to get response")
      }

      const data: ChatResponse = await response.json()

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        factsUsed: data.factsUsed,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      posthog.captureException(err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  function handleSend() {
    sendMessage(inputValue)
  }

  function handleQuickPrompt(prompt: string) {
    sendMessage(prompt)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className="flex flex-col h-auto lg:h-[700px]">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="text-xl">💬</span>
          Portfolio Flow
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Beta
          </span>
        </CardTitle>
        <CardDescription className="text-xs">
          AI assistant grounded in your actual portfolio data
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-2 min-h-0 pb-2">
        {/* Monthly contribution setting */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-accent/50 rounded-lg border border-accent">
          <div className="flex-1 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground whitespace-nowrap">Monthly:</span>
            {savedContribution !== null ? (
              <>
                <span className="font-semibold">{formatCurrency(savedContribution)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs ml-auto"
                  onClick={() => setSavedContribution(null)}
                >
                  Edit
                </Button>
              </>
            ) : (
              <>
                <Input
                  type="number"
                  placeholder="500"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  className="h-6 w-16 text-xs"
                  min="0"
                  step="50"
                />
                <Button
                  size="sm"
                  className="h-6 text-xs ml-auto px-2"
                  onClick={saveMonthlyContribution}
                  disabled={savingContribution || !monthlyContribution}
                >
                  {savingContribution ? "..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 space-y-3 pr-1 min-h-0 overflow-visible overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-4 text-center">
              <div className="text-5xl mb-3">🤖</div>
              <h3 className="text-base font-semibold mb-1.5">Ask me anything</h3>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs px-4">
                I&apos;ll answer using your real portfolio data—no made-up numbers.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-xs px-2">
                {quickPrompts.map((prompt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPrompt(prompt)}
                    disabled={isLoading}
                    className="text-xs h-7"
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`rounded-2xl px-3 py-2 max-w-[90%] shadow-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 border"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="text-[10px] font-semibold mb-1 text-muted-foreground uppercase tracking-wide">AI</div>
                )}
                <div className="text-xs sm:text-sm leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
                      li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      code: ({ children }) => (
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{children}</code>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {msg.role === "assistant" && msg.factsUsed && (
                  <details className="mt-2 pt-2 border-t border-border/50 group">
                    <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <span>📊</span> Facts used
                      <span className="ml-auto text-[10px] transition-transform group-open:rotate-180">▾</span>
                    </summary>
                    <div className="mt-1.5 space-y-1 text-[10px] text-muted-foreground pl-3">
                      <div className="flex gap-2">
                        <span className="opacity-60">As of:</span>
                        <span>{new Date(msg.factsUsed.asOf).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="opacity-60">Total:</span>
                        <span className="font-medium">{formatCurrency(msg.factsUsed.totalValue)}</span>
                      </div>
                      <div>
                        <div className="opacity-60 mb-1">Allocation:</div>
                        <div className="pl-2 space-y-0.5">
                          {Object.entries(msg.factsUsed.allocation).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span>{k}:</span>
                              <span className="font-medium">{formatPct(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {msg.factsUsed.topHoldings.length > 0 && (
                        <div>
                          <div className="opacity-60 mb-1">Top holdings:</div>
                          <div className="pl-2">
                            {msg.factsUsed.topHoldings
                              .map((h) => `${h.ticker || h.name} (${formatCurrency(h.value)})`)
                              .join(", ")}
                          </div>
                        </div>
                      )}
                      {msg.factsUsed.rebalanceSuggestions && (
                        <div>
                          <div className="opacity-60 mb-1">Rebalance plan:</div>
                          <div className="pl-2 space-y-0.5">
                            {msg.factsUsed.rebalanceSuggestions.map((s, idx) => (
                              <div key={idx}>
                                {s.bucket}: <span className="font-medium">{formatCurrency(s.buyAmount)}</span> in {s.tickers.join(", ")}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3 py-2 bg-muted/50 border shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>Thinking</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive shadow-sm">
              <div className="font-semibold mb-0.5 text-[10px] uppercase tracking-wide">Error</div>
              {error}
            </div>
          )}

        </div>

        {/* Input area */}
        <div className="flex-shrink-0 flex gap-2 pt-2 border-t">
          <Input
            placeholder="Ask about your portfolio..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 rounded-full text-sm h-9"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className="rounded-full px-4 h-9 text-sm"
          >
            {isLoading ? "..." : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
