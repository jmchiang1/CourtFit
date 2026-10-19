'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { signInWithGoogle } from '@/app/actions/auth'

const PERKS = [
  'Save every building you analyze, with its verdict',
  'Lay out courts on floor plans and keep them',
  'Track outreach status across your whole pipeline',
]

export function SignInDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setError(null)
      }}
    >
      <DialogTrigger render={children as React.ReactElement}></DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <div className="grid sm:grid-cols-[1fr_1.1fr]">
          {/* court-green side: what an account gets you */}
          <aside
            className="relative hidden flex-col justify-between overflow-hidden p-8 text-white sm:flex"
            style={{ background: '#1f6a4e', '--logo-court': '#fff', '--logo-lines': '#1f6a4e' } as React.CSSProperties}
          >
            <svg
              aria-hidden
              viewBox="0 0 20 44"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] text-white opacity-[0.11]"
              fill="none"
              stroke="currentColor"
            >
              {[
                'M0 0H20V44H0Z',
                'M1.5 0V44M18.5 0V44',
                'M0 2.5H20M0 41.5H20M0 15.5H20M0 28.5H20',
                'M10 0V15.5M10 28.5V44',
              ].map((d) => (
                <path key={d} d={d} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              ))}
              <path d="M0 22H20" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            </svg>

            <Logo className="relative text-white" />
            <div className="relative mt-24">
              <p className="font-display text-2xl leading-tight font-bold">
                Keep your pipeline in one place.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-white/85">
                {PERKS.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-line" strokeWidth={2.5} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* sign-in side */}
          <div className="flex flex-col justify-center p-8 sm:px-10 sm:py-14">
            <DialogHeader className="gap-2">
              <DialogTitle className="text-2xl">Sign in to CourtFit</DialogTitle>
              <DialogDescription className="text-base">
                Use your Google account. New here? Signing in creates your account.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-8 space-y-3">
              <GoogleButton onError={setError} />
              {error && (
                <p role="alert" className="text-sm text-risk">
                  {error}
                </p>
              )}
            </div>

            <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
              Just looking? The demo works without an account. Nothing you change there is saved.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Sends the browser to Google's sign-in page; Google returns to /api/auth/callback. */
function GoogleButton({ onError }: { onError: (m: string | null) => void }) {
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={pending}
      className="w-full gap-2"
      onClick={() => {
        onError(null)
        start(async () => {
          // On success the action redirects to Google and never returns.
          const r = await signInWithGoogle()
          if (r?.error) onError(r.error)
        })
      }}
    >
      <GoogleIcon />
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  )
}
