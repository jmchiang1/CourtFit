'use client'

import { Ruler, LineChart, Users, MapPin, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroCourt } from '@/components/HeroCourt'
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

// Each copy element rises + fades in (see `.splashRise` in globals.css). The
// per-element stagger is set via an inline animation-delay below.
const RISE = 'splashRise'

export function Splash({ onTry }: { onTry: () => void }) {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      {/* ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[44rem] w-[44rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-14 px-6 py-16">
        {/* hero — two-column on desktop */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* copy */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <h1
              className={`text-balance text-4xl font-semibold tracking-tight sm:text-5xl ${RISE}`}
              style={{ animationDelay: '60ms' }}
            >
              Find the right space for your{' '}
              <span className="bg-gradient-to-br from-primary to-[var(--chart-3)] bg-clip-text text-transparent">
                courts
              </span>
              .
            </h1>

            <p
              className={`mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg ${RISE}`}
              style={{ animationDelay: '200ms' }}
            >
              CourtFit turns any commercial listing into an instant verdict — square footage,
              ceiling height, build-out cost, NOI and local demand for racket sports, all on one
              screen.
            </p>

            <div
              className={`mt-8 flex flex-col items-center gap-3 sm:flex-row ${RISE}`}
              style={{ animationDelay: '280ms' }}
            >
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
          </div>

          {/* animated hero court — drops in from above and eases into place */}
          <div className="heroCourtDrop" style={{ animationDelay: '240ms' }}>
            <HeroCourt />
          </div>
        </div>

        {/* feature cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }, idx) => (
            <div
              key={title}
              className={`surface p-4 text-left transition-colors hover:bg-white/[0.03] ${RISE}`}
              style={{ animationDelay: `${440 + idx * 80}ms` }}
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-medium">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
