import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { plaidClient, plaidConfigReady } from "@/lib/plaid"

export async function POST() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!plaidConfigReady()) {
    return NextResponse.json(
      { error: "Plaid env vars are missing." },
      { status: 500 }
    )
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: "Portfolio Copilot",
      products: ["investments"],
      language: "en",
      country_codes: ["US"],
      redirect_uri: process.env.PLAID_REDIRECT_URI || undefined,
    })

    return NextResponse.json({ link_token: response.data.link_token })
  } catch (error) {
    console.error("Plaid link token error:", error)
    return NextResponse.json(
      { error: "Unable to create link token." },
      { status: 500 }
    )
  }
}
