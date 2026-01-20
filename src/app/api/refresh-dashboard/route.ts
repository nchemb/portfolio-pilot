import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  revalidatePath("/dashboard")
  return NextResponse.json({ ok: true })
}
