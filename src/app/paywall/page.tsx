import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { PaywallContent } from "./paywall-content"

export default async function PaywallPage() {
  const { userId } = await auth()

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    })

    const isSubscribed =
      user?.subscriptionStatus === "active" ||
      user?.subscriptionStatus === "trialing" ||
      user?.subscriptionStatus === "canceling"

    if (isSubscribed) {
      redirect("/dashboard")
    }
  }

  return <PaywallContent />
}
