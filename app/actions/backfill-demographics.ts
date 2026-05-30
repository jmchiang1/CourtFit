'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchDemographics } from '@/lib/census'

/**
 * Backfill 5-mile trade-area demographics for the current user's geocoded
 * properties that don't have them yet (saved before this feature, or where the
 * Census fetch previously failed). Runs sequentially to stay polite to the
 * Census / TIGERweb services. Returns how many rows were filled so the caller
 * knows whether to reload.
 */
export async function backfillDemographics(): Promise<{ updated: number }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { updated: 0 }

  const { data: rows } = await sb
    .from('properties')
    .select('id, latitude, longitude')
    .is('demographics_json', null)
    .not('latitude', 'is', null)

  if (!rows?.length) return { updated: 0 }

  let updated = 0
  for (const r of rows) {
    const demographics = await fetchDemographics(r.latitude, r.longitude)
    if (!demographics) continue
    const { error } = await sb
      .from('properties')
      .update({
        demographics_json: demographics,
        demographics_at: new Date().toISOString(),
      })
      .eq('id', r.id)
    if (!error) updated++
  }

  if (updated > 0) revalidatePath('/')
  return { updated }
}
