'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Marker,
  InfoWindow,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps'
import type { PropertyRow } from '@/lib/supabase/types'
import { calculateAnalysis } from '@/lib/calculator'
import { DEFAULT_ASSUMPTIONS } from '@/lib/constants'
import { fmtMoney, fmtPct } from '@/lib/format'
import { FACILITY_DEMOGRAPHICS } from '@/lib/facility-demographics'
import { DRIVE_MINUTES } from '@/lib/catchment'
import type { Demographics, FitScore, FitLabel } from '@/types/demographics'
import { RatingBadge } from '@/components/Dashboard/RatingBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getIsochrone } from '@/app/actions/isochrone'
import {
  loadDemandTracts,
  ETHNICITY_OPTIONS,
  INCOME_MAX,
  TRACT,
  type DemandTract,
  type HeatEthnicity,
} from '@/lib/demand-tracts-data'
import { MapPin, Eye, ExternalLink, Search, Plus, Trash2, Pencil, Clock, Circle, ChevronDown, Flame } from 'lucide-react'
import type { Rating } from '@/types/analysis'
import { REGIONS, detectRegion, type Region } from '@/lib/region'
import {
  REFERENCE_FACILITIES,
  facilityRegion,
  type Sport,
  type ReferenceFacility,
} from '@/lib/reference-facilities'
import {
  listReferenceFacilities,
  deleteReferenceFacility,
} from '@/app/actions/reference-facilities'
import type { ReferenceFacilityRow } from '@/lib/supabase/types'
import { AddFacilityDialog } from '@/components/AddFacilityDialog'

// Pin colors mirror the rating semantics used elsewhere in the app.
const RATING_COLOR: Record<Rating, { bg: string; border: string; glyph: string }> = {
  'Strong Candidate': { bg: '#10b981', border: '#059669', glyph: '#ffffff' },
  'Worth Investigating': { bg: '#38bdf8', border: '#0ea5e9', glyph: '#ffffff' },
  'Risky': { bg: '#f59e0b', border: '#d97706', glyph: '#ffffff' },
  'Do Not Pursue': { bg: '#f43f5e', border: '#e11d48', glyph: '#ffffff' },
  'Incomplete': { bg: '#94a3b8', border: '#64748b', glyph: '#ffffff' },
}

const NYC_CENTER = { lat: 40.73, lng: -73.85 }

// Default trade-area radius drawn around the selected marker — mirrors the
// 5-mile radius the Census demographics are aggregated over (lib/census-core.ts).
// The slider lets the user resize the *visual* ring; demand scores stay at 5 mi.
const DEFAULT_RADIUS_MILES = 5
const MILE_IN_METERS = 1609.344

// Clamp manual drive-time entry to Mapbox's supported 1–60 minute range.
const clampMinutes = (n: number) => Math.max(1, Math.min(60, Math.round(Number.isFinite(n) ? n : 15)))

// Shared classes for the segmented catchment-mode buttons.
const segBtn = (active: boolean) =>
  `flex h-full items-center gap-1.5 px-2.5 text-sm transition ${
    active ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
  }`

// Competitor facilities share one high-contrast marker so they read as a single
// "reference" layer, clearly distinct from the rating-colored candidate-site
// pins. White-on-dark is the most legible against the dark basemap; the sport
// is conveyed by the chips in the popup / list, not the marker color.
const COMPETITOR_COLOR = '#ffffff'
const COMPETITOR_RING = '#0f172a'

