/**
 * JSON-LD Structured Data for Blog Posts
 *
 * Provides rich snippets for Google search results.
 * Follows schema.org BlogPosting specification.
 */

type JsonLdProps = {
  post: {
    title: string
    description: string
    slug: string
    publishedAt: string
    content: string
  }
}

export function JsonLd({ post }: JsonLdProps) {
  const wordCount = post.content.split(/\s+/).length
  const url = `https://portfolioflow.ai/blog/${post.slug}`

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    author: {
      "@type": "Organization",
      name: "Portfolio Flow",
      url: "https://portfolioflow.ai",
    },
    publisher: {
      "@type": "Organization",
      name: "Portfolio Flow",
      logo: {
        "@type": "ImageObject",
        url: "https://portfolioflow.ai/logo.png",
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
    wordCount,
    inLanguage: "en-US",
    isAccessibleForFree: true,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

/**
 * Organization JSON-LD for the blog listing page.
 */
export function OrganizationJsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Portfolio Flow",
    url: "https://portfolioflow.ai",
    logo: "https://portfolioflow.ai/logo.png",
    description:
      "Portfolio aggregation tool for DIY investors. See your complete asset allocation across all brokerage accounts in one dashboard.",
    sameAs: ["https://twitter.com/portfolioflow"],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

/**
 * BreadcrumbList JSON-LD for navigation.
 */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[]
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
