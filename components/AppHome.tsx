'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, List, Map as MapIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardTable } from '@/components/DashboardTable'
import { PropertiesMap } from '@/components/PropertiesMap'
import { EditorSheet } from '@/components/EditorSheet'
import { VerdictModal } from '@/components/VerdictModal'
import { FloorPlannerOverlay } from '@/components/FloorPlanner/FloorPlannerOverlay'
import { BookmarkletHelper } from '@/components/BookmarkletHelper'
import { listProperties } from '@/app/actions/list-properties'
import { deleteProperty } from '@/app/actions/delete-property'
import { updatePropertyStatus } from '@/app/actions/update-status'
import { updatePropertyInterested } from '@/app/actions/update-interested'
import type { PropertyStatus } from '@/lib/property-status'
import { geocodeMissing } from '@/app/actions/geocode-missing'
import { backfillDemographics } from '@/app/actions/backfill-demographics'
import { backfillConditions } from '@/app/actions/backfill-conditions'
import { listReferenceFacilities } from '@/app/actions/reference-facilities'
import { buildCompetitorSites } from '@/lib/competition'
import { DEMO_PROPERTIES } from '@/lib/demo-data'
import type { PropertyRow, ReferenceFacilityRow } from '@/lib/supabase/types'
import type { FloorPlanLayout } from '@/lib/floor-planner/types'

type EditorState = { row?: PropertyRow; importedText?: string } | null
type View = 'list' | 'map'

/**
 * The signed-in dashboard. In `demo` mode (a visitor who chose "Try without an
 * account" on the splash) it runs entirely on local sample data — no server
 * fetch, no persistence — so the UI is fully explorable without auth.
 */
