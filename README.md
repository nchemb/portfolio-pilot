# Portfolio Copilot

A Next.js application for tracking and managing your investment portfolio with AI-powered assistance grounded in your actual portfolio data.

## Features

- **Brokerage Integration**: Connect accounts via Plaid to sync holdings
- **Portfolio Analysis**: Track allocation, performance, and diversification
- **AI Chat Assistant**: Get personalized advice grounded in your real data (not hallucinated numbers)
- **Rebalancing Recommendations**: Receive actionable suggestions for monthly contributions
- **Asset Classification**: Automatic and manual classification with override support

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use Supabase)
- Plaid API credentials
- OpenAI API key
- Clerk account for authentication

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

# OpenAI (required for Portfolio Copilot chat)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"  # optional, defaults to gpt-4o-mini
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

## Portfolio Copilot Chat

The Portfolio Copilot is an AI assistant embedded in the dashboard that answers questions about your portfolio using **only your actual data** - no hallucinated numbers.

### How It Works

The chat assistant is grounded in two deterministic truth layers:

1. **Portfolio Summary** (`src/lib/portfolio-summary.ts`): Current holdings, allocation, and performance
2. **Rebalance Plan** (`src/lib/rebalancer.ts`): Monthly contribution suggestions based on target allocation

The assistant **never invents financial numbers**. All responses cite specific data from these engine outputs.

### Setting Up Default Monthly Contribution

1. Navigate to the dashboard
2. In the Portfolio Copilot chat widget, enter your default monthly contribution amount
3. Click "Save" to store this preference
4. The assistant will use this default when you ask rebalancing questions without specifying an amount

### Sample Questions

Try asking the Portfolio Copilot:

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
