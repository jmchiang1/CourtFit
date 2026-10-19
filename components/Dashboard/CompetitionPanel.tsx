import { useMemo } from 'react'
import { analyzeCompetition, type CompetitorSite } from '@/lib/competition'
import { computeWhitespace, type WhitespaceResult } from '@/lib/whitespace'
import type { Demographics, FitLabel } from '@/types/demographics'

const TONE: Record<FitLabel, { text: string; bar: string }> = {
  Strong: { text: 'text-good', bar: 'bg-good' },
  Moderate: { text: 'text-caution', bar: 'bg-caution' },
  Weak: { text: 'text-risk', bar: 'bg-risk' },
}

/** Badminton whitespace: score on the left, bar + how it was derived on the right. */
function WhitespaceRow({ demandFit, ws }: { demandFit: number; ws: WhitespaceResult }) {
  const t = TONE[ws.label]
  return (
    <div className="flex items-center gap-5 py-3">
      <div className="shrink-0">
        <div className="text-sm font-medium text-foreground">Badminton whitespace</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{ws.score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="min-w-0 leading-snug text-muted-foreground">
            {demandFit} demand
            {ws.factor < 1 ? <> · ×{ws.factor.toFixed(2)} for competition</> : <> · no competition discount</>}
          </span>
          <span className={`shrink-0 font-medium ${t.text}`}>{ws.label}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-panel">
          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${ws.score}%` }} />
        </div>
      </div>
    </div>
  )
}

export function CompetitionPanel({
  lat,
  lng,
  demographics,
  sites,
}: {
  lat: number | null
  lng: number | null
  demographics: Demographics | null
  sites: CompetitorSite[]
}) {
  const data = useMemo(() => {
    if (lat == null || lng == null || !demographics) return null
    const competition = analyzeCompetition(lat, lng, sites)
    const whitespace = computeWhitespace({
      badmintonFit: demographics.badmintonFit.score,
      targetPopulation: demographics.ethnicity.targetAsian,
      competitors: competition.badmintonCompetitors,
    })
    return { competition, whitespace }
  }, [lat, lng, demographics, sites])

  if (!data) {
    return (
      <div className="competition-card surface p-5">
        <h3 className="font-display text-sm font-semibold text-foreground mb-3">Competition &amp; whitespace</h3>
        <div className="rounded-xl bg-field/60 px-4 py-6 text-center">
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
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-foreground">Competition &amp; whitespace</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {c.badmintonCompetitors} badminton {c.badmintonCompetitors === 1 ? 'facility' : 'facilities'} within{' '}
          {c.radiusMiles} mi
        </span>
      </div>

      <div className="mb-5 rounded-lg bg-field px-4">
        <WhitespaceRow demandFit={demographics!.badmintonFit.score} ws={w} />
      </div>

      {c.nearby.length > 0 ? (
        <div>
          <div className="flex items-center justify-between gap-3 pb-1.5 text-xs">
            <span className="font-medium text-foreground">Nearby competitors</span>
            {c.nearest && (
              <span className="tabular-nums text-muted-foreground">
                Nearest {c.nearest.miles.toFixed(1)} mi
              </span>
            )}
          </div>
          <div className="-mx-2">
            {c.nearby.slice(0, 4).map((n) => (
              <div
                key={n.name}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs odd:bg-muted/60"
              >
                <span className="truncate text-foreground/80">{n.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{n.miles.toFixed(1)} mi</span>
              </div>
            ))}
          </div>
          {c.nearby.length > 4 && (
            <div className="pt-1.5 text-xs text-muted-foreground">+{c.nearby.length - 4} more within {c.radiusMiles} mi</div>
          )}
        </div>
      ) : (
        <p className="text-xs text-good">No competing badminton facilities within {c.radiusMiles} mi — open court.</p>
      )}
    </div>
  )
}
