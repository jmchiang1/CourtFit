import { useMemo } from 'react'
import { analyzeCompetition, type CompetitorSite } from '@/lib/competition'
import { computeWhitespace, type WhitespaceSport } from '@/lib/whitespace'
import type { Demographics, FitLabel } from '@/types/demographics'
import type { Assumptions } from '@/types/analysis'

const TONE: Record<FitLabel, { text: string; chip: string; bar: string }> = {
  Strong: { text: 'text-emerald-300', chip: 'bg-emerald-400/10 ring-1 ring-emerald-400/25', bar: 'bg-emerald-400' },
  Moderate: { text: 'text-amber-300', chip: 'bg-amber-400/10 ring-1 ring-amber-400/25', bar: 'bg-amber-400' },
  Weak: { text: 'text-rose-300', chip: 'bg-rose-400/10 ring-1 ring-rose-400/25', bar: 'bg-rose-400' },
}

function WhitespaceCard({
  sport,
  demandFit,
  ws,
}: {
  sport: string
  demandFit: number
  ws: WhitespaceSport
}) {
  const t = TONE[ws.label]
  return (
    <div className={`rounded-lg px-4 py-3 ${t.chip}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{sport}</span>
        <span className={`text-xs font-semibold ${t.text}`}>{ws.label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-2xl font-semibold tabular-nums ${t.text}`}>{ws.score}</span>
        <span className="text-xs text-muted-foreground">/ 100 whitespace</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full ${t.bar}`} style={{ width: `${ws.score}%` }} />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
        {demandFit} demand × {ws.competitors} {ws.competitors === 1 ? 'competitor' : 'competitors'}
        {ws.factor < 1 && <> · ×{ws.factor.toFixed(2)} competition</>}
      </div>
    </div>
  )
}

export function CompetitionPanel({
  lat,
  lng,
  demographics,
  assumptions,
  sites,
}: {
  lat: number | null
  lng: number | null
  demographics: Demographics | null
  assumptions: Assumptions
  sites: CompetitorSite[]
}) {
  const data = useMemo(() => {
    if (lat == null || lng == null || !demographics) return null
    const competition = analyzeCompetition(lat, lng, sites)
    const adultPopulation = Math.round(demographics.totalPopulation * demographics.age.adult18to64Share)
    const whitespace = computeWhitespace({
      badmintonFit: demographics.badmintonFit.score,
      pickleballFit: demographics.pickleballFit.score,
      targetPopulation: demographics.ethnicity.targetAsian,
      adultPopulation,
      badmintonCompetitors: competition.badmintonCompetitors,
      pickleballCompetitors: competition.pickleballCompetitors,
      badmintonMixPct: assumptions.badmintonMixPct,
      pickleballMixPct: assumptions.pickleballMixPct,
    })
    return { competition, whitespace }
  }, [lat, lng, demographics, assumptions, sites])

  if (!data) {
    return (
      <div className="competition-card surface p-5">
        <h3 className="text-sm font-semibold tracking-tight mb-3">Competition &amp; whitespace</h3>
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center">
          <div className="text-sm text-muted-foreground">Not available yet.</div>
          <div className="text-xs text-muted-foreground mt-1">
            Needs a mappable address and its trade-area demographics.
          </div>
        </div>
      </div>
    )
  }

  const { competition: c, whitespace: w } = data

  return (
    <div className="competition-card surface p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Competition &amp; whitespace</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {c.totalWithin} within {c.radiusMiles} mi
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <WhitespaceCard sport="Badminton" demandFit={demographics!.badmintonFit.score} ws={w.badminton} />
        <WhitespaceCard sport="Pickleball" demandFit={demographics!.pickleballFit.score} ws={w.pickleball} />
      </div>

      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-muted-foreground">
          {c.badmintonCompetitors} badminton · {c.pickleballCompetitors} pickleball nearby
        </span>
        {c.nearest && (
          <span className="tabular-nums text-muted-foreground">
            Nearest {c.nearest.miles.toFixed(1)} mi
          </span>
        )}
      </div>

      {c.nearby.length > 0 ? (
        <div className="space-y-1">
          {c.nearby.slice(0, 4).map((n) => (
            <div key={n.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground/90">{n.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{n.miles.toFixed(1)} mi</span>
            </div>
          ))}
          {c.nearby.length > 4 && (
            <div className="text-[11px] text-muted-foreground">+{c.nearby.length - 4} more within {c.radiusMiles} mi</div>
          )}
        </div>
      ) : (
        <p className="text-xs text-emerald-300">No competing facilities within {c.radiusMiles} mi — open court.</p>
      )}
    </div>
  )
}
