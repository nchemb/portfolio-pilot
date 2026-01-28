/**
 * API Route: Generate Blog Post
 *
 * Called by GitHub Action to generate a new SEO-optimized blog post.
 * Returns the MDX content for the action to commit to the repo.
 *
 * Security: Requires BLOG_GENERATION_SECRET bearer token.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  generateWeeklyBlogPost,
  getPendingBlogPost,
} from "@/server/blog/blog-generator"

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.BLOG_GENERATION_SECRET
  if (!secret) {
    console.error("[api/blog/generate] BLOG_GENERATION_SECRET not configured")
    return false
  }

  const authHeader = request.headers.get("authorization")
  if (!authHeader) {
    return false
  }

  const [scheme, token] = authHeader.split(" ")
  return scheme?.toLowerCase() === "bearer" && token === secret
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  // 1. Verify authorization
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 2. Generate the blog post
    const result = await generateWeeklyBlogPost()

    if (!result.generated || !result.postId) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to generate blog post",
        },
        { status: 500 }
      )
    }

    // 3. Fetch the full post content
    const post = await getPendingBlogPost(result.postId)

    if (!post) {
      return NextResponse.json(
        { success: false, error: "Post created but not found" },
        { status: 500 }
      )
    }

    // 4. Return the content for GitHub Action to commit
    return NextResponse.json({
      success: true,
      slug: post.slug,
      filename: `${post.slug}.mdx`,
      content: post.content,
      metadata: {
        title: post.title,
        description: post.description,
        geoTarget: post.geoTarget,
        primaryKeyword: post.primaryKeyword,
      },
      timing: {
        durationMs: Date.now() - startedAt,
      },
    })
  } catch (error) {
    console.error("[api/blog/generate] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Also support GET for testing (without auth in dev)
export async function GET(request: NextRequest) {
  // In production, require auth even for GET
  if (process.env.NODE_ENV === "production") {
    if (!verifySecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  return NextResponse.json({
    endpoint: "Blog generation API",
    method: "POST to generate a new blog post",
    auth: "Bearer token required (BLOG_GENERATION_SECRET)",
    status: "ready",
  })
}
