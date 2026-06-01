import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { ExtractedListing } from '@/types/analysis'
import type { ComplianceItem, ConditionAssessment } from '@/types/condition'

// Vision + reasoning: Sonnet judges condition far better than Haiku, and the
// cost is acceptable for a once-per-save call.
const MODEL = 'claude-sonnet-4-6'
const MAX_IMAGES = 3

// The canonical NYC / Nassau County due-diligence checklist. The AI fills in
// status + detail per key; we merge against this list so the panel always shows
// the full set (missing keys default to "unknown").
const COMPLIANCE_CHECKLIST: { key: string; label: string }[] = [
  { key: 'certificate-of-occupancy', label: 'Current Certificate of Occupancy' },
  { key: 'zoning-use', label: 'Zoning allows indoor recreation / sports use' },
  { key: 'change-of-use', label: 'Change of use / amended CO required' },
  { key: 'floor-plan', label: 'Floor plan with column grid' },
  { key: 'clear-height', label: 'Clear height (incl. ducts/beams/lights/sprinklers)' },
  { key: 'parking', label: 'Parking count vs. legal requirement' },
  { key: 'sprinkler-fire-alarm', label: 'Existing sprinkler / fire-alarm status' },
  { key: 'bathrooms-plumbing', label: 'Bathroom count & plumbing capacity' },
  { key: 'hvac-capacity', label: 'HVAC capacity' },
  { key: 'electrical-capacity', label: 'Utility service / electrical capacity' },
  { key: 'open-violations', label: 'Open violations' },
  { key: 'landlord-ti', label: 'Landlord permit contingency / free rent / TI allowance' },
  { key: 'code-consultant', label: 'Architect / code-consultant sign-off to open as designed' },
]

const SYSTEM_PROMPT = `You assess commercial / industrial spaces being converted into INDOOR RACKET-SPORTS facilities (badminton & pickleball) in New York City or Nassau County, NY. You estimate renovation scope from the listing text and photos, and flag code/permitting due-diligence items.

CONTEXT YOU MUST APPLY:
- The end use is an ASSEMBLY occupancy (NYC Building Code Group A-3). That typically forces: automatic sprinklers + fire alarm, rated egress, accessible (ADA) restrooms, and adequate ventilation — often beyond what a warehouse/retail shell has.
- Badminton needs ~20 ft+ unobstructed clear height; pickleball ~18 ft+. Obstructions (ducts, beams, lights, low sprinklers) reduce usable height.
- A barebones warehouse shell (bare slab, no HVAC, exposed deck, no finishes) implies a near full gut. A space already fitted out (climate-controlled, finished floors/walls, existing restrooms) implies far less work.

For EACH building system, return:
- condition: good | fair | poor | absent (absent = not present at all, must be installed)
- multiplier: cost vs a typical full fit-out. 0 = already adequate, no work; 0.5 = light touch-up; 1.0 = typical full fit-out; 1.5 = heavy/rip-out; 2.0 = worst case (full install + assembly upsizing). Be decisive and base it on what you actually see.
- note: one short phrase citing what you saw (e.g. "bare slab, no subfloor", "rooftop units visible, likely reusable").
Systems: hvac, electrical, lighting (court lighting), plumbing, flooring (court surface), walls (walls & finishes), office (office buildout), bathrooms, fireSprinkler (sprinkler/fire-alarm/life-safety).

For the COMPLIANCE checklist, return status + detail for each provided key:
- ok: the listing affirmatively supports it.
- attention: likely needs work or a near-term cost (e.g., parking light, sprinkler upgrade implied).
- risk: the listing reveals a likely blocker (e.g., clear height below requirement, zoning that doesn't permit indoor recreation, no parking).
- unknown: not determinable from a listing (most legal/permit items — CO, violations, code-consultant sign-off — are usually unknown; say what to verify).
Be honest: prefer "unknown" with a concrete verification step over guessing.

Keep notes/details terse (a clause, not a sentence). Output only via the assess_condition tool.`

