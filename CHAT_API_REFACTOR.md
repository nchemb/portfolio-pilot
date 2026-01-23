# Chat API Refactor - Structured JSON Output

## Overview

The `/api/chat` endpoint has been refactored to produce **structured JSON responses** with **deterministically generated markdown**, ensuring consistent, explainable answers grounded in portfolio data.

## Key Changes

### 1. Structured Response Format

**Before:**
```typescript
{
  reply: string,
  factsUsed: {...},
  usedRebalance: boolean,
  usedContribution?: number
}
```

**After:**
```typescript
{
  reply: string,              // backward compat (= replyMarkdown)
  replyMarkdown: string,      // deterministically generated
  structured: {
    intent: "rebalance_plan" | "portfolio_question" | "needs_contribution" | "unknown",
    headline: string,
    summary: string,
    because?: string[],       // WHY bullets (deterministic)
    buys?: Array<{            // what to buy
      bucket: string,
      ticker: string,
      amount: number
    }>,
    allocation?: {
      current: Record<string, number>,
      target?: Record<string, number>,
      biggestGaps?: Array<{
        bucket: string,
        currentPct: number,
        targetPct: number,
        gapPct: number
      }>
    },
    warnings?: string[],
    followUps?: string[]
  },
  factsUsed: {...},
  usedRebalance: boolean,
  usedContribution?: number
}
```

### 2. Deterministic "Because" Explanations

For rebalance questions, the API now **always includes WHY** based on allocation gaps:

```typescript
because: [
  "Us Equity is 5.2% below target (35.0% vs 40.2%), so most goes to VTI",
  "Bonds is 3.1% below target (15.0% vs 18.1%), so most goes to BND",
  "Your allocation is close to target; these buys maintain balance"
]
```

These are computed **deterministically** from:
- Current allocation (from portfolio summary)
- Target allocation (from rebalance plan)
- Gaps sorted by size (target - current)

### 3. JSON Mode with Lower Temperature

```typescript
const completion = await openai.chat.completions.create({
  model,
  messages: openaiMessages,
  response_format: { type: "json_object" },  // NEW: Force JSON
  temperature: 0.2,                          // NEW: Was 0.7
  max_tokens: 800,
})
```

**Benefits:**
- Consistent output format
- More predictable responses
- Easier to parse and validate

### 4. Server-Side Markdown Generation

Markdown is generated **deterministically** on the server, not by the LLM:

```typescript
function generateMarkdown(structured: StructuredChatReply): string {
  // **Headline**
  // Summary
  // **Buy:**
  // - **VTI** (us_equity): $300
  // **Why:**
  // - Reason bullets
  // **Notes:**
  // - Warnings
  // **You might also ask:**
  // - Follow-ups
}
```

**Benefits:**
- Consistent formatting
- No LLM hallucination in formatting
- Easy to customize (change template, not prompt)

### 5. Fallback Logic

If OpenAI returns invalid JSON or missing fields, the API falls back to **fully deterministic** responses:

```typescript
function buildFallbackStructured(portfolioSummary, rebalancePlan) {
  if (rebalancePlan) {
    return {
      intent: "rebalance_plan",
      headline: "Here's what to buy",
      summary: "Based on your current allocation...",
      buys: buildDeterministicBuys(rebalancePlan),
      because: buildBecauseBullets(gaps, rebalancePlan)
    }
  }
  return {
    intent: "portfolio_question",
    headline: "Portfolio Overview",
    summary: `Your portfolio is worth $${totalValue}...`
  }
}
```

### 6. Improved System Prompt

The prompt now:
- Explicitly requests JSON output
- Defines the exact schema
- Specifies data contracts (pct vs decimals)
- Requires "because" bullets for rebalance answers
- Prohibits number invention

## Usage Examples

### Frontend (Backward Compatible)

The `reply` field still works for existing frontend:

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages })
})

const { reply, factsUsed } = await response.json()
// reply contains markdown as before
```

### Frontend (Using Structured)

New frontends can use structured data:

```typescript
const { replyMarkdown, structured, factsUsed } = await response.json()

if (structured.intent === "rebalance_plan") {
  // Render buys deterministically
  structured.buys.forEach(buy => {
    console.log(`Buy ${buy.ticker}: ${formatMoney(buy.amount)}`)
  })

  // Show why
  structured.because.forEach(reason => {
    console.log(`- ${reason}`)
  })

  // Show allocation gaps
  structured.allocation.biggestGaps.forEach(gap => {
    console.log(`${gap.bucket}: ${gap.currentPct}% → ${gap.targetPct}%`)
  })
}
```

### Frontend (Custom Rendering)

Instead of rendering markdown, render from structured:

```tsx
{structured.intent === "rebalance_plan" && (
  <>
    <h3>{structured.headline}</h3>
    <p>{structured.summary}</p>

    <h4>Buy These:</h4>
    <ul>
      {structured.buys.map(buy => (
        <li key={buy.ticker}>
          <strong>{buy.ticker}</strong> ({buy.bucket}): ${buy.amount}
        </li>
      ))}
    </ul>

    <h4>Why:</h4>
    <ul>
      {structured.because.map((reason, i) => (
        <li key={i}>{reason}</li>
      ))}
    </ul>
  </>
)}
```

## Key Functions

### `computeBiggestGaps(portfolioSummary, rebalancePlan)`

Computes allocation gaps (target - current) and returns sorted list of underweight positions.

**Input:**
- `portfolioSummary.allocation[bucket].pct` (0-100)
- `rebalancePlan.targetAllocation[bucket]` (0-1 decimal)

**Output:**
```typescript
[
  { bucket: "us_equity", currentPct: 35.0, targetPct: 40.2, gapPct: 5.2 },
  { bucket: "bonds", currentPct: 15.0, targetPct: 18.1, gapPct: 3.1 }
]
```

### `buildDeterministicBuys(rebalancePlan)`

Extracts buy recommendations from rebalance plan.

**Input:**
- `rebalancePlan.suggestions[]` with `recommendedBuyAmount` and `recommendedTickers`

**Output:**
```typescript
[
  { bucket: "us_equity", ticker: "VTI", amount: 300 },
  { bucket: "bonds", ticker: "BND", amount: 150 }
]
```

### `buildBecauseBullets(biggestGaps, rebalancePlan)`

Generates explanation bullets citing specific gaps.

**Input:**
- Sorted gaps array
- Rebalance plan with ticker recommendations

**Output:**
```typescript
[
  "Us Equity is 5.2% below target (35.0% vs 40.2%), so most goes to VTI",
  "Bonds is 3.1% below target (15.0% vs 18.1%), so most goes to BND"
]
```

### `generateMarkdown(structured)`

Deterministically renders structured data as markdown.

**Input:**
- Structured response object

**Output:**
```markdown
**Here's what to buy**

