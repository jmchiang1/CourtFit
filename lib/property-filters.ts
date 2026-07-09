// Shared numeric range-filter model used by both the list table and the map's
// "My Sites" layer, so the two views filter properties identically. Each range
// is a {min,max} pair of raw input strings ('' = no bound on that side).

export type RangeKey = 'sqft' | 'height' | 'rent'
export type Range = { min: string; max: string }
export type Ranges = Record<RangeKey, Range>

export const EMPTY_RANGES: Ranges = {
  sqft: { min: '', max: '' },
  height: { min: '', max: '' },
  rent: { min: '', max: '' },
}

export const RANGE_FIELDS: { key: RangeKey; label: string; unit: string; step: number }[] = [
  { key: 'sqft', label: 'Total sqft', unit: 'sf', step: 1000 },
  { key: 'height', label: 'Clear height', unit: 'ft', step: 1 },
  { key: 'rent', label: 'Lease price', unit: '$/sf/yr', step: 1 },
]

/**
 * A value passes a range if it's within whatever bounds the user actually set.
 * A missing value (null) fails as soon as either bound is set — we can't confirm
 * an unknown clear height / sqft / rent lies inside the requested band.
 */
export function inRange(value: number | null, { min, max }: Range): boolean {
  const lo = min.trim() === '' ? null : Number(min)
  const hi = max.trim() === '' ? null : Number(max)
  if (lo == null && hi == null) return true
  if (value == null) return false
  if (lo != null && isFinite(lo) && value < lo) return false
  if (hi != null && isFinite(hi) && value > hi) return false
  return true
}

/** How many of the ranges have at least one bound set (drives the "N" badge). */
export function countActiveRanges(ranges: Ranges): number {
  return (Object.keys(ranges) as RangeKey[]).filter(
    (k) => ranges[k].min.trim() !== '' || ranges[k].max.trim() !== '',
  ).length
}
