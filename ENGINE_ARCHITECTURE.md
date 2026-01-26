# Portfolio Flow Engine Architecture

Production-grade deterministic engine layer for portfolio analysis and rebalancing.

**NO LLMs. NO UI polish. Just logic + API + testing.**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      AI CHAT LAYER                          │
│              (Future: narrates results)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                               │
│   GET  /api/portfolio/summary  → PortfolioSummary          │
│   POST /api/rebalance          → RebalancePlan             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRUTH LAYER (Engine)                      │
│                                                              │
│  ┌──────────────────┐  ┌────────────────────────────────┐ │
│  │ Classification   │  │ Portfolio Summary              │ │
│  │ (shared logic)   │  │ (single source of truth)       │ │
│  └──────────────────┘  └────────────────────────────────┘ │
│           │                         │                       │
│           └─────────┬───────────────┘                      │
│                     ▼                                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Rebalancer Engine                                    │ │
│  │ - monthly_contribution mode                          │ │
│  │ - invest_cash_balance mode                           │ │
│  │ - Multi-ticker recommendations                       │ │
│  │ - Deterministic plan summary                         │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│               Prisma + PostgreSQL                            │
└─────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Classification Module ([src/lib/classification.ts](src/lib/classification.ts))

**Purpose:** Single source of truth for asset classification logic.

**Exports:**
- `getEffectiveClassification(holding, maps)` - Classify a holding
- `assetClassBucket(assetClass)` - Convert to bucket type
- `holdingMarketValue(holding)` - Compute market value
- `getHoldingAggregationKey(holding)` - Generate stable keys for holdings without tickers

**Classification Hierarchy (priority order):**
1. **UserSecurityOverride** (source: `"override"`) - User manual overrides
2. **FundProfile** (source: `"fundProfile"`) - Pre-seeded fund classifications
3. **SecurityType** (source: `"securityType"`) - Cash/bond inference
4. **Holding** (source: `"holding"`) - From Plaid data
5. **Fallback** (source: `"fallback"`) - Default to "other"

**Asset Class Buckets:**
- `us_equity` - US stocks/ETFs
- `intl_equity` - International stocks/ETFs
- `bonds` - Fixed income
- `cash` - Cash equivalents
- `other` - Alternative assets / unclassified

**Key Features:**
- Deterministic aggregation keys for holdings without tickers (`__CASH__`, `__UNKNOWN__`)
- Safe Prisma Decimal → number conversion
- Shared by dashboard, portfolio summary, and rebalancer

### 2. Portfolio Summary ([src/lib/portfolio-summary.ts](src/lib/portfolio-summary.ts))

**Purpose:** Single source of truth for complete portfolio state.

**Main Function:**
```typescript
getPortfolioSummary(userId: string): Promise<PortfolioSummary>
```

**Returns:**
```typescript
{
  userId: string
  asOf: string // ISO timestamp
  totalValue: number
  allocation: Record<AssetClassBucket, { dollarValue, pct }>
  holdings: TopHolding[] // ALL holdings, aggregated and sorted by value
  accounts: AccountSummary[] // per-account breakdowns
  classificationStats: {
    countBySource: Record<ClassificationSource, number>
    needsReviewCount: number
  }
  warnings: string[]
}
```

**Features:**
- Aggregates holdings across all accounts using stable keys
- Computes per-account and total allocation
- Tracks classification sources and review status
- Generates warnings for data quality issues
- Used by dashboard and future AI chat layer

### 3. Rebalancer Engine ([src/lib/rebalancer.ts](src/lib/rebalancer.ts))

**Purpose:** Deterministic allocation engine for monthly contributions and cash investment.

**Main Function:**
```typescript
buildMonthlyRebalancePlan(userId: string, input: RebalancerInput): Promise<RebalancePlan>
```

