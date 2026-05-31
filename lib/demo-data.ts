import type { PropertyRow } from '@/lib/supabase/types'
import type { ExtractedListing } from '@/types/analysis'
import { DEFAULT_ASSUMPTIONS } from '@/lib/constants'

/**
 * Sample properties shown when a visitor chooses "Try without an account" on the
 * splash. They live entirely client-side (never written to Supabase) so the
 * dashboard, map and verdict modal all have something real-looking to render.
 *
 * The stored rating/noi/courts columns are intentionally left null — the table
 * and verdict modal recompute every figure from listing_json + assumptions_json,
 * so these only need a realistic listing to produce a full analysis. The three
 * are tuned to land on visibly different verdicts (strong → marginal).
 */

function listing(partial: Partial<ExtractedListing>): ExtractedListing {
  return {
    address: null,
    totalSqft: null,
    warehouseSqft: null,
    officeSqft: null,
    clearHeight: null,
    rentPerSqftYr: null,
    zoning: null,
    loading: null,
    parking: null,
    locationNotes: [],
    sourceUrl: null,
    imageUrls: [],
    ...partial,
  }
}

function demo(
  id: string,
  label: string,
  address: string,
  latitude: number,
  longitude: number,
  partial: Partial<ExtractedListing>,
): PropertyRow {
  return {
    id,
    user_id: 'demo',
    created_at: '2026-05-20T15:00:00.000Z',
    updated_at: '2026-05-20T15:00:00.000Z',
    label,
    address,
    listing_json: listing({ address, ...partial }),
    assumptions_json: DEFAULT_ASSUMPTIONS,
    rating: null,
    noi: null,
    total_courts: null,
    payback_years: null,
    latitude,
    longitude,
    geocoded_at: '2026-05-20T15:00:00.000Z',
    demographics_json: null,
    demographics_at: null,
    condition_json: null,
    condition_at: null,
  }
}

export const DEMO_PROPERTIES: PropertyRow[] = [
  demo(
    'demo-flushing',
    'Flushing warehouse',
    '133-38 31st Ave, Flushing, Queens, NY 11354',
    40.769,
    -73.83,
    {
      totalSqft: 30000,
      warehouseSqft: 27000,
      officeSqft: 3000,
      clearHeight: 32,
      rentPerSqftYr: 17,
      zoning: 'M1-1',
      loading: '2 dock-high doors',
      parking: '40 surface spaces',
      locationNotes: [
        'Dense East-Asian residential catchment',
        '0.5 mi from Main St / Flushing subway',
      ],
    },
  ),
  demo(
    'demo-sunset-park',
    'Sunset Park flex space',
    '880 3rd Ave, Brooklyn, NY 11232',
    40.656,
    -74.008,
    {
      totalSqft: 18000,
      warehouseSqft: 16000,
      officeSqft: 2000,
      clearHeight: 24,
      rentPerSqftYr: 26,
      zoning: 'M1-2',
      loading: '1 dock-high door',
      parking: 'Street + small shared lot',
      locationNotes: ['Adjacent to Industry City', 'Strong young-adult population'],
    },
  ),
  demo(
    'demo-mineola',
    'Mineola light-industrial',
    '200 Old Country Rd, Mineola, NY 11501',
    40.747,
    -73.64,
    {
      totalSqft: 11000,
      warehouseSqft: 9500,
      officeSqft: 1500,
      clearHeight: 17,
      rentPerSqftYr: 24,
      zoning: 'Light Industrial',
      loading: 'Grade-level door',
      parking: 'Ample on-site lot',
      locationNotes: ['Affluent Nassau County suburb', 'Low ceiling — verify clear height'],
    },
  ),
]
