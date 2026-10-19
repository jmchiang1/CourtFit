import { describe, it, expect } from 'vitest'
import { generateFallbackSummary } from '../summary-fallback'

describe('generateFallbackSummary', () => {
  it('mentions the rating, court counts, and triggered flags', () => {
    const text = generateFallbackSummary({
      address: '91-15 139th St, Jamaica, NY',
      rating: 'Risky',
      courts: { badminton: 4, total: 4 },
      grossRevenue: 476_153,
      noi: 31_792,
      paybackYears: 12.27,
      flags: [
        { id: 'low-clear-height', severity: 'high', title: 'Low ceiling', detail: '' },
        { id: 'missing-rent', severity: 'high', title: 'Rent missing', detail: '' },
      ],
    })
    expect(text).toMatch(/Risky/)
    expect(text).toMatch(/4 badminton courts/)
    expect(text).not.toMatch(/pickleball/i)
    expect(text).toMatch(/Low ceiling|clear height/i)
    expect(text).toMatch(/Next steps/)
  })

  it('handles null payback gracefully', () => {
    const text = generateFallbackSummary({
      address: null,
      rating: 'Do Not Pursue',
      courts: { badminton: 0, total: 0 },
      grossRevenue: 0,
      noi: -5000,
      paybackYears: null,
      flags: [],
    })
    expect(text).toMatch(/Not profitable|unavailable/i)
  })
})
