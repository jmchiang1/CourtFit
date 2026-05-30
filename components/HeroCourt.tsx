'use client'

import { useEffect, useState } from 'react'
import { CourtIllustration, type CourtVariant } from '@/components/CourtIllustration'

const SPORTS: { variant: CourtVariant; label: string }[] = [
  { variant: 'pickleball', label: 'Pickleball' },
  { variant: 'badminton', label: 'Badminton' },
  { variant: 'tennis', label: 'Tennis' },
]

/**
 * The splash hero: an isometric court that crossfades through pickleball,
 * badminton and tennis, with floating product chips and clickable sport dots.
 */
export function HeroCourt() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % SPORTS.length), 3200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-lg">
      {/* glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-6 -z-10 h-48 rounded-full bg-primary/25 blur-[90px]"
      />

      {/* crossfading courts */}
      <div className="relative aspect-[460/310]">
        {SPORTS.map((s, idx) => (
          <div
            key={s.variant}
            className="absolute inset-0 transition-opacity duration-1000 ease-out"
            style={{ opacity: idx === active ? 1 : 0 }}
            aria-hidden={idx !== active}
          >
            <CourtIllustration variant={s.variant} className="drop-shadow-2xl" />
          </div>
        ))}

        {/* floating product chips */}
        <div
          className="heroFloat surface absolute -left-2 top-2 hidden items-center gap-2 rounded-xl px-3 py-2 text-xs shadow-xl backdrop-blur sm:flex"
          style={{ animationDelay: '0.2s' }}
        >
          <span className="size-2 rounded-full bg-emerald-400" />
          <span>
            <span className="font-semibold tabular-nums">92</span>{' '}
            <span className="text-muted-foreground">Demand fit</span>
          </span>
        </div>
        <div
          className="heroFloat surface absolute -right-1 bottom-8 hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs shadow-xl backdrop-blur sm:flex"
          style={{ animationDelay: '0.9s', animationDuration: '6s' }}
        >
          <span className="font-semibold tabular-nums">$182k</span>
          <span className="text-muted-foreground">NOI / yr</span>
        </div>
      </div>

      {/* sport caption */}
      <div className="relative mt-5 h-5">
        {SPORTS.map((s, idx) => (
          <span
            key={s.variant}
            className="absolute inset-x-0 text-center text-sm font-medium tracking-tight transition-opacity duration-700"
            style={{ opacity: idx === active ? 1 : 0 }}
            aria-hidden={idx !== active}
          >
            {s.label} court
          </span>
        ))}
      </div>

      {/* sport dots */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {SPORTS.map((s, idx) => (
          <button
            key={s.variant}
            type="button"
            onClick={() => setActive(idx)}
            aria-label={`Show ${s.label} court`}
            className={`h-1.5 rounded-full transition-all ${
              idx === active ? 'w-5 bg-primary' : 'w-1.5 bg-foreground/20 hover:bg-foreground/40'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
