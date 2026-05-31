'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchDemographics } from '@/lib/census'

/**
 * Backfill trade-area demographics for the current user's geocoded properties
 * that are missing them OR are still on the legacy 5-mile-radius shape (no
 * `mode`, or `mode = 'radius'`) — so existing rows get upgraded to sport-specific
 * drive-time catchments once Mapbox is configured. Runs sequentially to stay
 * polite to the Mapbox / Census / TIGERweb services. Returns how many rows were
 * (re)filled so the caller knows whether to reload.
 */
export async function backfillDemographics(): Promise<{ updated: number }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { updated: 0 }

  // Always fill rows that have no demographics yet. Only *upgrade* legacy
  // radius-mode rows to drive-time when Mapbox is actually configured —
  // otherwise re-fetching them just produces radius again and churns the Census
  // API every session. `mode` lives inside the demographics_json JSONB.
  const driveAvailable = !!process.env.MAPBOX_TOKEN
  const filter = driveAvailable
    ? `demographics_json.is.null,demographics_json->>mode.is.null,demographics_json->>mode.eq.radius`
    : `demographics_json.is.null`

  const { data: rows } = await sb
    .from('properties')
    .select('id, latitude, longitude')
    .not('latitude', 'is', null)
    .or(filter)

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
