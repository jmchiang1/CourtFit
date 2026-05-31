'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/geocode'
import { fetchDemographics } from '@/lib/census'
import type { ReferenceFacilityRow } from '@/lib/supabase/types'

export interface AddFacilityInput {
  name: string
  address: string
  sports: string[]
}

export async function listReferenceFacilities(): Promise<ReferenceFacilityRow[]> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return []

  const { data, error } = await sb
    .from('reference_facilities')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as ReferenceFacilityRow[]
}

/**
 * Add a competitor/reference facility: geocode the address, fetch its 5-mile
 * demographics (best-effort), and persist. Mirrors save-property's flow.
 */
export async function addReferenceFacility(
  input: AddFacilityInput,
): Promise<{ row: ReferenceFacilityRow } | { error: string }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'You need to sign in to add a facility.' }

  const name = input.name.trim()
  const address = input.address.trim()
  const sports = input.sports.filter((s) => s === 'Badminton' || s === 'Pickleball')
  if (!name) return { error: 'Name is required.' }
  if (!address) return { error: 'Address is required.' }
  if (sports.length === 0) return { error: 'Pick at least one sport.' }

  const point = await geocodeAddress(address)
  if (!point) return { error: "Couldn't find that address on the map." }

  const demographics = await fetchDemographics(point.lat, point.lng)
  const now = new Date().toISOString()

  const { data, error } = await sb
    .from('reference_facilities')
    .insert({
      user_id: user.id,
      name,
      address,
      sports,
      latitude: point.lat,
      longitude: point.lng,
      geocoded_at: now,
      demographics_json: demographics,
      demographics_at: demographics ? now : null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/')
  return { row: data as ReferenceFacilityRow }
}

export async function deleteReferenceFacility(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { error } = await sb.from('reference_facilities').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { ok: true }
}
