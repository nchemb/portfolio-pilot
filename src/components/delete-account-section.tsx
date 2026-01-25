"use client"

import { useClerk } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface DeleteAccountSectionProps {
  hasActiveSubscription: boolean
}

export function DeleteAccountSection({
  hasActiveSubscription,
}: DeleteAccountSectionProps) {
  const { openUserProfile } = useClerk()

  const handleDeleteAccount = () => {
    openUserProfile({
      appearance: {
        elements: {
          rootBox: { width: "100%" },
        },
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Manage your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {hasActiveSubscription
            ? "To delete your account, please cancel your subscription first."
            : "If you no longer need your account, you can delete it and all associated data."}
        </p>
        <Button
          variant="outline"
          onClick={handleDeleteAccount}
          disabled={hasActiveSubscription}
        >
          Delete account
        </Button>
      </CardContent>
    </Card>
  )
}
