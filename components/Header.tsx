import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SignInDialog } from './SignInDialog'
import { UserMenu } from './UserMenu'

export async function Header() {
  let user = null
  try {
    const sb = await createSupabaseServerClient()
    const r = await sb.auth.getUser()
    user = r.data.user
  } catch {
    // no Supabase configured — render unauthenticated state
  }

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
          {user?.email ? (
            <UserMenu email={user.email} />
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
