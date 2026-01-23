# Monthly Contribution Rebalancer Engine

Production-grade deterministic engine for allocating monthly contributions to maintain target portfolio allocation.

**NO LLMs. NO UI polish. Just logic.**

## Overview

Given:
- A user's current holdings and effective asset-class allocation
- Their recommended target allocation (based on age, risk tolerance, time horizon)
- A monthly contribution amount (cash added, no selling)

Returns:
- **A deterministic plan answering: "What should I buy this month to stay balanced?"**

## Architecture

### Core Files

| File | Purpose |
|------|---------|
| [src/lib/rebalancer.ts](src/lib/rebalancer.ts) | Core engine logic and types |
| [src/app/api/rebalance/route.ts](src/app/api/rebalance/route.ts) | POST API endpoint |
| [scripts/test-rebalancer.ts](scripts/test-rebalancer.ts) | Smoke test script |

### Asset Class Buckets

Exactly 5 buckets (no more, no less):
- `us_equity` - US stocks/ETFs
- `intl_equity` - International stocks/ETFs
- `bonds` - Fixed income
- `cash` - Cash equivalents
- `other` - Alternative assets / unclassified

## Engine Logic

### 1. Current Portfolio State

- Fetches all holdings across all brokerage accounts for the user
- Uses the **same** effective classification logic as the dashboard:
  1. UserSecurityOverride (manual user overrides)
  2. FundProfile (pre-seeded fund classifications)
  3. SecurityType (cash/bond inference)
  4. Holding field values (from Plaid)
  5. Fallback to "other"
- Computes market value per holding (prefers `price * quantity`, handles cash correctly)
- Aggregates total portfolio value and current dollar/percentage per bucket

### 2. Target Allocation

- Reuses existing `getRecommendedAllocation()` logic
- Based on user profile (age range, risk tolerance, time horizon)
- Deterministic adjustments applied in sequence
- Normalized to ensure percentages sum to 1.0

### 3. Monthly Contribution Allocation

**Core algorithm:**

1. **Compute target dollars after contribution:**
   ```
   targetDollar[bucket] = targetPct[bucket] * (currentTotal + monthlyContribution)
   ```

2. **Compute dollars needed per bucket:**
   ```
   needed[bucket] = max(0, targetDollar[bucket] - currentDollar[bucket])
   ```

3. **Allocate contribution proportionally to need:**
   - If total needed = 0: allocate proportionally to target percentages
   - Otherwise: allocate proportionally to `needed[bucket]`

4. **Round to cents and handle rounding errors:**
   - Round each allocation to 2 decimal places
   - Adjust largest allocation to match exact total (within 1 cent)

5. **Apply minimum buy threshold (default $25):**
   - If bucket allocation < threshold, roll into next most underweight bucket
   - Prevents tiny purchases that incur disproportionate fees

**Rules:**
- Never sell existing holdings
- Optional `preferInvestingCash` (default: `true`)
  - If true, do not allocate new money to cash unless all other buckets are satisfied
- Ensures total allocated equals `monthlyContribution` (within 1 cent)

### 4. Ticker Recommendations

For each bucket receiving dollars:

**If user already holds ETFs in that bucket:**
- Choose the ETF with the largest current market value
- Reason: `"existing_holding"`

**Otherwise, use defaults:**
- `us_equity` → VTI
- `intl_equity` → VXUS
- `bonds` → BND
- `cash` → CASH (no ticker)
- `other` → VTI (with note suggesting reclassification)

**Future extension:**
- Output structure supports multiple tickers per bucket (via `weight` field)
- Currently always returns one ticker with `weight: 1.0`

## API Usage

### Endpoint

`POST /api/rebalance`

### Authentication

Requires Clerk authentication. Returns `401 Unauthorized` if not authenticated.

### Request Body

```json
{
  "monthlyContribution": 1000,
  "preferInvestingCash": true,
  "minBuyAmount": 25
}
```

**Parameters:**
- `monthlyContribution` (required): Dollar amount to allocate (must be > 0)
- `preferInvestingCash` (optional, default: `true`): Skip cash allocation unless other buckets satisfied
- `minBuyAmount` (optional, default: `25`): Minimum dollar threshold for a buy recommendation

### Response

```json
{
  "timestamp": "2026-01-22T12:00:00.000Z",
  "monthlyContribution": 1000,
  "currentTotalValue": 50000,
  "projectedTotalValue": 51000,
  "currentAllocation": {
    "us_equity": 0.60,
    "intl_equity": 0.15,
    "bonds": 0.20,
    "cash": 0.05,
    "other": 0.00
  },
  "targetAllocation": {
    "us_equity": 0.50,
    "intl_equity": 0.15,
    "bonds": 0.25,
    "cash": 0.10,
    "other": 0.00
  },
  "projectedAllocation": {
    "us_equity": 0.588,
    "intl_equity": 0.147,
    "bonds": 0.216,
    "cash": 0.049,
    "other": 0.00
  },
  "suggestions": [
    {
      "bucket": "bonds",
      "currentPct": 0.20,
      "targetPct": 0.25,
      "gapToTargetPct": 0.05,
      "recommendedBuyAmount": 625.00,
      "recommendedTickers": [
        {
          "ticker": "BND",
          "reason": "existing_holding",
          "weight": 1.0
        }
      ]
    },
    {
      "bucket": "cash",
      "currentPct": 0.05,
      "targetPct": 0.10,
      "gapToTargetPct": 0.05,
      "recommendedBuyAmount": 375.00,
      "recommendedTickers": [
        {
          "ticker": "CASH",
          "reason": "default",
          "weight": 1.0
        }
      ]
    }
  ],
  "notes": []
}
```

