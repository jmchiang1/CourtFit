'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/geocode'
import type { Assumptions, ExtractedListing, Rating } from '@/types/analysis'
import type { Demographics } from '@/types/demographics'
import type { ConditionAssessment } from '@/types/condition'

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

  // Demographics (Census) and the condition assessment (a Claude vision call) are
  // both slow, so we deliberately DON'T block the save on them. We persist the
  // row immediately with demographics_json / condition_json left null; the
  // dashboard's background backfill fills them in a moment later. On an edit we
  // keep the cached values when the address / listing are unchanged, and null
  // them out (so the backfill refreshes them) when they change.
  let demo: { demographics_json: Demographics | null; demographics_at: string | null } = {
    demographics_json: null,
    demographics_at: null,
  }
  let cond: { condition_json: ConditionAssessment | null; condition_at: string | null } = {
    condition_json: null,
    condition_at: null,
  }
  let needsGeocode = !!input.address

  if (input.id) {
    const { data: existing } = await sb
      .from('properties')
      .select(
        'address, latitude, longitude, geocoded_at, demographics_json, demographics_at, listing_json, condition_json, condition_at',
      )
      .eq('id', input.id)
      .single()
    if (existing) {
      const addressUnchanged = existing.address === input.address && existing.latitude != null
      if (addressUnchanged) {
        geo = {
          latitude: existing.latitude,
          longitude: existing.longitude,
          geocoded_at: existing.geocoded_at,
        }
        demo = {
          demographics_json: existing.demographics_json as Demographics | null,
          demographics_at: existing.demographics_at,
        }
        needsGeocode = false
      }
      const listingUnchanged =
        JSON.stringify(existing.listing_json) === JSON.stringify(input.listing)
      if (listingUnchanged) {
        cond = {
          condition_json: existing.condition_json as ConditionAssessment | null,
          condition_at: existing.condition_at,
        }
      }
    }
  }

  if (needsGeocode) {
    const point = await geocodeAddress(input.address)
    if (point) {
      geo = { latitude: point.lat, longitude: point.lng, geocoded_at: new Date().toISOString() }
    }
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
    condition_json: cond.condition_json,
    condition_at: cond.condition_at,
    updated_at: new Date().toISOString(),
  }

  const result = input.id
    ? await sb.from('properties').update(row).eq('id', input.id).select().single()
    : await sb.from('properties').insert(row).select().single()

  if (result.error) return { error: result.error.message }
  revalidatePath('/')
  return { id: result.data.id }
}
