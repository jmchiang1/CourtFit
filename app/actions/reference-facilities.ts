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

/**
 * Edit a reference facility. Only re-geocodes (and refetches demographics) when
 * the address actually changes; a name/sports-only edit keeps the cached coords.
 */
export async function updateReferenceFacility(
  id: string,
  input: AddFacilityInput,
): Promise<{ row: ReferenceFacilityRow } | { error: string }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'You need to sign in to edit a facility.' }

  const name = input.name.trim()
  const address = input.address.trim()
  const sports = input.sports.filter((s) => s === 'Badminton' || s === 'Pickleball')
  if (!name) return { error: 'Name is required.' }
  if (!address) return { error: 'Address is required.' }
  if (sports.length === 0) return { error: 'Pick at least one sport.' }

  const { data: existing } = await sb
    .from('reference_facilities')
    .select('address, latitude, longitude, geocoded_at, demographics_json, demographics_at')
    .eq('id', id)
    .single()

  let geo = {
    latitude: existing?.latitude ?? null,
    longitude: existing?.longitude ?? null,
    geocoded_at: existing?.geocoded_at ?? null,
  }
  let demo = {
    demographics_json: existing?.demographics_json ?? null,
    demographics_at: existing?.demographics_at ?? null,
  }

  if (!existing || existing.address !== address) {
    const point = await geocodeAddress(address)
    if (!point) return { error: "Couldn't find that address on the map." }
    const now = new Date().toISOString()
    geo = { latitude: point.lat, longitude: point.lng, geocoded_at: now }
    const demographics = await fetchDemographics(point.lat, point.lng)
    demo = { demographics_json: demographics, demographics_at: demographics ? now : null }
  }

  const { data, error } = await sb
    .from('reference_facilities')
    .update({ name, address, sports, ...geo, ...demo })
    .eq('id', id)
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
