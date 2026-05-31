'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/geocode'
import { fetchDemographics } from '@/lib/census'
import type { Assumptions, ExtractedListing, Rating } from '@/types/analysis'
import type { Demographics } from '@/types/demographics'

export interface SaveInput {
  id?: string
  label: string | null
  address: string | null
  listing: ExtractedListing
  assumptions: Assumptions
  snapshot: {
    rating: Rating
    noi: number
    totalCourts: number
    paybackYears: number | null
  }
}

export async function saveProperty(input: SaveInput) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' as const }

  // Geocode the address so the map view has coordinates. On update we only
  // re-geocode when the address actually changed; otherwise reuse the cached
  // coords to avoid a redundant Geocoding API call.
  let geo: { latitude: number | null; longitude: number | null; geocoded_at: string | null } = {
    latitude: null,
    longitude: null,
    geocoded_at: null,
  }
  // Cached 5-mile demographics travel with the coords: reuse them only when the
  // address is unchanged, otherwise they're refetched for the new location.
  let demo: { demographics_json: Demographics | null; demographics_at: string | null } = {
    demographics_json: null,
    demographics_at: null,
  }
  let needsGeocode = !!input.address
  let coordsUnchanged = false
  if (input.id) {
    const { data: existing } = await sb
      .from('properties')
      .select('address, latitude, longitude, geocoded_at, demographics_json, demographics_at')
      .eq('id', input.id)
      .single()
    if (existing) {
      const unchanged = existing.address === input.address && existing.latitude != null
      if (unchanged) {
        geo = {
          latitude: existing.latitude,
          longitude: existing.longitude,
          geocoded_at: existing.geocoded_at,
        }
        demo = {
          demographics_json: existing.demographics_json,
          demographics_at: existing.demographics_at,
        }
        needsGeocode = false
        coordsUnchanged = true
      }
    }
  }
  // TEMP DEBUG — remove after diagnosing missing demographics.
  const dbg = (m: string) => console.warn(`[save-debug] ${m}`)
  dbg(`SAVE id=${input.id ?? 'new'} address=${JSON.stringify(input.address)} needsGeocode=${needsGeocode} coordsUnchanged=${coordsUnchanged} CENSUS_KEY=${!!process.env.CENSUS_API_KEY} GMAPS_KEY=${!!(process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)}`)

  if (needsGeocode) {
    const point = await geocodeAddress(input.address)
    dbg(`geocode → ${point ? `${point.lat},${point.lng}` : 'NULL'}`)
    if (point) {
      geo = { latitude: point.lat, longitude: point.lng, geocoded_at: new Date().toISOString() }
    }
  }

  // Fetch demographics whenever we have fresh coords or never had them cached.
  if (geo.latitude != null && (!coordsUnchanged || !demo.demographics_json)) {
    const demographics = await fetchDemographics(geo.latitude, geo.longitude)
    dbg(`fetchDemographics(${geo.latitude},${geo.longitude}) → ${demographics ? `pop=${demographics.totalPopulation} tracts=${demographics.tractCount}` : 'NULL'}`)
    if (demographics) {
      demo = { demographics_json: demographics, demographics_at: new Date().toISOString() }
    }
  } else {
    dbg(`SKIP demographics (lat=${geo.latitude} coordsUnchanged=${coordsUnchanged} hasDemo=${!!demo.demographics_json})`)
  }

  const row = {
    user_id: user.id,
    label: input.label,
    address: input.address,
    listing_json: input.listing,
    assumptions_json: input.assumptions,
    rating: input.snapshot.rating,
    noi: input.snapshot.noi,
    total_courts: input.snapshot.totalCourts,
    payback_years: input.snapshot.paybackYears,
    latitude: geo.latitude,
    longitude: geo.longitude,
    geocoded_at: geo.geocoded_at,
    demographics_json: demo.demographics_json,
    demographics_at: demo.demographics_at,
    updated_at: new Date().toISOString(),
  }

  const result = input.id
    ? await sb.from('properties').update(row).eq('id', input.id).select().single()
    : await sb.from('properties').insert(row).select().single()

  dbg(`DB ${input.id ? 'update' : 'insert'} → error=${result.error?.message ?? 'none'} wroteDemo=${!!row.demographics_json}`)

  if (result.error) return { error: result.error.message }
  revalidatePath('/')
  return { id: result.data.id }
}