### Error Responses

- `401 Unauthorized` - Missing or invalid authentication
- `400 Bad Request` - Invalid or missing `monthlyContribution`
- `500 Internal Server Error` - Engine error (e.g., no accounts, database issues)

## Testing

### Smoke Test Script

```bash
npx tsx scripts/test-rebalancer.ts <userId> <monthlyContribution>
```

**Example:**
```bash
npx tsx scripts/test-rebalancer.ts user_2abc123xyz 1000
```

**Output includes:**
- Current allocation (percentages and total value)
- Target allocation (percentages)
- Suggested buys (bucket, gap, amount, tickers)
- Projected allocation (after contribution)
- Verification (ensures buy amounts sum to contribution)
- Notes (warnings, recommendations)

### Manual API Test

```bash
curl -X POST http://localhost:3000/api/rebalance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "monthlyContribution": 1000,
    "preferInvestingCash": true,
    "minBuyAmount": 25
  }'
```

## Design Principles

### 1. Determinism > Cleverness

- Same inputs → same outputs, every time
- No randomness, no LLM calls, no external API dependencies
- Purely mathematical allocation based on need and target

### 2. Explainability

- Every allocation decision is traceable
- Output includes gap-to-target percentages
- Notes explain edge cases (e.g., "other" bucket recommendations)

### 3. Stability

- Reuses existing classification logic (no duplication)
- Handles Prisma Decimal → number conversions correctly
- Validates inputs and provides clear error messages

### 4. Production-Ready

- TypeScript types for all inputs/outputs
- Error handling at API and engine levels
- Rounding handled correctly (no floating-point drift)
- Designed to be called by AI chat layer later

## Edge Cases Handled

### 1. No Holdings Yet

- If user has no holdings, allocates contribution purely based on target percentages
- Adds note: "No holdings found. All contribution will be allocated based on target allocation."

### 2. All Buckets At Target

- If all buckets are at or above target, allocates proportionally to target percentages
- Ensures money is still invested rather than sitting idle

### 3. Cash Preference

- By default (`preferInvestingCash: true`), skips cash allocation if other buckets need funding
- Prevents parking new contributions in cash when equities/bonds are underweight

### 4. Minimum Buy Threshold

- Prevents recommending $5 purchases that would incur fees
- Rolls small allocations into next most underweight bucket
- Default: $25 (configurable via `minBuyAmount`)

### 5. Rounding Pennies

- Rounds all dollar amounts to cents
- Adjusts largest allocation to ensure total equals contribution exactly
- Verification step in smoke test confirms correctness

### 6. "Other" Bucket

- If forced to buy into "other" bucket, recommends VTI as fallback
- Adds note suggesting user reclassify holdings for more precise allocation

## Future Extensions

### Multi-Ticker Support

Output structure already supports multiple tickers per bucket:

```typescript
{
  "recommendedTickers": [
    { "ticker": "VTI", "reason": "existing_holding", "weight": 0.7 },
    { "ticker": "SCHB", "reason": "existing_holding", "weight": 0.3 }
  ]
}
```

### Tax-Loss Harvesting

Could add logic to avoid buying tickers that were recently sold at a loss (wash sale rule).

### Dividend Reinvestment

Could integrate with dividend data to factor in expected dividend income.

### Multi-Month Planning

Could extend to suggest a 3-6 month contribution plan.

## Integration with AI Chat Layer

This engine is designed to be **called by an AI assistant** that:
1. Asks user for monthly contribution amount
2. Calls `POST /api/rebalance` with user input
3. Presents suggestions in natural language
4. Optionally helps user execute trades via brokerage API

The AI layer can add:
- Natural language explanation of suggestions
- Interactive Q&A about recommendations
- Links to research about recommended ETFs
- Comparison of allocation strategies

**But the core math stays here, deterministic and testable.**

## Maintenance Notes

### If Adding New Asset Classes

1. Update `AssetClassBucket` type in [src/lib/rebalancer.ts](src/lib/rebalancer.ts:14)
2. Update `DEFAULT_TICKERS` map
3. Update bucket arrays in allocation functions
4. Update `AssetAllocation` type in [src/lib/allocation-recommendations.ts](src/lib/allocation-recommendations.ts:10)
5. Update `assetClassBucket()` function

### If Changing Classification Logic

Update `getEffectiveClassification()` in **both**:
- [src/lib/rebalancer.ts](src/lib/rebalancer.ts) (rebalancer engine copy)
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) (dashboard display copy)

Consider extracting to shared utility in the future.

### If Changing Allocation Recommendation Logic

Only update [src/lib/allocation-recommendations.ts](src/lib/allocation-recommendations.ts).

The rebalancer calls `getRecommendedAllocation()` directly, so changes propagate automatically.

## Questions?

This engine is designed to be self-contained and explainable. Read the code in [src/lib/rebalancer.ts](src/lib/rebalancer.ts) for full implementation details.

For issues or feature requests, consult the codebase or ask the maintainer.