**Input:**
```typescript
{
  mode?: "monthly_contribution" | "invest_cash_balance" // default "monthly_contribution"
  monthlyContribution?: number // required for monthly_contribution mode
  maxInvestAmount?: number // optional cap when investing cash
  preferInvestingCash?: boolean // default true
  minBuyAmount?: number // default $25
}
```

**Output:**
```typescript
{
  timestamp: string
  mode: RebalancerMode
  investAmount: number
  currentTotalValue: number
  projectedTotalValue: number
  currentAllocation: AssetAllocation
  targetAllocation: AssetAllocation
  projectedAllocation: AssetAllocation
  suggestions: BucketSuggestion[]
  warnings: string[]
  planSummary: string // 2-4 lines, deterministic explanation
}
```

**Modes:**

1. **monthly_contribution** (default)
   - Allocates new cash contribution across underweight buckets
   - `preferInvestingCash: true` → skip cash bucket unless others satisfied
   - Projects total value after contribution

2. **invest_cash_balance**
   - Invests existing cash balance into underweight buckets
   - `maxInvestAmount` can cap investment
   - Projected total value stays same (cash → other assets)

**Ticker Recommendations (2-3 per bucket):**
```typescript
[
  { ticker: "VOO", reason: "existing_holding", weight: 0.5 },
  { ticker: "VTI", reason: "default", weight: 0.3 },
  { ticker: "SCHB", reason: "low_fee_alternative", weight: 0.2 }
]
```

**Bucket Suggestions Include:**
- `gapToTargetPct` - Percentage gap (target - current)
- `gapToTargetDollar` - Dollar gap
- `bucketReason` - Deterministic explanation string
- `recommendedTickers[]` - 2-3 options with weights

**Warnings:**
- "other" bucket allocation → suggest reclassification
- Common ETF misclassifications (VOO/SPY/VTI classified as bonds/cash/other)

**Default Tickers:**
- `us_equity`: VTI (Vanguard Total Stock Market ETF)
- `intl_equity`: VXUS (Vanguard Total International Stock ETF)
- `bonds`: BND (Vanguard Total Bond Market ETF)
- `cash`: CASH (no ticker)
- `other`: VTI (fallback with warning)

**Low-Fee Alternatives (Schwab):**
- `us_equity`: SCHB
- `intl_equity`: SCHF
- `bonds`: SCHZ

## API Endpoints

### GET /api/portfolio/summary

**Auth:** Clerk (userId required)

**Response:** `PortfolioSummary` JSON

**Use Cases:**
- Dashboard overview
- AI chat: "Show me my portfolio"
- AI chat: "Am I overexposed to US equities?"

### POST /api/rebalance

**Auth:** Clerk (userId required)

**Request Body:**
```json
{
  "mode": "monthly_contribution",
  "monthlyContribution": 1000,
  "preferInvestingCash": true,
  "minBuyAmount": 25
}
```

OR

```json
{
  "mode": "invest_cash_balance",
  "maxInvestAmount": 5000,
  "minBuyAmount": 25
}
```

**Response:** `RebalancePlan` JSON

**Use Cases:**
- AI chat: "What should I buy this month?"
- AI chat: "What should I invest my idle cash into?"
- Automated monthly emails

## Testing

### Portfolio Summary Test

```bash
npx tsx scripts/test-portfolio-summary.ts <userId>
```

**Output:**
- Total value
- Allocation percentages
- Top 10 holdings (ticker, value, %, asset class, source)
- Per-account summaries
- Classification stats
- Warnings

### Rebalancer Test

```bash
# Test both modes
npx tsx scripts/test-rebalancer.ts <userId> 1000

# Test invest_cash_balance only
npx tsx scripts/test-rebalancer.ts <userId>
```

**Output:**
- Plan summary (deterministic explanation)
- Current / target / projected allocations
- Suggested buys with multi-ticker options
- Gap analysis (pct and dollar)
- Bucket reasons
- Warnings
- Verification (buy amounts sum to invest amount)

## Integration with AI Chat Layer (Future)

