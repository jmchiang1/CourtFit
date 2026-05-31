import { fmtMoney } from '@/lib/format'
import type { AnalysisResult, StartupCostLineItem } from '@/types/analysis'

export function StartupCostBreakdown({ result }: { result: AnalysisResult }) {
  const { startupCost } = result
  const adjusted = startupCost.conditionApplied
  const delta = startupCost.mid - startupCost.baselineMid

  return (
    <div className="startup-cost-card surface p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">
          {adjusted ? 'Renovation — condition-adjusted' : 'Startup cost breakdown'}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtMoney(startupCost.low)} – {fmtMoney(startupCost.high)} range
        </span>
      </div>

      {adjusted && (
        <p className="mb-3 text-xs text-muted-foreground">
          Scaled to the assessed condition of the space. Flat baseline:{' '}
          <span className="tabular-nums text-foreground">{fmtMoney(startupCost.baselineMid)}</span>
          {Math.abs(delta) > 1 && (
            <span className={delta > 0 ? 'text-amber-300' : 'text-emerald-300'}>
              {' '}
              ({delta > 0 ? '+' : '−'}
              {fmtMoney(Math.abs(delta))})
            </span>
          )}
          .
        </p>
      )}

      <div className="text-sm tabular-nums">
        {startupCost.breakdown.map((item) => (
          <Row key={item.label} item={item} />
        ))}
        <div className="h-2" />
        <div className="flex justify-between py-1.5">
          <span className="font-semibold text-foreground">Total (mid estimate)</span>
          <span className="font-semibold tabular-nums text-foreground">{fmtMoney(startupCost.mid)}</span>
        </div>
      </div>
    </div>
  )
}

function Row({ item }: { item: StartupCostLineItem }) {
  const m = item.multiplier
  const showMult = typeof m === 'number' && Math.abs(m - 1) > 0.01
  const tone =
    m == null ? '' : m === 0 ? 'text-emerald-300' : m < 1 ? 'text-emerald-300' : m > 1.25 ? 'text-rose-300' : 'text-amber-300'

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <span className="truncate" title={item.note}>
          {item.label}
        </span>
        {showMult && (
          <span className={`shrink-0 rounded bg-white/5 px-1 text-[10px] tabular-nums ${tone}`} title={item.note}>
            ×{m!.toFixed(2).replace(/\.?0+$/, '')}
          </span>
        )}
      </span>
      <span className="shrink-0 tabular-nums text-foreground">{fmtMoney(item.amount)}</span>
    </div>
  )
}
