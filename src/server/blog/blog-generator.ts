/**
 * Blog Content Generator
 *
 * Generates SEO/GEO-optimized blog posts using OpenAI.
 * Posts are stored in database, then committed as MDX files via GitHub Action.
 */

import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { getPostHogClient } from "@/lib/posthog-server"

// ===== TYPES =====

export type BlogCategory = "pain_point" | "education" | "comparison" | "guide"
export type GeoTarget = "US" | "UK" | "Canada" | "Australia"

// ===== GEO KEYWORDS =====

const GEO_KEYWORDS: Record<GeoTarget, string[]> = {
  US: [
    "American investors",
    "US brokerage accounts",
    "401(k)",
    "IRA",
    "Roth IRA",
    "US stock market",
    "S&P 500",
    "Fidelity",
    "Vanguard",
    "Schwab",
    "US tax-advantaged accounts",
    "capital gains tax",
  ],
  UK: [
    "UK investors",
    "ISA",
    "stocks and shares ISA",
    "SIPP",
    "UK pension",
    "FTSE 100",
    "British investors",
    "UK brokerage",
    "Hargreaves Lansdown",
    "AJ Bell",
  ],
  Canada: [
    "Canadian investors",
    "TFSA",
    "RRSP",
    "Canadian brokerage",
    "TSX",
    "Canadian retirement accounts",
    "Wealthsimple",
    "Questrade",
  ],
  Australia: [
    "Australian investors",
    "superannuation",
    "super fund",
    "ASX",
    "Australian shares",
    "self-managed super fund",
    "SMSF",
    "CommSec",
  ],
}

// ===== PROMPTS =====

const BLOG_SYSTEM_PROMPT = `You are an expert financial content writer for Portfolio Flow (portfolioflow.ai), a portfolio aggregation tool for DIY investors.

TARGET AUDIENCE:
- Self-directed investors with multiple brokerage accounts
- Bogleheads, FIRE community, personal finance enthusiasts
- Age 30-55, tech-comfortable, long-term focused
- People frustrated with fragmented portfolio views across multiple apps

WRITING STYLE:
- Authoritative but approachable
- Data-driven with specific examples and numbers
- Educational without being condescending
- Conversational "you" language
- Acknowledges real frustrations investors face
- Occasionally uses light humor

SEO REQUIREMENTS:
- Include primary keyword in title, first paragraph, and 2-3 H2 subheadings
- Use secondary keywords naturally throughout (don't force them)
- Include geo-targeted keywords for the specified region
- Aim for 1500-2500 words for comprehensive coverage
- Use H2 (##) and H3 (###) headings for clear structure
- Include a compelling meta description (150-160 characters)
- Write scannable content with short paragraphs
- Use bullet points and numbered lists where appropriate

NEVER:
- Sound like a corporate marketing team
- Use excessive exclamation marks
- Make unrealistic promises about returns
- Provide specific financial advice (we're educational, not advisors)
- Be condescending to beginners

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "title": "SEO-optimized title (50-60 characters ideal)",
  "description": "Meta description for search results (150-160 characters)",
  "slug": "url-friendly-slug-with-dashes",
  "content": "Full MDX content starting with frontmatter block"
}

The content field should be valid MDX starting with a YAML frontmatter block:
---
title: "The Title"
description: "Meta description"
publishedAt: "YYYY-MM-DD"
primaryKeyword: "main keyword"
secondaryKeywords: ["keyword1", "keyword2"]
geoTarget: "US"
---

Then the full article content with proper markdown formatting.`

const BLOG_USER_PROMPT = `Write a comprehensive blog post about: {title}

Primary keyword to target: {primaryKeyword}
Secondary keywords to include naturally: {secondaryKeywords}
Category: {category}

GEO TARGET: {geoTarget}
Include these geo-specific terms naturally where relevant: {geoKeywords}

{outline}

Create an engaging, SEO-optimized blog post that helps {geoTarget} investors understand this topic.

The article should:
1. Start with a compelling hook that addresses a pain point or curiosity
2. Provide actionable insights with specific examples
3. Include relevant statistics or data points where possible
4. End with a soft mention of how Portfolio Flow can help (not salesy)
5. Be comprehensive enough to rank well but focused on providing real value

Today's date for the frontmatter: {today}`

// ===== MAIN FUNCTIONS =====

/**
 * Get the next blog topic using LRU rotation.
 */
export async function getNextBlogTopic(): Promise<string | null> {
  const topic = await prisma.blogTopic.findFirst({
    where: { active: true },
    orderBy: [
      { lastUsed: { sort: "asc", nulls: "first" } },
      { useCount: "asc" },
    ],
  })
  return topic?.id || null
}

