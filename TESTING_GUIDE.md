# Testing Guide

## Database Connection Issues

If you encounter this error:
```
Error querying the database: FATAL: MaxClientsInSessionMode: max clients reached
```

This happens with pooled database connections (Supabase/Neon) when too many connections are open.

### Solutions:

#### Option 1: Wait for connections to close (easiest)
Wait 2-5 minutes for idle connections to automatically close, then retry.

#### Option 2: Restart database (Supabase)
1. Go to Supabase dashboard
2. Navigate to Database → Settings
3. Click "Restart database" or "Pause database" then resume

#### Option 3: Kill lingering processes
```bash
# Kill any hanging tsx/node processes
ps aux | grep -i "node.*tsx" | grep -v grep | awk '{print $2}' | xargs kill -9
```

#### Option 4: Use direct connection URL (for scripts only)
If you have a `DIRECT_DATABASE_URL` in your `.env` file that bypasses connection pooling:

```bash
# Run scripts with direct connection
DATABASE_URL=$DIRECT_DATABASE_URL npx tsx scripts/test-portfolio-summary.ts <userId>
```

### Prevention:

The test scripts now include `prisma.$disconnect()` in `finally` blocks to ensure connections are properly closed. However, if you interrupt a script (Ctrl+C), connections may not close cleanly.

**Best practice:** Always let scripts complete or wait for them to handle signals gracefully.

## Running Tests

### Portfolio Summary Test

```bash
npx tsx scripts/test-portfolio-summary.ts <userId>
```

**Example:**
```bash
npx tsx scripts/test-portfolio-summary.ts user_38PW6Tk1z6p3XJlyygoBhLFQmHr
```

**Output:**
- Total portfolio value
- Allocation breakdown ($ and %)
- All holdings with classification sources (sorted by value)
- Per-account summaries
- Classification statistics
- Warnings

### Rebalancer Test

```bash
# Test both modes
npx tsx scripts/test-rebalancer.ts <userId> <monthlyContribution>

# Test invest_cash_balance only
npx tsx scripts/test-rebalancer.ts <userId>
```

**Examples:**
```bash
# Test monthly contribution mode with $1000
npx tsx scripts/test-rebalancer.ts user_38PW6Tk1z6p3XJlyygoBhLFQmHr 1000

# Test invest cash balance mode only
npx tsx scripts/test-rebalancer.ts user_38PW6Tk1z6p3XJlyygoBhLFQmHr
```

**Output:**
- Plan summary (deterministic narrative)
- Current / target / projected allocations
- Suggested buys with multi-ticker options
- Gap analysis (% and $)
- Bucket reasons
- Warnings
- Verification (amounts sum correctly)

## TypeScript Validation

```bash
npx tsc --noEmit
```

Should produce no errors.

## API Testing (requires running dev server)

### Start dev server
```bash
npm run dev
```

### Test portfolio summary endpoint
```bash
curl http://localhost:3000/api/portfolio/summary \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### Test rebalance endpoint (monthly contribution)
```bash
curl -X POST http://localhost:3000/api/rebalance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "mode": "monthly_contribution",
    "monthlyContribution": 1000,
    "preferInvestingCash": true,
    "minBuyAmount": 25
  }'
```

### Test rebalance endpoint (invest cash balance)
```bash
curl -X POST http://localhost:3000/api/rebalance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "mode": "invest_cash_balance",
    "maxInvestAmount": 5000,
    "minBuyAmount": 25
  }'
```

## Common Issues

### "No brokerage accounts found"
- User has no connected accounts
- Run Plaid sync first
- Check userId is correct

### "No holdings found"
- Accounts are connected but haven't synced
- Run `/api/plaid/sync` to fetch holdings
- Check Plaid credentials

### TypeScript errors
```bash
# Regenerate Prisma client
npx prisma generate

# Check for errors
npx tsc --noEmit
```

### Script hangs
- Script may be waiting for database connection
- Check `.env` has correct `DATABASE_URL`
- Ctrl+C to interrupt, wait for cleanup
- If still hanging, kill process manually

## Environment Setup

Required environment variables in `.env`:

```env
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."  # Optional, for scripts
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
PLAID_CLIENT_ID="..."
PLAID_SECRET="..."
PLAID_ENV="sandbox"  # or "development" or "production"
```

## Test Data Requirements

For meaningful tests, user should have:
- ✅ At least 1 connected brokerage account
- ✅ Holdings synced from Plaid
- ✅ Profile configured (age range, risk tolerance, time horizon)
- ✅ Some cash balance (for invest_cash_balance mode test)

If tests fail due to missing data, the scripts will show clear error messages.