The engines are designed to be **called by an AI assistant** that:

1. **Asks clarifying questions**
   - "What's your monthly contribution amount?"
   - "Do you want to invest your idle cash?"

2. **Calls deterministic engines**
   - `GET /api/portfolio/summary` for state
   - `POST /api/rebalance` for recommendations

3. **Narrates results naturally**
   - "You have $50,000 invested across 3 accounts."
   - "I recommend buying $600 of BND and $400 of VTI this month."
   - "This will bring your bonds allocation from 18% to 22%, closer to your 25% target."

4. **Answers follow-up questions**
   - "Why BND?" → Explains bucket reason and gap
   - "What if I contribute $2000?" → Calls engine with new amount
   - "Show alternatives" → Uses multi-ticker recommendations

**The AI layer adds:**
- Natural language understanding
- Conversational flow
- Context memory
- Research about ETFs

**The engine layer guarantees:**
- Deterministic math
- Consistent classification
- Explainable recommendations
- Verifiable correctness

## Design Principles

### 1. Determinism > Cleverness
- Same inputs → same outputs, always
- No randomness, no LLM calls in engine
- Purely mathematical allocation

### 2. Single Source of Truth
- `getEffectiveClassification()` used everywhere
- `getPortfolioSummary()` is truth layer
- No duplicate classification logic

### 3. Explainability
- Every decision has a deterministic reason
- `bucketReason` explains gaps
- `planSummary` narrates plan
- Warnings highlight data issues

### 4. Stability
- Aggregation keys handle tickers/no-tickers
- Rounding handled correctly (no drift)
- Decimal conversions explicit

### 5. Testability
- Smoke tests verify correctness
- Allocation sums verified within 1 cent
- No database changes in test scripts

## Common Use Cases

### AI Chat: "Show me my portfolio"

```typescript
const summary = await fetch('/api/portfolio/summary').then(r => r.json())

// AI narrates:
"You have ${formatCurrency(summary.totalValue)} invested across
${summary.accounts.length} accounts with ${summary.holdings.length} holdings.
Your allocation is ${formatPct(summary.allocation.us_equity.pct)} US equity,
${formatPct(summary.allocation.intl_equity.pct)} international equity,
${formatPct(summary.allocation.bonds.pct)} bonds, and
${formatPct(summary.allocation.cash.pct)} cash."
```

### AI Chat: "What should I buy this month?"

```typescript
// AI asks: "What's your monthly contribution?"
// User: "$1000"

const plan = await fetch('/api/rebalance', {
  method: 'POST',
  body: JSON.stringify({
    mode: 'monthly_contribution',
    monthlyContribution: 1000
  })
}).then(r => r.json())

// AI narrates:
plan.planSummary
// "Allocating $1000.00 monthly contribution across 2 asset classes.
//  Primary allocation: $625.00 to bonds (BND).
//  Largest variance: bonds (5.2% from target)."

// AI shows suggestions:
for (const suggestion of plan.suggestions) {
  console.log(`Buy $${suggestion.recommendedBuyAmount.toFixed(2)} in
    ${suggestion.bucket} (${suggestion.bucketReason})`)
  console.log(`Options: ${suggestion.recommendedTickers.map(t =>
    `${t.ticker} (${(t.weight*100).toFixed(0)}%)`).join(', ')}`)
}
```

### AI Chat: "Am I overexposed to US equities?"

```typescript
const summary = await fetch('/api/portfolio/summary').then(r => r.json())

// Assume user has profile with target allocation
const targetAllocation = getRecommendedAllocation(userProfile)

const usEquityGap = summary.allocation.us_equity.pct - targetAllocation.us_equity
const isOverexposed = usEquityGap > 0.05 // more than 5% over

// AI narrates:
if (isOverexposed) {
  `Yes, you're overexposed to US equities. You have
   ${formatPct(summary.allocation.us_equity.pct)} but your target is
   ${formatPct(targetAllocation.us_equity)}. That's
   ${formatPct(Math.abs(usEquityGap))} above target.`
} else {
  `No, your US equity allocation (${formatPct(summary.allocation.us_equity.pct)})
   is within ${formatPct(Math.abs(usEquityGap))} of your
   ${formatPct(targetAllocation.us_equity)} target.`
}
```

