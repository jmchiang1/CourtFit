'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { LayoutThumbnail } from '@/components/FloorPlanner/LayoutThumbnail'
import { FloorPlannerOverlay } from '@/components/FloorPlanner/FloorPlannerOverlay'
import { NewFloorPlanDialog } from './NewFloorPlanDialog'
import { diagnose, tally } from '@/lib/floor-planner/geometry'
import { emptyLayout, normalizeLayout } from '@/lib/floor-planner/seed'
import {
  createFloorPlan,
  deleteFloorPlan,
  duplicateFloorPlan,
  listFloorPlans,
  updateFloorPlan,
} from '@/app/actions/floor-plans'
import type { FloorPlanLayout } from '@/lib/floor-planner/types'
import type { FloorPlanRow, PropertyRow } from '@/lib/supabase/types'

/**
 * What the planner overlay is currently editing. `key` identifies the *editing
 * session*, not the row — it stays put when a brand-new plan gets its first
 * save, so the planner keeps its undo history instead of re-initializing.
 */
type Editing = { key: string } & (
  | { kind: 'new'; name: string; layout: FloorPlanLayout; propertyId: string | null }
  | { kind: 'existing'; row: FloorPlanRow }
)

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `plan-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

/** Court count + item count for a plan's card, ignoring warned-on courts. */
function planStats(layout: FloorPlanLayout) {
  const diag = diagnose(layout.items, layout.footprintMode, layout.building, layout.zones)
  return tally(layout.items, layout.footprintMode, diag)
}

function RenameDialog({
  row,
  onOpenChange,
  onRename,
}: {
  row: FloorPlanRow | null
  onOpenChange: (open: boolean) => void
  onRename: (id: string, name: string) => void
}) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (row) setName(row.name)
  }, [row])

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename floor plan</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (row && name.trim()) onRename(row.id, name.trim())
            onOpenChange(false)
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="rename-plan">Name</Label>
            <Input
              id="rename-plan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The "Floor plans" tab — a gallery of the user's saved plans, each openable in
 * the full-screen planner. Plans are standalone; a listing can seed a new one's
 * envelope but doesn't own it.
 *
 * In `demo` mode everything stays in local state — no server round-trips — so a
 * signed-out visitor can still draw and "save" plans for the session.
 */
export function FloorPlansTab({
  properties,
  demo = false,
  creating,
  setCreating,
}: {
  properties: PropertyRow[]
  demo?: boolean
  /** "New floor plan" dialog state — owned by AppHome, whose header holds the button. */
  creating: boolean
  setCreating: (open: boolean) => void
}) {
  const [rows, setRows] = useState<FloorPlanRow[]>([])
  const [loaded, setLoaded] = useState(demo)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [renaming, setRenaming] = useState<FloorPlanRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, start] = useTransition()

  const reload = useCallback(() => {
    if (demo) return
    start(async () => {
      setRows(await listFloorPlans())
      setLoaded(true)
    })
  }, [demo])

  useEffect(() => {
    reload()
  }, [reload])

  const upsert = (row: FloorPlanRow) =>
    setRows((cur) => [row, ...cur.filter((r) => r.id !== row.id)])

  const openExisting = (row: FloorPlanRow) =>
    setEditing({ key: uid(), kind: 'existing', row })

  /** Persist the plan currently open in the planner (insert or update). */
  const handleSave = async (layout: FloorPlanLayout) => {
    if (!editing) return
    const name = layout.name.trim() || 'Untitled floor plan'
    const now = new Date().toISOString()

    if (demo) {
      const row: FloorPlanRow =
        editing.kind === 'existing'
          ? { ...editing.row, name, layout_json: layout, updated_at: now }
          : {
              id: uid(),
              user_id: 'demo',
              created_at: now,
              updated_at: now,
              name,
              property_id: editing.propertyId,
              layout_json: layout,
            }
      upsert(row)
      setEditing({ key: editing.key, kind: 'existing', row })
      return
    }

    const res =
      editing.kind === 'existing'
        ? await updateFloorPlan(editing.row.id, { name, layout })
        : await createFloorPlan({ name, layout, propertyId: editing.propertyId })

    if ('error' in res) return { error: res.error }
    upsert(res.row)
    // Switch to "existing" so the next save updates instead of re-inserting.
    setEditing({ key: editing.key, kind: 'existing', row: res.row })
  }

  const handleRename = (id: string, name: string) => {
    setRows((cur) =>
      cur.map((r) =>
        r.id === id ? { ...r, name, layout_json: { ...r.layout_json, name } } : r,
      ),
    )
    if (demo) return
    void updateFloorPlan(id, { name }).then((res) => {
      if ('error' in res) setError(res.error)
    })
  }

  const handleDuplicate = (row: FloorPlanRow) => {
    if (demo) {
      const now = new Date().toISOString()
      const name = `${row.name} (copy)`
      upsert({
        ...row,
        id: uid(),
        name,
        created_at: now,
        updated_at: now,
        layout_json: { ...row.layout_json, name },
      })
      return
    }
    start(async () => {
      const res = await duplicateFloorPlan(row.id)
      if ('error' in res) setError(res.error)
      else upsert(res.row)
    })
  }

  const handleDelete = (row: FloorPlanRow) => {
    if (!confirm(`Delete “${row.name}”? This can't be undone.`)) return
    setRows((cur) => cur.filter((r) => r.id !== row.id))
    if (demo) return
    void deleteFloorPlan(row.id).then((res) => {
      if ('error' in res) {
        setError(res.error)
        reload()
      }
    })
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {rows.length === 0
          ? 'Lay out courts, rooms, and furniture to scale.'
          : `${rows.length} saved plan${rows.length === 1 ? '' : 's'}.`}
      </p>

      {error && (
        <p className="mb-3 rounded-md bg-risk/10 px-3 py-2 text-sm text-risk">{error}</p>
      )}

      {!loaded ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface h-56 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-field/60 py-16 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            No floor plans yet. Start from a blank building, or size one from a saved listing’s
            square footage and clear height.
          </p>
          <Button onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="size-4" />
            New floor plan
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((row) => {
            const layout = normalizeLayout(row.layout_json)
            const stats = layout ? planStats(layout) : null
            return (
              <div key={row.id} className="surface flex flex-col p-4">
                <button
                  type="button"
                  onClick={() => openExisting(row)}
                  className="overflow-hidden rounded-md outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
                  title="Open in the planner"
                >
                  {layout ? (
                    <LayoutThumbnail layout={layout} />
                  ) : (
                    <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                      Preview unavailable
                    </div>
                  )}
                </button>

                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground" title={row.name}>
                      {row.name}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                      {layout
                        ? `${layout.building.lengthFt}′ × ${layout.building.widthFt}′ · ${
                            stats?.totalCourts ?? 0
                          } court${(stats?.totalCourts ?? 0) === 1 ? '' : 's'}`
                        : '—'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Edited {new Date(row.updated_at).toLocaleDateString()}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-7 shrink-0">
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openExisting(row)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRenaming(row)}>
                        <Pencil className="size-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(row)}>
                        <Copy className="size-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(row)}>
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <NewFloorPlanDialog
        open={creating}
        onOpenChange={setCreating}
        properties={properties}
        onCreate={({ name, layout, propertyId }) =>
          setEditing({ key: uid(), kind: 'new', name, layout, propertyId })
        }
      />

      <RenameDialog
        row={renaming}
        onOpenChange={(open) => !open && setRenaming(null)}
        onRename={handleRename}
      />

      {editing && (
        <FloorPlannerOverlay
          planKey={editing.key}
          layout={
            editing.kind === 'existing'
              ? (normalizeLayout(editing.row.layout_json) ?? emptyLayout(editing.row.name))
              : editing.layout
          }
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
