'use client'

import { useEffect, useMemo, useState } from 'react'
import { calculateAnalysis } from '@/lib/calculator'
import { DEFAULT_ASSUMPTIONS } from '@/lib/constants'
import { analyzeCompetition, type CompetitorSite } from '@/lib/competition'
import { computeWhitespace } from '@/lib/whitespace'
import {
  rankCandidates,
  readinessFromCondition,
  codeSafetyFromCondition,
  DEFAULT_WEIGHTS,
  DIMENSION_LABEL,
  type RankWeights,
  type RankDimension,
  type CandidateMetrics,
} from '@/lib/ranking'
import { fmtMoney, fmtYears } from '@/lib/format'
import { RotateCcw } from 'lucide-react'
import type { PropertyRow } from '@/lib/supabase/types'

const WEIGHTS_KEY = 'cf-rank-weights'
const DIMENSIONS = Object.keys(DEFAULT_WEIGHTS) as RankDimension[]

interface Props {
  rows: PropertyRow[]
  sites: CompetitorSite[]
  onView: (row: PropertyRow) => void
}

export function ComparePanel({ rows, sites, onView }: Props) {
  const [weights, setWeights] = useState<RankWeights>(DEFAULT_WEIGHTS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WEIGHTS_KEY)
      if (saved) setWeights({ ...DEFAULT_WEIGHTS, ...JSON.parse(saved) })
    } catch {
      /* ignore */
    }
  }, [])

  const setWeight = (dim: RankDimension, value: number) => {
    setWeights((cur) => {
      const next = { ...cur, [dim]: value }
      try {
        localStorage.setItem(WEIGHTS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const resetWeights = () => {
    setWeights(DEFAULT_WEIGHTS)
    try {
      localStorage.removeItem(WEIGHTS_KEY)
    } catch {
      /* ignore */
    }
  }

  // Build the per-candidate metrics from the saved listing + demographics + condition.
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  const metrics = useMemo<CandidateMetrics[]>(() => {
    return rows.map((r) => {
      const assumptions = { ...DEFAULT_ASSUMPTIONS, ...r.assumptions_json }
      const result = calculateAnalysis({
        listing: r.listing_json,
        assumptions,
        condition: r.condition_json,
      })

      let whitespace: number | null = null
      if (r.latitude != null && r.longitude != null && r.demographics_json) {
        const comp = analyzeCompetition(r.latitude, r.longitude, sites)
        const d = r.demographics_json
        const ws = computeWhitespace({
          badmintonFit: d.badmintonFit.score,
          pickleballFit: d.pickleballFit.score,
          targetPopulation: d.ethnicity.targetAsian,
          adultPopulation: Math.round(d.totalPopulation * d.age.adult18to64Share),
          badmintonCompetitors: comp.badmintonCompetitors,
          pickleballCompetitors: comp.pickleballCompetitors,
          badmintonMixPct: assumptions.badmintonMixPct,
          pickleballMixPct: assumptions.pickleballMixPct,
        })
        whitespace = ws.overall.score
      }

      return {
        id: r.id,
        label: r.label || r.address || 'Untitled',
        whitespace,
        noi: result.noi,
        paybackYears: result.paybackYears,
        courts: result.courts.total,
        readiness: readinessFromCondition(r.condition_json),
        coderisk: codeSafetyFromCondition(r.condition_json),
      }
    })
  }, [rows, sites])

  const ranked = useMemo(() => rankCandidates(metrics, weights), [metrics, weights])

  if (rows.length === 0) {
    return (
      <div className="surface p-8 text-center">
        <p className="text-sm font-medium">Nothing to compare yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a couple of properties and they’ll be ranked here.
        </p>
      </div>
    )
  }

  return (
    <div className="compare-view grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      {/* Weights */}
      <aside className="compare-weights surface h-fit p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-tight">Weighting</h3>
          <button
            type="button"
            onClick={resetWeights}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        </div>
        <div className="space-y-3">
          {DIMENSIONS.map((dim) => (
            <div key={dim}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-foreground/90">{DIMENSION_LABEL[dim]}</span>
                <span className="tabular-nums text-muted-foreground">{weights[dim]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={weights[dim]}
                onChange={(e) => setWeight(dim, Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
                aria-label={`${DIMENSION_LABEL[dim]} weight`}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          Each dimension is scored relative to your other candidates. Adjust the sliders to match
          what matters most for this deal.
        </p>
      </aside>

      {/* Leaderboard */}
      <div className="compare-leaderboard space-y-2">
        {ranked.map((c) => {
          const row = byId.get(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => row && onView(row)}
              className="compare-row block w-full rounded-xl ring-1 ring-border bg-card p-3 text-left transition hover:bg-foreground/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold tabular-nums text-primary">
                  {c.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.label}</span>
                    <span className="shrink-0 text-lg font-semibold tabular-nums">{c.score}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
                    <span>Whitespace {c.whitespace ?? '—'}</span>
                    <span>NOI {fmtMoney(c.noi)}</span>
                    <span>Payback {fmtYears(c.paybackYears)}</span>
                    <span>{c.courts} courts</span>
                  </div>
                </div>
              </div>

              {/* Dimension breakdown bars */}
              <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 sm:grid-cols-6">
                {DIMENSIONS.map((dim) => (
                  <div key={dim} title={`${DIMENSION_LABEL[dim]}: ${Math.round(c.normalized[dim])}`}>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-primary/70"
                        style={{ width: `${Math.round(c.normalized[dim])}%` }}
                      />
                    </div>
                    <div className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-muted-foreground">
                      {DIMENSION_LABEL[dim]}
                    </div>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
