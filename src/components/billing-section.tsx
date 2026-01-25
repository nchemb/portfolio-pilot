"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type SubscriptionStatus =
  | "active"
  | "trialing"
  | "canceling"
  | "canceled"
  | "past_due"
  | null

interface BillingSectionProps {
  subscriptionStatus: SubscriptionStatus
  subscriptionEndsAt: Date | null
  hasStripeCustomer: boolean
}

export function BillingSection({
  subscriptionStatus,
  subscriptionEndsAt,
  hasStripeCustomer,
}: BillingSectionProps) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [localStatus, setLocalStatus] = useState(subscriptionStatus)
  const [localEndsAt, setLocalEndsAt] = useState(subscriptionEndsAt)

  const isActive = localStatus === "active" || localStatus === "trialing"
  const isCanceling = localStatus === "canceling"

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" })
      if (!response.ok) {
        throw new Error("Failed to create portal session")
      }
      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error("Error opening billing portal:", error)
    } finally {
      setPortalLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setCancelLoading(true)
    try {
      const response = await fetch("/api/stripe/cancel", { method: "POST" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription")
      }

      setLocalStatus("canceling")
      if (data.cancelAt) {
        setLocalEndsAt(new Date(data.cancelAt))
      }
    } catch (error) {
      console.error("Error canceling subscription:", error)
    } finally {
      setCancelLoading(false)
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return null
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date))
  }

  if (!hasStripeCustomer) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
        <CardDescription>Manage your subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isActive && (
          <>
            <p className="text-sm text-muted-foreground">
              You have an active Pro subscription
              {localEndsAt && ` that renews on ${formatDate(localEndsAt)}`}.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={portalLoading}
              >
                {portalLoading ? "Loading..." : "Update payment method"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" disabled={cancelLoading}>
                    {cancelLoading ? "Processing..." : "Cancel subscription"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You&apos;ll continue to have access until the end of your
                      billing period
                      {localEndsAt && ` (${formatDate(localEndsAt)})`}. You can
                      reactivate anytime before then.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelSubscription}>
                      Yes, cancel
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}

        {isCanceling && (
          <>
            <p className="text-sm text-muted-foreground">
              Your subscription has been canceled. You&apos;ll have access until{" "}
              {formatDate(localEndsAt) || "the end of your billing period"}.
            </p>
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? "Loading..." : "Reactivate subscription"}
            </Button>
          </>
        )}

        {localStatus === "past_due" && (
          <>
            <p className="text-sm text-muted-foreground">
              Your payment is past due. Please update your payment method to
              continue your subscription.
            </p>
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? "Loading..." : "Update payment method"}
            </Button>
          </>
        )}

        {(localStatus === "canceled" || !localStatus) && (
          <p className="text-sm text-muted-foreground">
            You don&apos;t have an active subscription.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
