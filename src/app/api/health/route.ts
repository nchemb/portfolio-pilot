import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateEnv } from "@/lib/env"

export const dynamic = "force-dynamic"

type HealthStatus = "healthy" | "degraded" | "unhealthy"

type HealthCheck = {
  status: HealthStatus
  timestamp: string
  version: string
  checks: {
    database: { status: HealthStatus; latency?: number; error?: string }
    environment: { status: HealthStatus; missing?: string[] }
  }
}

export async function GET() {
  const startTime = Date.now()
  const checks: HealthCheck["checks"] = {
    database: { status: "healthy" },
    environment: { status: "healthy" },
  }

  // Check database connectivity
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.database.latency = Date.now() - dbStart
  } catch (error) {
    checks.database.status = "unhealthy"
    checks.database.error =
      error instanceof Error ? error.message : "Database connection failed"
  }

  // Check environment variables
  const envResult = validateEnv()
  if (!envResult.valid) {
    checks.environment.status = "unhealthy"
    checks.environment.missing = envResult.missing
  }

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status)
  let overallStatus: HealthStatus = "healthy"
  if (statuses.includes("unhealthy")) {
    overallStatus = "unhealthy"
  } else if (statuses.includes("degraded")) {
    overallStatus = "degraded"
  }

  const response: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    checks,
  }

  const statusCode = overallStatus === "healthy" ? 200 : 503

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}
