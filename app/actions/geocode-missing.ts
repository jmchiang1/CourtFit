'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/geocode'

/**
 * Backfill coordinates for the current user's properties that have an address
 * but no coordinates yet. Runs sequentially to stay under Google's per-second
 * geocoding limits. Returns how many rows were successfully geocoded so the
 * caller knows whether to reload.
 *
 * AppHome re-arms this on every reload, so an address Google can't resolve
 * would otherwise be re-submitted — and re-billed — on every page load forever.
 * `geocoded_at` is therefore stamped on a settled failure too, marking the row
 * as "asked and answered"; only retryable failures (key rejected, quota,
 * network) are left unstamped to be picked up next time. Editing the address
 * re-geocodes it via saveProperty regardless.
 */
export async function geocodeMissing(): Promise<{ updated: number }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { updated: 0 }

  const { data: rows } = await sb
    .from('properties')
    .select('id, address')
    .is('latitude', null)
    .is('geocoded_at', null)
    .not('address', 'is', null)

  if (!rows?.length) return { updated: 0 }

  let updated = 0
  for (const r of rows) {
    const res = await geocodeAddress(r.address)
    if (!res.ok) {
      // Retryable — leave geocoded_at null so the next run tries again.
      if (res.retryable) continue
      await sb
        .from('properties')
        .update({ geocoded_at: new Date().toISOString() })
        .eq('id', r.id)
      continue
    }
    const { error } = await sb
      .from('properties')
      .update({
        latitude: res.point.lat,
        longitude: res.point.lng,
        geocoded_at: new Date().toISOString(),
      })
      .eq('id', r.id)
    if (!error) updated++
  }

  if (updated > 0) revalidatePath('/')
  return { updated }
}
