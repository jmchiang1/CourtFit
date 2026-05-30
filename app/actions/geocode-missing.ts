'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/geocode'

/**
 * Backfill coordinates for the current user's properties that have an address
 * but were saved before geocoding existed (latitude is null). Runs sequentially
 * to stay under Google's per-second geocoding limits. Returns how many rows
 * were successfully geocoded so the caller knows whether to reload.
 */
export async function geocodeMissing(): Promise<{ updated: number }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { updated: 0 }

  const { data: rows } = await sb
    .from('properties')
    .select('id, address')
    .is('latitude', null)
    .not('address', 'is', null)

  if (!rows?.length) return { updated: 0 }

  let updated = 0
  for (const r of rows) {
    const point = await geocodeAddress(r.address)
    if (!point) continue
    const { error } = await sb
      .from('properties')
      .update({
        latitude: point.lat,
        longitude: point.lng,
        geocoded_at: new Date().toISOString(),
      })
      .eq('id', r.id)
    if (!error) updated++
  }

  if (updated > 0) revalidatePath('/')
  return { updated }
}
