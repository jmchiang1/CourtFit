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
  good: 'text-good',
  fair: 'text-caution',
  poor: 'text-risk',
  absent: 'text-risk',
}

const SCOPE_TONE: Record<RenovationScope, string> = {
  minimal: 'text-good bg-good/10 ring-good/25',
  moderate: 'text-caution bg-caution/10 ring-caution/25',
  heavy: 'text-caution bg-caution/15 ring-caution/35',
  'full-gut': 'text-risk bg-risk/10 ring-risk/25',
}

const SCOPE_LABEL: Record<RenovationScope, string> = {
  minimal: 'Minimal',
  moderate: 'Moderate',
  heavy: 'Heavy',
  'full-gut': 'Full gut',
}

const STATUS_TONE: Record<ComplianceStatus, { dot: string; text: string; label: string }> = {
  ok: { dot: 'bg-good', text: 'text-good', label: 'OK' },
  attention: { dot: 'bg-caution', text: 'text-caution', label: 'Attention' },
  risk: { dot: 'bg-risk', text: 'text-risk', label: 'Risk' },
  unknown: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', label: 'Verify' },
}

// Surface risks/attention first so the things to chase are at the top.
const STATUS_ORDER: Record<ComplianceStatus, number> = { risk: 0, attention: 1, unknown: 2, ok: 3 }

export function ConditionPanel({ condition }: { condition: ConditionAssessment | null }) {
  if (!condition) {
    return (
      <div className="condition-card surface p-5">
        <h3 className="font-display text-sm font-semibold text-foreground mb-3">Condition &amp; code</h3>
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
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
          <h3 className="font-display text-sm font-semibold text-foreground">Condition &amp; code</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c.confidence} confidence · {c.imageCount} {c.imageCount === 1 ? 'photo' : 'photos'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${SCOPE_TONE[c.scope]}`}
        >
          {SCOPE_LABEL[c.scope]} reno
        </span>
      </div>

      <p className="text-sm leading-relaxed text-foreground/80">{c.summary}</p>

      {/* Per-system condition */}
      {c.systems.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1 text-xs font-medium text-foreground">Systems</div>
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {c.systems.map((s) => (
              <div key={s.key} className="min-w-0 border-b border-border py-1.5" title={s.note}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-foreground">{SYSTEM_LABEL[s.key]}</span>
                  <span className={`shrink-0 text-xs font-medium capitalize ${LEVEL_TONE[s.condition]}`}>
                    {s.condition}
                  </span>
                </div>
                {s.note && (
                  <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
                    {s.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NYC / Nassau code & due-diligence checklist */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 text-xs font-medium text-foreground">
          Code &amp; due diligence (NYC / Nassau)
        </div>
        <div className="space-y-2">
          {compliance.map((item) => {
            const t = STATUS_TONE[item.status]
            return (
              <div key={item.key} className="flex items-start gap-2">
                <span className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${t.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                    <span className={`shrink-0 text-[11px] font-medium ${t.text}`}>{t.label}</span>
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
