"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "error"

type Toast = {
  id: string
  message: string
  variant: ToastVariant
}

type ToastContextValue = {
  toasts: Toast[]
  addToast: (message: string, variant?: ToastVariant) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, variant }])

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-3 rounded-md px-4 py-3 text-sm shadow-lg",
            "animate-in slide-in-from-right-full duration-200",
            toast.variant === "success" && "bg-emerald-600 text-white",
            toast.variant === "error" && "bg-destructive text-destructive-foreground",
            toast.variant === "default" && "bg-foreground text-background"
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// Utility component for banners (replaces raw error text)
export function Banner({
  variant = "default",
  children,
}: {
  variant?: "default" | "success" | "error" | "warning"
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-md px-4 py-3 text-sm",
        variant === "success" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
        variant === "error" && "bg-destructive/10 text-destructive border border-destructive/20",
        variant === "warning" && "bg-amber-50 text-amber-800 border border-amber-200",
        variant === "default" && "bg-muted text-muted-foreground border border-border"
      )}
    >
      {children}
    </div>
  )
}
