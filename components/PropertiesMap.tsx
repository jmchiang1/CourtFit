'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Marker,
  InfoWindow,
  Pin,
  useMap,
  ColorScheme,
} from '@vis.gl/react-google-maps'
import type { PropertyRow } from '@/lib/supabase/types'
import { calculateAnalysis } from '@/lib/calculator'
import { resolveAssumptions } from '@/lib/constants'
import { fmtMoney, fmtPct } from '@/lib/format'
import { FACILITY_DEMOGRAPHICS } from '@/lib/facility-demographics'
import { DRIVE_MINUTES } from '@/lib/catchment'
import type { Demographics, FitScore, FitLabel } from '@/types/demographics'
import { RatingBadge } from '@/components/Dashboard/RatingBadge'
import { RATING_STYLE } from '@/lib/rating-style'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getIsochrone } from '@/app/actions/isochrone'
import {
  loadDemandTracts,
  ethnicityIndices,
  ETHNICITY_OPTIONS,
  INCOME_MAX,
  TRACT,
  type DemandTract,
  type HeatEthnicity,
} from '@/lib/demand-tracts-data'
import { findOpportunities, type Opportunity } from '@/lib/opportunity'
import { COMPETITION_RADIUS_MILES } from '@/lib/competition'
import { MapPin, Eye, ExternalLink, Search, Plus, Trash2, Pencil, Flame, Target, SlidersHorizontal, Layers } from 'lucide-react'
import type { Rating } from '@/types/analysis'
import { REGIONS, detectRegion, type Region } from '@/lib/region'
import {
  REFERENCE_FACILITIES,
  facilityRegion,
  facilityUrl,
  type ReferenceFacility,
  type Sport,
} from '@/lib/reference-facilities'
import {
  listReferenceFacilities,
  deleteReferenceFacility,
} from '@/app/actions/reference-facilities'
import type { ReferenceFacilityRow } from '@/lib/supabase/types'
import { AddFacilityDialog } from '@/components/AddFacilityDialog'
import { RangeFields } from '@/components/RangeFilterMenu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EMPTY_RANGES, countActiveRanges, inRange, type Ranges } from '@/lib/property-filters'
import {
  PROPERTY_STATUSES,
  STATUS_META,
  normalizeStatus,
  type PropertyStatus,
} from '@/lib/property-status'

// Pin colors mirror the rating semantics used elsewhere in the app. Google's
// markers need literal colors (no CSS vars), so these are the hex values of the
// good / info / caution / risk tokens in app/globals.css, one set per theme.
type PinColor = { bg: string; border: string; glyph: string }
const RATING_COLOR: Record<'light' | 'dark', Record<Rating, PinColor>> = {
  light: {
    'Strong Candidate': { bg: '#176238', border: '#0f4527', glyph: '#ffffff' },
    'Worth Investigating': { bg: '#2558a3', border: '#1a3f78', glyph: '#ffffff' },
    'Risky': { bg: '#7a4c00', border: '#573600', glyph: '#ffffff' },
    'Do Not Pursue': { bg: '#9c2f1d', border: '#722215', glyph: '#ffffff' },
    'Incomplete': { bg: '#6b7770', border: '#535f58', glyph: '#ffffff' },
  },
  dark: {
    'Strong Candidate': { bg: '#52c48c', border: '#1f7a4b', glyph: '#0d1411' },
    'Worth Investigating': { bg: '#79a6f2', border: '#2a5fb0', glyph: '#0d1411' },
    'Risky': { bg: '#e3b04b', border: '#9a6100', glyph: '#0d1411' },
    'Do Not Pursue': { bg: '#f07c6c', border: '#bb3a2c', glyph: '#0d1411' },
    'Incomplete': { bg: '#92a199', border: '#5b6861', glyph: '#0d1411' },
  },
}

// Selected-marker trade-area overlay (radius ring / drive-time polygon) uses the
// brand court green — the hex of `--court` per theme.
const OVERLAY_COLOR = { light: '#1c5a44', dark: '#4fb985' } as const

const NYC_CENTER = { lat: 40.73, lng: -73.85 }

// Default trade-area radius drawn around the selected marker — mirrors the
// 5-mile radius the Census demographics are aggregated over (lib/census-core.ts).
// The slider lets the user resize the *visual* ring; demand scores stay at 5 mi.
const DEFAULT_RADIUS_MILES = 5
const MILE_IN_METERS = 1609.344

// Clamp manual drive-time entry to Mapbox's supported 1–60 minute range.
const clampMinutes = (n: number) => Math.max(1, Math.min(60, Math.round(Number.isFinite(n) ? n : 15)))

// Competitor facilities share one high-contrast marker so they read as a single
// "reference" layer, clearly distinct from the rating-colored candidate-site
// pins. A white dot with an ink ring stays legible on both basemaps.
const COMPETITOR_COLOR = '#ffffff'
const COMPETITOR_RING = '#15201b'

// Teardrop pin (candidate sites) — used for the legacy-marker fallback when no
// cloud Map ID is configured (Advanced Markers require a Map ID).
function pinIcon(bg: string, border: string, glyph: string = '#ffffff'): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">` +
    `<path d="M14 0C6.27 0 0 6.27 0 14c0 9.45 14 26 14 26s14-16.55 14-26C28 6.27 21.73 0 14 0z" ` +
    `fill="${bg}" stroke="${border}" stroke-width="1.5"/>` +
    `<circle cx="14" cy="14" r="5" fill="${glyph}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Circle marker (competitor facilities). The fill color is user-configurable
// (defaults to white); the ink ring keeps it legible on either basemap.
function competitorIcon(color: string = COMPETITOR_COLOR): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">` +
    `<circle cx="13" cy="13" r="9" fill="${color}" stroke="${COMPETITOR_RING}" stroke-width="3"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Per-device global color for the reference-facility dots (built-in and the
// ones the user adds share it), with a small palette of presets for the picker.
const REFERENCE_COLOR_KEY = 'cf-reference-color'
const REFERENCE_PRESETS = [
  '#ffffff', '#94a3b8', '#f43f5e', '#f59e0b',
  '#10b981', '#3b82f6', '#a855f7', '#ec4899',
]

interface PropertyPoint {
  kind: 'property'
  id: string
  position: { lat: number; lng: number }
  rating: Rating
  noi: number
  courts: number
  region: Region | null
  title: string
  subtitle: string | null
  row: PropertyRow
}

interface CompetitorPoint {
  kind: 'competitor'
  id: string
  position: { lat: number; lng: number }
  region: Region | null
  facility: ReferenceFacility
  /** Resolved demographics (baked file for built-ins, row data for custom). */
  demographics: Demographics | null
  /** Present for user-added facilities — carries the row id for deletion. */
  custom?: { id: string }
}

type Selected = { kind: 'property' | 'competitor' | 'opportunity'; id: string } | null

// Suggested-site markers: a numbered violet badge, distinct from both the
// rating-colored site pins and the reference-facility dots.
const OPPORTUNITY_COLOR = '#7c3aed'

function opportunityIcon(rank: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">` +
    `<circle cx="15" cy="15" r="12" fill="${OPPORTUNITY_COLOR}" stroke="#ffffff" stroke-width="2.5"/>` +
    `<text x="15" y="19.5" text-anchor="middle" font-family="system-ui, sans-serif" ` +
    `font-size="13" font-weight="700" fill="#ffffff">${rank}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const fmtPop = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`)

