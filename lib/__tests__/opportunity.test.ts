import { describe, expect, it } from 'vitest'
import { findOpportunities } from '@/lib/opportunity'
import { buildCompetitorSites } from '@/lib/competition'
import data from '@/lib/demand-tracts.json'
import type { DemandTract } from '@/lib/demand-tracts-data'

const tracts = (data as unknown as { tracts: DemandTract[] }).tracts
const sites = buildCompetitorSites()

describe('findOpportunities', () => {
  it('ranks spread-out sites clear of existing facilities', () => {
    const opps = findOpportunities(tracts, sites)
    expect(opps.length).toBe(8)
    expect(opps.map((o) => o.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    for (const o of opps) expect(o.nearest!.miles).toBeGreaterThanOrEqual(1.9)
    for (let i = 1; i < opps.length; i++) expect(opps[i - 1].score).toBeGreaterThanOrEqual(opps[i].score)
  })

  it('re-ranks when a competitor lands on the top pick', () => {
    const [top] = findOpportunities(tracts, sites)
    const next = findOpportunities(tracts, [...sites, { name: 'New club', lat: top.lat, lng: top.lng }])
    expect(next.find((o) => o.id === top.id)).toBeUndefined()
  })
})
