/**
 * Content Generation Service
 *
 * Uses OpenAI to generate distribution content (tweets, threads) based on topic templates.
 * Designed to be called by cron jobs for automated content creation.
 */

import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { getPostHogClient } from "@/lib/posthog-server"

// ===== TYPES =====

export type ContentType = "tweet" | "thread"
export type TopicCategory = "pain_point" | "education" | "product" | "engagement"

type GeneratedTweet = {
  text: string
  hashtags: string[]
}

type GeneratedThread = {
  tweets: string[]
  hashtags: string[]
}

// ===== PROMPT TEMPLATES =====

// Target hashtags for reaching DIY investors
const RECOMMENDED_HASHTAGS = [
  "investing", "portfolio", "FIRE", "Bogleheads", "personalfinance",
  "assetallocation", "indexfunds", "ETFs", "retirement", "401k",
  "IRA", "DIYinvesting", "passiveinvesting", "financialindependence",
  "wealthbuilding", "stockmarket", "bonds", "diversification"
]

const TWEET_PROMPTS: Record<TopicCategory, string> = {
  pain_point: `Generate a tweet about this DIY investing pain point: {topic}
{angle_instruction}

Target audience: Self-directed investors who use multiple brokerages (Fidelity, Vanguard, Schwab) and struggle to see their complete portfolio allocation.

Rules:
- Max 220 characters for the main text (leave room for URL and hashtags)
- Conversational, authentic tone - like a fellow investor venting
- End with a relatable question or statement that invites engagement
- MUST end with "portfolioflow.ai" as a subtle solution hint
- Use "you" language to make it personal

Choose 2 hashtags from: ${RECOMMENDED_HASHTAGS.join(", ")}

Output JSON: {"text": "...", "hashtags": ["...", "..."]}`,

  education: `Generate an educational tweet about: {topic}
{angle_instruction}

Target audience: DIY investors who want to learn about portfolio management, asset allocation, and long-term investing strategies.

Rules:
- Max 220 characters for the main text (leave room for URL and hashtags)
- One clear, actionable insight or surprising fact
- Use specific numbers/percentages when relevant
- Beginner-friendly but not condescending
- MUST end with "portfolioflow.ai" as a learn-more CTA

Choose 2 hashtags from: ${RECOMMENDED_HASHTAGS.join(", ")}

Output JSON: {"text": "...", "hashtags": ["...", "..."]}`,

  product: `Generate a tweet highlighting this benefit: {topic}
{angle_instruction}

Target audience: DIY investors frustrated with managing multiple brokerage accounts who need a unified portfolio view.

Portfolio Flow's key benefits:
- See complete allocation across ALL accounts in one dashboard
- Connect Fidelity, Vanguard, Schwab, and more via Plaid
- AI assistant that answers questions about YOUR specific portfolio
- Read-only access (your money stays safe)
- Automatic rebalancing recommendations

Rules:
- Max 220 characters for the main text (leave room for URL and hashtags)
- Focus on the transformation/outcome, not features
- MUST end with "portfolioflow.ai" as the CTA
- Sound like a helpful recommendation, not an ad

Choose 2 hashtags from: ${RECOMMENDED_HASHTAGS.join(", ")}

Output JSON: {"text": "...", "hashtags": ["...", "..."]}`,

  engagement: `Generate an engagement tweet about: {topic}
{angle_instruction}

Target audience: DIY investors in the FIRE, Bogleheads, and personal finance communities.

Rules:
- Max 220 characters for the main text (leave room for URL and hashtags)
- Ask a specific question that's easy to answer
- Topics: allocation splits, rebalancing habits, brokerage preferences, investing mistakes
- Make people want to share their experience
- MUST end with "portfolioflow.ai" after the question

Choose 2 hashtags from: ${RECOMMENDED_HASHTAGS.join(", ")}

Output JSON: {"text": "...", "hashtags": ["...", "..."]}`,
}

