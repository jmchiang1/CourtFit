import { fmtMoney, fmtPct } from '@/lib/format'
import type { Demographics, FitLabel } from '@/types/demographics'

const fitTone: Record<FitLabel, { text: string; chip: string; bar: string }> = {
  Strong: { text: 'text-emerald-300', chip: 'bg-emerald-400/10 ring-1 ring-emerald-400/25', bar: 'bg-emerald-400' },
  Moderate: { text: 'text-amber-300', chip: 'bg-amber-400/10 ring-1 ring-amber-400/25', bar: 'bg-amber-400' },
  Weak: { text: 'text-rose-300', chip: 'bg-rose-400/10 ring-1 ring-rose-400/25', bar: 'bg-rose-400' },
}

function FitCard({
  sport,
  score,
  label,
  hint,
}: {
  sport: string
  score: number
  label: FitLabel
  hint: string
}) {
  const t = fitTone[label]
  return (
    <div className={`rounded-lg px-4 py-3 ${t.chip}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{sport}</span>
        <span className={`text-xs font-semibold ${t.text}`}>{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-2xl font-semibold tabular-nums ${t.text}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full ${t.bar}`} style={{ width: `${score}%` }} />
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{hint}</div>
    </div>
  )
}

function ShareRow({ label, count, share }: { label: string; count: number; share: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {fmtPct(share)} <span className="text-muted-foreground">· {count.toLocaleString()}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <div className="h-full bg-white/40" style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
    </div>
  )
}

export function DemographicsPanel({ demographics }: { demographics: Demographics | null }) {
  if (!demographics) {
    return (
      <div className="surface p-5">
        <h3 className="text-sm font-semibold tracking-tight mb-3">Demand — 5-mile radius</h3>
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center">
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

  return (
    <div className="surface p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Demand — {d.radiusMiles}-mile radius</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {d.totalPopulation.toLocaleString()} people · {d.tractCount} tracts · ACS {d.vintage}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <FitCard
          sport="Badminton"
          score={d.badmintonFit.score}
          label={d.badmintonFit.label}
          hint={`${fmtPct(e.targetShare)} East + South Asian`}
        />
        <FitCard
          sport="Pickleball"
          score={d.pickleballFit.score}
          label={d.pickleballFit.label}
          hint={`broad demand · ${fmtPct(d.age.adult18to64Share)} aged 18–64`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Target communities
          </div>
          <ShareRow label="East Asian" count={e.eastAsian} share={e.eastAsianShare} />
          <ShareRow label="South Asian" count={e.southAsian} share={e.southAsianShare} />
          <ShareRow label="Combined target" count={e.targetAsian} share={e.targetShare} />
        </div>

        <div className="space-y-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Income & age
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Mean household income</span>
            <span className="tabular-nums">
              {d.meanHouseholdIncome != null ? fmtMoney(d.meanHouseholdIncome) : '—'}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Adults 18–44</span>
            <span className="tabular-nums">{fmtPct(d.age.prime18to44Share)}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Adults 18–64</span>
            <span className="tabular-nums">{fmtPct(d.age.adult18to64Share)}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Under 18 / 65+</span>
            <span className="tabular-nums">
              {fmtPct(d.age.under18 / d.totalPopulation)} / {fmtPct(d.age.senior65plus / d.totalPopulation)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
