import Image from "next/image"
import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
      <div className="mb-8">
        <Image
          src="/logo.png"
          alt="PortfolioFlow logo"
          width={160}
          height={40}
          priority
        />
      </div>
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
        routing="path"
        path="/signup"
        signInUrl="/login"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  )
}