interface Props {
  rows: PropertyRow[]
  onView: (row: PropertyRow) => void
  /** Count of rows that have an address but no coordinates yet. */
  unmappedCount?: number
  /** Demo mode (no auth) — hides the "Add facility" affordance. */
  demo?: boolean
}

/** Fits the map viewport to enclose every visible marker when the set changes. */
function FitBounds({ positions }: { positions: { lat: number; lng: number }[] }) {
  const map = useMap()
  const key = positions.map((p) => `${p.lat},${p.lng}`).join('|')
  useEffect(() => {
    if (!map || positions.length === 0) return
    if (positions.length === 1) {
      map.setCenter(positions[0])
      map.setZoom(13)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    positions.forEach((p) => bounds.extend(p))
    map.fitBounds(bounds, 64)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

/** Smoothly pans/zooms to a target when the user picks a facility from the list. */
function PanTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !target) return
    map.panTo(target)
    if ((map.getZoom() ?? 0) < 13) map.setZoom(13)
  }, [map, target])
  return null
}

/** Draws a trade-area ring around the currently selected marker. */
function RadiusRing({
  center,
  radiusMiles,
  color,
}: {
  center: { lat: number; lng: number } | null
  radiusMiles: number
  color: string
}) {
  const map = useMap()
  const circleRef = useRef<google.maps.Circle | null>(null)
  useEffect(() => {
    if (!map || !center) {
      circleRef.current?.setMap(null)
      circleRef.current = null
      return
    }
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillOpacity: 0.08,
        clickable: false,
      })
    }
    // Re-applied every run so a theme switch (which swaps the map instance and
    // the overlay color) carries the existing circle over.
    circleRef.current.setOptions({ map, strokeColor: color, fillColor: color })
    // Mutating the existing circle (vs. recreating) keeps the ring from
    // flickering while the user drags the radius slider.
    circleRef.current.setCenter(center)
    circleRef.current.setRadius(radiusMiles * MILE_IN_METERS)
  }, [map, center?.lat, center?.lng, radiusMiles, color])
  // Tear the circle down when the map unmounts.
  useEffect(() => () => circleRef.current?.setMap(null), [])
  return null
}

/**
 * Draws a single drive-time isochrone polygon (the live overlay the user tunes
 * via the Drive-time menu). Ring is [lng,lat] pairs; we convert to {lat,lng}.
 */
function PolygonRing({ ring, color }: { ring: number[][] | null; color: string }) {
  const map = useMap()
  const polyRef = useRef<google.maps.Polygon | null>(null)
  useEffect(() => {
    polyRef.current?.setMap(null)
    polyRef.current = null
    if (!map || !ring) return
    polyRef.current = new google.maps.Polygon({
      map,
      paths: ring.map(([lng, lat]) => ({ lat, lng })),
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.08,
      clickable: false,
    })
    return () => {
      polyRef.current?.setMap(null)
      polyRef.current = null
    }
  }, [map, ring, color])
  return null
}

// Warm ramp for the demand "heat bubbles", coolest → hottest.
const HEAT_RAMP = ['#fbbf24', '#fb923c', '#f97316', '#ef4444']

