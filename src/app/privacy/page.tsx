import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Privacy Policy | Portfolio Flow",
  description: "Privacy Policy for Portfolio Flow - Learn how we collect, use, and protect your personal and financial information.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to home
          </Link>
        </div>

        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">Last updated: January 26, 2025</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed">
          <section>
            <p className="text-muted-foreground">
              Portfolio Flow (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the portfolioflow.ai website and related services (collectively, the &quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. Please read this policy carefully. By accessing or using the Service, you agree to this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>

            <h3 className="font-medium mt-4 mb-2">1.1 Personal Information</h3>
            <p className="text-muted-foreground mb-2">
              When you create an account, we collect:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Email address</li>
              <li>Name (if provided)</li>
              <li>Profile preferences (age range, risk tolerance, investment time horizon)</li>
              <li>Account credentials managed through our authentication provider (Clerk)</li>
            </ul>

            <h3 className="font-medium mt-4 mb-2">1.2 Financial Information</h3>
            <p className="text-muted-foreground mb-2">
              When you connect brokerage or bank accounts through Plaid, we access:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Account names, types, and masked account numbers</li>
              <li>Holdings information (securities, quantities, prices, values)</li>
              <li>Account balances</li>
              <li>Institution names</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              <strong>Important:</strong> We request read-only access only. We cannot execute trades, transfer funds, or make any changes to your accounts. Your brokerage login credentials are never transmitted to or stored on our servers—Plaid handles authentication directly with your financial institution.
            </p>

            <h3 className="font-medium mt-4 mb-2">1.3 Usage Information</h3>
            <p className="text-muted-foreground mb-2">
              We automatically collect:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and approximate location</li>
              <li>Pages visited and features used</li>
              <li>Date and time of access</li>
              <li>Referring URLs</li>
            </ul>

            <h3 className="font-medium mt-4 mb-2">1.4 AI Chat Data</h3>
            <p className="text-muted-foreground">
              When you use the AI chat feature, we process your questions along with your portfolio data to generate responses. Chat history may be retained to improve the Service and provide context for follow-up questions within a session.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-2">We use collected information to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Provide, maintain, and improve the Service</li>
              <li>Display your aggregated portfolio holdings and allocation</li>
              <li>Calculate and display daily portfolio value changes</li>
              <li>Generate AI-powered insights based on your actual holdings</li>
              <li>Provide personalized allocation recommendations based on your profile</li>
              <li>Process subscription payments and manage your account</li>
              <li>Send transactional emails (account verification, payment receipts, important updates)</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Detect, prevent, and address technical issues or fraudulent activity</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Share Your Information</h2>
            <p className="text-muted-foreground mb-3">
              <strong>We do not sell, rent, or trade your personal information to third parties.</strong> We share information only in the following circumstances:
            </p>

            <h3 className="font-medium mt-4 mb-2">3.1 Service Providers</h3>
            <p className="text-muted-foreground mb-2">We use trusted third-party services to operate the Service:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li><strong>Plaid Inc.</strong> — For secure connection to your financial accounts. Plaid&apos;s use of your data is governed by their privacy policy at plaid.com/legal.</li>
              <li><strong>Stripe Inc.</strong> — For payment processing. Stripe&apos;s privacy policy is at stripe.com/privacy.</li>
              <li><strong>Clerk Inc.</strong> — For user authentication. Clerk&apos;s privacy policy is at clerk.com/privacy.</li>
              <li><strong>Vercel Inc.</strong> — For hosting and infrastructure.</li>
              <li><strong>OpenAI / Anthropic</strong> — For AI-powered chat features. Your portfolio data may be sent to AI providers to generate responses. These providers process data according to their respective privacy policies and data processing agreements.</li>
            </ul>

            <h3 className="font-medium mt-4 mb-2">3.2 Legal Requirements</h3>
            <p className="text-muted-foreground">
              We may disclose your information if required by law, regulation, legal process, or governmental request, or when we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
            </p>

            <h3 className="font-medium mt-4 mb-2">3.3 Business Transfers</h3>
            <p className="text-muted-foreground">
              If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change and any choices you may have.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
            <p className="text-muted-foreground mb-2">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>All data is transmitted over HTTPS/TLS encryption</li>
              <li>Data at rest is encrypted using AES-256 encryption</li>
              <li>We use secure, SOC 2 compliant infrastructure providers</li>
              <li>Access to user data is restricted to authorized personnel only</li>
              <li>We do not store your brokerage login credentials—authentication is handled directly by Plaid</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              However, no method of transmission or storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your personal and financial information for as long as your account is active or as needed to provide the Service. Historical portfolio snapshots are retained to enable performance tracking. If you delete your account, we will delete or anonymize your information within 30 days, except where retention is required for legal, accounting, or legitimate business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights and Choices</h2>
            <p className="text-muted-foreground mb-2">You have the following rights regarding your data:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li><strong>Access:</strong> You can view your data through the dashboard at any time.</li>
              <li><strong>Correction:</strong> You can update your profile information through your account settings.</li>
              <li><strong>Deletion:</strong> You can delete individual connected accounts or your entire account from the Settings page. This removes your data from our systems.</li>
              <li><strong>Disconnect:</strong> You can disconnect linked financial accounts at any time, which stops data syncing from those accounts.</li>
              <li><strong>Export:</strong> You can request a copy of your data by contacting us.</li>
              <li><strong>Revoke Plaid Access:</strong> You can revoke Plaid&apos;s access to your financial accounts through Plaid&apos;s portal at my.plaid.com.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              We use essential cookies to maintain your session and authentication state. We may use analytics tools to understand how the Service is used. You can control cookies through your browser settings, though disabling essential cookies may prevent the Service from functioning properly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground">
              The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child under 18, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. International Data Transfers</h2>
            <p className="text-muted-foreground">
              Your information may be transferred to and processed in countries other than your country of residence, including the United States. These countries may have different data protection laws. By using the Service, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. California Privacy Rights</h2>
            <p className="text-muted-foreground">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, request deletion, and opt out of sales (though we do not sell personal information). To exercise these rights, contact us using the information below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the &quot;Last updated&quot; date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="mt-2">
              <a href="mailto:neejbiz@gmail.com" className="text-foreground hover:underline">
                neejbiz@gmail.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t">
          <Button variant="outline" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