const THREAD_PROMPT = `Generate a Twitter thread about: {topic}
{angle_instruction}

Target audience: DIY investors in FIRE, Bogleheads, and personal finance communities who manage multiple brokerage accounts.

Rules:
- 4-5 tweets, each under 240 characters
- Tweet 1: Strong hook - a surprising fact, contrarian take, or relatable problem
- Tweets 2-4: Educational content with specific insights, numbers, or actionable tips
- Final tweet: MUST end with "portfolioflow.ai" as a soft CTA
- Each tweet valuable on its own but flows as a narrative
- Conversational tone, not lecture-style
- No hard selling - pure value

Choose 2-3 hashtags from: ${RECOMMENDED_HASHTAGS.join(", ")}

Output JSON: {
  "tweets": ["tweet 1...", "tweet 2...", ...],
  "hashtags": ["hashtag1", "hashtag2"]
}`

// ===== HELPER FUNCTIONS =====

function buildPrompt(
  type: ContentType,
  category: TopicCategory,
  topic: string,
  angle?: string | null
): string {
  const angleInstruction = angle
    ? `Specific angle to take: ${angle}`
    : "Take a fresh, authentic angle."

  if (type === "thread") {
    return THREAD_PROMPT
      .replace("{topic}", topic)
      .replace("{angle_instruction}", angleInstruction)
  }

  const template = TWEET_PROMPTS[category]
  return template
    .replace("{topic}", topic)
    .replace("{angle_instruction}", angleInstruction)
}

// ===== MAIN FUNCTIONS =====

/**
 * Generate content from a specific topic.
 * Creates a ContentItem in "pending" status.
 */
export async function generateContentFromTopic(
  topicId: string,
  type: ContentType = "tweet"
): Promise<string> {
  // 1. Fetch the topic
  const topic = await prisma.contentTopic.findUnique({
    where: { id: topicId },
  })

  if (!topic) {
    throw new Error(`Topic not found: ${topicId}`)
  }

  if (!topic.active) {
    throw new Error(`Topic is inactive: ${topicId}`)
  }

  // 2. Build the prompt
  const prompt = buildPrompt(
    type,
    topic.category as TopicCategory,
    topic.topic,
    topic.angle
  )

  // 3. Check OpenAI key
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const openai = new OpenAI({ apiKey: openaiApiKey })

  // 4. Call OpenAI
  const model = process.env.OPENAI_MODEL || "gpt-4o"
  const systemPrompt = `You are a social media content creator for Portfolio Flow (portfolioflow.ai).

PRODUCT: Portfolio Flow is a portfolio aggregation tool that lets DIY investors see their complete asset allocation across ALL brokerage accounts (Fidelity, Vanguard, Schwab, 401k, IRA, taxable) in one unified dashboard. It connects via Plaid (read-only, secure) and includes an AI assistant for portfolio questions.

TARGET AUDIENCE:
- Self-directed investors with 3+ brokerage accounts
- Bogleheads, FIRE community, r/personalfinance users
- People frustrated with logging into multiple apps
- Investors who care about proper asset allocation
- Age 30-55, tech-comfortable, long-term focused

BRAND VOICE:
- Authentic and relatable - like a fellow investor, not a financial advisor
- Educational without being preachy
- Conversational, uses "you" language
- Acknowledges real frustrations
- Never salesy or pushy
- Occasionally uses light humor

NEVER:
- Sound like a corporate marketing team
- Use excessive exclamation marks
- Make unrealistic promises
- Use jargon without explanation
- Be condescending

Always output valid JSON matching the requested schema.`

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.85, // Higher temperature for creative variety
    max_tokens: 800,
  })

  const rawContent = completion.choices[0]?.message?.content || "{}"

  // 5. Parse and validate
  let parsedContent: GeneratedTweet | GeneratedThread
  try {
    parsedContent = JSON.parse(rawContent)
  } catch {
    throw new Error(`Failed to parse OpenAI response: ${rawContent}`)
  }

  // Validate structure
  if (type === "tweet") {
    const tweet = parsedContent as GeneratedTweet
    if (!tweet.text || typeof tweet.text !== "string") {
      throw new Error("Invalid tweet content: missing text field")
    }
    // Truncate if needed
    if (tweet.text.length > 280) {
      tweet.text = tweet.text.slice(0, 277) + "..."
    }
  } else {
    const thread = parsedContent as GeneratedThread
    if (!thread.tweets || !Array.isArray(thread.tweets) || thread.tweets.length < 3) {
      throw new Error("Invalid thread content: missing or too few tweets")
    }
    // Truncate each tweet if needed
    thread.tweets = thread.tweets.map((t) =>
      t.length > 280 ? t.slice(0, 277) + "..." : t
    )
  }

  // 6. Create ContentItem
  const contentItem = await prisma.contentItem.create({
    data: {
      type,
      topic: topic.topic,
      content: JSON.stringify(parsedContent),
      generatedBy: model,
      prompt,
      status: "pending",
    },
  })

  // 7. Update topic usage
  await prisma.contentTopic.update({
    where: { id: topicId },
    data: {
      lastUsed: new Date(),
      useCount: { increment: 1 },
    },
  })

  return contentItem.id
}

