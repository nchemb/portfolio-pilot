/**
 * Portfolio Copilot Chat API
 *
 * Server-side chat endpoint using OpenAI, grounded in deterministic portfolio truth layer.
 * Returns structured JSON + markdown for consistent, explainable responses.
 */

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

import { prisma } from "@/lib/prisma"
import { getPortfolioSummary } from "@/lib/portfolio-summary"
import { buildMonthlyRebalancePlan } from "@/lib/rebalancer"

// ===== TYPES =====

type Message = {
  role: "user" | "assistant"
  content: string
}

type ChatRequest = {
  messages: Message[]
  overrideMonthlyContribution?: number // in dollars
}

type StructuredChatReply = {
  intent: "rebalance_plan" | "portfolio_question" | "needs_contribution" | "unknown"
  headline: string
  summary: string
  because?: string[] // 2-5 bullets explaining WHY (based on deterministic gaps)
  buys?: Array<{ bucket: string; ticker: string; amount: number }> // dollars
  allocation?: {
    current: Record<string, number> // pct 0-100
    target?: Record<string, number> // pct 0-100
    biggestGaps?: Array<{
      bucket: string
      currentPct: number
      targetPct: number
      gapPct: number
    }>
  }
  warnings?: string[]
  followUps?: string[] // suggested next questions
}

type ChatResponse = {
  reply: string // backward compatibility (same as replyMarkdown)
  replyMarkdown: string // deterministically generated markdown
  structured: StructuredChatReply
  factsUsed: FactsUsed
  usedRebalance: boolean
  usedContribution?: number
}

type FactsUsed = {
  asOf: string
  totalValue: number
  allocation: Record<string, number> // pct 0-100
  topHoldings: Array<{ ticker: string | null; name: string; value: number }>
  targetAllocation?: Record<string, number> // pct 0-100
  rebalanceSuggestions?: Array<{ bucket: string; buyAmount: number; tickers: string[] }>
}

// ===== FORMATTING HELPERS =====

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatPct(n: number): string {
  // n is already 0-100 from portfolio summary
  return `${n.toFixed(1)}%`
}

// ===== DETERMINISTIC HELPERS =====

/**
 * Compute biggest allocation gaps (target - current)
 * Returns only positive gaps (underweight positions), sorted desc
 */
function computeBiggestGaps(
  portfolioSummary: any,
  rebalancePlan: any
): Array<{ bucket: string; currentPct: number; targetPct: number; gapPct: number }> {
  if (!rebalancePlan?.targetAllocation) return []

  const gaps: Array<{
    bucket: string
    currentPct: number
    targetPct: number
    gapPct: number
  }> = []

  for (const [bucket, targetDecimal] of Object.entries(
    rebalancePlan.targetAllocation as Record<string, number>
  )) {
    // targetAllocation is in decimals (0-1), convert to 0-100
    const targetPct = targetDecimal * 100
    const currentPct = portfolioSummary.allocation[bucket]?.pct || 0
    const gapPct = targetPct - currentPct

    if (gapPct > 0) {
      // Only include underweight (positive gap)
      gaps.push({ bucket, currentPct, targetPct, gapPct })
    }
  }

  // Sort by gap descending
  gaps.sort((a, b) => b.gapPct - a.gapPct)
  return gaps
}

/**
 * Build deterministic buy list from rebalance plan
 */
function buildDeterministicBuys(rebalancePlan: any): Array<{
  bucket: string
  ticker: string
  amount: number
}> {
  if (!rebalancePlan?.suggestions) return []

  const buys: Array<{ bucket: string; ticker: string; amount: number }> = []

  for (const suggestion of rebalancePlan.suggestions) {
    const amount = suggestion.recommendedBuyAmount || 0
    if (amount <= 0) continue

    const tickers = suggestion.recommendedTickers || []
    if (tickers.length === 0) continue

    // For simplicity, allocate entire amount to first ticker
    // (In production, might split proportionally by weight)
    const ticker = tickers[0].ticker
    buys.push({
      bucket: suggestion.bucket,
      ticker,
      amount,
    })
  }

  return buys
}

/**
 * Build "because" bullets explaining WHY based on gaps
 */
