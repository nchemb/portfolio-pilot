import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/((?!clerk|stripe|cron|health).*)", // All API routes except webhooks, cron, and health
])

// Public API routes (webhooks, cron jobs, health checks)
const isPublicApiRoute = createRouteMatcher([
  "/api/clerk/webhook",
  "/api/stripe/webhook",
  "/api/cron/(.*)",
  "/api/health",
])

export default clerkMiddleware(async (auth, req) => {
  // Skip auth for public API routes
  if (isPublicApiRoute(req)) {
    return
  }

  // Protect dashboard and API routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
