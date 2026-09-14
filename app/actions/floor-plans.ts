'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { FloorPlanLayout } from '@/lib/floor-planner/types'
import type { FloorPlanRow } from '@/lib/supabase/types'

/** Every saved plan for the signed-in user, most recently edited first. */
export async function listFloorPlans(): Promise<FloorPlanRow[]> {
  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return []

  const { data, error } = await sb
    .from('floor_plans')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return []
  return (data ?? []) as FloorPlanRow[]
}

/**
 * Insert a new plan. `propertyId` is optional provenance — the listing the
 * envelope was seeded from. Ownership comes from the session, never the client.
 */
export async function createFloorPlan(input: {
  name: string
  layout: FloorPlanLayout
  propertyId?: string | null
}): Promise<{ row: FloorPlanRow } | { error: string }> {
  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const name = input.name.trim() || 'Untitled floor plan'
  const { data, error } = await sb
    .from('floor_plans')
    .insert({
      user_id: user.id,
      name,
      property_id: input.propertyId ?? null,
      // Keep the layout's own name in step with the row's, so the planner
      // toolbar and the gallery card never disagree.
      layout_json: { ...input.layout, name },
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/')
  return { row: data as FloorPlanRow }
}

/**
 * Update a plan's name and/or layout. The `user_id` filter is belt-and-braces
 * alongside the "own rows" RLS policy.
 */
export async function updateFloorPlan(
  id: string,
  patch: { name?: string; layout?: FloorPlanLayout },
): Promise<{ row: FloorPlanRow } | { error: string }> {
  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const name = patch.name?.trim()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name) update.name = name
  if (patch.layout) update.layout_json = name ? { ...patch.layout, name } : patch.layout

  const { data, error } = await sb
    .from('floor_plans')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/')
  return { row: data as FloorPlanRow }
}

export async function deleteFloorPlan(id: string): Promise<{ ok: true } | { error: string }> {
  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error } = await sb.from('floor_plans').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { ok: true }
}

/** Copy an existing plan, including its items, under a new name. */
export async function duplicateFloorPlan(
  id: string,
): Promise<{ row: FloorPlanRow } | { error: string }> {
  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { data: src, error: readErr } = await sb
    .from('floor_plans')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (readErr || !src) return { error: readErr?.message ?? 'not_found' }

  const row = src as FloorPlanRow
  const name = `${row.name} (copy)`
  const { data, error } = await sb
    .from('floor_plans')
    .insert({
      user_id: user.id,
      name,
      property_id: row.property_id,
      layout_json: { ...row.layout_json, name },
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/')
  return { row: data as FloorPlanRow }
}
