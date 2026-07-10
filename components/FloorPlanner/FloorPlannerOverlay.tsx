'use client'

import { useEffect, useState } from 'react'
import FloorPlanner from './FloorPlanner'
import { usePlanner } from '@/lib/floor-planner/store'
import { normalizeLayout, seedLayoutFromListing } from '@/lib/floor-planner/seed'
import { saveLayout } from '@/app/actions/save-layout'
import type { FloorPlanLayout } from '@/lib/floor-planner/types'
import type { PropertyRow } from '@/lib/supabase/types'

interface Props {
  property: PropertyRow
  /** Demo mode is local-only — don't hit the server. */
  demo?: boolean
  onClose: () => void
  onSaved: (id: string, layout: FloorPlanLayout, updatedAt: string) => void
}

/**
 * Full-screen floor-plan editor for a single property. Seeds a fresh plan from
 * the listing (size + clear height) the first time, then persists to
 * `properties.layout_json`.
 */
export function FloorPlannerOverlay({ property, demo = false, onClose, onSaved }: Props) {
  const init = usePlanner((s) => s.init)
  const serialize = usePlanner((s) => s.serialize)
  const markSaved = usePlanner((s) => s.markSaved)

  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the saved plan (or seed a new one) whenever the target property changes.
  useEffect(() => {
    const existing = normalizeLayout(property.layout_json)
    init(existing ?? seedLayoutFromListing(property.listing_json, property.label))
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.id])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const layout = serialize()

    if (demo) {
      markSaved()
      onSaved(property.id, layout, new Date().toISOString())
      setSaving(false)
      return
    }

    const res = await saveLayout(property.id, layout)
    setSaving(false)
    if ('error' in res) {
      setError(res.error ?? 'Failed to save')
      return
    }
    markSaved()
    onSaved(property.id, layout, res.layoutUpdatedAt)
  }

  if (!ready) return null

  return (
    <div className="fixed inset-0 z-[120] bg-[#0a0e14]">
      {error && (
        <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md bg-red-600 px-3 py-1.5 text-[12px] text-white shadow">
          {error}
        </div>
      )}
      <FloorPlanner onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  )
}