function buildBecauseBullets(
  biggestGaps: Array<{
    bucket: string
    currentPct: number
    targetPct: number
    gapPct: number
  }>,
  rebalancePlan: any
): string[] {
  const bullets: string[] = []

  // Take top 3 gaps
  const topGaps = biggestGaps.slice(0, 3)

  for (const gap of topGaps) {
    const bucketTitle = gap.bucket
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())

    // Find tickers for this bucket
    const suggestion = rebalancePlan.suggestions?.find(
      (s: any) => s.bucket === gap.bucket
    )
    const tickers =
      suggestion?.recommendedTickers?.map((t: any) => t.ticker).join(", ") || "this bucket"

    bullets.push(
      `${bucketTitle} is ${formatPct(gap.gapPct)} below target (${formatPct(gap.currentPct)} vs ${formatPct(gap.targetPct)}), so most goes to ${tickers}`
    )
  }

  // If no gaps but we have a rebalance plan, generic message
  if (bullets.length === 0 && rebalancePlan) {
    bullets.push("Your allocation is close to target; these buys maintain balance")
  }

  return bullets
}

/**
 * Generate markdown from structured response (deterministic)
 */
function generateMarkdown(structured: StructuredChatReply): string {
  const lines: string[] = []

  // Headline
  lines.push(`**${structured.headline}**`)
  lines.push("")

  // Summary
  lines.push(structured.summary)
  lines.push("")

  // Buys
  if (structured.buys && structured.buys.length > 0) {
    lines.push("**Buy:**")
    for (const buy of structured.buys) {
      lines.push(`- **${buy.ticker}** (${buy.bucket}): ${formatMoney(buy.amount)}`)
    }
    lines.push("")
  }

  // Because
  if (structured.because && structured.because.length > 0) {
    lines.push("**Why:**")
    for (const reason of structured.because) {
      lines.push(`- ${reason}`)
    }
    lines.push("")
  }

  // Warnings
  if (structured.warnings && structured.warnings.length > 0) {
    lines.push("**Notes:**")
    for (const warning of structured.warnings) {
      lines.push(`- ${warning}`)
    }
    lines.push("")
  }

  // Follow-ups
  if (structured.followUps && structured.followUps.length > 0) {
    lines.push("**You might also ask:**")
    for (const followUp of structured.followUps) {
      lines.push(`- ${followUp}`)
    }
  }

  return lines.join("\n").trim()
}

// ===== EXTRACTION HELPERS =====

/**
 * Extract dollar amount from user message
 */
function extractDollarAmount(message: string): number | null {
  const patterns = [
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|USD)/i,
    /(?:^|\s)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s|$)/,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      const numStr = match[1].replace(/,/g, "")
      const num = parseFloat(numStr)
      if (!isNaN(num) && num > 0) {
        return num
      }
    }
  }

  return null
}

/**
 * Determine if user message is asking about rebalancing
 */
function isRebalanceQuery(message: string): boolean {
  const keywords = [
    "rebalance",
    "buy",
    "contribution",
    "invest",
    "allocate",
    "dca",
    "monthly",
    "purchase",
    "what should i buy",
    "should i invest",
    "how much",
  ]

  const lowerMessage = message.toLowerCase()
  return keywords.some((keyword) => lowerMessage.includes(keyword))
}

/**
 * Build system prompt for JSON output
 */
function buildSystemPrompt(
  portfolioSummary: any,
  rebalancePlan: any | null,
  userQuery: string
): string {
  const lines = [
    "You are Portfolio Copilot, a financial assistant. You MUST respond with ONLY valid JSON matching this schema:",
    "",
    "```json",
    "{",
    '  "intent": "rebalance_plan" | "portfolio_question" | "needs_contribution" | "unknown",',
    '  "headline": "string (2-10 words)",',
    '  "summary": "string (1-3 sentences explaining the answer)",',
    '  "because": ["string (2-4 bullets explaining WHY, citing gaps)"], // REQUIRED for rebalance_plan',
    '  "buys": [{"bucket": "string", "ticker": "string", "amount": number}], // REQUIRED for rebalance_plan',
    '  "allocation": { "current": {...}, "target": {...}, "biggestGaps": [...] }, // optional',
    '  "warnings": ["string"], // optional',
    '  "followUps": ["string (1-3 questions)"] // optional',
    "}",
    "```",
    "",
    "CRITICAL RULES:",
    "1. NEVER invent numbers/tickers. ONLY use provided data.",
    "2. If intent is 'rebalance_plan', you MUST include 'buys' and 'because' arrays.",
    "3. If intent is 'needs_contribution', ask for monthly contribution amount.",
    "4. For 'because', cite allocation gaps from data (e.g., 'US Equity is 5.2% below target').",
    "5. Output ONLY JSON. No markdown code fences, no extra text.",
    "",
    "DATA CONTRACT:",
    "- PortfolioSummary.allocation[bucket].pct is 0-100 (current allocation %)",
    "- RebalancePlan.targetAllocation[bucket] is 0-1 decimal (target allocation)",
    "- RebalancePlan.suggestions[].recommendedBuyAmount is dollars",
    "",
    "USER QUERY:",
    userQuery,
    "",
    "PORTFOLIO SUMMARY:",
    JSON.stringify(portfolioSummary, null, 2),
  ]

  if (rebalancePlan) {
    lines.push("", "REBALANCE PLAN:", JSON.stringify(rebalancePlan, null, 2))
  } else if (isRebalanceQuery(userQuery)) {
    lines.push(
      "",
      "REBALANCE PLAN: null (no contribution amount provided)",
      "Set intent to 'needs_contribution' and ask for amount."
    )
  }

  return lines.join("\n")
}

