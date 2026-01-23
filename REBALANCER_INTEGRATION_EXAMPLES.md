# Rebalancer Engine Integration Examples

Examples showing how to integrate the deterministic rebalancer engine into different contexts.

## 1. Direct TypeScript/Node.js Usage

```typescript
import { buildMonthlyRebalancePlan } from "@/lib/rebalancer"

async function runRebalancer() {
  const userId = "user_abc123"

  const plan = await buildMonthlyRebalancePlan(userId, {
    monthlyContribution: 1000,
    preferInvestingCash: true,
    minBuyAmount: 25,
  })

  console.log("Current allocation:", plan.currentAllocation)
  console.log("Target allocation:", plan.targetAllocation)
  console.log("Suggestions:", plan.suggestions)

  // Extract actionable recommendations
  for (const suggestion of plan.suggestions) {
    const ticker = suggestion.recommendedTickers[0].ticker
    const amount = suggestion.recommendedBuyAmount
    console.log(`Buy ${amount.toFixed(2)} of ${ticker}`)
  }
}
```

## 2. API Call from Frontend

```typescript
// frontend/components/rebalancer.tsx
async function getRebalancePlan(monthlyContribution: number) {
  const response = await fetch("/api/rebalance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      monthlyContribution,
      preferInvestingCash: true,
      minBuyAmount: 25,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to generate rebalance plan")
  }

  return await response.json()
}

// Usage in React component
function RebalancerCard() {
  const [plan, setPlan] = useState(null)
  const [contribution, setContribution] = useState(1000)

  const handleGenerate = async () => {
    try {
      const result = await getRebalancePlan(contribution)
      setPlan(result)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  return (
    <div>
      <input
        type="number"
        value={contribution}
        onChange={(e) => setContribution(parseFloat(e.target.value))}
      />
      <button onClick={handleGenerate}>Generate Plan</button>

      {plan && (
        <div>
          <h3>Suggested Buys:</h3>
          <ul>
            {plan.suggestions.map((s) => (
              <li key={s.bucket}>
                {s.recommendedTickers[0].ticker}: ${s.recommendedBuyAmount.toFixed(2)}
                <br />
                <small>
                  Gap to target: {(s.gapToTargetPct * 100).toFixed(2)}%
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

## 3. AI Chat Assistant Integration (Pseudocode)

```typescript
// AI assistant calling the rebalancer engine
async function handleUserMessage(userId: string, message: string) {
  // AI detects intent: user wants rebalancing advice
  if (detectIntent(message) === "rebalance_request") {
    // Extract monthly contribution from message
    const contribution = extractAmount(message) // e.g., $1000

    // Call deterministic engine
    const plan = await buildMonthlyRebalancePlan(userId, {
      monthlyContribution: contribution,
      preferInvestingCash: true,
      minBuyAmount: 25,
    })

    // AI generates natural language response
    const response = `
Based on your ${formatCurrency(plan.currentTotalValue)} portfolio and
${formatCurrency(contribution)} monthly contribution, here's what I recommend:

${plan.suggestions.map(s =>
  `- Buy ${formatCurrency(s.recommendedBuyAmount)} of ${s.recommendedTickers[0].ticker}
    (${s.bucket} is ${(s.gapToTargetPct * 100).toFixed(1)}% below target)`
).join('\n')}

This will move your allocation from:
${formatAllocation(plan.currentAllocation)}

Closer to your target of:
${formatAllocation(plan.targetAllocation)}

Would you like me to explain why these specific ETFs were chosen?
    `

    return response
  }
}
```

## 4. Scheduled Automation (Monthly Email)

```typescript
// scripts/monthly-rebalance-email.ts
import { buildMonthlyRebalancePlan } from "@/lib/rebalancer"
import { sendEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"

async function sendMonthlyRebalanceEmails() {
  // Get all users who have enabled monthly rebalance emails
  const users = await prisma.user.findMany({
    where: {
      profile: {
        monthlyRebalanceEnabled: true,
        monthlyContribution: { gt: 0 }
      }
    },
    include: { profile: true }
  })

  for (const user of users) {
    const contribution = user.profile.monthlyContribution

    const plan = await buildMonthlyRebalancePlan(user.id, {
      monthlyContribution: contribution,
      preferInvestingCash: true,
      minBuyAmount: 25,
    })

    const emailHtml = `
      <h2>Your Monthly Rebalance Plan</h2>
      <p>Monthly contribution: $${contribution.toFixed(2)}</p>

      <h3>Suggested Purchases:</h3>
      <ul>
        ${plan.suggestions.map(s => `
          <li>
            <strong>${s.recommendedTickers[0].ticker}</strong>:
            $${s.recommendedBuyAmount.toFixed(2)}
            <br>
            <small>Gap to target: ${(s.gapToTargetPct * 100).toFixed(2)}%</small>
          </li>
        `).join('')}
      </ul>

      ${plan.notes.length > 0 ? `
        <h3>Notes:</h3>
        <ul>
          ${plan.notes.map(note => `<li>${note}</li>`).join('')}
        </ul>
      ` : ''}
    `

    await sendEmail({
      to: user.email,
      subject: "Your Monthly Portfolio Rebalance Plan",
      html: emailHtml,
    })
  }
}

// Run via cron: 0 9 1 * * (9am on 1st of each month)
```

## 5. Webhook Integration (Plaid Account Sync)

```typescript
// src/app/api/webhooks/plaid/route.ts
import { buildMonthlyRebalancePlan } from "@/lib/rebalancer"

export async function POST(request: Request) {
  const webhook = await request.json()

  // When holdings are updated, optionally regenerate rebalance plan
  if (webhook.webhook_type === "HOLDINGS" && webhook.webhook_code === "DEFAULT_UPDATE") {
    const userId = await getUserIdFromItemId(webhook.item_id)

    // Get user's configured monthly contribution
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { monthlyContribution: true }
    })

    if (profile?.monthlyContribution) {
      // Generate fresh plan with updated holdings
      const plan = await buildMonthlyRebalancePlan(userId, {
        monthlyContribution: profile.monthlyContribution,
        preferInvestingCash: true,
        minBuyAmount: 25,
      })

      // Store plan for later retrieval or send notification
      await prisma.rebalancePlan.create({
        data: {
          userId,
          planData: JSON.stringify(plan),
          createdAt: new Date(),
        }
      })
    }
  }

  return new Response("OK", { status: 200 })
}
```

## 6. CLI Tool for Power Users

```typescript
#!/usr/bin/env tsx
// scripts/rebalance.ts
import { buildMonthlyRebalancePlan } from "../src/lib/rebalancer"
import { program } from "commander"

