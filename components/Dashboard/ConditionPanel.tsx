import type {
  ComplianceStatus,
  ConditionAssessment,
  ConditionLevel,
  ConditionSystemKey,
  RenovationScope,
} from '@/types/condition'

const SYSTEM_LABEL: Record<ConditionSystemKey, string> = {
  hvac: 'HVAC',
  electrical: 'Electrical',
  lighting: 'Court lighting',
  plumbing: 'Plumbing',
  flooring: 'Court flooring',
  walls: 'Walls & finishes',
  office: 'Office',
  bathrooms: 'Bathrooms',
  fireSprinkler: 'Fire & life-safety',
}

const LEVEL_TONE: Record<ConditionLevel, string> = {
  good: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/25',
  fair: 'text-amber-300 bg-amber-400/10 ring-amber-400/25',
  poor: 'text-rose-300 bg-rose-400/10 ring-rose-400/25',
  absent: 'text-rose-300 bg-rose-500/15 ring-rose-500/30',
}

const SCOPE_TONE: Record<RenovationScope, string> = {
  minimal: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/25',
  moderate: 'text-amber-300 bg-amber-400/10 ring-amber-400/25',
  heavy: 'text-orange-300 bg-orange-400/10 ring-orange-400/25',
  'full-gut': 'text-rose-300 bg-rose-500/15 ring-rose-500/30',
}

const SCOPE_LABEL: Record<RenovationScope, string> = {
  minimal: 'Minimal',
  moderate: 'Moderate',
  heavy: 'Heavy',
  'full-gut': 'Full gut',
}

const STATUS_TONE: Record<ComplianceStatus, { dot: string; text: string; label: string }> = {
  ok: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'OK' },
  attention: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'Attention' },
  risk: { dot: 'bg-rose-500', text: 'text-rose-300', label: 'Risk' },
  unknown: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', label: 'Verify' },
}

// Surface risks/attention first so the things to chase are at the top.
const STATUS_ORDER: Record<ComplianceStatus, number> = { risk: 0, attention: 1, unknown: 2, ok: 3 }

export function ConditionPanel({ condition }: { condition: ConditionAssessment | null }) {
  if (!condition) {
    return (
      <div className="condition-card surface p-5">
        <h3 className="text-sm font-semibold tracking-tight mb-3">Condition &amp; code</h3>
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center">
          <div className="text-sm text-muted-foreground">Condition not assessed yet.</div>
          <div className="text-xs text-muted-foreground mt-1">
            It’s assessed automatically when you save a property (best with listing photos).
          </div>
        </div>
      </div>
    )
  }

  const c = condition
  const compliance = [...c.compliance].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  return (
    <div className="condition-card surface p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">Condition &amp; code</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c.confidence} confidence · {c.imageCount} {c.imageCount === 1 ? 'photo' : 'photos'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ring-1 ${SCOPE_TONE[c.scope]}`}
        >
          {SCOPE_LABEL[c.scope]} reno
        </span>
      </div>

      <p className="text-sm text-foreground/90 leading-relaxed">{c.summary}</p>

      {/* Per-system condition */}
      {c.systems.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Systems
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {c.systems.map((s) => (
              <div
                key={s.key}
                className={`rounded-md px-2 py-1.5 ring-1 ${LEVEL_TONE[s.condition]}`}
                title={s.note}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-medium text-foreground truncate">
                    {SYSTEM_LABEL[s.key]}
                  </span>
                  <span className="text-[10px] capitalize">{s.condition}</span>
                </div>
                {s.note && (
                  <p className="text-[10px] text-muted-foreground leading-snug truncate mt-0.5">
                    {s.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NYC / Nassau code & due-diligence checklist */}
      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Code &amp; due-diligence (NYC / Nassau)
        </div>
        <div className="space-y-1.5">
          {compliance.map((item) => {
            const t = STATUS_TONE[item.status]
            return (
              <div key={item.key} className="flex items-start gap-2">
                <span className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${t.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                    <span className={`shrink-0 text-[10px] font-medium ${t.text}`}>{t.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{item.detail}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
