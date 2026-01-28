/**
 * Twitter Posting Service
 *
 * Posts approved content to Twitter using twitterapi.io.
 * Handles rate limiting and status tracking.
 */

import { prisma } from "@/lib/prisma"
import { getPostHogClient } from "@/lib/posthog-server"

// ===== TYPES =====

type TweetContent = {
  text: string
  hashtags?: string[]
}

type ThreadContent = {
  tweets: string[]
  hashtags?: string[]
}

type TwitterApiResponse = {
  success: boolean
  data?: {
    id: string
    text: string
  }
  error?: string
}

// ===== HELPER FUNCTIONS =====

/**
 * Get start of day in UTC
 */
function startOfDayUTC(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

/**
 * Format tweet with hashtags
 */
function formatTweetWithHashtags(text: string, hashtags: string[] = []): string {
  if (hashtags.length === 0) return text

  // Calculate available space
  const hashtagStr = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
  const maxTextLength = 280 - hashtagStr.length - 2 // -2 for newlines

  let finalText = text
  if (text.length > maxTextLength) {
    finalText = text.slice(0, maxTextLength - 3) + "..."
  }

  return `${finalText}\n\n${hashtagStr}`
}

/**
 * Post a single tweet using twitterapi.io
 */
async function postTweet(text: string): Promise<TwitterApiResponse> {
  const apiKey = process.env.TWITTER_API_IO_KEY
  if (!apiKey) {
    return { success: false, error: "TWITTER_API_IO_KEY not configured" }
  }

  try {
    const response = await fetch("https://api.twitterapi.io/twitter/tweet", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Twitter API error (${response.status}): ${errorText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data: {
        id: data.id || data.data?.id || "unknown",
        text: data.text || text,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
    }
  }
}

/**
 * Post a thread (multiple tweets in sequence) using twitterapi.io
 */
async function postThread(tweets: string[]): Promise<TwitterApiResponse> {
  const apiKey = process.env.TWITTER_API_IO_KEY
  if (!apiKey) {
    return { success: false, error: "TWITTER_API_IO_KEY not configured" }
  }

  try {
    // twitterapi.io may have a thread endpoint, otherwise post sequentially
    // First, try the thread endpoint if available
    const response = await fetch("https://api.twitterapi.io/twitter/thread", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tweets }),
    })

    if (response.ok) {
      const data = await response.json()
      return {
        success: true,
        data: {
          id: data.id || data.data?.[0]?.id || "thread",
          text: tweets[0],
        },
      }
    }

    // If thread endpoint doesn't exist (404), fall back to sequential posting
    if (response.status === 404) {
      let lastTweetId: string | undefined

      for (let i = 0; i < tweets.length; i++) {
        const tweetText = tweets[i]
        const body: Record<string, string> = { text: tweetText }

        // If not the first tweet, reply to the previous one
        if (lastTweetId) {
          body.reply_to = lastTweetId
        }

        const tweetResponse = await fetch("https://api.twitterapi.io/twitter/tweet", {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        if (!tweetResponse.ok) {
          const errorText = await tweetResponse.text()
          return {
            success: false,
            error: `Failed at tweet ${i + 1}: ${errorText}`,
          }
        }

        const tweetData = await tweetResponse.json()
        lastTweetId = tweetData.id || tweetData.data?.id

        // Small delay between tweets to avoid rate limiting
        if (i < tweets.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      return {
        success: true,
        data: {
          id: lastTweetId || "thread",
          text: tweets[0],
        },
      }
    }

    const errorText = await response.text()
    return {
      success: false,
      error: `Twitter API error (${response.status}): ${errorText}`,
    }
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
    }
  }
}

// ===== MAIN FUNCTIONS =====

/**
 * Check if we can post (rate limiting + channel enabled)
 */
export async function canPostToTwitter(): Promise<{
  canPost: boolean
  reason?: string
}> {
  const channel = await prisma.distributionChannel.findUnique({
    where: { name: "twitter" },
  })

  if (!channel) {
    return { canPost: false, reason: "Twitter channel not configured" }
  }

  if (!channel.enabled) {
    return { canPost: false, reason: "Twitter channel is disabled" }
  }

  // Check API key
  if (!process.env.TWITTER_API_IO_KEY) {
    return { canPost: false, reason: "TWITTER_API_IO_KEY not configured" }
  }

  // Check daily limit
  const today = startOfDayUTC()
  const needsReset = !channel.dailyResetAt || channel.dailyResetAt < today

  if (needsReset) {
    // Reset the counter for a new day
    await prisma.distributionChannel.update({
      where: { name: "twitter" },
      data: {
        dailyPostCount: 0,
        dailyResetAt: today,
      },
    })
    return { canPost: true }
  }

  if (channel.dailyPostCount >= channel.postsPerDay) {
    return { canPost: false, reason: `Daily limit reached (${channel.postsPerDay})` }
  }

  return { canPost: true }
}

/**
 * Post the next approved content item to Twitter.
 * Returns true if something was posted, false otherwise.
 */
export async function postNextApprovedContent(): Promise<{
  posted: boolean
  contentId?: string
  tweetId?: string
  error?: string
}> {
  // 1. Check if we can post
  const { canPost, reason } = await canPostToTwitter()
  if (!canPost) {
    return { posted: false, error: reason }
  }

  // 2. Get next approved content
  const content = await prisma.contentItem.findFirst({
    where: {
      type: { in: ["tweet", "thread"] },
      status: "approved",
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: new Date() } },
      ],
    },
    orderBy: [
      { scheduledFor: { sort: "asc", nulls: "last" } },
      { approvedAt: "asc" },
    ],
  })

  if (!content) {
    return { posted: false, error: "No approved content to post" }
  }

  // 3. Parse content
  let parsedContent: TweetContent | ThreadContent
  try {
    parsedContent = JSON.parse(content.content)
  } catch {
    // Mark as failed
    await prisma.contentItem.update({
      where: { id: content.id },
      data: {
        status: "failed",
        error: "Failed to parse content JSON",
      },
    })
    return { posted: false, error: "Failed to parse content JSON" }
  }

  // 4. Post to Twitter
  let result: TwitterApiResponse

  if (content.type === "tweet") {
    const tweet = parsedContent as TweetContent
    const formattedText = formatTweetWithHashtags(tweet.text, tweet.hashtags)
    result = await postTweet(formattedText)
  } else {
    const thread = parsedContent as ThreadContent
    // Add hashtags to last tweet of thread
    const tweets = [...thread.tweets]
    if (thread.hashtags && thread.hashtags.length > 0) {
      const lastIndex = tweets.length - 1
      tweets[lastIndex] = formatTweetWithHashtags(tweets[lastIndex], thread.hashtags)
    }
    result = await postThread(tweets)
  }

  // 5. Update content status
  if (result.success) {
    await prisma.contentItem.update({
      where: { id: content.id },
      data: {
        status: "published",
        publishedAt: new Date(),
        publishedId: result.data?.id,
      },
    })

    // Update channel stats
    await prisma.distributionChannel.update({
      where: { name: "twitter" },
      data: {
        lastPostedAt: new Date(),
        dailyPostCount: { increment: 1 },
      },
    })

    // Track successful post in PostHog
    const posthog = getPostHogClient()
    posthog.capture({
      distinctId: "system",
      event: "content_posted",
      properties: {
        platform: "twitter",
        content_type: content.type,
        content_id: content.id,
        tweet_id: result.data?.id,
        topic: content.topic,
      },
    })

    return {
      posted: true,
      contentId: content.id,
      tweetId: result.data?.id,
    }
  } else {
    await prisma.contentItem.update({
      where: { id: content.id },
      data: {
        status: "failed",
        error: result.error,
      },
    })

    // Track failed post in PostHog
    const posthog = getPostHogClient()
    posthog.capture({
      distinctId: "system",
      event: "content_post_failed",
      properties: {
        platform: "twitter",
        content_type: content.type,
        content_id: content.id,
        error: result.error,
      },
    })

    return { posted: false, contentId: content.id, error: result.error }
  }
}

/**
 * Get Twitter channel status
 */
export async function getTwitterChannelStatus(): Promise<{
  enabled: boolean
  postsToday: number
  dailyLimit: number
  lastPostedAt: Date | null
}> {
  const channel = await prisma.distributionChannel.findUnique({
    where: { name: "twitter" },
  })

  if (!channel) {
    return {
      enabled: false,
      postsToday: 0,
      dailyLimit: 3,
      lastPostedAt: null,
    }
  }

  // Check if we need to reset count for today
  const today = startOfDayUTC()
  const postsToday =
    channel.dailyResetAt && channel.dailyResetAt >= today
      ? channel.dailyPostCount
      : 0

  return {
    enabled: channel.enabled,
    postsToday,
    dailyLimit: channel.postsPerDay,
    lastPostedAt: channel.lastPostedAt,
  }
}

/**
 * Enable or disable Twitter posting
 */
export async function setTwitterEnabled(enabled: boolean): Promise<void> {
  await prisma.distributionChannel.update({
    where: { name: "twitter" },
    data: { enabled },
  })
}