// Teardrop pin (candidate sites) — used for the legacy-marker fallback when no
// cloud Map ID is configured (Advanced Markers require a Map ID).
function pinIcon(bg: string, border: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">` +
    `<path d="M14 0C6.27 0 0 6.27 0 14c0 9.45 14 26 14 26s14-16.55 14-26C28 6.27 21.73 0 14 0z" ` +
    `fill="${bg}" stroke="${border}" stroke-width="1.5"/>` +
    `<circle cx="14" cy="14" r="5" fill="#ffffff"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Circle marker (competitor facilities). The fill color is user-configurable
// (defaults to white); the dark ring keeps it legible on the dark basemap.
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

type Selected = { kind: 'property' | 'competitor'; id: string } | null

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
}: {
  center: { lat: number; lng: number } | null
  radiusMiles: number
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
        strokeColor: '#f43f5e',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#f43f5e',
        fillOpacity: 0.07,
        clickable: false,
      })
    }
    // Mutating the existing circle (vs. recreating) keeps the ring from
    // flickering while the user drags the radius slider.
    circleRef.current.setCenter(center)
    circleRef.current.setRadius(radiusMiles * MILE_IN_METERS)
  }, [map, center?.lat, center?.lng, radiusMiles])
  // Tear the circle down when the map unmounts.
  useEffect(() => () => circleRef.current?.setMap(null), [])
  return null
}

/**
 * Draws a single drive-time isochrone polygon (the live overlay the user tunes
 * via the Drive-time menu). Ring is [lng,lat] pairs; we convert to {lat,lng}.
 */
function PolygonRing({ ring }: { ring: number[][] | null }) {
  const map = useMap()
  const polyRef = useRef<google.maps.Polygon | null>(null)
  useEffect(() => {
    polyRef.current?.setMap(null)
    polyRef.current = null
    if (!map || !ring) return
    polyRef.current = new google.maps.Polygon({
      map,
      paths: ring.map(([lng, lat]) => ({ lat, lng })),
      strokeColor: '#f43f5e',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: '#f43f5e',
      fillOpacity: 0.07,
      clickable: false,
    })
    return () => {
      polyRef.current?.setMap(null)
      polyRef.current = null
    }
  }, [map, ring])
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
 * which blocked the main thread on every toggle/sport-change and repainted all
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

  // Push new data (initial load / sport toggle / off) and request a redraw —
  // no overlay teardown, just a restamp on the next frame.
  useEffect(() => {
    let max = 0
    if (points) for (const p of points) if (p.weight > max) max = p.weight
    dataRef.current = { points, max }
    overlayRef.current?.schedule()
  }, [points])

  return null
}

// Fit-label colors tuned for the white InfoWindow (dark text on light chips).
const FIT_PILL: Record<FitLabel, string> = {
  Strong: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Moderate: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Weak: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}

function FitPill({ sport, fit }: { sport: string; fit: FitScore }) {
  return (
    <span
      className={`fit-pill inline-flex flex-1 items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ${FIT_PILL[fit.label]}`}
      title={`${fit.label} demand`}
    >
      <span>{sport}</span>
      <span className="tabular-nums">{fit.score}</span>
    </span>
  )
}

/** Compact 5-mile trade-area summary shown inside a map InfoWindow. */
function DemandMini({ d }: { d: Demographics }) {
  return (
    <div className="demand-mini mt-1 space-y-1 border-t border-black/10 pt-1.5">
      <div className="flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          {d.mode === 'drive'
            ? `Demand · ${DRIVE_MINUTES.badminton}/${DRIVE_MINUTES.pickleball}-min drive`
            : `Demand · ${d.radiusMiles}-mi radius`}
        </span>
        <span className="tabular-nums">{d.totalPopulation.toLocaleString()} people</span>
      </div>
      <div className="flex gap-1.5">
        <FitPill sport="Badminton" fit={d.badmintonFit} />
        <FitPill sport="Pickleball" fit={d.pickleballFit} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-neutral-600">
        <span>East + South Asian</span>
        <span className="tabular-nums">{fmtPct(d.ethnicity.targetShare)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-neutral-600">
        <span>Mean income</span>
        <span className="tabular-nums">
          {d.meanHouseholdIncome != null ? fmtMoney(d.meanHouseholdIncome) : '—'}
        </span>
      </div>
    </div>
  )
}

function SportChips({ sports }: { sports: Sport[] }) {
  return (
    <div className="sport-chips flex flex-wrap gap-1">
      {sports.map((s) => (
        <span
          key={s}
          className="sport-chip inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ring-1"
          style={{
            color: s === 'Badminton' ? '#a5b4fc' : '#5eead4',
            borderColor: s === 'Badminton' ? '#6366f155' : '#14b8a655',
            backgroundColor: s === 'Badminton' ? '#6366f118' : '#14b8a618',
          }}
        >
          {s}
        </span>
      ))}
    </div>
  )
}

export function PropertiesMap({ rows, onView, unmappedCount = 0, demo = false }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  // Advanced Markers require a real cloud Map ID. When one isn't configured we
  // fall back to classic colored markers so the map still works (and we avoid
  // the "initialized without a valid Map ID" warning).
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
  const useAdvanced = !!mapId

  const [selected, setSelected] = useState<Selected>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES)
  const [driveMinutes, setDriveMinutes] = useState(15)
  const [mapMode, setMapMode] = useState<'radius' | 'drive'>('drive')
  // Demand heatmap (greenfield finder) — baked tract data loaded on first enable.
  const [heatmapOn, setHeatmapOn] = useState(false)
  const [heatmapEth, setHeatmapEth] = useState<HeatEthnicity>('Total')
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
  const [sport, setSport] = useState<'all' | Sport | 'both'>('all')
  const [region, setRegion] = useState<'all' | Region>('all')
  const [minCourts, setMinCourts] = useState(0)
  const [search, setSearch] = useState('')

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

  useEffect(() => {
    if (demo) return
    let active = true
    listReferenceFacilities().then((list) => {
      if (active) setCustom(list)
    })
    return () => {
      active = false
    }
  }, [demo])

  const handleDeleteFacility = (id: string) => {
    setCustom((cur) => cur.filter((r) => r.id !== id))
    setSelected((cur) => (cur?.kind === 'competitor' && cur.id === `custom-${id}` ? null : cur))
    void deleteReferenceFacility(id)
  }

  const q = search.trim().toLowerCase()

  // All candidate-site points (geocoded saved properties), with analysis.
  const allProperties = useMemo<PropertyPoint[]>(() => {
    return rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => {
        const result = calculateAnalysis({
          listing: r.listing_json,
          assumptions: { ...DEFAULT_ASSUMPTIONS, ...r.assumptions_json },
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
          sports: r.sports as Sport[],
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

  // Weight each tract by the selected ethnicity pool, filtered to the chosen
  // median-income band. A full-range band keeps every tract (incl. unreported).
  const heatmapPoints = useMemo(() => {
    if (!heatmapOn || !tracts) return null
    const ethIdx = ETHNICITY_OPTIONS.find((o) => o.label === heatmapEth)?.index ?? TRACT.total
    const [lo, hi] = incomeRange
    const filtering = lo > 0 || hi < INCOME_MAX
    const out: { lat: number; lng: number; weight: number }[] = []
    for (const t of tracts) {
      const income = t[TRACT.income]
      // Tracts with no reported income (0) only drop out once a band is set.
      if (filtering && (income <= 0 || income < lo || income > hi)) continue
      const weight = t[ethIdx]
      if (weight <= 0) continue
      out.push({ lat: t[TRACT.lat], lng: t[TRACT.lng], weight })
    }
    return out
  }, [heatmapOn, tracts, heatmapEth, incomeRange])

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
      if (q && !(`${p.title} ${p.row.address ?? ''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [allProperties, showProperties, region, minCourts, q])

  const competitors = useMemo(() => {
    if (!showCompetitors) return []
    return allCompetitors.filter((c) => {
      if (sport === 'both') {
        if (!(c.facility.sports.includes('Badminton') && c.facility.sports.includes('Pickleball')))
          return false
      } else if (sport !== 'all' && !c.facility.sports.includes(sport)) {
        return false
      }
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
  // The ring/isochrone follows whichever marker is currently selected.
  const selectedCenter = selectedProperty?.position ?? selectedCompetitor?.position ?? null
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
    getIsochrone(selectedCenter.lat, selectedCenter.lng, driveMinutes).then((ring) => {
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
      <div className="map-unavailable rounded-xl ring-1 ring-border bg-card p-8 text-center">
        <MapPin className="size-6 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Map unavailable</p>
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
      {/* Filter bar — two grouped rows: layers + search/actions on top,
          filters + catchment overlay below. */}
      <div className="map-filter-bar space-y-2">
        {/* Row 1 — layers (left) · search + add (right) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="map-layer-toggles flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={showProperties ? 'default' : 'outline'}
              onClick={() => setShowProperties((v) => !v)}
              className="map-layer-toggle gap-1.5"
            >
              <span className="size-2 rounded-full bg-emerald-400" />
              My sites ({allProperties.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={showCompetitors ? 'default' : 'outline'}
              onClick={() => setShowCompetitors((v) => !v)}
              className="map-layer-toggle gap-1.5"
            >
              <span
                className="size-2 rounded-full ring-1 ring-black/30"
                style={{ background: referenceColor }}
              />
              Competitors ({allCompetitors.length})
            </Button>

            <Button
              type="button"
              size="sm"
              variant={heatmapOn ? 'default' : 'outline'}
              onClick={() => setHeatmapOn((v) => !v)}
              className="map-heatmap-toggle gap-1.5"
              title="Demand heatmap — population by race/ethnicity & income across the NYC metro"
            >
              <Flame className="size-3.5" />
              Demand
            </Button>
            {heatmapOn && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={heatmapEth} onValueChange={(v) => setHeatmapEth(v as HeatEthnicity)}>
                  <SelectTrigger size="sm" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ETHNICITY_OPTIONS.map((o) => (
                      <SelectItem key={o.label} value={o.label}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div
                  className="flex items-center gap-1.5"
                  title="Filter tracts by median household income"
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Income
                  </span>
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
                    className="map-income-range h-1 w-16 cursor-pointer"
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
                    className="map-income-range h-1 w-16 cursor-pointer"
                    aria-label="Maximum median household income"
                  />
                  <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    ${Math.round(incomeRange[0] / 1000)}k–${Math.round(incomeRange[1] / 1000)}k
                    {incomeRange[1] >= INCOME_MAX ? '+' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="map-search relative ml-auto">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or address"
              className="map-search-input h-8 w-[220px] pl-8 text-sm"
            />
          </div>
        </div>

        {/* Row 2 — filters (left) · catchment overlay (right) */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="map-filters flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Filter
            </span>
            <Select value={sport} onValueChange={(v) => setSport(v as 'all' | Sport | 'both')}>
            <SelectTrigger size="sm" className="map-filter-sport w-[170px]">
              <span className="text-muted-foreground">Sport:</span>
              <SelectValue>
                {(v: string) => (v === 'all' ? 'All' : v === 'both' ? 'Badminton + Pickleball' : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Badminton">Badminton</SelectItem>
              <SelectItem value="Pickleball">Pickleball</SelectItem>
              <SelectItem value="both">Badminton + Pickleball</SelectItem>
            </SelectContent>
          </Select>

          <Select value={region} onValueChange={(v) => setRegion(v as 'all' | Region)}>
            <SelectTrigger size="sm" className="map-filter-location w-[180px]">
              <span className="text-muted-foreground">Location:</span>
              <SelectValue>{(v: string) => (v === 'all' ? 'All' : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {presentRegions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(minCourts)} onValueChange={(v) => setMinCourts(Number(v))}>
            <SelectTrigger size="sm" className="map-filter-courts w-[150px]">
              <span className="text-muted-foreground">Courts:</span>
              <SelectValue>{(v: string) => (v === '0' ? 'All' : `${v}+`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
              <SelectItem value="6">6+</SelectItem>
              <SelectItem value="8">8+</SelectItem>
            </SelectContent>
          </Select>

          </div>

          <div className="map-catchment flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Catchment
            </span>
            <div className="map-catchment-mode flex items-center rounded-md border border-input h-8 overflow-hidden">
            {/* Drive time → minutes menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" />}
                onClick={() => setMapMode('drive')}
                className={segBtn(mapMode === 'drive')}
              >
                <Clock className="size-3.5" />
                Drive time
                {mapMode === 'drive' && (
                  <span className="tabular-nums text-muted-foreground">· {driveMinutes}m</span>
                )}
                <ChevronDown className="size-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 space-y-2.5 p-3">
                <div className="text-xs font-medium">Drive-time area</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={driveMinutes}
                    onChange={(e) => setDriveMinutes(clampMinutes(Number(e.target.value)))}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-8 w-20"
                    aria-label="Drive time in minutes"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <div className="flex gap-1">
                  {[10, 15, 20, 30].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDriveMinutes(m)}
                      className={`flex-1 rounded border px-1.5 py-1 text-xs transition ${
                        driveMinutes === m
                          ? 'border-rose-500/60 bg-rose-500/10 text-foreground'
                          : 'border-input text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Driving distance reachable around the selected marker. Demand scores still use the
                  fixed per-sport catchments.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Radius → miles slider menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button type="button" />}
                onClick={() => setMapMode('radius')}
                className={`${segBtn(mapMode === 'radius')} border-l border-input`}
              >
                <Circle className="size-3.5" />
                Radius
                {mapMode === 'radius' && (
                  <span className="tabular-nums text-muted-foreground">· {radiusMiles}mi</span>
                )}
                <ChevronDown className="size-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 space-y-2.5 p-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Radius</span>
                  <span className="tabular-nums text-muted-foreground">{radiusMiles} mi</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(Number(e.target.value))}
                  aria-label="Trade-area ring radius in miles"
                  className="map-radius-slider w-full accent-rose-500 cursor-pointer"
                />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Straight-line distance around the selected marker.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {minCourts > 0 && (
        <p className="map-note text-xs text-muted-foreground">
          Court filter applies to your sites only — competitor court counts aren&apos;t published.
        </p>
      )}
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
        <div className="map-canvas relative h-[72vh] flex-1 overflow-hidden rounded-xl ring-1 ring-border">
          <APIProvider apiKey={apiKey}>
            <Map
              mapId={mapId}
              defaultCenter={positions[0] ?? NYC_CENTER}
              defaultZoom={10}
              gestureHandling="greedy"
              disableDefaultUI={false}
              clickableIcons={false}
              colorScheme="DARK"
              onClick={() => setSelected(null)}
            >
              <FitBounds positions={positions} />
              <DemandHeatmap points={heatmapPoints} />
              <PanTo target={focus} />
              {mapMode === 'drive' ? (
                <PolygonRing ring={liveRing} />
              ) : (
                <RadiusRing center={selectedCenter} radiusMiles={radiusMiles} />
              )}

              {properties.map((p) => {
                const c = RATING_COLOR[p.rating] ?? RATING_COLOR.Incomplete
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
                    icon={pinIcon(c.bg, c.border)}
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

              {selectedProperty && (
                <InfoWindow
                  position={selectedProperty.position}
                  onCloseClick={() => setSelected(null)}
                  pixelOffset={[0, -36]}
                >
                  <div className="site-infowindow min-w-44 max-w-64 space-y-1.5 p-0.5 text-neutral-900">
                    <p className="font-medium leading-snug text-black">{selectedProperty.title}</p>
                    {selectedProperty.subtitle && (
                      <p className="text-xs text-neutral-600 leading-snug">
                        {selectedProperty.subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-0.5">
                      <RatingBadge rating={selectedProperty.rating} />
                      <span className="text-xs text-neutral-600">
                        NOI {fmtMoney(selectedProperty.noi)}
                      </span>
                    </div>
                    {selectedProperty.row.demographics_json && (
                      <DemandMini d={selectedProperty.row.demographics_json} />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 w-full gap-1.5 text-white hover:text-white"
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
                  <div className="facility-infowindow min-w-44 max-w-64 space-y-1.5 p-0.5 text-neutral-900">
                    <p className="font-medium leading-snug text-black">
                      {selectedCompetitor.facility.name}
                    </p>
                    <p className="text-xs text-neutral-600 leading-snug">
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
                        className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-black"
                      >
                        <ExternalLink className="size-3.5" />
                        Open in Google Maps
                      </a>
                      {selectedCompetitor.custom && (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEditFacility(selectedCompetitor.custom!.id)}
                            className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-black"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFacility(selectedCompetitor.custom!.id)}
                            className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
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
            </Map>
          </APIProvider>

          {/* Legend */}
          <div className="map-legend absolute bottom-2 left-2 rounded-lg bg-background/80 backdrop-blur ring-1 ring-border px-2.5 py-2 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full bg-emerald-400" />
              <span className="text-muted-foreground">Your candidate sites (by rating)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full ring-1 ring-black/40"
                style={{ background: referenceColor }}
              />
              <span className="text-muted-foreground">Reference Facilities</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full border border-rose-500 bg-rose-500/10" />
              <span className="text-muted-foreground">
                {mapMode === 'drive'
                  ? `${driveMinutes}-min drive area (selected)`
                  : `${radiusMiles}-mi radius (selected)`}
              </span>
            </div>
          </div>
        </div>

        {/* Reference list */}
        <aside className="reference-list hidden lg:flex w-72 shrink-0 flex-col h-[72vh] rounded-xl ring-1 ring-border bg-card">
          <div className="reference-list-header flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <div className="min-w-0">
              <p className="text-sm font-medium">Reference Facilities</p>
              <p className="text-xs text-muted-foreground">
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
                        className="size-3 rounded-full ring-1 ring-black/40"
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
                        className={`size-6 rounded-full ring-1 transition ${
                          referenceColor.toLowerCase() === c.toLowerCase()
                            ? 'ring-2 ring-primary'
                            : 'ring-black/30 hover:ring-foreground/50'
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                    <label htmlFor="ref-color-custom" className="text-xs text-muted-foreground">
                      Custom
                    </label>
                    <input
                      id="ref-color-custom"
                      type="color"
                      value={referenceColor}
                      onChange={(e) => updateReferenceColor(e.target.value)}
                      className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
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
          <div className="reference-list-items flex-1 overflow-y-auto divide-y divide-border">
            {competitors.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No facilities match the filters.</p>
            ) : (
              competitors.map((c) => (
                <div key={c.id} className="reference-item group relative">
                  <button
                    type="button"
                    onClick={() => focusFacility(c)}
                    className={`block w-full text-left px-3 py-2 hover:bg-foreground/5 transition ${
                      selected?.kind === 'competitor' && selected.id === c.id ? 'bg-foreground/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/30"
                        style={{ background: referenceColor }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug truncate pr-5">
                          {c.facility.name}
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug truncate">
                          {c.facility.address}
                        </p>
                        <div className="mt-1">
                          <SportChips sports={c.facility.sports} />
                        </div>
                        {c.demographics && (
                          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                            5-mi demand · Badminton {c.demographics.badmintonFit.score}
                            {' · '}Pickleball {c.demographics.pickleballFit.score}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                  {c.custom && (
                    <div className="absolute right-2 top-2 hidden items-center gap-0.5 group-hover:flex">
                      <button
                        type="button"
                        onClick={() => openEditFacility(c.custom!.id)}
                        aria-label={`Edit ${c.facility.name}`}
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFacility(c.custom!.id)}
                        aria-label={`Remove ${c.facility.name}`}
                        className="rounded p-1 text-muted-foreground hover:text-rose-400"
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