/**
 * Extract facts used from portfolio summary and rebalance plan
 */
function extractFactsUsed(
  portfolioSummary: any,
  rebalancePlan: any | null
): FactsUsed {
  const factsUsed: FactsUsed = {
    asOf: portfolioSummary.asOf,
    totalValue: portfolioSummary.totalValue,
    allocation: Object.entries(portfolioSummary.allocation).reduce(
      (acc, [bucket, data]: [string, any]) => {
        acc[bucket] = data.pct // already 0-100
        return acc
      },
      {} as Record<string, number>
    ),
    topHoldings: portfolioSummary.holdings
      .slice(0, 3)
      .map((h: any) => ({
        ticker: h.ticker,
        name: h.name,
        value: h.value,
      })),
  }

  if (rebalancePlan) {
    // Convert targetAllocation from 0-1 to 0-100 for UI consistency
    factsUsed.targetAllocation = Object.entries(
      rebalancePlan.targetAllocation as Record<string, number>
    ).reduce(
      (acc, [bucket, decimal]) => {
        acc[bucket] = decimal * 100
        return acc
      },
      {} as Record<string, number>
    )

    factsUsed.rebalanceSuggestions = rebalancePlan.suggestions.map((s: any) => ({
      bucket: s.bucket,
      buyAmount: s.recommendedBuyAmount,
      tickers: s.recommendedTickers.map((t: any) => t.ticker),
    }))
  }

  return factsUsed
}

/**
 * Parse JSON safely with fallback
 */
function parseStructuredJSON(
  content: string,
  portfolioSummary: any,
  rebalancePlan: any | null
): StructuredChatReply {
  try {
    const parsed = JSON.parse(content)

    // Validate required fields
    if (!parsed.intent || !parsed.headline || !parsed.summary) {
      throw new Error("Missing required fields")
    }

    // If intent is rebalance_plan but missing buys/because, fall back
    if (parsed.intent === "rebalance_plan") {
      if (!parsed.buys || parsed.buys.length === 0) {
        parsed.buys = buildDeterministicBuys(rebalancePlan)
      }
      if (!parsed.because || parsed.because.length === 0) {
        const gaps = computeBiggestGaps(portfolioSummary, rebalancePlan)
        parsed.because = buildBecauseBullets(gaps, rebalancePlan)
      }
    }

    return parsed as StructuredChatReply
  } catch (error) {
    console.error("Failed to parse structured JSON:", error)
    console.error("Raw content:", content)

    // Fallback: build minimal structured response
    return buildFallbackStructured(portfolioSummary, rebalancePlan)
  }
}

/**
 * Build fallback structured response
 */
function buildFallbackStructured(
  portfolioSummary: any,
  rebalancePlan: any | null
): StructuredChatReply {
  if (rebalancePlan) {
    const buys = buildDeterministicBuys(rebalancePlan)
    const gaps = computeBiggestGaps(portfolioSummary, rebalancePlan)
    const because = buildBecauseBullets(gaps, rebalancePlan)

    return {
      intent: "rebalance_plan",
      headline: "Here's what to buy",
      summary: "Based on your current allocation and target, here are the recommended purchases.",
      buys,
      because,
      allocation: {
        current: Object.entries(portfolioSummary.allocation).reduce(
          (acc, [bucket, data]: [string, any]) => {
            acc[bucket] = data.pct
            return acc
          },
          {} as Record<string, number>
        ),
        target: Object.entries(rebalancePlan.targetAllocation as Record<string, number>).reduce(
          (acc, [bucket, decimal]) => {
            acc[bucket] = decimal * 100
            return acc
          },
          {} as Record<string, number>
        ),
        biggestGaps: gaps,
      },
    }
  }

  return {
    intent: "portfolio_question",
    headline: "Portfolio Overview",
    summary: `Your portfolio is worth ${formatMoney(portfolioSummary.totalValue)} as of ${new Date(portfolioSummary.asOf).toLocaleDateString()}.`,
    followUps: ["What should I buy this month?", "Am I diversified enough?"],
  }
}

