import { detectRegion, type Region } from '@/lib/region'

export type Sport = 'Badminton' | 'Pickleball'

export interface ReferenceFacility {
  name: string
  address: string
  sports: Sport[]
  lat: number
  lng: number
  /** Known indoor court count, when published. Most operators don't list it. */
  courts?: number
}

/**
 * Existing indoor badminton / pickleball facilities across the NYC metro —
 * the five boroughs, Long Island, and northern New Jersey — shown on the map
 * as competitive reference points. Coordinates are
 * geocoded once (build-time) and baked in so there's no runtime geocoding cost.
 * Add new facilities here; region is derived from the address at render time.
 */
export const REFERENCE_FACILITIES: ReferenceFacility[] = [
  { name: 'Kotofit Long Island City', address: '43-56 10th St, Long Island City, NY 11101', sports: ['Badminton', 'Pickleball'], lat: 40.750952, lng: -73.950284 },
  { name: 'Kotofit Jersey City (3rd St)', address: '209 3rd St, Jersey City, NJ 07302', sports: ['Badminton', 'Pickleball'], lat: 40.722961, lng: -74.043414 },
  { name: 'Kotofit Jersey City (Brunswick St)', address: '189 Brunswick St, Jersey City, NJ 07302', sports: ['Badminton', 'Pickleball'], lat: 40.726486, lng: -74.050851 },
  { name: 'Kotofit Jersey City (Summit Ave)', address: '413 Summit Ave, Jersey City, NJ 07306', sports: ['Badminton', 'Pickleball'], lat: 40.729782, lng: -74.062070 },
  { name: 'Gotham Pickleball', address: '5-25 46th Ave, Long Island City, NY 11101', sports: ['Pickleball'], lat: 40.747456, lng: -73.954172 },
  { name: 'Brooklyn Badminton Center', address: '14 Woodward Ave, Ridgewood, NY 11385', sports: ['Badminton'], lat: 40.713386, lng: -73.920492 },
  { name: 'Badminking Badminton', address: '142 Georgia Ave, Brooklyn, NY 11207', sports: ['Badminton'], lat: 40.673335, lng: -73.898485 },
  { name: 'Velto Pickleball', address: '160 Van Brunt St, Brooklyn, NY 11231', sports: ['Pickleball'], lat: 40.683093, lng: -74.006555 },
  { name: 'Red Hook Pickleball Club', address: '262 Van Brunt St, Brooklyn, NY 11231', sports: ['Pickleball'], lat: 40.680533, lng: -74.009768 },
  { name: 'PKLYN Pickleball Club', address: '80 4th St, Brooklyn, NY 11231', sports: ['Pickleball'], lat: 40.676563, lng: -73.993362 },
  { name: 'New York Badminton Center', address: '132-70 34th Ave, Flushing, NY 11354', sports: ['Badminton'], lat: 40.765682, lng: -73.834482 },
  { name: 'Long Island Sports Center', address: '22 Lumber Rd, Roslyn, NY 11576', sports: ['Badminton'], lat: 40.801201, lng: -73.651543 },
  { name: 'Pickleball Prime', address: '205 E 2nd St, Mineola, NY 11501', sports: ['Pickleball'], lat: 40.744465, lng: -73.626631 },
  { name: 'Pickleball Plus', address: '525 Eagle Ave, West Hempstead, NY 11552', sports: ['Pickleball'], lat: 40.686559, lng: -73.651088 },
  { name: 'Pickleball Smash IT', address: '1500 Old Country Rd, Westbury, NY 11590', sports: ['Pickleball'], lat: 40.745652, lng: -73.595620 },
  { name: 'SportTime Pickleball Westbury', address: '575 Merrick Ave, Westbury, NY 11590', sports: ['Pickleball'], lat: 40.738356, lng: -73.584130 },
  { name: 'Gold Coast Pickleball Club', address: '95 Glen Head Rd, Glen Head, NY 11545', sports: ['Pickleball'], lat: 40.834036, lng: -73.625006 },
  { name: 'The Pickle Complex', address: '140 Eileen Way, Syosset, NY 11791', sports: ['Pickleball'], lat: 40.804019, lng: -73.519872 },
  { name: 'The Pickle Club', address: '200 Robbins Ln d2, Jericho, NY 11753', sports: ['Pickleball'], lat: 40.794827, lng: -73.517524 },
  { name: 'Long Island Badminton Center', address: '260 Spagnoli Rd, Melville, NY 11747', sports: ['Badminton'], lat: 40.762442, lng: -73.436398 },
  { name: 'Long Island Pickleball Center', address: '260 Spagnoli Rd, Melville, NY 11747', sports: ['Pickleball'], lat: 40.762442, lng: -73.436398 },
  { name: 'New Jersey Badminton Club', address: '95 Broadway, Jersey City, NJ 07306', sports: ['Badminton'], lat: 40.735833, lng: -74.072467 },
  { name: 'New Jersey Badminton Club Dream', address: '225 Meadowlands Pkwy, Secaucus, NJ 07094', sports: ['Badminton'], lat: 40.780817, lng: -74.080290 },
  { name: 'Cardinal Badminton', address: '500 Nordhoff Pl, Englewood, NJ 07631', sports: ['Badminton'], lat: 40.879628, lng: -73.987035 },
]

export function facilityRegion(f: ReferenceFacility): Region | null {
  return detectRegion(f.address)
}
