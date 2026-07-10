'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { FloorPlanLayout } from '@/lib/floor-planner/types'

/**
 * Persist a property's floor plan to `properties.layout_json`. Ownership is
 * enforced both by the `user_id` filter and the "own rows" RLS policy.
 */
export async function saveLayout(propertyId: string, layout: FloorPlanLayout) {
  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' as const }

  const layoutUpdatedAt = new Date().toISOString()
  const { error } = await sb
    .from('properties')
    .update({ layout_json: layout, layout_updated_at: layoutUpdatedAt })
    .eq('id', propertyId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/')
  return { layoutUpdatedAt }
}
