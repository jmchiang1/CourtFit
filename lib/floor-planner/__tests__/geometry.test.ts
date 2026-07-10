import { describe, it, expect } from 'vitest'
import { diagnose, resolveRect, tally } from '../geometry'
import { makeZone } from '../config'
import { seedLayoutFromListing, normalizeLayout } from '../seed'
import type { BuildingDef, PlacedItem, ZoneDef } from '../types'

const building: BuildingDef = { name: 'Test', lengthFt: 200, widthFt: 100 }

function court(id: string, type: string, xFt: number, yFt: number, rotated = false): PlacedItem {
  return { id, category: 'court', type, xFt, yFt, rotated }
}

describe('resolveRect', () => {
  it('uses footprint vs play size for a court', () => {
    const c = court('a', 'badminton', 0, 0)
    expect(resolveRect(c, 'footprint')).toMatchObject({ wFt: 44, hFt: 22 })
    expect(resolveRect(c, 'play')).toMatchObject({ wFt: 44, hFt: 20 })
  })
  it('swaps axes when rotated', () => {
    const c = court('a', 'badminton', 0, 0, true)
    expect(resolveRect(c, 'footprint')).toMatchObject({ wFt: 22, hFt: 44 })
  })
})

describe('diagnose', () => {
  const tall: ZoneDef[] = [makeZone(100, 30)]
  const low: ZoneDef[] = [makeZone(100, 20)]

  it('flags badminton in a low-ceiling zone', () => {
    const d = diagnose([court('a', 'badminton', 10, 10)], 'footprint', building, low)
    expect(d['a'].warnings).toContain('ceiling')
  })
  it('passes badminton in a tall zone', () => {
    const d = diagnose([court('a', 'badminton', 10, 10)], 'footprint', building, tall)
    expect(d['a'].warnings).toHaveLength(0)
  })
  it('allows pickleball in a low zone (needs only 18 ft)', () => {
    const d = diagnose([court('a', 'pickleball', 10, 10)], 'footprint', building, low)
    expect(d['a'].warnings).toHaveLength(0)
  })
  it('flags a court that spills outside the building', () => {
    const d = diagnose([court('a', 'badminton', 190, 10)], 'footprint', building, tall)
    expect(d['a'].warnings).toContain('out-of-bounds')
  })
  it('flags two overlapping courts', () => {
    const d = diagnose(
      [court('a', 'badminton', 10, 10), court('b', 'badminton', 20, 12)],
      'footprint',
      building,
      tall,
    )
    expect(d['a'].warnings).toContain('overlap')
    expect(d['b'].warnings).toContain('overlap')
  })
})

describe('tally', () => {
  const zones = [makeZone(100, 30)]
  it('counts only valid, in-bounds, non-overlapping courts', () => {
    const items = [
      court('a', 'badminton', 10, 10),
      court('b', 'badminton', 60, 10),
      court('c', 'pickleball', 110, 10),
      court('d', 'badminton', 190, 10), // out of bounds → excluded
    ]
    const d = diagnose(items, 'footprint', building, zones)
    const t = tally(items, 'footprint', d)
    expect(t.totalCourts).toBe(3)
    expect(t.badminton).toBe(2)
    expect(t.pickleball).toBe(1)
    expect(t.warnings).toBeGreaterThanOrEqual(1)
  })
})

describe('seedLayoutFromListing', () => {
  it('sizes the envelope from square footage and ceiling from clear height', () => {
    const layout = seedLayoutFromListing(
      { warehouseSqft: 30_000, totalSqft: 35_000, clearHeight: 24, address: '1 A St' },
      'My site',
    )
    const area = layout.building.lengthFt * layout.building.widthFt
    expect(area).toBeGreaterThan(20_000)
    expect(area).toBeLessThan(40_000)
    expect(layout.zones[0].ceilingFt).toBe(24)
    expect(layout.name).toBe('My site')
    expect(layout.items).toHaveLength(0)
  })
  it('falls back to a default envelope when sizes are null', () => {
    const layout = seedLayoutFromListing({
      warehouseSqft: null,
      totalSqft: null,
      clearHeight: null,
      address: null,
    })
    expect(layout.building.lengthFt).toBeGreaterThan(0)
    expect(layout.building.widthFt).toBeGreaterThan(0)
    expect(layout.zones[0].ceilingFt).toBe(24)
  })
})

describe('normalizeLayout', () => {
  it('returns null for malformed input', () => {
    expect(normalizeLayout(null)).toBeNull()
    expect(normalizeLayout({})).toBeNull()
    expect(normalizeLayout({ building: {}, zones: [], items: [] })).toBeNull()
  })
  it('accepts a well-formed layout', () => {
    const seeded = seedLayoutFromListing({
      warehouseSqft: 20_000,
      totalSqft: null,
      clearHeight: 22,
      address: null,
    })
    const round = normalizeLayout(JSON.parse(JSON.stringify(seeded)))
    expect(round).not.toBeNull()
    expect(round!.building.lengthFt).toBe(seeded.building.lengthFt)
  })
})
