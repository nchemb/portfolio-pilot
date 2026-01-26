import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Terms of Service | Portfolio Flow",
  description: "Terms of Service for Portfolio Flow - Read our terms and conditions for using our portfolio tracking and analysis service.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to home
          </Link>
        </div>

        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-muted-foreground">Last updated: January 26, 2025</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed">
          <section>
            <p className="text-muted-foreground">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Portfolio Flow website, applications, and services (collectively, the &quot;Service&quot;) provided by Portfolio Flow (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Eligibility</h2>
            <p className="text-muted-foreground">
              You must be at least 18 years old and capable of entering into a legally binding agreement to use the Service. By using the Service, you represent and warrant that you meet these requirements. The Service is intended for personal, non-commercial use only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Account Registration</h2>
            <p className="text-muted-foreground mb-2">
              To use certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and update your information to keep it accurate and current</li>
              <li>Maintain the security and confidentiality of your login credentials</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              We reserve the right to suspend or terminate your account if any information provided is inaccurate, false, or violates these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Description of Service</h2>
            <p className="text-muted-foreground mb-2">
              Portfolio Flow provides portfolio tracking, aggregation, and analysis tools that allow you to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Connect brokerage and bank accounts through Plaid to view holdings and balances</li>
              <li>View aggregated portfolio allocation across multiple accounts</li>
              <li>Track daily portfolio value changes</li>
              <li>Interact with an AI assistant for portfolio-related questions</li>
              <li>Receive suggested allocation targets based on your profile</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              <strong>The Service is read-only.</strong> We do not have the ability to execute trades, transfer funds, or make any changes to your financial accounts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. NOT FINANCIAL ADVICE</h2>
            <div className="bg-muted/50 border rounded-lg p-4">
              <p className="text-muted-foreground font-medium mb-2">
                IMPORTANT: THE SERVICE IS FOR INFORMATIONAL AND EDUCATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE FINANCIAL, INVESTMENT, TAX, OR LEGAL ADVICE.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>We are not a registered investment adviser, broker-dealer, or financial planner</li>
                <li>Information provided through the Service, including AI-generated content and suggested allocations, should not be relied upon as the basis for investment decisions</li>
                <li>Past performance is not indicative of future results</li>
                <li>All investment decisions should be made based on your own research and in consultation with qualified financial, tax, and legal advisors</li>
                <li>We do not guarantee the accuracy, completeness, or timeliness of any information provided</li>
                <li>We are not responsible for any investment decisions you make based on information from the Service</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Third-Party Services</h2>
            <p className="text-muted-foreground mb-2">
              The Service integrates with third-party services including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li><strong>Plaid:</strong> For connecting to your financial accounts. Your use of Plaid is subject to Plaid&apos;s Terms of Service and Privacy Policy.</li>
              <li><strong>Stripe:</strong> For payment processing. Your use of Stripe is subject to Stripe&apos;s Terms of Service.</li>
              <li><strong>AI Providers:</strong> For generating AI-powered insights. AI responses are generated based on your portfolio data and general knowledge, and may contain errors or inaccuracies.</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              We are not responsible for the acts or omissions of third-party service providers. Your relationship with these providers is governed by their respective terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Subscription and Payment</h2>

            <h3 className="font-medium mt-4 mb-2">6.1 Subscription Plans</h3>
            <p className="text-muted-foreground">
              Access to the Service requires a paid subscription. Subscription fees, features, and terms are displayed at the time of purchase and may change over time.
            </p>

            <h3 className="font-medium mt-4 mb-2">6.2 Billing</h3>
            <p className="text-muted-foreground">
              Subscriptions are billed in advance on a recurring monthly basis. By subscribing, you authorize us to charge your payment method automatically each billing period until you cancel.
            </p>

            <h3 className="font-medium mt-4 mb-2">6.3 Free Trials</h3>
            <p className="text-muted-foreground">
              We may offer free trial periods. At the end of the trial, your subscription will automatically convert to a paid subscription unless you cancel before the trial ends.
            </p>

            <h3 className="font-medium mt-4 mb-2">6.4 Cancellation</h3>
            <p className="text-muted-foreground">
              You may cancel your subscription at any time through the dashboard settings or by contacting us. Cancellation takes effect at the end of the current billing period. You will retain access until then. We do not provide prorated refunds for partial billing periods.
            </p>

            <h3 className="font-medium mt-4 mb-2">6.5 Refunds</h3>
            <p className="text-muted-foreground">
              Refunds are handled on a case-by-case basis at our sole discretion. To request a refund, contact us within 7 days of the charge.
            </p>

            <h3 className="font-medium mt-4 mb-2">6.6 Price Changes</h3>
            <p className="text-muted-foreground">
              We reserve the right to change subscription prices. We will notify you of price changes in advance. Continued use after a price change constitutes acceptance of the new price.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Acceptable Use</h2>
            <p className="text-muted-foreground mb-2">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Use the Service for any unlawful purpose or in violation of any laws</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its systems</li>
              <li>Use the Service to transmit malware, viruses, or harmful code</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Scrape, crawl, or use automated means to access the Service without permission</li>
              <li>Reverse engineer, decompile, or attempt to extract source code from the Service</li>
              <li>Share your account credentials or allow others to access your account</li>
              <li>Use the Service on behalf of third parties without authorization</li>
              <li>Circumvent any access controls or usage limits</li>
              <li>Use the Service to compete with us or for commercial purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground mb-2">
              The Service, including its design, features, code, content, and trademarks, is owned by Portfolio Flow and protected by intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Service for personal purposes in accordance with these Terms.
            </p>
            <p className="text-muted-foreground">
              You retain ownership of any data you provide to the Service. By using the Service, you grant us a license to use your data solely to provide and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Data Accuracy and Availability</h2>
            <p className="text-muted-foreground mb-2">
              We strive to provide accurate information, but we do not guarantee:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>The accuracy, completeness, or timeliness of data retrieved from financial institutions</li>
              <li>The accuracy of portfolio valuations, calculations, or AI-generated content</li>
              <li>Uninterrupted or error-free operation of the Service</li>
              <li>Compatibility with all financial institutions or account types</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Data may be delayed, incomplete, or temporarily unavailable. You should verify important information directly with your financial institutions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Disclaimer of Warranties</h2>
            <div className="bg-muted/50 border rounded-lg p-4">
              <p className="text-muted-foreground">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT DEFECTS WILL BE CORRECTED. YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Limitation of Liability</h2>
            <div className="bg-muted/50 border rounded-lg p-4">
              <p className="text-muted-foreground mb-2">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, PORTFOLIO FLOW AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Loss of profits, revenue, data, or goodwill</li>
                <li>Investment losses or financial damages</li>
                <li>Damages arising from reliance on information provided by the Service</li>
                <li>Damages arising from unauthorized access to your account</li>
                <li>Damages arising from third-party services or content</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify, defend, and hold harmless Portfolio Flow and its officers, directors, employees, agents, and affiliates from any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) any content you provide to the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Termination</h2>
            <p className="text-muted-foreground mb-2">
              We may suspend or terminate your access to the Service at any time, with or without cause or notice, including for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
              <li>Violation of these Terms</li>
              <li>Non-payment of subscription fees</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Extended periods of inactivity</li>
              <li>Discontinuation of the Service</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Upon termination, your right to use the Service ceases immediately. You may request deletion of your data in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Dispute Resolution</h2>

            <h3 className="font-medium mt-4 mb-2">14.1 Informal Resolution</h3>
            <p className="text-muted-foreground">
              Before filing any claim, you agree to contact us to attempt to resolve the dispute informally. Most disputes can be resolved this way.
            </p>

            <h3 className="font-medium mt-4 mb-2">14.2 Arbitration</h3>
            <p className="text-muted-foreground">
              If we cannot resolve a dispute informally, any controversy or claim arising out of or relating to these Terms or the Service shall be settled by binding arbitration in accordance with the rules of the American Arbitration Association. The arbitration shall be conducted in the English language, and judgment on the award may be entered in any court of competent jurisdiction.
            </p>

            <h3 className="font-medium mt-4 mb-2">14.3 Class Action Waiver</h3>
            <p className="text-muted-foreground">
              YOU AGREE THAT ANY DISPUTES WILL BE RESOLVED ON AN INDIVIDUAL BASIS AND NOT AS PART OF A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">16. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on this page and updating the &quot;Last updated&quot; date. Your continued use of the Service after changes constitutes acceptance of the updated Terms. If you do not agree to the changes, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">17. Severability</h2>
            <p className="text-muted-foreground">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">18. Entire Agreement</h2>
            <p className="text-muted-foreground">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Portfolio Flow regarding the Service and supersede all prior agreements and understandings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">19. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about these Terms, please contact us at:
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
