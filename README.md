# Portfolio Flow

A Next.js application for tracking and managing your investment portfolio with AI-powered assistance grounded in your actual portfolio data.

## Features

- **Brokerage Integration**: Connect accounts via Plaid to sync holdings
- **Portfolio Analysis**: Track allocation, performance, and diversification
- **AI Chat Assistant**: Get personalized advice grounded in your real data (not hallucinated numbers)
- **Rebalancing Recommendations**: Receive actionable suggestions for monthly contributions
- **Asset Classification**: Automatic and manual classification with override support
- **Subscription Billing**: Stripe-powered subscription management with billing portal

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use Supabase)
- Plaid API credentials
- OpenAI API key
- Clerk account for authentication
- Stripe account for payments

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Plaid
PLAID_CLIENT_ID="your_plaid_client_id"
PLAID_SECRET="your_plaid_secret"
PLAID_ENV="sandbox"  # or "development" or "production"

# OpenAI (required for Portfolio Flow chat)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"  # optional, defaults to gpt-4o-mini

# Stripe (for subscription billing)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PRICE_ID="price_..."  # Your subscription price ID
STRIPE_WEBHOOK_SECRET="whsec_..."  # Webhook signing secret

# App URL (required for Stripe redirects)
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Use your production URL in production
```

### Installation

1. Install dependencies:

```bash
npm install
```

2. Run database migrations:

```bash
npx prisma migrate dev
```

3. Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Portfolio Flow Chat

Portfolio Flow is an AI assistant embedded in the dashboard that answers questions about your portfolio using **only your actual data** - no hallucinated numbers.

### How It Works

The chat assistant is grounded in two deterministic truth layers:

1. **Portfolio Summary** (`src/lib/portfolio-summary.ts`): Current holdings, allocation, and performance
2. **Rebalance Plan** (`src/lib/rebalancer.ts`): Monthly contribution suggestions based on target allocation

The assistant **never invents financial numbers**. All responses cite specific data from these engine outputs.

### Setting Up Default Monthly Contribution

1. Navigate to the dashboard
2. In the Portfolio Flow chat widget, enter your default monthly contribution amount
3. Click "Save" to store this preference
4. The assistant will use this default when you ask rebalancing questions without specifying an amount

### Sample Questions

Try asking Portfolio Flow:

- **"What should I buy with $500 this month to get closer to target?"**
  The assistant will compute a rebalance plan and suggest specific purchases by asset class.

- **"Why is my cash allocation so high?"**
  The assistant will analyze your current allocation breakdown and explain the cash position.

- **"What are my biggest positions?"**
  The assistant will list your top holdings with actual values from your portfolio.

- **"Am I diversified enough?"**
  The assistant will compare your current allocation to recommended targets based on your profile.

- **"How much should I invest monthly?"**
  The assistant can provide general guidance, but specific advice depends on your personal situation.

### How Rebalancing Works

When you ask a rebalancing question, the system:

1. **Extracts contribution amount** from your message (e.g., "$500", "500 dollars")
2. **Falls back to saved default** if no amount is specified in the message
3. **Asks for amount** if neither is available
4. **Computes rebalance plan** using your target allocation and current holdings
5. **Provides specific buy recommendations** by asset class and ticker

### Facts Used

Each assistant response includes a collapsible "Facts used" section showing:

- Portfolio snapshot date
- Total portfolio value
- Current allocation percentages
- Top 3 holdings
- Target allocation (if available)
- Rebalance suggestions with specific buy amounts and tickers

This transparency ensures you can verify the assistant is using real data from your account.

### Troubleshooting

**"OPENAI_API_KEY is not configured"**
Add your OpenAI API key to `.env.local` and restart the dev server.

**Assistant asks for contribution amount repeatedly**
Set a default monthly contribution in the chat widget, or include a dollar amount in your question.

**Numbers seem wrong**
Check the "Facts used" section to see exactly what data the assistant is referencing. If the underlying data is stale, refresh your brokerage connection.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)

2. Create a product and price in the Stripe Dashboard:
   - Go to Products > Add product
   - Name: "Portfolio Flow Pro"
   - Price: $9/month (or your desired price)
   - Copy the Price ID (starts with `price_`)

3. Get your API keys from the Developers section:
   - Copy the Secret key (starts with `sk_test_` or `sk_live_`)

4. Set up webhooks:
   - Go to Developers > Webhooks
   - Add endpoint: `https://your-domain.com/api/stripe/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy the Signing secret (starts with `whsec_`)

5. Configure the Customer Portal:
   - Go to Settings > Billing > Customer portal
   - Enable the portal and configure allowed actions

### Testing Webhooks Locally

Use the Stripe CLI to forward webhooks to your local server:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook signing secret from the CLI output
```

## Deploy on Vercel

1. Push your code to GitHub

2. Import your project on [Vercel](https://vercel.com/new)

3. Add all environment variables in the Vercel dashboard:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `DIRECT_DATABASE_URL` - Direct connection for migrations
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
   - `CLERK_SECRET_KEY` - Clerk secret key
   - `PLAID_CLIENT_ID` - Plaid client ID
   - `PLAID_SECRET` - Plaid secret (use production secret)
   - `PLAID_ENV` - Set to `production` for live
   - `OPENAI_API_KEY` - OpenAI API key
   - `STRIPE_SECRET_KEY` - Stripe secret key (use live key)
   - `STRIPE_PRICE_ID` - Your Stripe price ID
   - `STRIPE_WEBHOOK_SECRET` - Webhook signing secret for production endpoint
   - `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., `https://your-app.vercel.app`)

4. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```

5. Update Stripe webhook endpoint to your production URL

6. Update Clerk allowed origins and redirect URLs

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
