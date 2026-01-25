import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-4 text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="prose prose-neutral mt-8 dark:prose-invert">
        <p>
          This privacy policy describes how Portfolio Copilot collects, uses, and protects your personal information.
        </p>

        <h2>Information We Collect</h2>
        <p>
          We collect information you provide directly, including your email address and account credentials when you sign up.
          When you connect your brokerage accounts via Plaid, we access your holdings and account balances to provide portfolio analysis.
        </p>

        <h2>How We Use Your Information</h2>
        <p>
          We use your information to provide and improve our services, including portfolio tracking, analysis, and personalized recommendations.
          We do not sell your personal information to third parties.
        </p>

        <h2>Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your data.
          Your brokerage credentials are never stored on our servers - we use Plaid&apos;s secure connection to access your account data.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about this privacy policy, please contact us.
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
