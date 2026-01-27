# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into your Portfolio Flow Next.js application. This integration includes:

- **Client-side initialization** via `instrumentation-client.ts` (Next.js 15.3+ approach)
- **Server-side tracking** via `posthog-node` for API routes and server actions
- **User identification** synced with Clerk authentication
- **Reverse proxy** configured in `next.config.ts` for reliable event delivery
- **Exception capture** enabled for automatic error tracking

## Events Implemented

| Event Name | Description | File Path |
|------------|-------------|-----------|
| `subscription_checkout_started` | User clicked the subscribe button to start checkout | `src/app/paywall/paywall-content.tsx` |
| `subscription_checkout_completed` | Stripe webhook: user successfully subscribed | `src/app/api/stripe/webhook/route.ts` |
| `subscription_canceled` | User canceled their subscription (at period end) | `src/components/billing-section.tsx` |
| `subscription_deleted` | Stripe webhook: subscription fully canceled | `src/app/api/stripe/webhook/route.ts` |
| `payment_failed` | Stripe webhook: user's payment failed | `src/app/api/stripe/webhook/route.ts` |
| `brokerage_connected` | User successfully connected a brokerage via Plaid | `src/components/plaid-link-button.tsx` |
| `brokerage_connection_failed` | Plaid brokerage connection failed | `src/components/plaid-link-button.tsx` |
| `brokerage_deleted` | User deleted a brokerage account | `src/components/delete-brokerage-button.tsx` |
| `cash_account_connected` | User connected a cash account via Plaid | `src/components/plaid-link-cash-button.tsx` |
| `profile_settings_updated` | User updated profile settings (age, risk, horizon) | `src/app/dashboard/page.tsx` |
| `portfolio_chat_message_sent` | User sent a message to Portfolio Flow AI | `src/components/portfolio-copilot-chat.tsx` |
| `monthly_contribution_saved` | User saved their monthly contribution amount | `src/components/portfolio-copilot-chat.tsx` |
| `portfolio_refreshed` | User clicked to refresh portfolio holdings | `src/components/overview-refresh-button.tsx` |
| `rebalance_plan_generated` | Server: User requested a rebalance plan | `src/app/api/rebalance/route.ts` |

## Files Created/Modified

### New Files
- `instrumentation-client.ts` - PostHog client-side initialization
- `src/lib/posthog-server.ts` - Server-side PostHog client
- `src/components/posthog-identity.tsx` - Clerk user identification component

### Modified Files
- `.env.local` - Added PostHog environment variables
- `next.config.ts` - Added reverse proxy rewrites
- `src/app/layout.tsx` - Added PostHogIdentify component
- `src/app/paywall/paywall-content.tsx` - Checkout tracking
- `src/app/api/stripe/webhook/route.ts` - Subscription events
- `src/app/api/rebalance/route.ts` - Rebalance tracking
- `src/app/dashboard/page.tsx` - Profile update tracking
- `src/components/plaid-link-button.tsx` - Brokerage connection events
- `src/components/plaid-link-cash-button.tsx` - Cash account events
- `src/components/delete-brokerage-button.tsx` - Deletion tracking
- `src/components/billing-section.tsx` - Cancellation tracking
- `src/components/portfolio-copilot-chat.tsx` - Chat engagement tracking
- `src/components/overview-refresh-button.tsx` - Refresh tracking

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

### Dashboard
- [Analytics basics](https://us.posthog.com/project/299677/dashboard/1142750) - Core analytics dashboard

### Insights
- [Subscription Conversion Funnel](https://us.posthog.com/project/299677/insights/RAMQ3vdz) - Tracks checkout start to completion
- [Brokerage Connection Rate](https://us.posthog.com/project/299677/insights/RObAEYfb) - Successful vs failed connections
- [Subscription Churn Events](https://us.posthog.com/project/299677/insights/DsCA2bRU) - Cancellations, deletions, payment failures
- [User Engagement - Chat & Refresh](https://us.posthog.com/project/299677/insights/IyMIOrVI) - AI chat and portfolio refresh usage
- [Account Management Events](https://us.posthog.com/project/299677/insights/ZsIQTNqB) - Brokerage deletions and profile updates

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