/**
 * Generate a blog post from a specific topic.
 * Returns the created BlogPost ID.
 */
export async function generateBlogPost(topicId: string): Promise<string> {
  // 1. Fetch the topic
  const topic = await prisma.blogTopic.findUnique({
    where: { id: topicId },
  })

  if (!topic || !topic.active) {
    throw new Error(`Topic not found or inactive: ${topicId}`)
  }

  // 2. Select geo target (rotate through regions based on use count)
  const geoTargets: GeoTarget[] = ["US", "UK", "Canada", "Australia"]
  const geoTarget = geoTargets[topic.useCount % geoTargets.length]
  const geoKeywords = GEO_KEYWORDS[geoTarget].slice(0, 6)

  // 3. Build the prompt
  const today = new Date().toISOString().split("T")[0]
  const prompt = BLOG_USER_PROMPT
    .replace("{title}", topic.title)
    .replace("{primaryKeyword}", topic.primaryKeyword)
    .replace("{secondaryKeywords}", topic.secondaryKeywords.join(", "))
    .replace("{category}", topic.category)
    .replace("{geoTarget}", geoTarget)
    .replace("{geoKeywords}", geoKeywords.join(", "))
    .replace(
      "{outline}",
      topic.outline ? `Suggested outline:\n${topic.outline}` : ""
    )
    .replace("{today}", today)

  // 4. Check OpenAI key
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const openai = new OpenAI({ apiKey: openaiApiKey })

  // 5. Call OpenAI
  const model = process.env.OPENAI_MODEL || "gpt-4o"

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: BLOG_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 4000,
  })

  const rawContent = completion.choices[0]?.message?.content || "{}"

  // 6. Parse and validate
  let parsed: {
    title: string
    description: string
    slug: string
    content: string
  }

  try {
    parsed = JSON.parse(rawContent)
  } catch {
    throw new Error(`Failed to parse OpenAI response: ${rawContent}`)
  }

  if (!parsed.title || !parsed.description || !parsed.slug || !parsed.content) {
    throw new Error(
      `Invalid blog post structure: missing required fields. Got: ${Object.keys(parsed).join(", ")}`
    )
  }

  // Ensure slug is URL-friendly
  const slug = parsed.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  // 7. Check for duplicate slug
  const existing = await prisma.blogPost.findUnique({
    where: { slug },
  })

  const finalSlug = existing ? `${slug}-${Date.now()}` : slug

  // 8. Create BlogPost in database
  const blogPost = await prisma.blogPost.create({
    data: {
      slug: finalSlug,
      title: parsed.title,
      description: parsed.description,
      content: parsed.content,
      primaryKeyword: topic.primaryKeyword,
      secondaryKeywords: topic.secondaryKeywords,
      geoTarget,
      topicId: topic.id,
      generatedBy: model,
      prompt,
      status: "pending",
    },
  })

  // 9. Update topic usage
  await prisma.blogTopic.update({
    where: { id: topicId },
    data: {
      lastUsed: new Date(),
      useCount: { increment: 1 },
    },
  })

  // 10. Track in PostHog
  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: "system",
    event: "blog_post_generated",
    properties: {
      slug: finalSlug,
      geoTarget,
      category: topic.category,
      primaryKeyword: topic.primaryKeyword,
      model,
    },
  })

  return blogPost.id
}

/**
 * Generate blog posts for the week.
 * Called by GitHub Action on Monday/Thursday.
 */
export async function generateWeeklyBlogPost(): Promise<{
  generated: boolean
  postId?: string
  slug?: string
  error?: string
}> {
  try {
    const topicId = await getNextBlogTopic()

    if (!topicId) {
      return {
        generated: false,
        error: "No active blog topics available",
      }
    }

    const postId = await generateBlogPost(topicId)

    const post = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: { slug: true },
    })

    return {
      generated: true,
      postId,
      slug: post?.slug,
    }
  } catch (error) {
    return {
      generated: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Mark a blog post as published after GitHub Action commits the file.
 */
export async function markBlogPostPublished(slug: string): Promise<void> {
  await prisma.blogPost.update({
    where: { slug },
    data: {
      status: "published",
      publishedAt: new Date(),
    },
  })

  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: "system",
    event: "blog_post_published",
    properties: { slug },
  })
}

/**
 * Get a pending blog post by ID with full content.
 */
export async function getPendingBlogPost(postId: string) {
  return prisma.blogPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      content: true,
      primaryKeyword: true,
      geoTarget: true,
      status: true,
    },
  })
}

/**
 * Get all published blog posts (for sitemap generation).
 */
export async function getPublishedBlogPosts() {
  return prisma.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      description: true,
      publishedAt: true,
      geoTarget: true,
    },
  })
}
