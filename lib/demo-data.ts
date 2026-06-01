import type { PropertyRow } from '@/lib/supabase/types'
import type { ExtractedListing } from '@/types/analysis'
import type { Demographics } from '@/types/demographics'
import type { ConditionAssessment } from '@/types/condition'
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
 *
 * demographics_json and condition_json are pre-baked here (rather than fetched at
 * runtime like a signed-in user's saved rows) so the demo's Demand, Competition
 * & whitespace, and Condition & code panels render fully without any API calls.
 * The figures are realistic ACS-style estimates for each trade area, not live.
 */

const FETCHED_AT = '2026-05-20T15:00:00.000Z'

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
  demographics: Demographics,
  condition: ConditionAssessment,
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
    demographics_json: demographics,
    demographics_at: FETCHED_AT,
    condition_json: condition,
    condition_at: FETCHED_AT,
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
    {
      vintage: '2023',
      mode: 'radius',
      radiusMiles: 5,
      tractCount: 142,
      totalPopulation: 612000,
      households: 214000,
      meanHouseholdIncome: 74000,
      ethnicity: {
        eastAsian: 281000,
        southAsian: 52000,
        targetAsian: 333000,
        eastAsianShare: 0.459,
        southAsianShare: 0.085,
        targetShare: 0.544,
      },
      age: {
        under18: 116000,
        prime18to44: 251000,
        mature45to64: 159000,
        senior65plus: 86000,
        prime18to44Share: 0.41,
        adult18to64Share: 0.67,
      },
      badmintonFit: { score: 89, label: 'Strong' },
      pickleballFit: { score: 61, label: 'Moderate' },
      fetchedAt: FETCHED_AT,
    },
    {
      scope: 'moderate',
      summary:
        'High-clear warehouse with a small existing office. Shell is sound; the cost drivers are a sports-grade floor, full court lighting, and an Assembly-occupancy fire sprinkler system. HVAC and electrical need capacity upgrades but are present.',
      confidence: 'medium',
      imageCount: 6,
      systems: [
        { key: 'hvac', condition: 'fair', multiplier: 0.8, note: 'Rooftop units present; capacity likely undersized for full Assembly load.' },
        { key: 'electrical', condition: 'fair', multiplier: 0.9, note: 'Service panel appears original — plan a sub-panel for court lighting.' },
        { key: 'lighting', condition: 'poor', multiplier: 1.3, note: 'Sparse warehouse high-bays; full LED court retrofit required.' },
        { key: 'plumbing', condition: 'good', multiplier: 0.4, note: 'Functional rough-ins visible near the office wing.' },
        { key: 'flooring', condition: 'poor', multiplier: 1.2, note: 'Bare polished concrete — needs cushioned sport surface.' },
        { key: 'walls', condition: 'good', multiplier: 0.3, note: 'Painted block in good shape; minimal finish work.' },
        { key: 'office', condition: 'good', multiplier: 0.3, note: '3,000 sf finished office usable for reception / pro shop.' },
        { key: 'bathrooms', condition: 'fair', multiplier: 0.6, note: 'Two restrooms; add fixtures to meet Assembly counts.' },
        { key: 'fireSprinkler', condition: 'absent', multiplier: 1.5, note: 'No wet system visible — full coverage mandated for Assembly use.' },
      ],
      compliance: [
        { key: 'co-use', label: 'Certificate of Occupancy / use', status: 'attention', detail: 'M1-1 allows indoor recreation, but an Assembly change-of-use amendment to the CO is required.' },
        { key: 'clear-height', label: 'Clear height', status: 'ok', detail: "32' comfortably clears badminton (20') and pickleball (18')." },
        { key: 'sprinkler', label: 'Fire sprinkler', status: 'risk', detail: 'None present; NYC Assembly occupancy requires a full system + fire alarm.' },
        { key: 'egress', label: 'Egress / occupant load', status: 'attention', detail: 'Verify two remote exits sized for projected occupant load.' },
        { key: 'parking', label: 'Parking', status: 'ok', detail: '40 on-site spaces adequate for the modeled court count.' },
        { key: 'ada', label: 'ADA / accessibility', status: 'attention', detail: 'Accessible restrooms and an entrance route needed for the public-facing use.' },
        { key: 'violations', label: 'Open DOB violations', status: 'unknown', detail: 'Run a DOB / ECB violation search before LOI.' },
      ],
      assessedAt: FETCHED_AT,
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
    {
      vintage: '2023',
      mode: 'radius',
      radiusMiles: 5,
      tractCount: 168,
      totalPopulation: 798000,
      households: 301000,
      meanHouseholdIncome: 91000,
      ethnicity: {
        eastAsian: 132000,
        southAsian: 24000,
        targetAsian: 156000,
        eastAsianShare: 0.165,
        southAsianShare: 0.03,
        targetShare: 0.195,
      },
      age: {
        under18: 135000,
        prime18to44: 359000,
        mature45to64: 191000,
        senior65plus: 113000,
        prime18to44Share: 0.45,
        adult18to64Share: 0.69,
      },
      badmintonFit: { score: 58, label: 'Moderate' },
      pickleballFit: { score: 78, label: 'Strong' },
      fetchedAt: FETCHED_AT,
    },
    {
      scope: 'moderate',
      summary:
        'Clean flex space beside Industry City with usable ceiling height. Less structural work than a raw warehouse, but the rent is high and parking is thin — the build budget should stay lean to protect payback.',
      confidence: 'medium',
      imageCount: 5,
      systems: [
        { key: 'hvac', condition: 'good', multiplier: 0.4, note: 'Recent split systems serving the front; supplement for the court floor.' },
        { key: 'electrical', condition: 'good', multiplier: 0.4, note: 'Upgraded panel from a prior tenant fit-out.' },
        { key: 'lighting', condition: 'fair', multiplier: 0.9, note: 'Some high-bays in place; standardize to court-spec LED.' },
        { key: 'plumbing', condition: 'good', multiplier: 0.3, note: 'Two finished restrooms with working fixtures.' },
        { key: 'flooring', condition: 'fair', multiplier: 1.0, note: 'Sealed concrete — sport surface still required.' },
        { key: 'walls', condition: 'good', multiplier: 0.2, note: 'Recently painted; move-in-grade finishes.' },
        { key: 'office', condition: 'good', multiplier: 0.2, note: '2,000 sf office suitable for front-of-house.' },
        { key: 'bathrooms', condition: 'good', multiplier: 0.3, note: 'Adequate fixture count for initial courts.' },
        { key: 'fireSprinkler', condition: 'fair', multiplier: 0.7, note: 'Partial system present; confirm coverage meets Assembly load.' },
      ],
      compliance: [
        { key: 'co-use', label: 'Certificate of Occupancy / use', status: 'attention', detail: 'M1-2 permits the use; confirm the CO covers Assembly and amend if needed.' },
        { key: 'clear-height', label: 'Clear height', status: 'ok', detail: "24' clears both sports with margin." },
        { key: 'sprinkler', label: 'Fire sprinkler', status: 'attention', detail: 'Existing partial system — engineer a coverage check.' },
        { key: 'egress', label: 'Egress / occupant load', status: 'ok', detail: 'Two existing exits; verify sizing against occupant load.' },
        { key: 'parking', label: 'Parking', status: 'risk', detail: 'Mostly street parking — model rideshare / transit and confirm zoning parking minimums.' },
        { key: 'ada', label: 'ADA / accessibility', status: 'ok', detail: 'Accessible entrance and restrooms already present.' },
        { key: 'violations', label: 'Open DOB violations', status: 'unknown', detail: 'Pull DOB / ECB history before LOI.' },
      ],
      assessedAt: FETCHED_AT,
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
    {
      vintage: '2023',
      mode: 'radius',
      radiusMiles: 5,
      tractCount: 121,
      totalPopulation: 487000,
      households: 162000,
      meanHouseholdIncome: 138000,
      ethnicity: {
        eastAsian: 39000,
        southAsian: 41000,
        targetAsian: 80000,
        eastAsianShare: 0.08,
        southAsianShare: 0.084,
        targetShare: 0.164,
      },
      age: {
        under18: 107000,
        prime18to44: 165000,
        mature45to64: 132000,
        senior65plus: 83000,
        prime18to44Share: 0.339,
        adult18to64Share: 0.61,
      },
      badmintonFit: { score: 41, label: 'Weak' },
      pickleballFit: { score: 72, label: 'Strong' },
      fetchedAt: FETCHED_AT,
    },
    {
      scope: 'heavy',
      summary:
        "Affluent, pickleball-leaning suburb with ample parking, but the 17' clear height is below badminton's 20' requirement — this site is realistically pickleball-only, and confirming true deck-to-joist height is the first diligence item.",
      confidence: 'low',
      imageCount: 4,
      systems: [
        { key: 'hvac', condition: 'poor', multiplier: 1.3, note: 'Aging units; likely full replacement for a conditioned court space.' },
        { key: 'electrical', condition: 'fair', multiplier: 0.9, note: 'Service may need upsizing for HVAC + lighting load.' },
        { key: 'lighting', condition: 'poor', multiplier: 1.2, note: 'Low-mounted fixtures; re-layout around the lower ceiling.' },
        { key: 'plumbing', condition: 'fair', multiplier: 0.7, note: 'Single restroom core; expansion likely required.' },
        { key: 'flooring', condition: 'poor', multiplier: 1.2, note: 'Bare slab — pickleball surface and line marking needed.' },
        { key: 'walls', condition: 'fair', multiplier: 0.6, note: 'Dated finishes; cosmetic refresh.' },
        { key: 'office', condition: 'fair', multiplier: 0.5, note: '1,500 sf office; reconfigure for reception.' },
        { key: 'bathrooms', condition: 'poor', multiplier: 1.1, note: 'Below Assembly fixture counts — add restrooms.' },
        { key: 'fireSprinkler', condition: 'absent', multiplier: 1.5, note: 'No system; full coverage required for the new use.' },
      ],
      compliance: [
        { key: 'co-use', label: 'Certificate of Occupancy / use', status: 'attention', detail: 'Nassau / Town of North Hempstead change-of-use and site-plan review likely required.' },
        { key: 'clear-height', label: 'Clear height', status: 'risk', detail: "17' is below badminton's 20' minimum — pickleball-only unless height can be gained." },
        { key: 'sprinkler', label: 'Fire sprinkler', status: 'risk', detail: 'None present; required for Assembly occupancy.' },
        { key: 'egress', label: 'Egress / occupant load', status: 'attention', detail: 'Confirm two compliant exits for the recreation occupant load.' },
        { key: 'parking', label: 'Parking', status: 'ok', detail: 'Ample on-site lot — a real advantage for a suburban operator.' },
        { key: 'ada', label: 'ADA / accessibility', status: 'attention', detail: 'Upgrade restrooms and entrance route to ADA.' },
        { key: 'violations', label: 'Open violations', status: 'unknown', detail: 'Check Town building-department records.' },
      ],
      assessedAt: FETCHED_AT,
    },
  ),
]
