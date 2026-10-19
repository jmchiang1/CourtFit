import { describe, it, expect } from 'vitest'
import { analyzeCompetition, buildCompetitorSites, type CompetitorSite } from '../competition'
import { computeWhitespace } from '../whitespace'
import { REFERENCE_FACILITIES } from '../reference-facilities'
import { FACILITY_DEMOGRAPHICS } from '../facility-demographics'
import type { ReferenceFacilityRow } from '../supabase/types'

function row(over: Partial<ReferenceFacilityRow>): ReferenceFacilityRow {
  return {
    id: 'x',
    user_id: 'u',
    created_at: '2026-01-01T00:00:00Z',
    name: 'Custom',
    address: '1 Main St, Queens, NY 11101',
    sports: ['Badminton'],
    latitude: 40.75,
    longitude: -73.95,
    geocoded_at: null,
    demographics_json: null,
    demographics_at: null,
    ...over,
  }
}

describe('built-in reference facilities', () => {
  it('include pickleball-only clubs for the map, but only badminton clubs compete', () => {
    const pickleOnly = REFERENCE_FACILITIES.filter((f) => !f.sports.includes('Badminton'))
    expect(pickleOnly.length).toBeGreaterThan(0)
    const competing = buildCompetitorSites().map((s) => s.name)
    for (const f of pickleOnly) expect(competing).not.toContain(f.name)
  })

  it('baked demographics match the facility list and carry no pickleball fields', () => {
    expect(Object.keys(FACILITY_DEMOGRAPHICS).sort()).toEqual(REFERENCE_FACILITIES.map((f) => f.name).sort())
    for (const d of Object.values(FACILITY_DEMOGRAPHICS)) {
      expect(d.pickleballFit).toBeUndefined()
      expect(d.catchments?.pickleball).toBeUndefined()
    }
  })
})

describe('buildCompetitorSites', () => {
  it('drops user-added rows that do not offer badminton', () => {
    const sites = buildCompetitorSites([
      row({ id: 'a', name: 'Pickle only', sports: ['Pickleball'] }),
      row({ id: 'b', name: 'Both', sports: ['Badminton', 'Pickleball'] }),
      row({ id: 'c', name: 'Badminton only', sports: ['Badminton'] }),
      row({ id: 'd', name: 'No coords', latitude: null, longitude: null }),
    ])
    const names = sites.map((s) => s.name)
    expect(names).not.toContain('Pickle only')
    expect(names).not.toContain('No coords')
    expect(names).toContain('Both')
    expect(names).toContain('Badminton only')
    const builtinBadminton = REFERENCE_FACILITIES.filter((f) => f.sports.includes('Badminton')).length
    expect(sites.length).toBe(builtinBadminton + 2)
  })
})

describe('analyzeCompetition', () => {
  it('counts only badminton facilities within the radius', () => {
    const sites: CompetitorSite[] = [
      { name: 'Near badminton', lat: 40.751, lng: -73.95, sports: ['Badminton'] },
      { name: 'Near both', lat: 40.752, lng: -73.95, sports: ['Badminton', 'Pickleball'] },
      { name: 'Near pickleball', lat: 40.753, lng: -73.95, sports: ['Pickleball'] },
      { name: 'Far badminton', lat: 41.5, lng: -73.95, sports: ['Badminton'] },
    ]
    const r = analyzeCompetition(40.75, -73.95, sites)
    expect(r.badmintonCompetitors).toBe(2)
    expect(r.nearby.map((n) => n.name)).toEqual(['Near badminton', 'Near both'])
    expect(r.nearest?.name).toBe('Near badminton')
  })
})

describe('computeWhitespace', () => {
  it('returns the full demand fit with no competition', () => {
    const w = computeWhitespace({ badmintonFit: 80, targetPopulation: 200_000, competitors: 0 })
    expect(w).toMatchObject({ score: 80, label: 'Strong', competitors: 0, factor: 1 })
  })

  it('discounts for competition, floored at 0.35', () => {
    const some = computeWhitespace({ badmintonFit: 80, targetPopulation: 240_000, competitors: 1 })
    expect(some.factor).toBeCloseTo(0.775)
    expect(some.score).toBe(62)
    const saturated = computeWhitespace({ badmintonFit: 80, targetPopulation: 10_000, competitors: 10 })
    expect(saturated.factor).toBe(0.35)
    expect(saturated.score).toBe(28)
    expect(saturated.label).toBe('Weak')
  })
})