// ===== MAIN HANDLER =====

export async function POST(request: NextRequest) {
  try {
    // 1. AUTH
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. PARSE REQUEST
    const body: ChatRequest = await request.json()
    const { messages, overrideMonthlyContribution } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      )
    }

    // 3. CHECK OPENAI KEY
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured. Please set the environment variable.",
        },
        { status: 500 }
      )
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })

    // 4. LOAD PROFILE
    const profile = await prisma.profile.findUnique({
      where: { userId },
    })

    // 5. FETCH PORTFOLIO SUMMARY
    const portfolioSummary = await getPortfolioSummary(userId)

    // 6. DETERMINE IF REBALANCE PLAN IS NEEDED
    const latestUserMessage = messages[messages.length - 1]
    const isRebalanceRequest = isRebalanceQuery(latestUserMessage.content)
    const extractedAmount = extractDollarAmount(latestUserMessage.content)

    let usedRebalance = false
    let usedContribution: number | undefined = undefined
    let rebalancePlan: any | null = null

    if (isRebalanceRequest) {
      // Determine contribution amount
      let contributionAmount: number | null = null

      if (extractedAmount !== null) {
        contributionAmount = extractedAmount
      } else if (overrideMonthlyContribution !== undefined) {
        contributionAmount = overrideMonthlyContribution
      } else if (profile?.monthlyContributionCents) {
        contributionAmount = profile.monthlyContributionCents / 100
      }

      // If we have contribution amount, build rebalance plan
      if (contributionAmount !== null && contributionAmount > 0) {
        try {
          rebalancePlan = await buildMonthlyRebalancePlan(userId, {
            monthlyContribution: contributionAmount,
            mode: "monthly_contribution",
          })
          usedRebalance = true
          usedContribution = contributionAmount
        } catch (error) {
          console.error("Error building rebalance plan:", error)
          // Continue without rebalance plan
        }
      }
    }

    // 7. BUILD SYSTEM PROMPT
    const systemPrompt = buildSystemPrompt(
      portfolioSummary,
      rebalancePlan,
      latestUserMessage.content
    )

    // 8. CALL OPENAI WITH JSON MODE
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini"

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(0, -1).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: latestUserMessage.content },
    ]

    const completion = await openai.chat.completions.create({
      model,
      messages: openaiMessages,
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for consistency
      max_tokens: 800,
    })

    const rawContent = completion.choices[0]?.message?.content || "{}"

    // 9. PARSE STRUCTURED JSON
    let structured = parseStructuredJSON(rawContent, portfolioSummary, rebalancePlan)

    // 10. ENHANCE STRUCTURED WITH DETERMINISTIC DATA
    if (structured.intent === "rebalance_plan" && rebalancePlan) {
      // Ensure buys are present
      if (!structured.buys || structured.buys.length === 0) {
        structured.buys = buildDeterministicBuys(rebalancePlan)
      }

      // Ensure because is present
      if (!structured.because || structured.because.length === 0) {
        const gaps = computeBiggestGaps(portfolioSummary, rebalancePlan)
        structured.because = buildBecauseBullets(gaps, rebalancePlan)
      }

      // Add allocation data
      if (!structured.allocation) {
        const gaps = computeBiggestGaps(portfolioSummary, rebalancePlan)
        structured.allocation = {
          current: Object.entries(portfolioSummary.allocation).reduce(
            (acc, [bucket, data]: [string, any]) => {
              acc[bucket] = data.pct
              return acc
            },
            {} as Record<string, number>
          ),
          target: Object.entries(
            rebalancePlan.targetAllocation as Record<string, number>
          ).reduce(
            (acc, [bucket, decimal]) => {
              acc[bucket] = decimal * 100
              return acc
            },
            {} as Record<string, number>
          ),
          biggestGaps: gaps,
        }
      }
    }

    // 11. GENERATE MARKDOWN DETERMINISTICALLY
    const replyMarkdown = generateMarkdown(structured)

    // 12. EXTRACT FACTS USED
    const factsUsed = extractFactsUsed(portfolioSummary, rebalancePlan)

    // 13. RETURN RESPONSE
    const response: ChatResponse = {
      reply: replyMarkdown, // backward compatibility
      replyMarkdown,
      structured,
      factsUsed,
      usedRebalance,
      usedContribution,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