type HeatPoint = { lat: number; lng: number; weight: number }

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// One soft radial sprite per ramp color, built once and stamped (scaled) per
// tract. Stamping a cached bitmap is ~free vs. instantiating a map overlay.
function buildHeatSprites(size = 128): HTMLCanvasElement[] {
  return HEAT_RAMP.map((hex) => {
    const [r, g, b] = hexToRgb(hex)
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
    grad.addColorStop(0.55, `rgba(${r},${g},${b},0.5)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    return c
  })
}

/**
 * Demand heatmap overlay (greenfield finder). Renders baked Census-tract demand
 * onto a SINGLE <canvas> via a custom OverlayView: every tract is one cached
 * radial-sprite stamp (sized/colored by weight; overlap reads as heat), redrawn
 * at most once per animation frame on pan/zoom.
 *
 * Replaces the previous approach of attaching ~900 google.maps.Circle overlays,
 * which blocked the main thread on every toggle/filter change and repainted all
 * 900 vector shapes on each pan. (We avoid the deprecated visualization
 * HeatmapLayer, which newer Maps keys no longer provision.)
 */
function DemandHeatmap({ points }: { points: HeatPoint[] | null }) {
  const map = useMap()
  // Latest data, read by the overlay's render loop without re-creating it.
  const dataRef = useRef<{ points: HeatPoint[] | null; max: number }>({ points: null, max: 0 })
  const overlayRef = useRef<{ schedule: () => void; destroy: () => void } | null>(null)

  // Create the overlay once the map (and the google.maps global) is ready.
  useEffect(() => {
    if (!map) return
    const m = map // non-null capture for the overlay's render closure

    const sprites = buildHeatSprites()

    class HeatOverlay extends google.maps.OverlayView {
      canvas: HTMLCanvasElement | null = null
      raf = 0

      onAdd() {
        const c = document.createElement('canvas')
        c.style.position = 'absolute'
        c.style.pointerEvents = 'none'
        c.style.willChange = 'left, top'
        this.canvas = c
        this.getPanes()!.overlayLayer.appendChild(c)
      }

      onRemove() {
        if (this.raf) cancelAnimationFrame(this.raf)
        this.raf = 0
        this.canvas?.remove()
        this.canvas = null
      }

      // Maps calls draw() on every viewport change; coalesce to one render/frame.
      draw() { this.schedule() }

      schedule() {
        if (this.raf) return
        this.raf = requestAnimationFrame(() => { this.raf = 0; this.render() })
      }

      render() {
        const canvas = this.canvas
        const proj = this.getProjection()
        const { points: pts, max } = dataRef.current
        if (!canvas) return
        const bounds = m.getBounds()
        if (!proj || !bounds || !pts || pts.length === 0 || max <= 0) {
          canvas.style.display = 'none'
          return
        }

        const ne = proj.fromLatLngToDivPixel(bounds.getNorthEast())
        const sw = proj.fromLatLngToDivPixel(bounds.getSouthWest())
        if (!ne || !sw) return
        const left = Math.min(ne.x, sw.x)
        const top = Math.min(ne.y, sw.y)
        const w = Math.abs(ne.x - sw.x)
        const h = Math.abs(ne.y - sw.y)
        if (w <= 0 || h <= 0) return

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.style.display = ''
        canvas.style.left = `${left}px`
        canvas.style.top = `${top}px`
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        const ctx = canvas.getContext('2d')!
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)

        // Cull to the visible bounds (+margin), then stamp survivors.
        const latPad = (bounds.getNorthEast().lat() - bounds.getSouthWest().lat()) * 0.2
        const lngPad = (bounds.getNorthEast().lng() - bounds.getSouthWest().lng()) * 0.2
        const nLat = bounds.getNorthEast().lat() + latPad
        const sLat = bounds.getSouthWest().lat() - latPad
        const eLng = bounds.getNorthEast().lng() + lngPad
        const wLng = bounds.getSouthWest().lng() - lngPad
        const zoom = m.getZoom() ?? 11
        const scale = Math.pow(2, zoom)

        for (const p of pts) {
          if (p.lat > nLat || p.lat < sLat || p.lng > eLng || p.lng < wLng) continue
          const px = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng))
          if (!px) continue
          const norm = p.weight / max // 0–1
          const radiusM = 300 + Math.sqrt(norm) * 1500
          const mpp = (156543.03392 * Math.cos((p.lat * Math.PI) / 180)) / scale
          const r = radiusM / mpp
          const sprite = sprites[Math.min(sprites.length - 1, Math.floor(norm * sprites.length))]
          ctx.globalAlpha = 0.18 + norm * 0.22
          ctx.drawImage(sprite, px.x - left - r, px.y - top - r, r * 2, r * 2)
        }
        ctx.globalAlpha = 1
      }
    }

    const overlay = new HeatOverlay()
    overlay.setMap(map)
    overlayRef.current = { schedule: () => overlay.schedule(), destroy: () => overlay.setMap(null) }

    return () => {
      overlayRef.current = null
      overlay.setMap(null)
    }
  }, [map])

  // Push new data (initial load / filter change / off) and request a redraw —
  // no overlay teardown, just a restamp on the next frame.
  useEffect(() => {
    let max = 0
    if (points) for (const p of points) if (p.weight > max) max = p.weight
    dataRef.current = { points, max }
    overlayRef.current?.schedule()
  }, [points])

  return null
}

// Google's InfoWindow is always white, even on the dark basemap, so its
// contents are pinned to the light-theme tokens (hex values from globals.css).
// Token classes inside (text-good, text-muted-foreground, bg-primary …) then
// resolve against these instead of the page's dark values.
const INFOWINDOW_VARS = {
  '--foreground': '#15201b',
  '--muted': '#e3e7e1',
  '--muted-foreground': '#535f58',
  '--panel': '#ffffff',
  '--panel-2': '#e3e7e1',
  '--field-hover': '#d8ddd6',
  '--primary': '#1c5a44',
  '--primary-foreground': '#ffffff',
  '--ring': '#1c5a44',
  '--good': '#176238',
  '--info': '#2558a3',
  '--caution': '#7a4c00',
  '--risk': '#9c2f1d',
} as React.CSSProperties

// Fit-label colors for the demand pills (semantic tones).
const FIT_PILL: Record<FitLabel, string> = {
  Strong: 'bg-good/10 text-good',
  Moderate: 'bg-caution/10 text-caution',
  Weak: 'bg-risk/10 text-risk',
}

function FitPill({ fit }: { fit: FitScore }) {
  return (
    <span
      className={`fit-pill inline-flex flex-1 items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${FIT_PILL[fit.label]}`}
      title={`${fit.label} demand`}
    >
      <span>Badminton demand</span>
      <span className="tabular-nums">{fit.score}</span>
    </span>
  )
}

/** "20-min drive" / "5-mi radius" — the catchment a demographics record covers. */
function catchmentLabel(d: Demographics): string {
  return d.mode === 'drive'
    ? `${d.catchments?.badminton.driveMinutes ?? DRIVE_MINUTES}-min drive`
    : `${d.radiusMiles}-mi radius`
}

/** Why a suggested site ranks where it does — shared by its InfoWindow and list row. */
function OpportunityStats({ o }: { o: Opportunity }) {
  return (
    <div className="min-w-0 space-y-0.5 text-xs leading-snug">
      <p className="text-foreground">
        <span className="font-medium tabular-nums">{fmtPop(o.asianPop)}</span> Asian residents ·{' '}
        <span className="font-medium tabular-nums">{o.competitors}</span>{' '}
        {o.competitors === 1 ? 'facility' : 'facilities'} within {COMPETITION_RADIUS_MILES} mi
      </p>
      {o.nearest && (
        <p className="text-muted-foreground truncate">
          Nearest: {o.nearest.name} · {o.nearest.miles.toFixed(1)} mi
        </p>
      )}
      <p className="text-muted-foreground tabular-nums">
        ~{fmtPop(o.score)} residents per facility if you open here
      </p>
    </div>
  )
}

/** Compact trade-area summary shown inside a map InfoWindow. */
function DemandMini({ d }: { d: Demographics }) {
  return (
    <div className="demand-mini space-y-1 pt-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Demand · {catchmentLabel(d)}</span>
        <span className="tabular-nums">{d.totalPopulation.toLocaleString()} people</span>
      </div>
      <div className="flex gap-1.5">
        <FitPill fit={d.badmintonFit} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>East + South Asian</span>
        <span className="tabular-nums">{fmtPct(d.ethnicity.targetShare)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Mean income</span>
        <span className="tabular-nums">
          {d.meanHouseholdIncome != null ? fmtMoney(d.meanHouseholdIncome) : '—'}
        </span>
      </div>
    </div>
  )
}

const noopSubscribe = () => () => {}

/** Sport filter for the reference-facility layer. */
type SportFilter = 'all' | Sport | 'both'
const SPORT_FILTER_LABEL: Record<SportFilter, string> = {
  all: 'All',
  Badminton: 'Badminton',
  Pickleball: 'Pickleball',
  both: 'Badminton + Pickleball',
}

function matchesSport(sports: readonly Sport[], f: SportFilter): boolean {
  if (f === 'all') return true
  if (f === 'both') return sports.includes('Badminton') && sports.includes('Pickleball')
  return sports.includes(f)
}

/** Small sport tags; badminton in the brand green, pickleball in info blue. */
function SportChips({ sports, className = '' }: { sports: readonly Sport[]; className?: string }) {
  if (!sports.length) return null
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {sports.map((s) => (
        <span
          key={s}
          className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight ${
            s === 'Badminton'
              ? 'bg-primary/10 text-primary'
              : 'bg-info/10 text-info'
          }`}
        >
          {s}
        </span>
      ))}
    </div>
  )
}

const RATINGS: Rating[] = [
  'Strong Candidate',
  'Worth Investigating',
  'Risky',
  'Do Not Pursue',
  'Incomplete',
]