export function AppHome({ demo = false }: { demo?: boolean }) {
  const [rows, setRows] = useState<PropertyRow[]>(demo ? DEMO_PROPERTIES : [])
  // Competitor facilities (built-in + the user's added ones) for competition /
  // whitespace scoring across the verdict and map views.
  const [facilities, setFacilities] = useState<ReferenceFacilityRow[]>([])
  const [editor, setEditor] = useState<EditorState>(null)
  const [viewing, setViewing] = useState<PropertyRow | null>(null)
  const [plannerFor, setPlannerFor] = useState<PropertyRow | null>(null)
  const [view, setView] = useState<View>('list')
  const [, startReload] = useTransition()
  // Ensures the one-time backfill of legacy rows runs only once per session.
  const backfilledRef = useRef(false)
  // Same, for the automatic 5-mile demographics backfill.
  const demographicsRef = useRef(false)
  // Same, for the automatic AI condition-assessment backfill.
  const conditionRef = useRef(false)

  const reload = useCallback(() => {
    if (demo) {
      setRows(DEMO_PROPERTIES)
      return
    }
    // Re-arm the background backfills so a freshly saved/edited property (which
    // is persisted without demographics/condition, then filled in afterward)
    // gets geocoded, scored, and assessed without needing a page refresh.
    backfilledRef.current = false
    demographicsRef.current = false
    conditionRef.current = false
    startReload(async () => {
      const list = await listProperties()
      setRows(list)
    })
  }, [demo])

  // Initial load. Demo mode is seeded from state, so only fetch for real users.
  useEffect(() => {
    if (!demo) reload()
  }, [demo, reload])

  // Load the added competitor facilities once; combined with the built-in curated
  // list, these drive the competition / whitespace scoring. They're shared
  // reference data, so demo (signed-out) sessions load them too.
  useEffect(() => {
    listReferenceFacilities().then(setFacilities)
  }, [])

  const competitorSites = useMemo(() => buildCompetitorSites(facilities), [facilities])

  // Bookmarklet hash → open editor with imported text.
  // The EditorSheet's ListingInput reads the hash itself when it mounts and
  // auto-extracts. We just need to open the sheet so the ListingInput mounts.
  useEffect(() => {
    const handleImport = () => {
      if (window.location.hash.startsWith('#import=')) {
        setEditor({ row: undefined })
      }
    }
    handleImport()
    window.addEventListener('hashchange', handleImport)
    return () => window.removeEventListener('hashchange', handleImport)
  }, [])

  // Properties saved before geocoding existed have an address but no coords.
  // Geocoding works straight from the address, so backfill once on load — no
  // need to wait for the map view. This also unblocks the demographics fill
  // below, which requires coordinates.
  const unmappedCount = useMemo(
    () => rows.filter((r) => r.address && r.latitude == null).length,
    [rows],
  )

  useEffect(() => {
    if (demo || backfilledRef.current || unmappedCount === 0) return
    backfilledRef.current = true
    startReload(async () => {
      const { updated } = await geocodeMissing()
      if (updated > 0) {
        // New coords mean those rows now need demographics too — let the
        // demographics effect run again against the refreshed set.
        demographicsRef.current = false
        const list = await listProperties()
        setRows(list)
      }
    })
  }, [demo, unmappedCount])

  // Automatically fetch trade-area demographics for any geocoded property that
  // doesn't have them cached yet, or is still on the legacy radius shape (so it
  // gets upgraded to drive-time once Mapbox is configured). No button — new saves
  // already fetch at save time; this just fills/upgrades gaps once per session.
  // The server action decides whether radius rows are actually worth re-fetching
  // (it skips the upgrade when Mapbox isn't configured).
  const needsDemographics = useMemo(
    () =>
      rows.some(
        (r) =>
          r.latitude != null &&
          (r.demographics_json == null || r.demographics_json.mode !== 'drive'),
      ),
    [rows],
  )

  useEffect(() => {
    if (demo || demographicsRef.current || !needsDemographics) return
    demographicsRef.current = true
    startReload(async () => {
      const { updated } = await backfillDemographics()
      if (updated > 0) {
        const list = await listProperties()
        setRows(list)
      }
    })
  }, [demo, needsDemographics])

  // Automatically assess condition (renovation scope + code checklist) for any
  // property that doesn't have one yet. Each is a vision call, so process small
  // batches and refresh between them so panels fill in progressively; stop if a
  // batch makes no progress (e.g., assessment unavailable).
  const needsCondition = useMemo(() => rows.some((r) => r.condition_json == null), [rows])

  useEffect(() => {
    if (demo || conditionRef.current || !needsCondition) return
    conditionRef.current = true
    startReload(async () => {
      for (let i = 0; i < 25; i++) {
        const { updated, remaining } = await backfillConditions(3)
        if (updated > 0) {
          const list = await listProperties()
          setRows(list)
        }
        if (remaining === 0 || updated === 0) break
      }
    })
  }, [demo, needsCondition])

  // Set a property's manual status. Optimistically update the table + the open
  // modal, then persist (real users only — demo mode is local-only).
  const handleStatusChange = (id: string, status: PropertyStatus) => {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, status } : r)))
    setViewing((cur) => (cur?.id === id ? { ...cur, status } : cur))
    if (demo) return
    void updatePropertyStatus(id, status).then((res) => {
      if (res && 'error' in res) console.error('Failed to update status:', res.error)
    })
  }

  // Toggle the manual "interested" star. Same optimistic pattern as status —
  // update the table + open modal immediately, then persist for real users.
  const handleInterestedChange = (id: string, interested: boolean) => {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, interested } : r)))
    setViewing((cur) => (cur?.id === id ? { ...cur, interested } : cur))
    if (demo) return
    void updatePropertyInterested(id, interested).then((res) => {
      if (res && 'error' in res) console.error('Failed to update interested:', res.error)
    })
  }

  // A layout was saved in the floor planner — reflect it in the table, the open
  // verdict, and the planner's own copy (same optimistic pattern as status).
  const handleLayoutSaved = (id: string, layout: FloorPlanLayout, updatedAt: string) => {
    const patch = { layout_json: layout, layout_updated_at: updatedAt }
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setViewing((cur) => (cur?.id === id ? { ...cur, ...patch } : cur))
    setPlannerFor((cur) => (cur?.id === id ? { ...cur, ...patch } : cur))
  }

  const handleDelete = (id: string) => {
    if (demo) {
      setRows((cur) => cur.filter((r) => r.id !== id))
      setViewing((cur) => (cur?.id === id ? null : cur))
      return
    }
    startReload(async () => {
      await deleteProperty(id)
      const list = await listProperties()
      setRows(list)
      // Close any open verdict for the just-deleted row.
      setViewing((cur) => (cur?.id === id ? null : cur))
    })
  }

  return (
    <main className="max-w-[95vw] mx-auto w-full px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          {/* <p className="text-sm text-muted-foreground mt-0.5">
            {demo
              ? 'Sample properties — sign in to save your own analyses.'
              : view === 'map'
                ? 'All saved locations on the map. Click a pin for details.'
                : 'All saved analyses. Click a row to view the verdict.'}
          </p> */}
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="list" className="gap-1.5">
                <List className="size-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="map" className="gap-1.5">
                <MapIcon className="size-4" />
                Map
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setEditor({ row: undefined })} className="gap-1.5">
            <Plus className="size-4" />
            Add property
          </Button>
        </div>
      </div>

      {view === 'list' && (
        <DashboardTable
          rows={rows}
          onView={(row) => setViewing(row)}
          onEdit={(row) => {
            setViewing(null)
            setEditor({ row })
          }}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onInterestedChange={handleInterestedChange}
        />
      )}
      {view === 'map' && (
        <PropertiesMap
          rows={rows}
          onView={(row) => setViewing(row)}
          unmappedCount={unmappedCount}
          demo={demo}
        />
      )}

      <VerdictModal
        property={viewing}
        sites={competitorSites}
        onClose={() => setViewing(null)}
        onEdit={(row) => {
          setViewing(null)
          setEditor({ row })
        }}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onInterestedChange={handleInterestedChange}
        onOpenPlanner={(row) => setPlannerFor(row)}
      />

      {plannerFor && (
        <FloorPlannerOverlay
          property={plannerFor}
          demo={demo}
          onClose={() => setPlannerFor(null)}
          onSaved={handleLayoutSaved}
        />
      )}

      <EditorSheet
        initial={editor}
        onClose={() => setEditor(null)}
        onSaved={() => reload()}
      />

      {view === 'list' && (
        <div className="mt-6 flex justify-start">
          <BookmarkletHelper />
        </div>
      )}
    </main>
  )
}