/**
 * Get the next topic to use for content generation.
 * Uses least-recently-used rotation to ensure variety.
 */
export async function getNextTopic(
  category?: TopicCategory
): Promise<string | null> {
  const topic = await prisma.contentTopic.findFirst({
    where: {
      active: true,
      ...(category ? { category } : {}),
    },
    orderBy: [
      { lastUsed: { sort: "asc", nulls: "first" } },
      { useCount: "asc" },
    ],
  })

  return topic?.id || null
}

/**
 * Generate a batch of content for the day.
 * Called by the daily cron job.
 */
export async function generateDailyContent(): Promise<{
  generated: number
  errors: string[]
}> {
  const results = {
    generated: 0,
    errors: [] as string[],
  }

  // Generate tweets: 1 pain_point, 1 education, 1 product or engagement
  const categories: TopicCategory[] = ["pain_point", "education", "product"]

  // On random days, swap product for engagement
  if (Math.random() > 0.5) {
    categories[2] = "engagement"
  }

  for (const category of categories) {
    try {
      const topicId = await getNextTopic(category)
      if (!topicId) {
        results.errors.push(`No active topic found for category: ${category}`)
        continue
      }

      await generateContentFromTopic(topicId, "tweet")
      results.generated++
    } catch (error) {
      results.errors.push(
        `Failed to generate ${category} tweet: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  // Generate a thread on Mondays and Thursdays
  const dayOfWeek = new Date().getDay()
  if (dayOfWeek === 1 || dayOfWeek === 4) {
    try {
      // Prefer education topics for threads
      const topicId = await getNextTopic("education")
      if (topicId) {
        await generateContentFromTopic(topicId, "thread")
        results.generated++
      }
    } catch (error) {
      results.errors.push(
        `Failed to generate thread: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  // Track generation results in PostHog
  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: "system",
    event: "content_generation_completed",
    properties: {
      generated_count: results.generated,
      error_count: results.errors.length,
      categories: categories,
      day_of_week: dayOfWeek,
    },
  })

  return results
}

/**
 * Get pending content items ready for review.
 */
export async function getPendingContent(limit: number = 20): Promise<
  Array<{
    id: string
    type: string
    topic: string
    content: string
    createdAt: Date
  }>
> {
  return prisma.contentItem.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      topic: true,
      content: true,
      createdAt: true,
    },
  })
}

/**
 * Approve a content item for posting.
 */
export async function approveContent(
  contentId: string,
  editedContent?: string
): Promise<void> {
  await prisma.contentItem.update({
    where: { id: contentId },
    data: {
      status: "approved",
      approvedAt: new Date(),
      ...(editedContent ? { content: editedContent } : {}),
    },
  })
}

/**
 * Reject a content item.
 */
export async function rejectContent(contentId: string): Promise<void> {
  await prisma.contentItem.update({
    where: { id: contentId },
    data: {
      status: "rejected",
    },
  })
}
