/**
 * Admin Tweet Generator
 *
 * Generate AI tweets, copy them, and post manually to Twitter.
 */

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ContentQueueClient } from "./content-queue-client"

export const dynamic = "force-dynamic"

export default async function AdminContentPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  // Fetch pending content items only
  const pendingItems = await prisma.contentItem.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  // Get count of pending items
  const pendingCount = await prisma.contentItem.count({
    where: { status: "pending" },
  })

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <ContentQueueClient
        initialPending={pendingItems}
        statusCounts={{ pending: pendingCount }}
      />
    </div>
  )
}