### AI Chat: "What should I invest my idle cash into?"

```typescript
const plan = await fetch('/api/rebalance', {
  method: 'POST',
  body: JSON.stringify({
    mode: 'invest_cash_balance'
  })
}).then(r => r.json())

if (plan.investAmount === 0) {
  // AI: "You don't have any idle cash to invest right now."
} else {
  // AI narrates plan.planSummary and suggestions
}
```

## Maintenance Notes

### Adding New Asset Classes

1. Update `AssetClassBucket` type in [src/lib/classification.ts](src/lib/classification.ts:7)
2. Update `assetClassBucket()` function
3. Update `DEFAULT_TICKERS` and `LOW_FEE_ALTERNATIVES` in [src/lib/rebalancer.ts](src/lib/rebalancer.ts)
4. Update `AssetAllocation` type in [src/lib/allocation-recommendations.ts](src/lib/allocation-recommendations.ts)
5. Update all bucket arrays in functions
6. Update test scripts

### Changing Classification Logic

**IMPORTANT:** Only modify [src/lib/classification.ts](src/lib/classification.ts).

All consumers automatically get the update:
- Dashboard ([src/app/dashboard/page.tsx](src/app/dashboard/page.tsx))
- Portfolio summary ([src/lib/portfolio-summary.ts](src/lib/portfolio-summary.ts))
- Rebalancer ([src/lib/rebalancer.ts](src/lib/rebalancer.ts))

### Changing Allocation Recommendations

Only modify [src/lib/allocation-recommendations.ts](src/lib/allocation-recommendations.ts).

Rebalancer and dashboard call `getRecommendedAllocation()` directly.

## File Reference

| File | Purpose | Lines |
|------|---------|-------|
| [src/lib/classification.ts](src/lib/classification.ts) | Shared classification logic | ~200 |
| [src/lib/portfolio-summary.ts](src/lib/portfolio-summary.ts) | Truth layer for portfolio state | ~350 |
| [src/lib/rebalancer.ts](src/lib/rebalancer.ts) | Rebalancer engine (both modes) | ~570 |
| [src/app/api/portfolio/summary/route.ts](src/app/api/portfolio/summary/route.ts) | Portfolio summary endpoint | ~30 |
| [src/app/api/rebalance/route.ts](src/app/api/rebalance/route.ts) | Rebalance endpoint | ~85 |
| [scripts/test-portfolio-summary.ts](scripts/test-portfolio-summary.ts) | Portfolio summary test | ~130 |
| [scripts/test-rebalancer.ts](scripts/test-rebalancer.ts) | Rebalancer test (both modes) | ~270 |

## Questions the System Can Answer

### Portfolio State
- ✅ "Show me my portfolio"
- ✅ "What's my current allocation?"
- ✅ "Am I overexposed to US equities?"
- ✅ "How much cash do I have?"
- ✅ "What are my top holdings?"
- ✅ "How many holdings need classification review?"

### Rebalancing
- ✅ "What should I buy this month?" (with contribution amount)
- ✅ "What should I invest my idle cash into?"
- ✅ "Why are you recommending BND?"
- ✅ "What's the gap between my current and target allocation?"
- ✅ "What would happen if I contributed $2000?"

### Tickers
- ✅ "What tickers should I buy for bonds?"
- ✅ "Show me alternatives to VTI"
- ✅ "Why VTI instead of VOO?"

### Classification
- ✅ "How is SPY classified?"
- ✅ "What holdings are classified by override?"
- ✅ "What holdings need review?"

All answers are **deterministic, explainable, and verifiable**.
