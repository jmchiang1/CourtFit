import type { RiskFlag } from '@/types/analysis'

const severityStyles: Record<
  RiskFlag['severity'],
  { dot: string; label: string }
> = {
  high: {
    dot: 'bg-risk',
    label: 'text-risk',
  },
  medium: {
    dot: 'bg-caution',
    label: 'text-caution',
  },
  low: {
    dot: 'bg-muted-foreground',
    label: 'text-foreground',
  },
}

export function RiskFlagsPanel({ flags }: { flags: RiskFlag[] }) {
  return (
    <div className="risk-flags-card surface p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-display text-sm font-semibold text-foreground">Risks to confirm</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {flags.length} {flags.length === 1 ? 'flag' : 'flags'}
        </span>
      </div>

      {flags.length === 0 ? (
        <div className="rounded-xl bg-field/60 px-4 py-6 text-center">
          <div className="text-sm text-good">No major risk flags.</div>
          <div className="text-xs text-muted-foreground mt-1">
            Inputs look healthy across the board.
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {flags.map((f) => {
            const s = severityStyles[f.severity]
            return (
              <li key={f.id} className="rounded-lg bg-muted/60 px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${s.dot}`} />
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${s.label}`}>{f.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {f.detail}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
