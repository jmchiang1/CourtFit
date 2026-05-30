'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, List, Map as MapIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardTable } from '@/components/DashboardTable'
import { PropertiesMap } from '@/components/PropertiesMap'
import { EditorSheet } from '@/components/EditorSheet'
import { VerdictModal } from '@/components/VerdictModal'
import { BookmarkletHelper } from '@/components/BookmarkletHelper'
import { listProperties } from '@/app/actions/list-properties'
import { deleteProperty } from '@/app/actions/delete-property'
import { geocodeMissing } from '@/app/actions/geocode-missing'
import { backfillDemographics } from '@/app/actions/backfill-demographics'
import { DEMO_PROPERTIES } from '@/lib/demo-data'
import type { PropertyRow } from '@/lib/supabase/types'

type EditorState = { row?: PropertyRow; importedText?: string } | null
type View = 'list' | 'map'

/**
 * The signed-in dashboard. In `demo` mode (a visitor who chose "Try without an
 * account" on the splash) it runs entirely on local sample data — no server
 * fetch, no persistence — so the UI is fully explorable without auth.
 */
export function AppHome({ demo = false }: { demo?: boolean }) {
  const [rows, setRows] = useState<PropertyRow[]>(demo ? DEMO_PROPERTIES : [])
  const [editor, setEditor] = useState<EditorState>(null)
  const [viewing, setViewing] = useState<PropertyRow | null>(null)
  const [view, setView] = useState<View>('list')
  const [, startReload] = useTransition()
  // Ensures the one-time backfill of legacy rows runs only once per session.
  const backfilledRef = useRef(false)
  // Same, for the automatic 5-mile demographics backfill.
  const demographicsRef = useRef(false)

  const reload = useCallback(() => {
    if (demo) {
      setRows(DEMO_PROPERTIES)
      return
    }
    startReload(async () => {
      const list = await listProperties()
      setRows(list)
    })
  }, [demo])

  // Initial load. Demo mode is seeded from state, so only fetch for real users.
  useEffect(() => {
    if (!demo) reload()
  }, [demo, reload])

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
  // Backfill them once, the first time the user opens the map.
  const unmappedCount = useMemo(
    () => rows.filter((r) => r.address && r.latitude == null).length,
    [rows],
  )

  useEffect(() => {
    if (demo || view !== 'map' || backfilledRef.current || unmappedCount === 0) return
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
  }, [demo, view, unmappedCount])

  // Automatically fetch 5-mile trade-area demographics for any geocoded property
  // that doesn't have them cached yet (legacy rows, or where a prior Census fetch
  // failed). No button — new saves already fetch demographics at save time; this
  // just fills the gaps once per session.
  const needsDemographics = useMemo(
    () => rows.some((r) => r.latitude != null && r.demographics_json == null),
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
          <p className="text-sm text-muted-foreground mt-0.5">
            {demo
              ? 'Sample properties — sign in to save your own analyses.'
              : view === 'map'
                ? 'All saved locations on the map. Click a pin for details.'
                : 'All saved analyses. Click a row to view the verdict.'}
          </p>
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

      {view === 'list' ? (
        <DashboardTable
          rows={rows}
          onView={(row) => setViewing(row)}
          onEdit={(row) => {
            setViewing(null)
            setEditor({ row })
          }}
          onDelete={handleDelete}
        />
      ) : (
        <PropertiesMap
          rows={rows}
          onView={(row) => setViewing(row)}
          unmappedCount={unmappedCount}
        />
      )}

      <VerdictModal
        property={viewing}
        onClose={() => setViewing(null)}
        onEdit={(row) => {
          setViewing(null)
          setEditor({ row })
        }}
        onDelete={handleDelete}
      />

      <EditorSheet
        initial={editor}
        onClose={() => setEditor(null)}
        onSaved={() => reload()}
      />

      <div className="mt-6 flex justify-start">
        <BookmarkletHelper />
      </div>
    </main>
  )
}
