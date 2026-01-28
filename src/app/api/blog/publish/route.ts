/**
 * API Route: Mark Blog Post as Published
 *
 * Called by GitHub Action after successfully committing the MDX file.
 * Updates the database status to "published".
 *
 * Security: Requires BLOG_GENERATION_SECRET bearer token.
 */

import { NextRequest, NextResponse } from "next/server"
import { markBlogPostPublished } from "@/server/blog/blog-generator"

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.BLOG_GENERATION_SECRET
  if (!secret) {
    console.error("[api/blog/publish] BLOG_GENERATION_SECRET not configured")
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
  // 1. Verify authorization
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 2. Parse request body
    const body = await request.json()
    const { slug } = body

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid slug" },
        { status: 400 }
      )
    }

    // 3. Mark as published
    await markBlogPostPublished(slug)

    return NextResponse.json({
      success: true,
      slug,
      publishedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[api/blog/publish] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
