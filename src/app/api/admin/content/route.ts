/**
 * Admin API: Content Management
 *
 * Endpoints for managing content queue (approve, reject, edit).
 * Protected by auth - only accessible to authenticated users.
 */

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ===== GET: List content items =====

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") || "pending"
  const limit = parseInt(searchParams.get("limit") || "50")

  const items = await prisma.contentItem.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      topic: true,
      content: true,
      status: true,
      createdAt: true,
      approvedAt: true,
      publishedAt: true,
      publishedId: true,
      error: true,
    },
  })

  // Get counts by status
  const counts = await prisma.contentItem.groupBy({
    by: ["status"],
    _count: { status: true },
  })

  const statusCounts = counts.reduce(
    (acc: Record<string, number>, c: { status: string; _count: { status: number } }) => {
      acc[c.status] = c._count.status
      return acc
    },
    {} as Record<string, number>
  )

  return NextResponse.json({ items, counts: statusCounts })
}

// ===== POST: Create manual content =====

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { type, topic, content } = body

  if (!type || !topic || !content) {
    return NextResponse.json(
      { error: "Missing required fields: type, topic, content" },
      { status: 400 }
    )
  }

  const item = await prisma.contentItem.create({
    data: {
      type,
      topic,
      content: typeof content === "string" ? content : JSON.stringify(content),
      status: "pending",
      generatedBy: "manual",
    },
  })

  return NextResponse.json({ id: item.id })
}

// ===== PATCH: Update content item (approve, reject, edit) =====

export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { id, action, content } = body

  if (!id || !action) {
    return NextResponse.json(
      { error: "Missing required fields: id, action" },
      { status: 400 }
    )
  }

  // Verify item exists
  const existing = await prisma.contentItem.findUnique({
    where: { id },
  })

  if (!existing) {
    return NextResponse.json({ error: "Content item not found" }, { status: 404 })
  }

  switch (action) {
    case "approve":
      await prisma.contentItem.update({
        where: { id },
        data: {
          status: "approved",
          approvedAt: new Date(),
          ...(content ? { content: typeof content === "string" ? content : JSON.stringify(content) } : {}),
        },
      })
      break

    case "reject":
      await prisma.contentItem.update({
        where: { id },
        data: { status: "rejected" },
      })
      break

    case "edit":
      if (!content) {
        return NextResponse.json(
          { error: "Content is required for edit action" },
          { status: 400 }
        )
      }
      await prisma.contentItem.update({
        where: { id },
        data: {
          content: typeof content === "string" ? content : JSON.stringify(content),
        },
      })
      break

    case "requeue":
      // Move back to pending (e.g., after failure)
      await prisma.contentItem.update({
        where: { id },
        data: {
          status: "pending",
          error: null,
          publishedAt: null,
          publishedId: null,
        },
      })
      break

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      )
  }

  return NextResponse.json({ success: true })
}

// ===== DELETE: Delete content item =====

export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 })
  }

  await prisma.contentItem.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}
