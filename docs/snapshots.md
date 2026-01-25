# Daily Snapshots System

This document describes the daily snapshot system for portfolio tracking.

## Overview

The Daily Snapshot system captures a user's portfolio state once per day, including:
- **Total portfolio value** (in cents)
- **Daily change** from the previous snapshot
- **Asset allocation** breakdown (US Equity, Int'l Equity, Bonds, Cash, Other)
- **Holdings count**

Snapshots are stored in the `UserDailySnapshot` table with a unique constraint on `(userId, date)`.

## How Snapshots Are Written

Snapshots are created via the `runPortfolioSyncForUser()` function in `src/server/portfolio/sync.ts`.

### Trigger Points

1. **Cron Job** (`POST /api/cron/daily-snapshot`)
   - Runs once daily (configure in Vercel Cron or external scheduler)
   - Iterates through all users with Plaid connections
   - Forces sync for each user

2. **Manual Refresh** (`POST /api/refresh-dashboard`)
   - Triggered by the "Refresh holdings" button in the UI
   - Forces sync for the current user

### Sync Process

1. Check rate-limit backoff (skip if blocked)
2. Check sync lock (prevent concurrent syncs)
3. Check freshness (skip Plaid if synced within 15 minutes)
4. Acquire lock
5. Call Plaid API to fetch latest holdings
6. Compute portfolio summary (value + allocation)
7. Upsert `UserDailySnapshot` for today
8. Release lock

## Rate Limiting

### Plaid Rate Limits

If Plaid returns HTTP 429, the system:
- Sets `nextAllowedSyncAt` to now + 60 seconds
- Returns `RATE_LIMITED` error to the caller
- Subsequent sync attempts within the backoff window are blocked

### AI Request Limits

Users are limited to 25 AI chat requests per day (configurable).
- Tracked in `AiUsageDaily` table
- Resets at midnight UTC
- Returns 429 with `resetAt` timestamp when exceeded

## Sync Locking

To prevent concurrent syncs:
- `syncInProgress` flag in `SyncState` table
- `syncLockAt` timestamp for staleness detection
- Locks older than 5 minutes are considered stale and can be overridden
- Lock is always released in `finally` block

## Triggering Cron Locally

### 1. Set CRON_SECRET

Add to your `.env.local`:

```bash
CRON_SECRET=your_secure_random_string
```

Generate a secure secret:

```bash
openssl rand -hex 32
```

### 2. Run the Cron Endpoint

```bash
# Start your dev server
npm run dev

# In another terminal, trigger the cron
curl -X POST http://localhost:3000/api/cron/daily-snapshot \
  -H "Authorization: Bearer your_secure_random_string" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "processed": 3,
  "succeeded": 3,
  "failed": 0,
  "failures": [],
  "startedAt": "2024-01-15T00:00:00.000Z",
  "completedAt": "2024-01-15T00:00:05.123Z",
  "durationMs": 5123
}
```

## Testing Manual Refresh

```bash
# This requires authentication - test via the UI
# or use a tool that can handle Clerk session cookies
```

## Database Models

### UserDailySnapshot

```prisma
model UserDailySnapshot {
  id               String   @id @default(cuid())
  userId           String
  date             DateTime // Start of day UTC
  totalValueCents  BigInt
  dailyChangeCents BigInt?
  allocationJson   Json     // { "us_equity": 0.515, ... }
  holdingsCount    Int
  createdAt        DateTime
  updatedAt        DateTime

  @@unique([userId, date])
}
```

### SyncState

```prisma
model SyncState {
  userId            String   @unique
  lastPlaidSyncAt   DateTime?
  syncInProgress    Boolean  @default(false)
  syncLockAt        DateTime?
  nextAllowedSyncAt DateTime?
  lastSyncStatus    String?  // "success" | "error" | "rate_limited"
  lastSyncError     String?
}
```

### AiUsageDaily

```prisma
model AiUsageDaily {
  userId   String
  date     DateTime // Start of day UTC
  requests Int      @default(0)
  tokens   Int      @default(0)

  @@unique([userId, date])
}
```

## Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-snapshot",
      "schedule": "0 21 * * *"
    }
  ]
}
```

This runs at 9:00 PM UTC (after US market close).

**Note:** Vercel Cron automatically adds the `Authorization: Bearer <CRON_SECRET>` header when `CRON_SECRET` is set as an environment variable.

## Troubleshooting

### Sync Stuck in Progress

If a sync gets stuck:
1. Wait 5 minutes (stale lock auto-release)
2. Or manually clear the lock:
   ```sql
   UPDATE "SyncState"
   SET "syncInProgress" = false, "syncLockAt" = null
   WHERE "userId" = 'your_user_id';
   ```

### Rate Limited Errors

If getting repeated rate limit errors:
1. Check `SyncState.nextAllowedSyncAt` for backoff end time
2. Wait for backoff to expire
3. Or force sync: the cron uses `{ force: true }` which ignores backoff

### Missing Snapshots

If snapshots aren't being created:
1. Verify user has Plaid items connected
2. Check `SyncState.lastSyncStatus` and `lastSyncError`
3. Check server logs for errors