const TOOL = {
  name: 'assess_condition',
  description: 'Return the renovation condition assessment and code checklist.',
  input_schema: {
    type: 'object' as const,
    properties: {
      scope: { type: 'string', enum: ['minimal', 'moderate', 'heavy', 'full-gut'] },
      summary: { type: 'string', description: '1–2 sentence narrative of the overall condition and reno scope.' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      systems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              enum: ['hvac', 'electrical', 'lighting', 'plumbing', 'flooring', 'walls', 'office', 'bathrooms', 'fireSprinkler'],
            },
            condition: { type: 'string', enum: ['good', 'fair', 'poor', 'absent'] },
            multiplier: { type: 'number' },
            note: { type: 'string' },
          },
          required: ['key', 'condition', 'multiplier', 'note'],
        },
      },
      compliance: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            status: { type: 'string', enum: ['ok', 'attention', 'unknown', 'risk'] },
            detail: { type: 'string' },
          },
          required: ['key', 'status', 'detail'],
        },
      },
    },
    required: ['scope', 'summary', 'confidence', 'systems', 'compliance'],
  },
} as const

const AssessSchema = z.object({
  scope: z.enum(['minimal', 'moderate', 'heavy', 'full-gut']),
  summary: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  systems: z
    .array(
      z.object({
        key: z.enum(['hvac', 'electrical', 'lighting', 'plumbing', 'flooring', 'walls', 'office', 'bathrooms', 'fireSprinkler']),
        condition: z.enum(['good', 'fair', 'poor', 'absent']),
        multiplier: z.number(),
        note: z.string().default(''),
      }),
    )
    .default([]),
  compliance: z
    .array(
      z.object({
        key: z.string(),
        status: z.enum(['ok', 'attention', 'unknown', 'risk']),
        detail: z.string().default(''),
      }),
    )
    .default([]),
})

function listingText(listing: ExtractedListing): string {
  const lines: string[] = []
  const push = (label: string, v: unknown) => {
    if (v != null && v !== '') lines.push(`${label}: ${v}`)
  }
  push('Address', listing.address)
  push('Total sqft', listing.totalSqft)
  push('Warehouse/open sqft', listing.warehouseSqft)
  push('Office sqft', listing.officeSqft)
  push('Clear height (ft)', listing.clearHeight)
  push('Zoning', listing.zoning)
  push('Loading', listing.loading)
  push('Parking', listing.parking)
  push('Asking rent ($/sqft/yr)', listing.rentPerSqftYr)
  for (const n of listing.locationNotes ?? []) lines.push(`Note: ${n}`)
  return lines.length ? lines.join('\n') : 'No structured details provided.'
}

/** Merge AI compliance results onto the canonical checklist (missing → unknown). */
function mergeCompliance(ai: { key: string; status: ComplianceItem['status']; detail: string }[]): ComplianceItem[] {
  const byKey = new Map(ai.map((c) => [c.key, c]))
  return COMPLIANCE_CHECKLIST.map(({ key, label }) => {
    const hit = byKey.get(key)
    return {
      key,
      label,
      status: hit?.status ?? 'unknown',
      detail: hit?.detail ?? 'Verify with the broker / building department.',
    }
  })
}

/**
 * Assess a property's condition from its listing details + photos. Returns null
 * (never throws) when there's no API key or the call fails — callers treat that
 * as "not assessed yet" and fall back to the flat baseline renovation estimate.
 */
export async function assessCondition(listing: ExtractedListing): Promise<ConditionAssessment | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[condition] No ANTHROPIC_API_KEY set — skipping assessment.')
    return null
  }

  const images = (listing.imageUrls ?? []).filter((u) => /^https?:\/\//.test(u)).slice(0, MAX_IMAGES)

  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 })

  try {
    const content: Anthropic.ContentBlockParam[] = [
      {
        type: 'text',
        text: `Assess this prospective indoor racket-sports facility.\n\nLISTING DETAILS:\n${listingText(listing)}\n\n${images.length} photo(s) follow.`,
      },
      ...images.map(
        (url): Anthropic.ContentBlockParam => ({
          type: 'image',
          source: { type: 'url', url },
        }),
      ),
    ]

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] as Anthropic.TextBlockParam[],
      tools: [TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: 'assess_condition' },
      messages: [{ role: 'user', content }],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return null

    const parsed = AssessSchema.parse(toolUse.input)
    return {
      scope: parsed.scope,
      summary: parsed.summary,
      confidence: parsed.confidence,
      imageCount: images.length,
      systems: parsed.systems.map((s) => ({ ...s, multiplier: Math.max(0, Math.min(2, s.multiplier)) })),
      compliance: mergeCompliance(parsed.compliance),
      assessedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.warn('[condition] assessment failed:', err)
    return null
  }
}
