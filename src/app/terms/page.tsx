import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-4 text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="prose prose-neutral mt-8 dark:prose-invert">
        <p>
          By using Portfolio Flow, you agree to these terms of service.
        </p>

        <h2>Service Description</h2>
        <p>
          Portfolio Flow provides portfolio tracking, analysis, and AI-powered recommendations.
          The service is for informational purposes only and does not constitute financial advice.
        </p>

        <h2>User Responsibilities</h2>
        <p>
          You are responsible for maintaining the security of your account credentials.
          You agree not to use the service for any unlawful purpose.
        </p>

        <h2>Disclaimer</h2>
        <p>
          The information provided by Portfolio Flow is for general informational purposes only.
          We do not guarantee the accuracy, completeness, or usefulness of any information.
          Investment decisions should be made based on your own research and consultation with financial advisors.
        </p>

        <h2>Subscription and Billing</h2>
        <p>
          Subscriptions are billed monthly through Stripe.
          You can cancel your subscription at any time through the billing portal.
          Refunds are handled on a case-by-case basis.
        </p>

        <h2>Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time.
          Continued use of the service constitutes acceptance of updated terms.
        </p>
      </div>

      <div className="mt-8">
        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  )
}
