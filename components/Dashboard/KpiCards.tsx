import { fmtMoney, fmtPct } from '@/lib/format'
import type { AnalysisResult } from '@/types/analysis'

/** Secondary numbers under the verdict: one ruled strip, not four cards. */
export function KpiCards({ result }: { result: AnalysisResult }) {
  const items: Array<{
    label: string
    value: string
    sub: string
    tone?: 'warn'
  }> = [
    {
      label: 'Gross revenue',
      value: fmtMoney(result.revenue.gross),
      sub: `${fmtMoney(result.monthlyRevenue)} a month`,
    },
    {
      label: 'Expenses',
      value: fmtMoney(result.expenses.total),
      sub: `${fmtMoney(result.expenses.rent)} of it rent`,
    },
    {
      label: 'Rent burden',
      value: fmtPct(result.rentBurden),
      sub: result.rentBurden > 0.3 ? 'Above the 30% guideline' : 'Within range',
      tone: result.rentBurden > 0.3 ? 'warn' : undefined,
    },
    {
      label: 'Revenue per sq ft',
      value: fmtMoney(result.revenuePerSqft),
      sub: 'Across total square footage',
    },
  ]

  return (
    <dl className="kpi-cards-row surface grid grid-cols-2 sm:grid-cols-4">
      {items.map((i, idx) => (
        <div
          key={i.label}
          className={`px-4 py-3.5 ${idx % 2 === 1 ? 'border-l' : ''} ${idx >= 2 ? 'border-t sm:border-t-0' : ''} ${idx === 2 ? 'sm:border-l' : ''}`}
        >
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd
            className={`font-display mt-1 text-lg font-semibold tabular-nums ${
              i.tone === 'warn' ? 'text-caution' : 'text-foreground'
            }`}
          >
            {i.value}
          </dd>
          <dd className="mt-0.5 text-xs text-muted-foreground tabular-nums">{i.sub}</dd>
        </div>
      ))}
    </dl>
  )
}
