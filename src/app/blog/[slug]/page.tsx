/**
 * Individual Blog Post Page
 *
 * Renders MDX content with full SEO optimization.
 * Statically generated at build time with generateStaticParams.
 */

import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPostBySlug, getAllPostSlugs } from "@/lib/blog/mdx"
import { MDXContent } from "@/components/blog/mdx-content"
import { JsonLd, BreadcrumbJsonLd } from "@/components/blog/json-ld"

type Props = {
  params: Promise<{ slug: string }>
}

/**
 * Generate static paths for all blog posts at build time.
 */
export async function generateStaticParams() {
  const slugs = await getAllPostSlugs()
  return slugs.map((slug) => ({ slug }))
}

/**
 * Generate SEO metadata for each blog post.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    return {
      title: "Post Not Found | Portfolio Flow",
    }
  }

  const url = `https://portfolioflow.ai/blog/${slug}`

  return {
    title: `${post.title} | Portfolio Flow`,
    description: post.description,
    keywords: [post.primaryKeyword, ...post.secondaryKeywords],
    authors: [{ name: "Portfolio Flow" }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      authors: ["Portfolio Flow"],
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: url,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return (
    <>
      <JsonLd post={post} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://portfolioflow.ai" },
          { name: "Blog", url: "https://portfolioflow.ai/blog" },
          { name: post.title, url: `https://portfolioflow.ai/blog/${slug}` },
        ]}
      />

      <article className="mx-auto max-w-3xl px-6 py-16">
        {/* Back link */}
        <Link
          href="/blog"
          className="text-muted-foreground hover:text-foreground mb-8 inline-block"
        >
          &larr; Back to Blog
        </Link>

        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-4 leading-tight">{post.title}</h1>
          <p className="text-muted-foreground text-lg mb-4">
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
              <span className="bg-muted px-2 py-0.5 rounded">
                {post.geoTarget} Focus
              </span>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <MDXContent source={post.content} />
        </div>

        {/* Footer CTA */}
        <footer className="mt-16 pt-8 border-t border-border">
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-2">
              Struggling to see your complete portfolio allocation?
            </h3>
            <p className="text-muted-foreground mb-4">
              Portfolio Flow connects all your brokerage accounts (Fidelity,
              Vanguard, Schwab, and more) in one dashboard. See your true asset
              allocation across all accounts.
            </p>
            <Link
              href="/signup"
              className="text-primary font-medium hover:underline"
            >
              Try it free &rarr;
            </Link>
          </div>

          {/* Share section */}
          <div className="mt-8 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">
              Found this helpful? Share it:
            </p>
            <div className="flex gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://portfolioflow.ai/blog/${slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://portfolioflow.ai/blog/${slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </footer>
      </article>
    </>
  )
}
