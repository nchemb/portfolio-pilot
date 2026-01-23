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
    const cashAccount = await prisma.cashAccount.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!cashAccount) {
      return NextResponse.json(
        { error: "Cash account not found" },
        { status: 404 }
      )
    }

    if (cashAccount.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this cash account" },
        { status: 403 }
      )
    }

    await prisma.cashAccount.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting cash account:", error)
    return NextResponse.json(
      { error: "Failed to delete cash account" },
      { status: 500 }
    )
  }
}