/** Toggle-chip styling shared by the toolbar panels. */
function chipClass(on: boolean) {
  return `h-7 rounded-md px-2.5 text-xs font-medium tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-popover ${
    on
      ? 'bg-primary text-primary-foreground'
      : 'bg-field text-foreground hover:bg-field-hover'
  }`
}

/** Single-choice chip row. */
function ChipGroup({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={chipClass(o.value === value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold tabular-nums text-primary">
      {n}
    </span>
  )
}

function PanelHeader({
  title,
  action,
}: {
  title: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-display text-sm font-semibold">{title}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

/** A titled group inside a toolbar panel, separated from the one above by extra space. */
function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-3">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** One layer row: swatch, label, optional count / hint, and a switch. */
function LayerToggle({
  checked,
  onChange,
  swatch,
  label,
  count,
  hint,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  swatch: React.ReactNode
  label: string
  count?: number
  hint?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{swatch}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">
          {label}
          {count != null && <span className="ml-1.5 tabular-nums text-muted-foreground">{count}</span>}
        </span>
        {hint && <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/75'}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow-xs transition-[left] ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

export function PropertiesMap({ rows, onView, unmappedCount = 0, demo = false }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  // Advanced Markers require a real cloud Map ID. When one isn't configured we
  // fall back to classic colored markers so the map still works (and we avoid
  // the "initialized without a valid Map ID" warning).
  //
  // Note the `|| undefined`: a declared-but-blank env var (`…MAP_ID=`) reads as
  // "", and @vis.gl only strips `undefined` options — so "" would be forwarded
  // to `new google.maps.Map({ mapId: "" })`, which the Maps JS API treats as a
  // real-but-invalid Map ID and renders as a blank map rather than ignoring.
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || undefined
  const useAdvanced = !!mapId

  // Basemap + pin palette follow the app theme. `resolvedTheme` is unknown
  // during SSR/hydration, so hold the <Map> back until mounted — otherwise it
  // would be created LIGHT and immediately re-created DARK (colorScheme is an
  // init-only option, so each change is a fresh, billable map instance).
  const { resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const theme: 'light' | 'dark' = mounted && resolvedTheme === 'dark' ? 'dark' : 'light'
  const colorScheme = theme === 'dark' ? ColorScheme.DARK : ColorScheme.LIGHT
  const pinColors = RATING_COLOR[theme]
  const overlayColor = OVERLAY_COLOR[theme]

  const [selected, setSelected] = useState<Selected>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES)
  // Default the exploratory overlay to the badminton catchment the scores use.
  const [driveMinutes, setDriveMinutes] = useState<number>(DRIVE_MINUTES)
  const [mapMode, setMapMode] = useState<'radius' | 'drive'>('drive')
  // Demand heatmap (greenfield finder) — baked tract data loaded on first enable.
  const [heatmapOn, setHeatmapOn] = useState(false)
  const [heatmapEths, setHeatmapEths] = useState<HeatEthnicity[]>(['Total'])
  // Suggested greenfield sites (low competition × high Asian population).
  const [showOpportunities, setShowOpportunities] = useState(false)
  // Median-income band (dollars) the heatmap is filtered to. Full range by default.
  const [incomeRange, setIncomeRange] = useState<[number, number]>([0, INCOME_MAX])
  const [tracts, setTracts] = useState<DemandTract[] | null>(null)
  // Live drive-time overlay: ring fetched for the selected marker at driveMinutes.
  const [liveRing, setLiveRing] = useState<number[][] | null>(null)
  const [isoLoading, setIsoLoading] = useState(false)
  // Keyed cache of fetched rings ("markerId:minutes"). Plain object because the
  // Map identifier is shadowed by the Google Maps <Map> component import above.
  const isoCache = useRef<Record<string, number[][] | null>>({})

  // Filters.
  const [showProperties, setShowProperties] = useState(true)
  const [showCompetitors, setShowCompetitors] = useState(true)
  const [sport, setSport] = useState<SportFilter>('all')
  // Global, per-device color for the built-in reference-facility dots.
  const [referenceColor, setReferenceColor] = useState<string>(COMPETITOR_COLOR)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REFERENCE_COLOR_KEY)
      if (saved) setReferenceColor(saved)
    } catch {
      /* localStorage unavailable */
    }
  }, [])
  const updateReferenceColor = (c: string) => {
    setReferenceColor(c)
    try {
      localStorage.setItem(REFERENCE_COLOR_KEY, c)
    } catch {
      /* ignore */
    }
  }
  const [region, setRegion] = useState<'all' | Region>('all')
  const [minCourts, setMinCourts] = useState(0)
  const [search, setSearch] = useState('')
  // My Sites filters — mirror the list tab so both views filter properties the
  // same way. (Rating / status / value ranges apply to your sites only;
  // competitor pins have no rating, status, or listing figures.)
  const [ratingFilter, setRatingFilter] = useState<'all' | Rating>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PropertyStatus>('all')
  const [ranges, setRanges] = useState<Ranges>(EMPTY_RANGES)

  // User-added reference facilities (signed-in only).
  const [custom, setCustom] = useState<ReferenceFacilityRow[]>([])
  const [addOpen, setAddOpen] = useState(false)
  // When set, the dialog edits this facility instead of adding a new one.
  const [editingFacility, setEditingFacility] = useState<ReferenceFacilityRow | null>(null)

  // Open the dialog in add or edit mode.
  const openAddFacility = () => {
    setEditingFacility(null)
    setAddOpen(true)
  }
  const openEditFacility = (id: string) => {
    const row = custom.find((r) => r.id === id)
    if (!row) return
    setEditingFacility(row)
    setAddOpen(true)
  }

  // Added facilities are shared reference data, so load them in demo mode too —
  // signed-out visitors see the same competitor set, minus the edit/add controls.
  useEffect(() => {
    let active = true
    listReferenceFacilities().then((list) => {
      if (active) setCustom(list)
    })
    return () => {
      active = false
    }
  }, [])

  const handleDeleteFacility = (id: string) => {
    setCustom((cur) => cur.filter((r) => r.id !== id))
    setSelected((cur) => (cur?.kind === 'competitor' && cur.id === `custom-${id}` ? null : cur))
    void deleteReferenceFacility(id)
  }

  const q = search.trim().toLowerCase()

  // Badge counts for the toolbar panels.
  const activeFilterCount =
    (region !== 'all' ? 1 : 0) +
    (ratingFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (minCourts > 0 ? 1 : 0) +
    countActiveRanges(ranges) +
    (sport !== 'all' ? 1 : 0)
  const activeLayerCount = [showProperties, showCompetitors, showOpportunities, heatmapOn].filter(
    Boolean,
  ).length
  const clearMapFilters = () => {
    setRegion('all')
    setRatingFilter('all')
    setStatusFilter('all')
    setMinCourts(0)
    setRanges(EMPTY_RANGES)
    setSport('all')
  }

  // All candidate-site points (geocoded saved properties), with analysis.
  const allProperties = useMemo<PropertyPoint[]>(() => {
    return rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => {
        const result = calculateAnalysis({
          listing: r.listing_json,
          assumptions: resolveAssumptions(r.assumptions_json),
          condition: r.condition_json,
        })
        const title = r.label || r.address || 'Property'
        const subtitle = r.address && r.address !== title ? r.address : null
        return {
          kind: 'property' as const,
          id: r.id,
          position: { lat: r.latitude as number, lng: r.longitude as number },
          rating: result.rating as Rating,
          noi: result.noi,
          courts: result.courts.total,
          region: detectRegion(r.address),
          title,
          subtitle,
          row: r,
        }
      })
  }, [rows])

  const allCompetitors = useMemo<CompetitorPoint[]>(() => {
    const builtins: CompetitorPoint[] = REFERENCE_FACILITIES.map((f) => ({
      kind: 'competitor',
      id: f.name,
      position: { lat: f.lat, lng: f.lng },
      region: facilityRegion(f),
      facility: f,
      demographics: FACILITY_DEMOGRAPHICS[f.name] ?? null,
    }))
    const added: CompetitorPoint[] = custom
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({
        kind: 'competitor',
        id: `custom-${r.id}`,
        position: { lat: r.latitude as number, lng: r.longitude as number },
        region: detectRegion(r.address),
        facility: {
          name: r.name,
          address: r.address,
          sports: r.sports as ReferenceFacility['sports'],
          lat: r.latitude as number,
          lng: r.longitude as number,
        },
        demographics: r.demographics_json,
        custom: { id: r.id },
      }))
    // User-added first so they sort to the top of the reference list.
    return [...added, ...builtins]
  }, [custom])

  // Prefetch the baked tract demand as soon as the map mounts (cached chunk, no
  // server hop) so the demand toggle has zero wait — the data is already in
  // memory by the time the user flips it on.
  useEffect(() => {
    let alive = true
    loadDemandTracts().then((d) => { if (alive) setTracts(d.tracts) })
    return () => { alive = false }
  }, [])

  // Weight each tract by the selected ethnicity pools (summed), filtered to the
  // chosen median-income band. A full-range band keeps every tract (incl. unreported).
  const heatmapPoints = useMemo(() => {
    if (!heatmapOn || !tracts) return null
    const ethIdx = ethnicityIndices(heatmapEths)
    const [lo, hi] = incomeRange
    const filtering = lo > 0 || hi < INCOME_MAX
    const out: { lat: number; lng: number; weight: number }[] = []
    for (const t of tracts) {
      const income = t[TRACT.income]
      // Tracts with no reported income (0) only drop out once a band is set.
      if (filtering && (income <= 0 || income < lo || income > hi)) continue
      let weight = 0
      for (const i of ethIdx) weight += t[i]
      if (weight <= 0) continue
      out.push({ lat: t[TRACT.lat], lng: t[TRACT.lng], weight })
    }
    return out
  }, [heatmapOn, tracts, heatmapEths, incomeRange])

  // Toggle one pool in the multi-select. Total is exclusive: picking it clears
  // the rest, picking anything else clears it, and emptying falls back to it.
  const toggleEthnicity = (label: HeatEthnicity, checked: boolean) => {
    setHeatmapEths((cur) => {
      if (label === 'Total') return ['Total']
      const next = checked
        ? [...cur.filter((l) => l !== 'Total'), label]
        : cur.filter((l) => l !== label)
      return next.length ? next : ['Total']
    })
  }

  // Ranked greenfield suggestions. Scored against every badminton competitor
  // (built-in + user-added, regardless of map filters), so adding or removing a
  // reference facility re-ranks immediately.
  const opportunities = useMemo<Opportunity[]>(() => {
    if (!tracts) return []
    const sites = allCompetitors
      .filter((c) => c.facility.sports.includes('Badminton'))
      .map((c) => ({ name: c.facility.name, lat: c.position.lat, lng: c.position.lng }))
    return findOpportunities(tracts, sites, { radiusMiles: COMPETITION_RADIUS_MILES })
  }, [tracts, allCompetitors])
  const visibleOpportunities = showOpportunities ? opportunities : []

  // Regions that actually appear (across both layers) drive the region dropdown.
  const presentRegions = useMemo(() => {
    const set = new Set<Region>()
    allProperties.forEach((p) => p.region && set.add(p.region))
    allCompetitors.forEach((c) => c.region && set.add(c.region))
    return REGIONS.filter((r) => set.has(r))
  }, [allProperties, allCompetitors])

  const properties = useMemo(() => {
    if (!showProperties) return []
    return allProperties.filter((p) => {
      if (region !== 'all' && p.region !== region) return false
      if (p.courts < minCourts) return false
      if (ratingFilter !== 'all' && p.rating !== ratingFilter) return false
      if (statusFilter !== 'all' && normalizeStatus(p.row.status) !== statusFilter) return false
      const listing = p.row.listing_json
      if (!inRange(listing.totalSqft, ranges.sqft)) return false
      if (!inRange(listing.clearHeight, ranges.height)) return false
      if (!inRange(listing.rentPerSqftYr, ranges.rent)) return false
      if (q && !(`${p.title} ${p.row.address ?? ''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [allProperties, showProperties, region, minCourts, ratingFilter, statusFilter, ranges, q])

  const competitors = useMemo(() => {
    if (!showCompetitors) return []
    return allCompetitors.filter((c) => {
      if (!matchesSport(c.facility.sports, sport)) return false
      if (region !== 'all' && c.region !== region) return false
      if (q && !(`${c.facility.name} ${c.facility.address}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [allCompetitors, showCompetitors, sport, region, q])

  const positions = useMemo(
    () => [...properties.map((p) => p.position), ...competitors.map((c) => c.position)],
    [properties, competitors],
  )

  const selectedProperty =
    selected?.kind === 'property' ? properties.find((p) => p.id === selected.id) ?? null : null
  const selectedCompetitor =
    selected?.kind === 'competitor' ? competitors.find((c) => c.id === selected.id) ?? null : null
  const selectedOpportunity =
    selected?.kind === 'opportunity'
      ? visibleOpportunities.find((o) => o.id === selected.id) ?? null
      : null
  // The ring/isochrone follows whichever marker is currently selected.
  const selectedCenter =
    selectedProperty?.position ??
    selectedCompetitor?.position ??
    (selectedOpportunity ? { lat: selectedOpportunity.lat, lng: selectedOpportunity.lng } : null)
  const selectedId = selected?.id ?? null

  // In drive mode, fetch (and cache) a driving isochrone for the selected marker
  // at the chosen minutes. The catchment-based demand scores stay fixed; this is
  // a visual exploration overlay, the drive-time analogue of the radius slider.
  useEffect(() => {
    if (mapMode !== 'drive' || !selectedCenter || !selectedId) {
      setLiveRing(null)
      setIsoLoading(false)
      return
    }
    const key = `${selectedId}:${driveMinutes}`
    if (key in isoCache.current) {
      setLiveRing(isoCache.current[key])
      setIsoLoading(false)
      return
    }
    let active = true
    setIsoLoading(true)
    getIsochrone(selectedCenter.lat, selectedCenter.lng, driveMinutes)
      // The action itself can reject (server error, network blip) on top of
      // resolving null. Without this the promise rejects unhandled and the
      // overlay hangs in "loading" forever, hiding the unavailable notice.
      .catch((err) => {
        console.warn('[isochrone] lookup failed:', err)
        return null
      })
      .then((ring) => {
        // Only cache successful rings — caching a null (e.g. a transient Mapbox
        // failure, or the token not yet loaded) would permanently disable the
        // overlay for this marker until a page reload. Let failures retry.
        if (ring) isoCache.current[key] = ring
        if (!active) return
        setLiveRing(ring)
        setIsoLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode, selectedId, selectedCenter?.lat, selectedCenter?.lng, driveMinutes])

  // True once a drive-time lookup finished but returned nothing (Mapbox off / failed).
  const driveUnavailable =
    mapMode === 'drive' && selectedCenter != null && !isoLoading && liveRing == null

  if (!apiKey) {
    return (
      <div className="map-unavailable surface rounded-xl p-8 text-center">
        <MapPin className="size-6 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">Map unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set <code className="text-foreground">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the
          map view.
        </p>
      </div>
    )
  }

  const focusFacility = (c: CompetitorPoint) => {
    setSelected({ kind: 'competitor', id: c.id })
    setFocus({ ...c.position })
  }

  return (
    <div className="properties-map space-y-3">
      {/* Toolbar — search, then two panels: Filters (which items show) and
          Layers (what's drawn: sites, competitors, best spots, demand,
          catchment). Badges count what's active inside each. */}
      <div className="map-toolbar flex flex-wrap items-center gap-2">
        <div className="map-search relative w-full sm:w-80">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or address"
            className="map-search-input h-8 w-full pl-8 text-sm"
          />
        </div>

        {/* Filters */}
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className="map-filters-trigger gap-1.5 font-normal shadow-none">
                <SlidersHorizontal className="size-4" />
                Filters
                <CountBadge n={activeFilterCount} />
              </Button>
            }
          />
          <PopoverContent className="map-filters-panel w-[360px] space-y-4">
            <PanelHeader
              title="Filters"
              action={activeFilterCount > 0 ? { label: 'Clear all', onClick: clearMapFilters } : undefined}
            />
            <ChipGroup
              label="Location"
              value={region}
              onChange={(v) => setRegion(v as 'all' | Region)}
              options={[
                { value: 'all', label: 'All' },
                ...presentRegions.map((r) => ({ value: r, label: r })),
              ]}
            />

            <PanelSection title="Your sites">
              <ChipGroup
                label="Rating"
                value={ratingFilter}
                onChange={(v) => setRatingFilter(v as 'all' | Rating)}
                options={[
                  { value: 'all', label: 'All' },
                  ...RATINGS.map((r) => ({ value: r, label: RATING_STYLE[r].label })),
                ]}
              />
              <ChipGroup
                label="Status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as 'all' | PropertyStatus)}
                options={[
                  { value: 'all', label: 'All' },
                  ...PROPERTY_STATUSES.map((st) => ({ value: st, label: STATUS_META[st].label })),
                ]}
              />
              <ChipGroup
                label="Minimum courts"
                value={String(minCourts)}
                onChange={(v) => setMinCourts(Number(v))}
                options={[
                  { value: '0', label: 'Any' },
                  { value: '2', label: '2+' },
                  { value: '4', label: '4+' },
                  { value: '6', label: '6+' },
                  { value: '8', label: '8+' },
                ]}
              />
              <RangeFields ranges={ranges} onChange={setRanges} />
            </PanelSection>

            <PanelSection title="Competitors">
              <ChipGroup
                label="Sport"
                value={sport}
                onChange={(v) => setSport(v as SportFilter)}
                options={(Object.keys(SPORT_FILTER_LABEL) as SportFilter[]).map((k) => ({
                  value: k,
                  label: SPORT_FILTER_LABEL[k],
                }))}
              />
            </PanelSection>
          </PopoverContent>
        </Popover>

        {/* Layers */}
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" className="map-layers-trigger gap-1.5 font-normal shadow-none">
                <Layers className="size-4" />
                Layers
                <CountBadge n={activeLayerCount} />
              </Button>
            }
          />
          <PopoverContent className="map-layers-panel w-[340px] space-y-4">
            <PanelHeader title="Layers" />
            <div className="space-y-1">
              <LayerToggle
                checked={showProperties}
                onChange={setShowProperties}
                swatch={<span className="size-2.5 rounded-full bg-good" />}
                label="My sites"
                count={allProperties.length}
              />
              <LayerToggle
                checked={showCompetitors}
                onChange={setShowCompetitors}
                swatch={
                  <span
                    className="size-2.5 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
                    style={{ background: referenceColor }}
                  />
                }
                label="Competitors"
                count={allCompetitors.length}
              />
              <LayerToggle
                checked={showOpportunities}
                onChange={setShowOpportunities}
                swatch={<Target className="size-3.5" style={{ color: OPPORTUNITY_COLOR }} />}
                label="Best spots"
                hint={`Most Asian residents per badminton club within ${COMPETITION_RADIUS_MILES} mi`}
              />
              <LayerToggle
                checked={heatmapOn}
                onChange={setHeatmapOn}
                swatch={<Flame className="size-3.5 text-caution" />}
                label="Demand heatmap"
                hint="Population by race/ethnicity and income"
              />
            </div>

            {heatmapOn && (
              <PanelSection title="Demand heatmap">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-foreground">Population</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ETHNICITY_OPTIONS.map((o) => {
                      const on = heatmapEths.includes(o.label)
                      return (
                        <button
                          key={o.label}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleEthnicity(o.label, !on)}
                          className={chipClass(on)}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-foreground">Median household income</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      ${Math.round(incomeRange[0] / 1000)}k–${Math.round(incomeRange[1] / 1000)}k
                      {incomeRange[1] >= INCOME_MAX ? '+' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={INCOME_MAX}
                      step={5000}
                      value={incomeRange[0]}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setIncomeRange(([, hi]) => [Math.min(v, hi), hi])
                      }}
                      className="map-income-range h-1 flex-1 cursor-pointer accent-primary"
                      aria-label="Minimum median household income"
                    />
                    <input
                      type="range"
                      min={0}
                      max={INCOME_MAX}
                      step={5000}
                      value={incomeRange[1]}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setIncomeRange(([lo]) => [lo, Math.max(v, lo)])
                      }}
                      className="map-income-range h-1 flex-1 cursor-pointer accent-primary"
                      aria-label="Maximum median household income"
                    />
                  </div>
                </div>
              </PanelSection>
            )}

            <PanelSection title="Catchment around the selected pin">
              <ChipGroup
                label="Show"
                value={mapMode}
                onChange={(v) => setMapMode(v as typeof mapMode)}
                options={[
                  { value: 'drive', label: 'Drive time' },
                  { value: 'radius', label: 'Radius' },
                ]}
              />
              {mapMode === 'drive' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={driveMinutes}
                      onChange={(e) => setDriveMinutes(clampMinutes(Number(e.target.value)))}
                      className="h-8 w-20 tabular-nums"
                      aria-label="Drive time in minutes"
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                    <div className="ml-auto flex gap-1">
                      {[10, 15, 20, 30].map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={driveMinutes === m}
                          onClick={() => setDriveMinutes(m)}
                          className={chipClass(driveMinutes === m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Areas reachable by car. Demand scores always use the {DRIVE_MINUTES}-min badminton
                    catchment.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={15}
                      step={1}
                      value={radiusMiles}
                      onChange={(e) => setRadiusMiles(Number(e.target.value))}
                      aria-label="Trade-area ring radius in miles"
                      className="map-radius-slider flex-1 accent-primary cursor-pointer"
                    />
                    <span className="w-10 text-right text-sm tabular-nums">{radiusMiles} mi</span>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Straight-line distance around the selected pin.
                  </p>
                </div>
              )}
            </PanelSection>
          </PopoverContent>
        </Popover>
      </div>

      {unmappedCount > 0 && (
        <p className="map-note text-xs text-muted-foreground">
          {unmappedCount} {unmappedCount === 1 ? 'site' : 'sites'} couldn&apos;t be placed on the map
          (address missing or not found).
        </p>
      )}
      {driveUnavailable && (
        <p className="map-note text-xs text-muted-foreground">
          Couldn&apos;t load the {driveMinutes}-min drive-time area (Mapbox not configured or no
          roads reachable). Try the radius view.
        </p>
      )}

      <div className="map-layout flex gap-3">
        <div className="map-canvas relative h-[72vh] flex-1 overflow-hidden rounded-xl bg-muted">
          <APIProvider apiKey={apiKey}>
            {mounted && (
              <Map
                mapId={mapId}
                // AppHome unmounts this whole component when you leave the Map
                // tab, and every `new google.maps.Map()` is a billable Dynamic
                // Maps load. `reuseMaps` parks the instance in the library's
                // module-level cache on unmount and re-attaches it on return, so
                // a session costs one map load however often you switch tabs.
                reuseMaps
                defaultCenter={positions[0] ?? NYC_CENTER}
                defaultZoom={10}
                gestureHandling="greedy"
                disableDefaultUI={false}
                clickableIcons={false}
                colorScheme={colorScheme}
                onClick={() => setSelected(null)}
              >
                <FitBounds positions={positions} />
                <DemandHeatmap points={heatmapPoints} />
                <PanTo target={focus} />
                {mapMode === 'drive' ? (
                  <PolygonRing ring={liveRing} color={overlayColor} />
                ) : (
                  <RadiusRing center={selectedCenter} radiusMiles={radiusMiles} color={overlayColor} />
                )}

                {properties.map((p) => {
                  const c = pinColors[p.rating] ?? pinColors.Incomplete
                  return useAdvanced ? (
                    <AdvancedMarker
                      key={p.id}
                      position={p.position}
                      title={p.title}
                      onClick={() => setSelected({ kind: 'property', id: p.id })}
                    >
                      <Pin background={c.bg} borderColor={c.border} glyphColor={c.glyph} />
                    </AdvancedMarker>
                  ) : (
                    <Marker
                      key={p.id}
                      position={p.position}
                      title={p.title}
                      icon={pinIcon(c.bg, c.border, c.glyph)}
                      onClick={() => setSelected({ kind: 'property', id: p.id })}
                    />
                  )
                })}

                {competitors.map((c) => (
                  <Marker
                    key={c.id}
                    position={c.position}
                    title={c.facility.name}
                    icon={competitorIcon(referenceColor)}
                    onClick={() => setSelected({ kind: 'competitor', id: c.id })}
                  />
                ))}

                {visibleOpportunities.map((o) => (
                  <Marker
                    key={o.id}
                    position={{ lat: o.lat, lng: o.lng }}
                    title={`Suggested site #${o.rank}`}
                    icon={opportunityIcon(o.rank)}
                    zIndex={1000 - o.rank}
                    onClick={() => setSelected({ kind: 'opportunity', id: o.id })}
                  />
                ))}

                {selectedProperty && (
                  <InfoWindow
                    position={selectedProperty.position}
                    onCloseClick={() => setSelected(null)}
                    pixelOffset={[0, -36]}
                  >
                    <div
                      className="site-infowindow min-w-44 max-w-64 space-y-1.5 p-0.5 text-foreground"
                      style={INFOWINDOW_VARS}
                    >
                      <p className="font-medium leading-snug">{selectedProperty.title}</p>
                      {selectedProperty.subtitle && (
                        <p className="text-xs text-muted-foreground leading-snug">
                          {selectedProperty.subtitle}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-0.5">
                        <RatingBadge rating={selectedProperty.rating} />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          NOI {fmtMoney(selectedProperty.noi)}
                        </span>
                      </div>
                      {selectedProperty.row.demographics_json && (
                        <DemandMini d={selectedProperty.row.demographics_json} />
                      )}
                      <Button
                        size="sm"
                        className="mt-1 w-full gap-1.5"
                        onClick={() => onView(selectedProperty.row)}
                      >
                        <Eye className="size-3.5" />
                        View analysis
                      </Button>
                    </div>
                  </InfoWindow>
                )}

                {selectedCompetitor && (
                  <InfoWindow
                    position={selectedCompetitor.position}
                    onCloseClick={() => setSelected(null)}
                    pixelOffset={[0, -28]}
                  >
                    <div
                      className="facility-infowindow min-w-44 max-w-64 space-y-1.5 p-0.5 text-foreground"
                      style={INFOWINDOW_VARS}
                    >
                      <a
                        href={facilityUrl(selectedCompetitor.facility)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-medium leading-snug underline-offset-2 hover:underline"
                      >
                        {selectedCompetitor.facility.name}
                      </a>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {selectedCompetitor.facility.address}
                      </p>
                      <SportChips sports={selectedCompetitor.facility.sports} />
                      {selectedCompetitor.demographics && (
                        <DemandMini d={selectedCompetitor.demographics} />
                      )}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            selectedCompetitor.facility.address,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" />
                          Open in Google Maps
                        </a>
                        {selectedCompetitor.custom && (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openEditFacility(selectedCompetitor.custom!.id)}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFacility(selectedCompetitor.custom!.id)}
                              className="inline-flex items-center gap-1 text-xs text-risk hover:text-risk/80"
                            >
                              <Trash2 className="size-3.5" />
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </InfoWindow>
                )}

                {selectedOpportunity && (
                  <InfoWindow
                    position={{ lat: selectedOpportunity.lat, lng: selectedOpportunity.lng }}
                    onCloseClick={() => setSelected(null)}
                    pixelOffset={[0, -16]}
                  >
                    <div
                      className="opportunity-infowindow min-w-48 max-w-64 space-y-1.5 p-0.5 text-foreground"
                      style={INFOWINDOW_VARS}
                    >
                      <p className="font-medium leading-snug">
                        Suggested site #{selectedOpportunity.rank}
                      </p>
                      <OpportunityStats o={selectedOpportunity} />
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedOpportunity.lat},${selectedOpportunity.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 pt-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                        Open in Google Maps
                      </a>
                    </div>
                  </InfoWindow>
                )}
              </Map>
            )}
          </APIProvider>

          {/* Legend */}
          <div className="map-legend surface shadow-lift absolute bottom-2 left-2 space-y-1 px-2.5 py-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5" aria-hidden>
                <span className="inline-block size-2 rounded-full bg-good" />
                <span className="inline-block size-2 rounded-full bg-info" />
                <span className="inline-block size-2 rounded-full bg-caution" />
                <span className="inline-block size-2 rounded-full bg-risk" />
              </span>
              <span className="text-muted-foreground">Your candidate sites (by rating)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
                style={{ background: referenceColor }}
              />
              <span className="text-muted-foreground">Reference facilities</span>
            </div>
            {showOpportunities && (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: OPPORTUNITY_COLOR }}
                />
                <span className="text-muted-foreground">Suggested sites (ranked)</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {/* Legend glyph for the stroked catchment drawing on the map (content, not a UI border). */}
              <svg viewBox="0 0 10 10" className="size-2.5 text-primary" aria-hidden>
                <circle cx="5" cy="5" r="4.25" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="text-muted-foreground">
                {mapMode === 'drive'
                  ? `${driveMinutes}-min drive area (selected)`
                  : `${radiusMiles}-mi radius (selected)`}
              </span>
            </div>
          </div>
        </div>

        {/* Reference list */}
        <aside className="reference-list surface hidden lg:flex w-72 shrink-0 flex-col h-[72vh] overflow-hidden rounded-xl">
          {showOpportunities && (
            <div className="opportunity-list flex max-h-[45%] shrink-0 flex-col pb-2">
              <div className="px-3 pt-3 pb-2">
                <p className="font-display text-sm font-semibold text-foreground">Suggested sites</p>
                <p className="text-xs text-muted-foreground leading-snug">
                  Most Asian residents per badminton facility within {COMPETITION_RADIUS_MILES} mi.
                  Re-ranks as facilities are added.
                </p>
              </div>
              <div className="overflow-y-auto space-y-0.5 px-1.5">
                {opportunities.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Loading demand data…</p>
                ) : (
                  opportunities.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelected({ kind: 'opportunity', id: o.id })
                        setFocus({ lat: o.lat, lng: o.lng })
                      }}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                        selected?.kind === 'opportunity' && selected.id === o.id
                          ? 'bg-muted'
                          : 'even:bg-muted/40 hover:bg-muted/70'
                      }`}
                    >
                      <span
                        className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: OPPORTUNITY_COLOR }}
                      >
                        {o.rank}
                      </span>
                      <OpportunityStats o={o} />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          <div className="reference-list-header flex items-center justify-between gap-2 px-3 pt-3 pb-2">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-foreground">Reference facilities</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {competitors.length} of {allCompetitors.length} shown
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="reference-color-picker"
                      aria-label="Reference facility dot color"
                    >
                      <span
                        className="size-3 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
                        style={{ background: referenceColor }}
                      />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-auto p-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {REFERENCE_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateReferenceColor(c)}
                        aria-label={`Use ${c}`}
                        aria-pressed={referenceColor.toLowerCase() === c.toLowerCase()}
                        className={`flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          referenceColor.toLowerCase() === c.toLowerCase()
                            ? 'bg-primary'
                            : 'bg-field hover:bg-field-hover'
                        }`}
                      >
                        <span className={`size-5 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.45)]`} style={{ background: c }} />
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-2 pt-2">
                    <label htmlFor="ref-color-custom" className="text-xs text-muted-foreground">
                      Custom
                    </label>
                    <input
                      id="ref-color-custom"
                      type="color"
                      value={referenceColor}
                      onChange={(e) => updateReferenceColor(e.target.value)}
                      className="h-7 w-9 cursor-pointer rounded-md bg-field p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateReferenceColor(COMPETITOR_COLOR)}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {!demo && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  className="map-add-facility"
                  aria-label="Add reference facility"
                  onClick={openAddFacility}
                >
                  <Plus className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="reference-list-items flex-1 overflow-y-auto space-y-0.5 px-1.5 pb-1.5">
            {competitors.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No facilities match the filters.</p>
            ) : (
              competitors.map((c) => (
                <div key={c.id} className="reference-item group relative rounded-lg even:bg-muted/40">
                  {/* div rather than <button> so the name can be a real link inside it. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => focusFacility(c)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        focusFacility(c)
                      }
                    }}
                    className={`block w-full cursor-pointer rounded-lg text-left px-2 py-2.5 outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors ${
                      selected?.kind === 'competitor' && selected.id === c.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 inline-block size-2.5 shrink-0 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
                        style={{ background: referenceColor }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug text-foreground truncate pr-5">
                          <a
                            href={facilityUrl(c.facility)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="underline-offset-2 hover:underline"
                          >
                            {c.facility.name}
                          </a>
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug truncate">
                          {c.facility.address}
                        </p>
                        <SportChips sports={c.facility.sports} className="mt-1" />
                        {c.demographics && (
                          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                            Badminton demand {c.demographics.badmintonFit.score}
                            {' · '}
                            {catchmentLabel(c.demographics)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {c.custom && !demo && (
                    <div className="absolute right-2 top-2 hidden items-center gap-0.5 group-hover:flex">
                      <button
                        type="button"
                        onClick={() => openEditFacility(c.custom!.id)}
                        aria-label={`Edit ${c.facility.name}`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFacility(c.custom!.id)}
                        aria-label={`Remove ${c.facility.name}`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-risk/10 hover:text-risk"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      <AddFacilityDialog
        open={addOpen}
        editing={editingFacility}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) setEditingFacility(null)
        }}
        onSaved={(row) => {
          setCustom((cur) =>
            cur.some((r) => r.id === row.id)
              ? cur.map((r) => (r.id === row.id ? row : r))
              : [row, ...cur],
          )
          setShowCompetitors(true)
          if (row.latitude != null && row.longitude != null) {
            setSelected({ kind: 'competitor', id: `custom-${row.id}` })
            setFocus({ lat: row.latitude, lng: row.longitude })
          }
        }}
      />
    </div>
  )
}
