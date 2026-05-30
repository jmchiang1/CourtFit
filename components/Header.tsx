'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { SignInDialog } from './SignInDialog'
import { UserMenu } from './UserMenu'

/**
 * App header. Rendered by HomeGate over the dashboard (signed-in or demo), not
 * on the splash. `email` is resolved server-side and passed in, so this stays a
 * plain client component.
 */
export function Header({ email }: { email: string | null }) {
  return (
    <header className="app-header sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="max-w-[95vw] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          aria-label="CourtFit home"
          className="group inline-flex items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Logo markClassName="transition group-hover:scale-105" />
        </Link>
        <div className="flex items-center gap-2">
          {email ? (
            <UserMenu email={email} />
          ) : (
            <SignInDialog>
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </SignInDialog>
          )}
        </div>
      </div>
    </header>
  )
}
