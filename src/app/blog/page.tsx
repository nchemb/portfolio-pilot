/**
 * Blog Listing Page
 *
 * Displays all published blog posts with SEO metadata.
 * Statically generated at build time.
 */

import { Metadata } from "next"
import Link from "next/link"
import { getAllPosts } from "@/lib/blog/mdx"
import { OrganizationJsonLd, BreadcrumbJsonLd } from "@/components/blog/json-ld"

export const metadata: Metadata = {
  title: "Blog | Portfolio Flow - Investment Insights for DIY Investors",
  description:
    "Expert insights on portfolio management, asset allocation, and investment strategies for self-directed investors in the US, UK, Canada, and Australia.",
  keywords: [
    "portfolio management",
    "asset allocation",
    "DIY investing",
    "investment strategies",
    "portfolio tracker",
    "brokerage aggregation",
  ],
  openGraph: {
    title: "Portfolio Flow Blog - Investment Insights",
    description:
      "Expert insights on portfolio management and asset allocation for DIY investors.",
    type: "website",
    url: "https://portfolioflow.ai/blog",
  },
  twitter: {
    card: "summary_large_image",
    title: "Portfolio Flow Blog",
    description: "Investment insights for DIY investors",
  },
  alternates: {
    canonical: "https://portfolioflow.ai/blog",
  },
}

export default async function BlogPage() {
  const posts = await getAllPosts()

  return (
    <>
      <OrganizationJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://portfolioflow.ai" },
          { name: "Blog", url: "https://portfolioflow.ai/blog" },
        ]}
      />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Blog</h1>
          <p className="text-muted-foreground text-lg">
            Insights on portfolio management, asset allocation, and investing
            strategies for self-directed investors.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="border-b border-border pb-8 last:border-0"
              >
                <Link href={`/blog/${post.slug}`} className="group block">
                  <h2 className="text-2xl font-semibold group-hover:text-primary transition-colors mb-2">
                    {post.title}
                  </h2>
                  <p className="text-muted-foreground mb-3">
                    {post.description}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{post.readingTime}</span>
                    <span>
                      {new Date(post.publishedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    {post.geoTarget && (
                      <span className="bg-muted px-2 py-0.5 rounded text-xs">
                        {post.geoTarget}
                      </span>
                    )}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <section className="mt-16 bg-muted/50 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-3">
            See Your Complete Portfolio Allocation
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Connect all your brokerage accounts and see your true asset
            allocation in one dashboard. Free to get started.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get Started Free
          </Link>
        </section>
      </div>
    </>
  )
}
