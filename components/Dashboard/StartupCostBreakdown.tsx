import { fmtMoney } from '@/lib/format'
import type { AnalysisResult, StartupCostLineItem } from '@/types/analysis'

export function StartupCostBreakdown({ result }: { result: AnalysisResult }) {
  const { startupCost } = result
  const adjusted = startupCost.conditionApplied
  const delta = startupCost.mid - startupCost.baselineMid

  return (
    <div className="startup-cost-card surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Cost to open
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtMoney(startupCost.low)} – {fmtMoney(startupCost.high)} range
        </span>
      </div>

      {adjusted && (
        <p className="mb-3 text-xs text-muted-foreground">
          Buildout is scaled to the assessed condition of the space. At the flat $/sf rate:{' '}
          <span className="tabular-nums text-foreground">{fmtMoney(startupCost.baselineMid)}</span>
          {Math.abs(delta) > 1 && (
            <span className={delta > 0 ? 'text-caution' : 'text-good'}>
              {' '}
              ({delta > 0 ? '+' : '−'}
              {fmtMoney(Math.abs(delta))})
            </span>
          )}
          .
        </p>
      )}

      <div className="-mx-2.5 text-sm tabular-nums">
        {startupCost.breakdown.map((item) => (
          <Row key={item.label} item={item} />
        ))}
        <div className="mt-1.5 flex justify-between rounded-md bg-field px-2.5 py-2">
          <span className="font-semibold text-foreground">Total cost to open</span>
          <span className="font-display font-semibold tabular-nums text-foreground">{fmtMoney(startupCost.mid)}</span>
        </div>
      </div>
    </div>
  )
}

function Row({ item }: { item: StartupCostLineItem }) {
  const m = item.multiplier
  const showMult = typeof m === 'number' && Math.abs(m - 1) > 0.01
  const tone =
    m == null ? '' : m === 0 ? 'text-good' : m < 1 ? 'text-good' : m > 1.25 ? 'text-risk' : 'text-caution'

  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 odd:bg-muted/40">
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <span className="truncate" title={item.note}>
          {item.label}
        </span>
        {showMult && (
          <span className={`shrink-0 rounded-sm bg-field px-1 text-[10px] tabular-nums ${tone}`} title={item.note}>
            ×{m!.toFixed(2).replace(/\.?0+$/, '')}
          </span>
        )}
      </span>
      <span className="shrink-0 tabular-nums text-foreground">{fmtMoney(item.amount)}</span>
    </div>
  )
}
