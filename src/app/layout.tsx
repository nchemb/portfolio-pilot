import { type Metadata } from 'next'
import Link from 'next/link'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import { ToastProvider } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Portfolio Copilot',
  description: 'Track your portfolio with AI-powered insights grounded in real data.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ToastProvider>
            <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <Link href="/" className="font-semibold text-lg tracking-tight">
                Portfolio Copilot
              </Link>
              <div className="flex items-center gap-4">
                <SignedOut>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Log in
                  </Link>
                  <Button asChild>
                    <Link href="/signup">Start free</Link>
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button variant="ghost" asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                  <UserButton />
                </SignedIn>
              </div>
            </header>
            {children}
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
