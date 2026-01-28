/**
 * MDX Utility Functions
 *
 * Handles reading and parsing MDX files from the content directory.
 * Used by blog pages for static generation.
 */

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import readingTime from "reading-time"

const CONTENT_DIR = path.join(process.cwd(), "src/content/blog")

export type BlogPost = {
  slug: string
  title: string
  description: string
  content: string
  publishedAt: string
  readingTime: string
  primaryKeyword: string
  secondaryKeywords: string[]
  geoTarget?: string
}

export type BlogPostMeta = Omit<BlogPost, "content">

/**
 * Get all published blog posts from the content directory.
 * Returns posts sorted by publish date (newest first).
 */
export async function getAllPosts(): Promise<BlogPostMeta[]> {
  if (!fs.existsSync(CONTENT_DIR)) {
    return []
  }

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"))

  const posts = files.map((filename) => {
    const filePath = path.join(CONTENT_DIR, filename)
    const fileContent = fs.readFileSync(filePath, "utf-8")
    const { data, content } = matter(fileContent)

    return {
      slug: filename.replace(".mdx", ""),
      title: data.title || "Untitled",
      description: data.description || "",
      publishedAt: data.publishedAt || new Date().toISOString().split("T")[0],
      readingTime: readingTime(content).text,
      primaryKeyword: data.primaryKeyword || "",
      secondaryKeywords: data.secondaryKeywords || [],
      geoTarget: data.geoTarget,
    }
  })

  // Sort by publish date, newest first
  return posts.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

/**
 * Get a single blog post by slug.
 * Returns the full post including content.
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  const fileContent = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(fileContent)

  return {
    slug,
    title: data.title || "Untitled",
    description: data.description || "",
    content,
    publishedAt: data.publishedAt || new Date().toISOString().split("T")[0],
    readingTime: readingTime(content).text,
    primaryKeyword: data.primaryKeyword || "",
    secondaryKeywords: data.secondaryKeywords || [],
    geoTarget: data.geoTarget,
  }
}

/**
 * Get all post slugs for static generation.
 */
export async function getAllPostSlugs(): Promise<string[]> {
  if (!fs.existsSync(CONTENT_DIR)) {
    return []
  }

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(".mdx", ""))
}

/**
 * Check if a post exists by slug.
 */
export async function postExists(slug: string): Promise<boolean> {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`)
  return fs.existsSync(filePath)
}
