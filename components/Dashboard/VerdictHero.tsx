import { fmtMoney, fmtPct, fmtYears } from '@/lib/format'
import { RATING_STYLE } from '@/lib/rating-style'
import type { AnalysisResult, Rating } from '@/types/analysis'

/** Dot colors tuned to read on the dark court-green slab (both themes). */
const heroDot: Record<Rating, string> = {
  'Strong Candidate': 'bg-[#7fe0a8]',
  'Worth Investigating': 'bg-[#9cc0ff]',
  Risky: 'bg-[#f5c96a]',
  'Do Not Pursue': 'bg-[#ff9c8c]',
  Incomplete: 'bg-white/50',
}

const blurb: Record<Rating, string> = {
  'Strong Candidate': 'Numbers, fit, and risk profile all support pursuing this property.',
  'Worth Investigating': 'Promising fundamentals. Confirm the flagged items before moving forward.',
  Risky: 'Several risk factors stack up. Verify them before committing time.',
  'Do Not Pursue': 'The fundamentals don’t support a viable build-out here.',
  Incomplete: 'Add square footage and rent to unlock the full verdict.',
}

const toneText = {
  good: 'text-white',
  warn: 'text-[#f5c96a]',
  bad: 'text-[#ff9c8c]',
} as const

/**
 * The verdict slab at the top of a property. Deliberately the loudest thing in
 * the app: a court-green panel with faint court lines, the rating set as the
 * headline, and the three numbers that decide it.
 */
export function VerdictHero({ result }: { result: AnalysisResult }) {
  const noiPositive = result.noi > 0

  return (
    <section className="verdict-hero relative overflow-hidden rounded-xl bg-court-ink text-white">
      <CourtLines />

      <div className="relative px-5 pt-5 pb-6 sm:px-7 sm:pt-6">
        <h2 className="font-display flex items-center gap-3 text-3xl font-bold sm:text-4xl">
          <span aria-hidden className={`size-3 shrink-0 rounded-full ${heroDot[result.rating]}`} />
          {RATING_STYLE[result.rating].label}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-white/70">{blurb[result.rating]}</p>

        <dl className="mt-6 grid grid-cols-3 border-t border-white/15">
          <Stat
            label="Net operating income"
            value={fmtMoney(result.noi)}
            sub={
              result.revenue.gross > 0 ? `${fmtPct(result.noiMargin)} margin` : 'No revenue yet'
            }
            tone={noiPositive ? 'good' : 'bad'}
          />
          <Stat
            label="Payback"
            value={fmtYears(result.paybackYears)}
            sub={`${fmtMoney(result.startupCost.mid)} to open`}
          />
          <Stat
            label="Badminton courts"
            value={String(result.courts.total)}
            sub={`${fmtMoney(result.revenue.courtRental)} a year in rentals`}
            tone={result.courts.total >= 5 ? 'good' : result.courts.total > 0 ? 'warn' : undefined}
          />
        </dl>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone?: 'good' | 'warn' | 'bad'
}) {
  return (
    <div className="min-w-0 border-white/15 pt-4 pr-3 not-first:border-l not-first:pl-4 sm:not-first:pl-6">
      <dt className="truncate text-xs text-white/60">{label}</dt>
      <dd
        className={`font-display mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${
          tone ? toneText[tone] : 'text-white'
        }`}
      >
        {value}
      </dd>
      <dd className="mt-0.5 truncate text-xs text-white/60 tabular-nums">{sub}</dd>
    </div>
  )
}

/**
 * Half a badminton court to scale (net to baseline, 22 × 20 ft) in white
 * hairlines, pinned to the right edge of the slab.
 */
function CourtLines() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 hidden h-full text-white opacity-[0.13] sm:block"
      viewBox="-0.5 0 23 20"
      preserveAspectRatio="xMaxYMid meet"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <g vectorEffect="non-scaling-stroke">
        <path vectorEffect="non-scaling-stroke" d="M0 0V20" strokeWidth="2.5" />
        <path vectorEffect="non-scaling-stroke" d="M0 1.5H22M0 18.5H22" />
        <path vectorEffect="non-scaling-stroke" d="M6.5 0V20M19.5 0V20M22 0V20" />
        <path vectorEffect="non-scaling-stroke" d="M6.5 10H22" />
      </g>
    </svg>
  )
}
