/**
 * Robots.txt Configuration
 *
 * Controls search engine crawling behavior.
 * Allows public pages, blocks private/admin areas.
 */

import { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/admin",
          "/api",
          "/paywall",
          "/r/", // Referral links (dynamic, not needed in search)
        ],
      },
    ],
    sitemap: "https://portfolioflow.ai/sitemap.xml",
  }
}