program
  .name("rebalance")
  .description("Generate monthly rebalance plan")
  .requiredOption("-u, --user <userId>", "User ID")
  .requiredOption("-c, --contribution <amount>", "Monthly contribution amount")
  .option("--no-cash", "Do not prefer investing cash")
  .option("--min-buy <amount>", "Minimum buy amount (default: 25)", "25")
  .action(async (options) => {
    const plan = await buildMonthlyRebalancePlan(options.user, {
      monthlyContribution: parseFloat(options.contribution),
      preferInvestingCash: options.cash,
      minBuyAmount: parseFloat(options.minBuy),
    })

    console.log("\n=== REBALANCE PLAN ===\n")
    console.log("Suggested buys:")
    for (const suggestion of plan.suggestions) {
      console.log(
        `  ${suggestion.recommendedTickers[0].ticker}: $${suggestion.recommendedBuyAmount.toFixed(2)}`
      )
    }
    console.log()
  })

program.parse()

// Usage: npx tsx scripts/rebalance.ts -u user_123 -c 1000
```

## 7. Comparison Tool (Test Different Scenarios)

```typescript
// Compare allocation strategies
async function compareStrategies(userId: string) {
  const scenarios = [
    { contribution: 500, preferCash: true },
    { contribution: 1000, preferCash: true },
    { contribution: 1000, preferCash: false },
    { contribution: 2000, preferCash: true },
  ]

  console.log("=== STRATEGY COMPARISON ===\n")

  for (const scenario of scenarios) {
    const plan = await buildMonthlyRebalancePlan(userId, {
      monthlyContribution: scenario.contribution,
      preferInvestingCash: scenario.preferCash,
      minBuyAmount: 25,
    })

    console.log(
      `Contribution: $${scenario.contribution}, Prefer Cash: ${scenario.preferCash}`
    )
    console.log("Suggestions:")
    for (const s of plan.suggestions) {
      console.log(
        `  ${s.bucket}: $${s.recommendedBuyAmount.toFixed(2)} → ${s.recommendedTickers[0].ticker}`
      )
    }
    console.log()
  }
}
```

## 8. Portfolio Dashboard Widget

```typescript
// components/rebalance-widget.tsx
"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function RebalanceWidget() {
  const [contribution, setContribution] = useState(1000)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyContribution: contribution }),
      })
      const data = await response.json()
      setPlan(data)
    } catch (error) {
      console.error("Failed to generate plan:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Rebalance Planner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Monthly contribution"
            value={contribution}
            onChange={(e) => setContribution(parseFloat(e.target.value))}
          />
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate Plan"}
          </Button>
        </div>

        {plan && (
          <div className="space-y-2">
            <h4 className="font-semibold">Suggested Purchases:</h4>
            {plan.suggestions.map((s) => (
              <div
                key={s.bucket}
                className="flex justify-between items-center p-2 border rounded"
              >
                <div>
                  <div className="font-medium">
                    {s.recommendedTickers[0].ticker}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {s.bucket} · Gap: {(s.gapToTargetPct * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="text-lg font-semibold">
                  ${s.recommendedBuyAmount.toFixed(2)}
                </div>
              </div>
            ))}

            {plan.notes.length > 0 && (
              <div className="text-sm text-muted-foreground space-y-1">
                {plan.notes.map((note, i) => (
                  <p key={i}>ℹ️ {note}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

## Key Takeaways

1. **The engine is deterministic** - same inputs always produce same outputs
2. **No LLMs in the engine** - AI layer can wrap it for natural language
3. **Reusable across contexts** - CLI, API, scheduled jobs, webhooks, UI
4. **Production-ready** - handles edge cases, validates inputs, provides clear errors
5. **Extendable** - output structure supports future features (multi-ticker, tax-loss harvesting)

The engine does **one thing well**: deterministic contribution allocation. Everything else (UI, AI chat, automation) is layered on top.
