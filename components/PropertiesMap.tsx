'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { MapPin, Eye, ExternalLink, Search } from 'lucide-react'
import type { Rating } from '@/types/analysis'
import { REGIONS, detectRegion, type Region } from '@/lib/region'
import {
  REFERENCE_FACILITIES,
  facilityRegion,
  type Sport,
  type ReferenceFacility,
} from '@/lib/reference-facilities'

// Pin colors mirror the rating semantics used elsewhere in the app.
const RATING_COLOR: Record<Rating, { bg: string; border: string; glyph: string }> = {
  'Strong Candidate': { bg: '#10b981', border: '#059669', glyph: '#ffffff' },
  'Worth Investigating': { bg: '#38bdf8', border: '#0ea5e9', glyph: '#ffffff' },
  'Risky': { bg: '#f59e0b', border: '#d97706', glyph: '#ffffff' },
  'Do Not Pursue': { bg: '#f43f5e', border: '#e11d48', glyph: '#ffffff' },
  'Incomplete': { bg: '#94a3b8', border: '#64748b', glyph: '#ffffff' },
}

const NYC_CENTER = { lat: 40.73, lng: -73.85 }

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

// Circle marker (competitor facilities) — uniform white with a dark ring.
function competitorIcon(): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">` +
    `<circle cx="13" cy="13" r="9" fill="${COMPETITOR_COLOR}" stroke="${COMPETITOR_RING}" stroke-width="3"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

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
  image: string | null
  row: PropertyRow
}

interface CompetitorPoint {
  kind: 'competitor'
  id: string
  position: { lat: number; lng: number }
  region: Region | null
  facility: ReferenceFacility
}

type Selected = { kind: 'property' | 'competitor'; id: string } | null

interface Props {
  rows: PropertyRow[]
  onView: (row: PropertyRow) => void
  /** Count of rows that have an address but no coordinates yet. */
  unmappedCount?: number
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
        <span>Demand · {d.radiusMiles}-mi radius</span>
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

export function PropertiesMap({ rows, onView, unmappedCount = 0 }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  // Advanced Markers require a real cloud Map ID. When one isn't configured we
  // fall back to classic colored markers so the map still works (and we avoid
  // the "initialized without a valid Map ID" warning).
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
  const useAdvanced = !!mapId

  const [selected, setSelected] = useState<Selected>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)

  // Filters.
  const [showProperties, setShowProperties] = useState(true)
  const [showCompetitors, setShowCompetitors] = useState(true)
  const [sport, setSport] = useState<'all' | Sport | 'both'>('all')
  const [region, setRegion] = useState<'all' | Region>('all')
  const [minCourts, setMinCourts] = useState(0)
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()

  // All candidate-site points (geocoded saved properties), with analysis.
  const allProperties = useMemo<PropertyPoint[]>(() => {
    return rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => {
        const result = calculateAnalysis({
          listing: r.listing_json,
          assumptions: { ...DEFAULT_ASSUMPTIONS, ...r.assumptions_json },
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
          image: (r.listing_json.imageUrls ?? [])[0] ?? null,
          row: r,
        }
      })
  }, [rows])

  const allCompetitors = useMemo<CompetitorPoint[]>(() => {
    return REFERENCE_FACILITIES.map((f) => ({
      kind: 'competitor' as const,
      id: f.name,
      position: { lat: f.lat, lng: f.lng },
      region: facilityRegion(f),
      facility: f,
    }))
  }, [])

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
      {/* Filter bar */}
      <div className="map-filter-bar flex flex-wrap items-center gap-2">
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
            <span className="size-2 rounded-full bg-white ring-1 ring-black/30" />
            Competitors ({allCompetitors.length})
          </Button>
        </div>

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

        <div className="map-search relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or address"
            className="map-search-input h-8 w-[220px] pl-8 text-sm"
          />
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
              <PanTo target={focus} />

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
                  icon={competitorIcon()}
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
                    {selectedProperty.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedProperty.image}
                        alt={selectedProperty.title}
                        className="h-28 w-full rounded-md object-cover ring-1 ring-black/10"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
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
                    {FACILITY_DEMOGRAPHICS[selectedCompetitor.facility.name] && (
                      <DemandMini d={FACILITY_DEMOGRAPHICS[selectedCompetitor.facility.name]} />
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        selectedCompetitor.facility.address,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-black"
                    >
                      <ExternalLink className="size-3.5" />
                      Open in Google Maps
                    </a>
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
              <span className="inline-block size-2.5 rounded-full bg-white ring-1 ring-black/40" />
              <span className="text-muted-foreground">Reference facilities</span>
            </div>
          </div>
        </div>

        {/* Reference list */}
        <aside className="reference-list hidden lg:flex w-72 shrink-0 flex-col h-[72vh] rounded-xl ring-1 ring-border bg-card">
          <div className="reference-list-header px-3 py-2 border-b border-border">
            <p className="text-sm font-medium">Reference facilities</p>
            <p className="text-xs text-muted-foreground">
              {competitors.length} of {allCompetitors.length} shown
            </p>
          </div>
          <div className="reference-list-items flex-1 overflow-y-auto divide-y divide-border">
            {competitors.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No facilities match the filters.</p>
            ) : (
              competitors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => focusFacility(c)}
                  className={`reference-item block w-full text-left px-3 py-2 hover:bg-foreground/5 transition ${
                    selected?.kind === 'competitor' && selected.id === c.id ? 'bg-foreground/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-block size-2.5 shrink-0 rounded-full bg-white ring-1 ring-black/30" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{c.facility.name}</p>
                      <p className="text-xs text-muted-foreground leading-snug truncate">
                        {c.facility.address}
                      </p>
                      <div className="mt-1">
                        <SportChips sports={c.facility.sports} />
                      </div>
                      {FACILITY_DEMOGRAPHICS[c.facility.name] && (
                        <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                          5-mi demand · Badminton {FACILITY_DEMOGRAPHICS[c.facility.name].badmintonFit.score}
                          {' · '}Pickleball {FACILITY_DEMOGRAPHICS[c.facility.name].pickleballFit.score}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
