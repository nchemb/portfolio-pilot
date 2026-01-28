"use client"

/**
 * Content Queue Client Component
 *
 * Interactive UI for reviewing and managing content.
 * Simplified for manual Twitter posting workflow.
 * Password protected for admin access.
 */

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

// Password for admin access - simple protection layer
const ADMIN_PASSWORD = "content"
const AUTH_STORAGE_KEY = "admin_content_auth"

// ===== TYPES =====

type ContentItem = {
  id: string
  type: string
  topic: string
  content: string
  status: string
  createdAt: Date
  approvedAt: Date | null
  publishedAt: Date | null
  publishedId: string | null
  error: string | null
}

type ContentQueueClientProps = {
  initialPending: ContentItem[]
  statusCounts: Record<string, number>
}

// ===== HELPER FUNCTIONS =====

function parseContent(content: string): { text?: string; tweets?: string[]; hashtags?: string[] } {
  try {
    return JSON.parse(content)
  } catch {
    return { text: content }
  }
}

/**
 * Get copyable text from parsed content (tweet text + hashtags)
 */
function getCopyableText(parsed: { text?: string; tweets?: string[]; hashtags?: string[] }): string {
  let text = ""

  if (parsed.text) {
    text = parsed.text
  } else if (parsed.tweets && parsed.tweets.length > 0) {
    // For threads, join all tweets with line breaks
    text = parsed.tweets.join("\n\n---\n\n")
  }

  if (parsed.hashtags && parsed.hashtags.length > 0) {
    const hashtagStr = parsed.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
    text = `${text}\n\n${hashtagStr}`
  }

  return text
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—"
  const d = new Date(date)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ===== COMPONENTS =====

function ContentCard({
  item,
  onDelete,
  onEdit,
  onRequeue,
  showActions = true,
}: {
  item: ContentItem
  onDelete?: (id: string) => void
  onEdit?: (id: string, content: string) => void
  onRequeue?: (id: string) => void
  showActions?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(item.content)
  const [copied, setCopied] = useState(false)
  const parsed = parseContent(item.content)

  const handleSaveEdit = () => {
    onEdit?.(item.id, editedContent)
    setIsEditing(false)
  }

  const handleCopy = async () => {
    const text = getCopyableText(parsed)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={item.type === "thread" ? "default" : "secondary"}>
              {item.type}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatDate(item.createdAt)}
            </span>
          </div>
          {item.status === "published" && item.publishedId && (
            <a
              href={`https://twitter.com/i/web/status/${item.publishedId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline"
            >
              View on Twitter
            </a>
          )}
        </div>
        <CardDescription className="text-xs mt-1">{item.topic}</CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditedContent(item.content)
                  setIsEditing(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {item.type === "tweet" && parsed.text && (
              <div className="bg-muted p-3 rounded-md">
                <p className="whitespace-pre-wrap">{parsed.text}</p>
                {parsed.hashtags && parsed.hashtags.length > 0 && (
                  <p className="text-blue-500 mt-2">
                    {parsed.hashtags.map((h) => `#${h}`).join(" ")}
                  </p>
                )}
              </div>
            )}
            {item.type === "thread" && parsed.tweets && (
              <div className="space-y-2">
                {parsed.tweets.map((tweet, i) => (
                  <div key={i} className="bg-muted p-3 rounded-md">
                    <span className="text-xs text-muted-foreground mb-1 block">
                      Tweet {i + 1}/{parsed.tweets!.length}
                    </span>
                    <p className="whitespace-pre-wrap">{tweet}</p>
                  </div>
                ))}
                {parsed.hashtags && parsed.hashtags.length > 0 && (
                  <p className="text-blue-500 text-sm">
                    {parsed.hashtags.map((h) => `#${h}`).join(" ")}
                  </p>
                )}
              </div>
            )}
            {item.error && (
              <div className="bg-red-50 text-red-700 p-2 rounded text-sm">
                Error: {item.error}
              </div>
            )}
          </div>
        )}

        {showActions && !isEditing && (
          <div className="flex gap-2 mt-4">
            {item.status === "pending" && (
              <>
                <Button
                  size="sm"
                  onClick={handleCopy}
                  variant={copied ? "secondary" : "default"}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete?.(item.id)}
                >
                  Posted
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete?.(item.id)}
                >
                  Discard
                </Button>
              </>
            )}
            {item.status === "failed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRequeue?.(item.id)}
              >
                Retry
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ===== PASSWORD GATE COMPONENT =====

function PasswordGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  const handleCheck = () => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, "true")
      onAuthenticated()
    } else {
      setError(true)
      setPassword("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleCheck()
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin Access</CardTitle>
          <CardDescription>Enter password to access the tweet generator.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(false)
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              autoComplete="off"
            />
            {error && (
              <p className="text-sm text-red-500">Incorrect password</p>
            )}
            <Button type="button" className="w-full" onClick={handleCheck}>
              Enter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== MAIN COMPONENT =====

export function ContentQueueClient({
  initialPending,
  statusCounts,
}: ContentQueueClientProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [pending, setPending] = useState(initialPending)
  const [counts, setCounts] = useState(statusCounts)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Check if already authenticated on mount
  useEffect(() => {
    const isAuthed = sessionStorage.getItem(AUTH_STORAGE_KEY) === "true"
    setIsAuthenticated(isAuthed)
    setIsCheckingAuth(false)
  }, [])

  // Show loading while checking auth
  if (isCheckingAuth) {
    return <div className="py-8 text-center text-muted-foreground">Loading...</div>
  }

  // Show password gate if not authenticated
  if (!isAuthenticated) {
    return <PasswordGate onAuthenticated={() => setIsAuthenticated(true)} />
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/admin/content?id=${id}`, {
        method: "DELETE",
      })

      setPending((prev) => prev.filter((p) => p.id !== id))
      setCounts((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
      }))
    } catch (error) {
      console.error("Failed to delete:", error)
    }
  }

  const handleEdit = async (id: string, content: string) => {
    try {
      await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "edit", content }),
      })

      setPending((prev) =>
        prev.map((p) => (p.id === id ? { ...p, content } : p))
      )
    } catch (error) {
      console.error("Failed to edit:", error)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateError(null)

    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        setGenerateError(data.error || "Failed to generate content")
        return
      }

      // Reload to show new content
      window.location.reload()
    } catch (error) {
      console.error("Failed to generate:", error)
      setGenerateError("Network error - please try again")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold mb-2">Tweet Generator</h1>
        <p className="text-muted-foreground">
          Generate AI tweets, copy them, and post manually to Twitter.
        </p>
      </div>

      {/* Generate Button */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Generate Tweets</CardTitle>
          <CardDescription>
            Generate 3 new tweets using AI. Copy them and post manually to Twitter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate 3 Tweets"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {counts.pending} tweets ready to post
            </span>
          </div>
          {generateError && (
            <p className="text-sm text-red-500 mt-2">{generateError}</p>
          )}
        </CardContent>
      </Card>

      {/* Tweet Queue */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Tweet Queue</h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No tweets in queue. Click &quot;Generate 3 Tweets&quot; to create some.
            </CardContent>
          </Card>
        ) : (
          pending.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))
        )}
      </div>
    </div>
  )
}
