'use client'

import { useEffect, useRef, useState } from 'react'
import FloorPlanner from './FloorPlanner'
import { usePlanner } from '@/lib/floor-planner/store'
import type { FloorPlanLayout } from '@/lib/floor-planner/types'

interface Props {
  /** Identity of the plan being edited; changing it reloads the editor. */
  planKey: string
  /** The layout to open — a saved plan, or a freshly seeded one. */
  layout: FloorPlanLayout
  /**
   * Persist the current layout. Resolve with an error message to surface it and
   * leave the plan dirty; resolve with nothing to mark it saved.
   */
  onSave: (layout: FloorPlanLayout) => Promise<{ error?: string } | void>
  onClose: () => void
}

/**
 * Full-screen floor-plan editor. Owns only the save/dirty plumbing — the plan
 * itself lives in the planner store, and where it gets persisted is the
 * caller's business.
 */
export function FloorPlannerOverlay({ planKey, layout, onSave, onClose }: Props) {
  const init = usePlanner((s) => s.init)
  const serialize = usePlanner((s) => s.serialize)
  const markSaved = usePlanner((s) => s.markSaved)

  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // `layout` is only the *initial* value — re-running init on every render
  // would wipe the user's edits, so load it once per plan.
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  useEffect(() => {
    init(layoutRef.current)
    setReady(true)
  }, [planKey, init])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await onSave(serialize())
    setSaving(false)
    if (res && 'error' in res && res.error) {
      setError(res.error)
      return
    }
    markSaved()
  }

  // Closing with unsaved work now loses a whole plan, not just a property's
  // panel — so confirm first.
  const handleClose = () => {
    if (usePlanner.getState().dirty && !confirm('Discard unsaved changes to this floor plan?')) {
      return
    }
    onClose()
  }

  if (!ready) return null

  return (
    <div className="fixed inset-0 z-[120] bg-background">
      {error && (
        <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md border border-risk/30 bg-panel px-3 py-1.5 text-[12px] text-risk shadow-lift">
          {error}
        </div>
      )}
      <FloorPlanner onClose={handleClose} onSave={handleSave} saving={saving} />
    </div>
  )
}
