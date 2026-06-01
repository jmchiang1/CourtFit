import { ExtractedListingSchema } from '@/lib/extract/schema'
import { EXTRACT_SYSTEM_PROMPT } from '@/lib/extract/prompt'
import { parseListingWithRegex } from '@/lib/extract/regex-fallback'
import type { ExtractedListing } from '@/types/analysis'

/**
 * Edge runtime — Vercel hobby tier gives ~25s of wall time for streaming
 * responses, much more headroom than the 10s Node Serverless cap.
 *
 * We call the Anthropic REST API directly via fetch instead of using
 * @anthropic-ai/sdk — the SDK pulls in `node:fs` and `node:path` somewhere
 * in its bundle which Edge runtime rejects. All we need is one POST.
 */
export const runtime = 'edge'

const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_VERSION = '2023-06-01'

const TOOL_SCHEMA = {
  name: 'extract_listing',
  description: 'Extract structured property data from a commercial listing.',
  input_schema: {
    type: 'object',
    properties: {
      address: { type: ['string', 'null'] },
      totalSqft: { type: ['number', 'null'] },
      warehouseSqft: { type: ['number', 'null'] },
      officeSqft: { type: ['number', 'null'] },
      clearHeight: { type: ['number', 'null'] },
      rentPerSqftYr: { type: ['number', 'null'] },
      zoning: { type: ['string', 'null'] },
      loading: { type: ['string', 'null'] },
      parking: { type: ['string', 'null'] },
      locationNotes: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'address', 'totalSqft', 'warehouseSqft', 'officeSqft', 'clearHeight',
      'rentPerSqftYr', 'zoning', 'loading', 'parking', 'locationNotes',
    ],
  },
}

interface AnthropicResponse {
  content: Array<{ type: string; input?: unknown; text?: string }>
}

interface ExtractResult {
  listing: ExtractedListing
  source: 'ai' | 'regex'
  error?: string
}

/**
 * Regex-first cost gate. The regex parser is free; the Claude call costs money
 * on every paste. If regex already pulled the financially material fields —
 * size and rent, the two numbers the deal math actually needs — the listing is
 * clean enough that the AI pass would add little. Skip it.
 *
 * When either is missing (e.g. "Rent: Upon Request", odd formatting, prose
 * descriptions), regex isn't enough and we fall through to Claude.
 */
function regexIsConfident(listing: ExtractedListing): boolean {
  const hasSize = listing.totalSqft != null || listing.warehouseSqft != null
  const hasRent = listing.rentPerSqftYr != null
  return hasSize && hasRent
}

async function extractWithAnthropic(rawText: string, apiKey: string): Promise<ExtractedListing> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: EXTRACT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'extract_listing' },
      messages: [{ role: 'user', content: rawText }],
    }),
    // 20s SDK-level cap — leaves a few seconds for the response to flow back
    // before the Edge runtime's 25s wall-time limit fires.
    signal: AbortSignal.timeout(20_000),
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`Anthropic returned ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data: AnthropicResponse = await resp.json()
  const toolUse = data.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.input === undefined) {
    throw new Error('Anthropic did not return a tool_use block')
  }

  return ExtractedListingSchema.parse(toolUse.input) as ExtractedListing
}

export async function POST(request: Request): Promise<Response> {
  let body: { text?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text : ''

  if (!text.trim()) {
    const result: ExtractResult = { listing: parseListingWithRegex(''), source: 'regex' }
    return Response.json(result)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const result: ExtractResult = { listing: parseListingWithRegex(text), source: 'regex' }
    return Response.json(result)
  }

  // Regex-first: try the free parser before spending an API call. If it already
  // captured size + rent, return it and skip Claude entirely.
  const regexListing = parseListingWithRegex(text)
  if (regexIsConfident(regexListing)) {
    const result: ExtractResult = { listing: regexListing, source: 'regex' }
    return Response.json(result)
  }

  try {
    const listing = await extractWithAnthropic(text, process.env.ANTHROPIC_API_KEY)
    const result: ExtractResult = { listing, source: 'ai' }
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    const result: ExtractResult = {
      listing: parseListingWithRegex(text),
      source: 'regex',
      error: `AI extraction failed: ${message}`,
    }
    return Response.json(result)
  }
}
