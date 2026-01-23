import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    // First verify the brokerage exists and belongs to the user
    const brokerage = await prisma.brokerageAccount.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!brokerage) {
      return NextResponse.json(
        { error: "Brokerage account not found" },
        { status: 404 }
      )
    }

    if (brokerage.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this brokerage account" },
        { status: 403 }
      )
    }

    // Delete the brokerage account
    // Holdings and snapshots will be cascade deleted due to schema configuration
    await prisma.brokerageAccount.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting brokerage account:", error)
    return NextResponse.json(
      { error: "Failed to delete brokerage account" },
      { status: 500 }
    )
  }
}
