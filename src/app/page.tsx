import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const MONTHLY_PRICE = 9

export default async function Home() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Finally see your full allocation.
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Connect your brokerage accounts and see your combined holdings, allocation breakdown, and daily changes in one simple dashboard. Ask questions with an AI that only uses your real data.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button size="lg" asChild>
                <Link href="/signup">Start free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#pricing">See demo</Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Read-only &middot; We never move money &middot; Delete your data anytime
            </p>
          </div>

          {/* Right: Dashboard Screenshot Placeholder */}
          <div className="relative">
            <div className="relative rounded-xl border bg-card shadow-2xl overflow-hidden">
              {/* Mock Dashboard UI */}
              <div className="border-b bg-muted/30 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-block bg-muted rounded px-3 py-1 text-xs text-muted-foreground">
                    app.portfoliocopilot.com/dashboard
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-background p-4">
                    <div className="text-xs text-muted-foreground">Total Value</div>
                    <div className="text-lg font-semibold mt-1">$127,432</div>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <div className="text-xs text-muted-foreground">Daily Change</div>
                    <div className="text-lg font-semibold text-primary mt-1">+$1,247</div>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <div className="text-xs text-muted-foreground">Accounts</div>
                    <div className="text-lg font-semibold mt-1">4</div>
                  </div>
                </div>
                {/* Allocation Skeleton */}
                <div className="rounded-lg border bg-background p-4 space-y-3">
                  <div className="text-sm font-medium">Allocation</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">US Equity</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full w-3/5 bg-foreground rounded-full" />
                        </div>
                        <span className="text-xs font-medium">60%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Int&apos;l Equity</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full w-1/5 bg-foreground/70 rounded-full" />
                        </div>
                        <span className="text-xs font-medium">20%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Bonds</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full w-[15%] bg-foreground/50 rounded-full" />
                        </div>
                        <span className="text-xs font-medium">15%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Cash</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full w-[5%] bg-foreground/30 rounded-full" />
                        </div>
                        <span className="text-xs font-medium">5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border">
                <EyeIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Read-only access</div>
                <div className="text-xs text-muted-foreground">No trading permissions</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border">
                <ShieldIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Encrypted connections</div>
                <div className="text-xs text-muted-foreground">Data transmitted securely</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border">
                <PlaidIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Powered by Plaid</div>
                <div className="text-xs text-muted-foreground">Secure account linking</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border">
                <TrashIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">You own your data</div>
                <div className="text-xs text-muted-foreground">Delete anytime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              One dashboard. All your accounts.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Stop switching between brokerage apps or updating spreadsheets.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-2 hover:border-foreground/20 transition-colors">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground mb-4">
                  <PieChartIcon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Combined allocation view</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  See your total allocation across all linked accounts. We classify holdings into US equity, international, bonds, and cash automatically.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-foreground/20 transition-colors">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground mb-4">
                  <CalendarIcon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">Daily snapshots</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Track your portfolio value day over day. See how much you&apos;re up or down without logging into each brokerage.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-foreground/20 transition-colors">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground mb-4">
                  <SparklesIcon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">AI chat for your portfolio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Ask questions about your holdings. The AI sees your actual data, so answers are specific to your portfolio—not generic advice.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Who it's for / Not for you */}
      <section className="border-t bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-semibold mb-6">Built for DIY investors who want clarity</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <CheckIcon />
                  <span>You have accounts at multiple brokerages and want one view</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon />
                  <span>You want to see your actual allocation without a spreadsheet</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon />
                  <span>You prefer making your own decisions with better information</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-6">Probably not for you if...</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <XIcon />
                  <span>You want automatic trading or rebalancing execution</span>
                </li>
                <li className="flex items-start gap-3">
                  <XIcon />
                  <span>You need expense tracking, budgeting, or bill management</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Connect your accounts and see your allocation in minutes.
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background text-xl font-bold mb-6">
                1
              </div>
              <h3 className="text-lg font-semibold mb-2">Link your brokerages</h3>
              <p className="text-muted-foreground text-sm">
                Connect through Plaid. We request read-only access—no ability to trade or move funds.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background text-xl font-bold mb-6">
                2
              </div>
              <h3 className="text-lg font-semibold mb-2">See your full picture</h3>
              <p className="text-muted-foreground text-sm">
                View combined holdings, allocation percentages, and daily value changes across all accounts.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background text-xl font-bold mb-6">
                3
              </div>
              <h3 className="text-lg font-semibold mb-2">Ask questions</h3>
              <p className="text-muted-foreground text-sm">
                Use the AI assistant to explore your portfolio. It uses your real holdings—no guessing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="border-t bg-muted/30 py-20 sm:py-28 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              One plan. No tiers. No upsells.
            </p>
          </div>

          <div className="mx-auto max-w-md">
            <Card className="border-2 border-foreground/10">
              <CardHeader className="text-center pb-8 pt-8">
                <CardTitle className="text-2xl">Pro</CardTitle>
                <div className="mt-4">
                  <span className="text-5xl font-bold">${MONTHLY_PRICE}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-3">
                    <CheckIcon />
                    Connect unlimited brokerage accounts
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckIcon />
                    Combined allocation breakdown
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckIcon />
                    Daily portfolio snapshots
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckIcon />
                    AI chat grounded in your holdings
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckIcon />
                    Suggested allocation targets
                  </li>
                </ul>
                <Button className="w-full" size="lg" asChild>
                  <Link href="/signup">Start free</Link>
                </Button>
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Cancel anytime. No trading permissions.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Read-only &middot; We never move money &middot; Delete your data anytime
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAQ */}
          <div className="mx-auto max-w-2xl mt-16">
            <h3 className="text-xl font-semibold text-center mb-8">
              Common questions
            </h3>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Is this actually read-only?</AccordionTrigger>
                <AccordionContent>
                  Yes. We connect through Plaid and only request permission to view holdings and balances. We cannot place trades, transfer funds, or make any changes to your accounts.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Which brokerages work?</AccordionTrigger>
                <AccordionContent>
                  Most major brokerages are supported through Plaid, including Fidelity, Schwab, Vanguard, and Robinhood. Some institutions have limited support. If yours doesn&apos;t connect, reach out and we&apos;ll look into it.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Can I delete my data?</AccordionTrigger>
                <AccordionContent>
                  Yes. You can disconnect accounts or delete all your data from the dashboard settings at any time. We remove it from our systems.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Is there a free trial?</AccordionTrigger>
                <AccordionContent>
                  Yes. You can try the full product before being charged. Cancel anytime if it&apos;s not for you.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>Does the AI give financial advice?</AccordionTrigger>
                <AccordionContent>
                  No. The AI helps you understand your own portfolio data—what you hold, your allocation, and how things have changed. It doesn&apos;t recommend specific investments or guarantee returns.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mb-4">
            See your full allocation in one place.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Connect your accounts and get clarity on what you actually own.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">Start free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#pricing">See demo</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            Read-only &middot; We never move money &middot; Delete your data anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Portfolio Copilot. All rights reserved.
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <a href="mailto:support@portfoliocopilot.com" className="text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-4 w-4 text-primary shrink-0 mt-0.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  )
}

function PlaidIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
      />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  )
}

function PieChartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z"
      />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  )
}