Based on your current allocation and target, here are the recommended purchases.

**Buy:**
- **VTI** (us_equity): $300
- **BND** (bonds): $150

**Why:**
- Us Equity is 5.2% below target (35.0% vs 40.2%), so most goes to VTI
- Bonds is 3.1% below target (15.0% vs 18.1%), so most goes to BND
```

## Testing

### 1. Rebalance Question with Amount

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "What should I buy with $500?" }
  ]
}
```

**Expected Response:**
```json
{
  "reply": "**Rebalance Plan for $500**\n\n...",
  "replyMarkdown": "**Rebalance Plan for $500**\n\n...",
  "structured": {
    "intent": "rebalance_plan",
    "headline": "Rebalance Plan for $500",
    "summary": "...",
    "buys": [...],
    "because": [...]
  },
  "usedRebalance": true,
  "usedContribution": 500
}
```

### 2. Rebalance Question without Amount

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "What should I buy?" }
  ]
}
```

**Expected Response:**
```json
{
  "structured": {
    "intent": "needs_contribution",
    "headline": "How much are you investing?",
    "summary": "To create a rebalance plan, I need to know your monthly contribution amount."
  },
  "usedRebalance": false
}
```

### 3. Portfolio Question

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "What are my biggest holdings?" }
  ]
}
```

**Expected Response:**
```json
{
  "structured": {
    "intent": "portfolio_question",
    "headline": "Your Top Holdings",
    "summary": "Your biggest positions are...",
    "followUps": [
      "Am I diversified enough?",
      "What should I buy this month?"
    ]
  },
  "usedRebalance": false
}
```

## Migration Guide

### For Existing Frontend

**No changes required!** The `reply` field still works:

```typescript
// This still works
const { reply } = await response.json()
setMessages([...messages, { role: "assistant", content: reply }])
```

### To Use Structured Data

Update to use `replyMarkdown` and `structured`:

```diff
- const { reply, factsUsed } = await response.json()
+ const { replyMarkdown, structured, factsUsed } = await response.json()

  setMessages([...messages, {
    role: "assistant",
-   content: reply,
+   content: replyMarkdown,
+   structured,
    factsUsed
  }])
```

Then optionally render from `structured` instead of markdown.

## Benefits

### 1. **Consistency**

- Fixed markdown format (no LLM variation)
- Predictable JSON structure
- Lower temperature = less randomness

### 2. **Explainability**

- Always includes "because" for rebalance answers
- Citations reference deterministic gaps
- Transparent allocation math

### 3. **Reliability**

- Fallback logic for invalid JSON
- Server validates required fields
- No dependency on LLM formatting

### 4. **Flexibility**

- Frontend can render markdown OR structured
- Easy to customize templates
- Machine-readable + human-readable

### 5. **Debuggability**

- Log structured output for analysis
- Track intent distribution
- Monitor gap calculations

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (defaults to gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini
```

### Tuning Temperature

Current: `0.2` (low variance, consistent)

- Increase to `0.3-0.5` for more creative explanations
- Decrease to `0.0-0.1` for maximum determinism

### Customizing Markdown

Edit `generateMarkdown()` function:

```typescript
function generateMarkdown(structured: StructuredChatReply): string {
  // Customize format here
  const lines: string[] = []
  lines.push(`# ${structured.headline}`)  // H1 instead of bold
  // ...
  return lines.join("\n")
}
```

## Troubleshooting

### "Invalid JSON from OpenAI"

Check console logs for raw output. The API will fall back to deterministic response.

### "Missing because bullets"

The API automatically fills in `because` from gaps if OpenAI omits them.

### "Numbers don't match portfolio"

Check `factsUsed` to verify data sources. All numbers should trace to portfolio summary or rebalance plan.

### "Allocation percentages wrong"

Verify units:
- Portfolio summary: `0-100` (percentages)
- Rebalance plan: `0-1` (decimals)
- API converts to `0-100` for consistency

## Future Enhancements

1. **Function Calling**: Use OpenAI tools API instead of JSON mode
2. **Streaming**: Stream structured JSON fields incrementally
3. **Multi-turn Context**: Include allocation history across conversation
4. **Risk Metrics**: Add Sharpe ratio, volatility to structured output
5. **Visual Data**: Include chart configs in structured response

## Summary

The refactored API:

✅ Returns **structured JSON** + **deterministic markdown**
✅ Always includes **"because" explanations** based on gaps
✅ Uses **JSON mode** + **lower temperature** (0.2)
✅ Has **fallback logic** for invalid responses
✅ Maintains **backward compatibility** with `reply` field
✅ Enables **custom frontend rendering** from structured data

The model's job is now: **"Explain the deterministic facts in plain English"**, not invent numbers or format output.
