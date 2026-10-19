import { fmtMoney, fmtPct } from '@/lib/format'
import { DRIVE_MINUTES } from '@/lib/catchment'
import type { Demographics, FitLabel } from '@/types/demographics'

const fitTone: Record<FitLabel, { text: string; bar: string }> = {
  Strong: { text: 'text-good', bar: 'bg-good' },
  Moderate: { text: 'text-caution', bar: 'bg-caution' },
  Weak: { text: 'text-risk', bar: 'bg-risk' },
}

/** Single badminton demand score: number on the left, bar + context on the right. */
function FitScoreRow({
  title,
  score,
  label,
  hint,
}: {
  title: string
  score: number
  label: FitLabel
  hint: string
}) {
  const t = fitTone[label]
  return (
    <div className="flex items-center gap-5 py-3">
      <div className="shrink-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="min-w-0 leading-snug text-muted-foreground">{hint}</span>
          <span className={`shrink-0 font-medium ${t.text}`}>{label}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  )
}

function ShareRow({ label, count, share }: { label: string; count: number; share: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">
          {fmtPct(share)} <span className="text-muted-foreground">· {count.toLocaleString()}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
    </div>
  )
}

export function DemographicsPanel({ demographics }: { demographics: Demographics | null }) {
  if (!demographics) {
    return (
      <div className="surface p-5">
        <h3 className="font-display text-sm font-semibold text-foreground mb-3">Demand — trade area</h3>
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <div className="text-sm text-muted-foreground">Demographics not available yet.</div>
          <div className="text-xs text-muted-foreground mt-1">
            They’re fetched automatically once the property has a mappable address.
          </div>
        </div>
      </div>
    )
  }

  const d = demographics
  const e = d.ethnicity
  const isDrive = d.mode === 'drive'
  const driveMinutes = d.catchments?.badminton.driveMinutes ?? DRIVE_MINUTES

  return (
    <div className="surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-sm font-semibold text-foreground">
          {isDrive ? `Demand — ${driveMinutes}-min drive` : `Demand — ${d.radiusMiles}-mile radius`}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {d.totalPopulation.toLocaleString()} people · {d.tractCount} tracts · ACS {d.vintage}
        </span>
      </div>

      <div className="mb-4 border-y border-border">
        <FitScoreRow
          title="Badminton demand"
          score={d.badmintonFit.score}
          label={d.badmintonFit.label}
          hint={`${fmtPct(e.targetShare)} East + South Asian · ${fmtPct(d.age.prime18to44Share)} aged 18–44`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-2.5">
          <div className="text-xs font-medium text-foreground">
            Target communities
          </div>
          <ShareRow label="East Asian" count={e.eastAsian} share={e.eastAsianShare} />
          <ShareRow label="South Asian" count={e.southAsian} share={e.southAsianShare} />
          <ShareRow label="Combined target" count={e.targetAsian} share={e.targetShare} />
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-medium text-foreground">
            Income &amp; age
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Mean household income</span>
            <span className="tabular-nums text-foreground">
              {d.meanHouseholdIncome != null ? fmtMoney(d.meanHouseholdIncome) : '—'}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Adults 18–44</span>
            <span className="tabular-nums text-foreground">{fmtPct(d.age.prime18to44Share)}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Adults 18–64</span>
            <span className="tabular-nums text-foreground">{fmtPct(d.age.adult18to64Share)}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Under 18 / 65+</span>
            <span className="tabular-nums text-foreground">
              {fmtPct(d.age.under18 / d.totalPopulation)} / {fmtPct(d.age.senior65plus / d.totalPopulation)}
            </span>
          </div>
        </div>
      </div>

      {isDrive && (
        <p className="mt-4 border-t border-border pt-3 text-xs leading-snug text-muted-foreground">
          Figures cover the area reachable within a {driveMinutes}-minute drive — it follows roads and
          water, not a straight-line radius.
        </p>
      )}
    </div>
  )
}
