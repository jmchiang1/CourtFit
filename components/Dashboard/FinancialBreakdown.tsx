'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { fmtMoney } from '@/lib/format'
import type { AnalysisResult } from '@/types/analysis'

// Chart colors come from the theme tokens (CSS vars), so the chart follows the
// light/dark toggle without re-rendering.
const CHART = {
  tick: 'var(--muted-foreground)',
  cursor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
  barTop: 'var(--court)',
  bar: 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)',
} as const

export function FinancialBreakdown({ result }: { result: AnalysisResult }) {
  const { revenue: r, expenses: e } = result
  const expenseData = [
    { name: 'Rent', value: e.rent },
    { name: 'Payroll', value: e.payroll },
    { name: 'Coach', value: e.coach },
    { name: 'Utilities', value: e.utilities },
    { name: 'Card fees', value: e.cardProcessing },
    { name: 'Admin', value: e.admin },
    { name: 'Repairs', value: e.repairs },
    { name: 'Insurance', value: e.insurance },
    { name: 'Other', value: e.marketing + e.contingency },
  ]
  const max = Math.max(...expenseData.map((d) => d.value))

  return (
    <div className="financial-breakdown-card surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Annual revenue &amp; expenses
        </h3>
        <span className="text-xs text-muted-foreground">At full booking (year 3 on)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="text-sm tabular-nums">
          <div className="-mx-2.5">
            <Row label="Court rentals" value={fmtMoney(r.courtRental)} />
            <Row label="Open play" value={fmtMoney(r.openPlay)} />
            <Row label="Coaching & clinics" value={fmtMoney(r.coaching)} />
            <Row label="Pro shop and F&B" value={fmtMoney(r.proShop + r.foodBeverage)} />
            <Row label="Card surcharge" value={fmtMoney(r.cardSurcharge)} />
            <Row label="Gross revenue" value={fmtMoney(r.gross)} bold />
          </div>
          <div className="h-3" />
          <div className="-mx-2.5">
            <Row label="Cost of goods sold" value={fmtMoney(result.costOfSales.total)} />
            <Row label="Operating expenses" value={fmtMoney(e.total)} />
            <Row
              label="Net operating income"
              value={fmtMoney(result.noi)}
              bold
              highlight={result.noi > 0 ? 'text-good' : 'text-risk'}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Year one, while bookings ramp up: {fmtMoney(result.yearOne.revenue)} revenue,{' '}
            <span className={result.yearOne.noi > 0 ? 'text-foreground' : 'text-risk'}>
              {fmtMoney(result.yearOne.noi)}
            </span>{' '}
            income. Before loan payments.
          </p>
        </div>
        <div className="h-48 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={expenseData} margin={{ left: 4, right: 4, top: 8 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: CHART.tick }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: CHART.tick }}
                tickFormatter={(v) => fmtMoney(v as number)}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: CHART.cursor }}
                contentStyle={{
                  background: 'var(--popover)',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow:
                    '0 1px 2px hsl(var(--shadow-color) / 0.06), 0 8px 24px -12px hsl(var(--shadow-color) / 0.18)',
                }}
                labelStyle={{ color: 'var(--popover-foreground)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--popover-foreground)' }}
                formatter={((v: number) => fmtMoney(v)) as never}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {expenseData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.value === max ? CHART.barTop : CHART.bar}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

const Row = ({
  label,
  value,
  bold,
  highlight,
}: {
  label: string
  value: string
  bold?: boolean
  highlight?: string
}) => (
  <div
    className={`flex justify-between rounded-md px-2.5 py-1.5 ${
      bold ? 'mt-1.5 bg-field' : 'odd:bg-muted/40'
    }`}
  >
    <span className={bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
      {label}
    </span>
    <span className={`tabular-nums ${bold ? 'font-display font-semibold' : ''} ${highlight ?? 'text-foreground'}`}>
      {value}
    </span>
  </div>
)
