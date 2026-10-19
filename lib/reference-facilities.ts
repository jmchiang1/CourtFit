import { detectRegion, type Region } from '@/lib/region'

/**
 * Sports a facility can list. The app is badminton-only, but facilities that
 * also run pickleball keep it in their list (and older user-added rows in
 * `reference_facilities.sports` may contain it), so the union stays. Only
 * facilities whose sports include 'Badminton' count as competitors.
 */
export type Sport = 'Badminton' | 'Pickleball'

export interface ReferenceFacility {
  name: string
  address: string
  sports: Sport[]
  lat: number
  lng: number
  /** Known indoor court count, when published. Most operators don't list it. */
  courts?: number
  /** Operator's official site. */
  website?: string
}

/**
 * Existing indoor badminton facilities across the NYC metro —
 * the five boroughs, Long Island, and northern New Jersey — shown on the map
 * as competitive reference points. Coordinates are
 * geocoded once (build-time) and baked in so there's no runtime geocoding cost.
 * Add new facilities here; region is derived from the address at render time.
 */
export const REFERENCE_FACILITIES: ReferenceFacility[] = [
  { name: 'Kotofit Long Island City', address: '43-56 10th St, Long Island City, NY 11101', sports: ['Badminton', 'Pickleball'], lat: 40.750952, lng: -73.950284, website: 'https://www.kotofit.com/locations/club/new-york-nyc-long-island-city' },
  { name: 'Kotofit Jersey City (3rd St)', address: '209 3rd St, Jersey City, NJ 07302', sports: ['Badminton', 'Pickleball'], lat: 40.722961, lng: -74.043414, website: 'https://www.kotofit.com/locations/club/new-jersey-jersey-city-3rd-st' },
  { name: 'Kotofit Jersey City (Brunswick St)', address: '189 Brunswick St, Jersey City, NJ 07302', sports: ['Badminton', 'Pickleball'], lat: 40.726486, lng: -74.050851, website: 'https://www.kotofit.com/locations/club/new-jersey-jersey-city-brunswick-st' },
  { name: 'Kotofit Jersey City (Summit Ave)', address: '413 Summit Ave, Jersey City, NJ 07306', sports: ['Badminton', 'Pickleball'], lat: 40.729782, lng: -74.062070, website: 'https://www.kotofit.com/locations/club/new-jersey-jersey-city-summit-ave' },
  { name: 'Brooklyn Badminton Center', address: '14 Woodward Ave, Ridgewood, NY 11385', sports: ['Badminton'], lat: 40.713386, lng: -73.920492, website: 'https://www.brooklynbadmintoncenter.com' },
  { name: 'Badminking Badminton', address: '142 Georgia Ave, Brooklyn, NY 11207', sports: ['Badminton'], lat: 40.673335, lng: -73.898485 },
  { name: 'New York Badminton Center', address: '132-70 34th Ave, Flushing, NY 11354', sports: ['Badminton'], lat: 40.765682, lng: -73.834482, website: 'https://www.newyorkcitybadminton.com/flushing' },
  { name: 'Long Island Sports Center', address: '22 Lumber Rd, Roslyn, NY 11576', sports: ['Badminton'], lat: 40.801201, lng: -73.651543, website: 'https://www.longislandsportscenter.com' },
  { name: 'Long Island Badminton Center', address: '260 Spagnoli Rd, Melville, NY 11747', sports: ['Badminton'], lat: 40.762442, lng: -73.436398, website: 'https://longislandbadmintoncenter.com' },
  { name: 'New Jersey Badminton Club', address: '95 Broadway, Jersey City, NJ 07306', sports: ['Badminton'], lat: 40.735833, lng: -74.072467, website: 'https://jerseycitybadminton.com' },
  { name: 'New Jersey Badminton Club Dream', address: '225 Meadowlands Pkwy, Secaucus, NJ 07094', sports: ['Badminton'], lat: 40.780817, lng: -74.080290, website: 'https://www.njbadminton.com' },
  { name: 'Cardinal Badminton', address: '500 Nordhoff Pl, Englewood, NJ 07631', sports: ['Badminton'], lat: 40.879628, lng: -73.987035, website: 'https://www.cardinalbadminton.com' },
]

export function facilityRegion(f: ReferenceFacility): Region | null {
  return detectRegion(f.address)
}

/** The facility's website, or a web search for it when none is on file. */
export function facilityUrl(f: ReferenceFacility): string {
  return f.website ?? `https://www.google.com/search?q=${encodeURIComponent(`${f.name} ${f.address}`)}`
}
