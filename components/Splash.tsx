'use client'

import { Ruler, LineChart, Users, MapPin, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/Logo'
import { SignInDialog } from '@/components/SignInDialog'

const FEATURES = [
  {
    icon: Ruler,
    title: 'Space diligence',
    body: 'Clear height, square footage, parking and loading — auto-checked against what a court build needs.',
  },
  {
    icon: LineChart,
    title: 'Deal math',
    body: 'Court count, NOI, renovation cost and payback period, modeled the moment you paste a listing.',
  },
  {
    icon: Users,
    title: 'Demand signal',
    body: '5-mile trade-area demographics scored for badminton and pickleball fit.',
  },
  {
    icon: MapPin,
    title: 'Pipeline map',
    body: 'Every property you’re tracking on one map, ranked by viability at a glance.',
  },
]

export function Splash({ onTry }: { onTry: () => void }) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20">
      {/* ambient brand glow behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/4 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
      />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="size-3.5 text-primary" />
          Racket-sport real-estate intelligence
        </div>

        <div className="relative mt-8">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-[1.6rem] bg-primary/30 blur-2xl"
          />
          <LogoMark className="size-16 drop-shadow-xl" />
        </div>

        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Find the right space for your{' '}
          <span className="bg-gradient-to-br from-primary to-[var(--chart-3)] bg-clip-text text-transparent">
            courts
          </span>
          .
        </h1>

        <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          CourtFit turns any commercial listing into an instant verdict — square footage,
          ceiling height, build-out cost, NOI and local demand for badminton &amp; pickleball, all
          on one screen.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <SignInDialog>
            <Button size="lg" className="h-11 px-5 text-sm">
              Get started — it’s free
            </Button>
          </SignInDialog>
          <Button
            variant="ghost"
            size="lg"
            className="h-11 gap-1.5 px-5 text-sm"
            onClick={onTry}
          >
            Try without an account
            <ArrowRight className="size-4" />
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          No credit card. Sample properties load instantly.
        </p>
      </div>

      <div className="relative z-10 mt-16 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="surface p-4 text-left transition-colors hover:bg-white/[0.03]"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-3 text-sm font-medium">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
