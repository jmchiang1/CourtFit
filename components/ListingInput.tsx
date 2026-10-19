'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { fetchListingText } from '@/app/actions/fetch-listing'
import { parseListingWithRegex } from '@/lib/extract/regex-fallback'
import type { ExtractedListing } from '@/types/analysis'

interface ExtractResult {
  listing: ExtractedListing
  source: 'ai' | 'regex'
  error?: string
}

/**
 * Calls /api/extract — a Route Handler running on Edge runtime (25s wall
 * time on Vercel hobby vs the 10s Node Serverless cap).
 */
async function extractListing(text: string): Promise<ExtractResult> {
  const resp = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`)
  }
  return resp.json()
}

const URL_RE = /^https?:\/\/\S+$/

interface Props {
  onExtracted: (listing: ExtractedListing, source: 'ai' | 'regex', error?: string) => void
  /** Optional slot for header action(s) — e.g. a "How it works" button. */
  headerAction?: React.ReactNode
}

export function ListingInput({ onExtracted, headerAction }: Props) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'extracting'>('idle')
  const [pending, start] = useTransition()
  const [warning, setWarning] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  // Track whether the user has manually edited the textarea. We only prompt
  // before overwriting when the content is user-typed — not when it came from
  // a previous bookmarklet drop (which is already processed into the form).
  const editedRef = useRef(false)

  // Read text from #import= hash (bookmarklet drop point). Runs on mount AND
  // on hashchange so a reused tab (window.open with named target) also fires.
  useEffect(() => {
    const handleImport = () => {
      const hash = window.location.hash
      if (!hash.startsWith('#import=')) return

      let decoded = ''
      try {
        decoded = decodeURIComponent(hash.slice('#import='.length))
      } catch {
        return
      }

      // Strip the hash immediately so reloads / re-mounts don't replay it.
      window.history.replaceState(null, '', window.location.pathname + window.location.search)

      if (!decoded.trim()) return

      // New bookmarklet format: JSON { text, sourceUrl, imageUrls }.
      // Old format: plain text. Detect and fall back.
      let imported = decoded
      let sourceUrl: string | null = null
      let imageUrls: string[] = []
      try {
        const parsed = JSON.parse(decoded)
        if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
          imported = parsed.text
          sourceUrl = typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl : null
          imageUrls = Array.isArray(parsed.imageUrls)
            ? parsed.imageUrls.filter((s: unknown) => typeof s === 'string')
            : []
        }
      } catch {
        // Old plain-text bookmarklet — keep imported = decoded
      }

      // If the user was mid-edit, ask before clobbering their work.
      if (editedRef.current) {
        const ok = window.confirm(
          'A bookmarklet import is replacing the listing input you were editing. Continue?',
        )
        if (!ok) return
      }

      setText(imported)
      editedRef.current = false
      setWarning(null)
      setStatus(`Loaded ${imported.length.toLocaleString()} chars from bookmarklet — extracting…`)

      // Auto-extract immediately (skips URL-fetch path — bookmarklet content is already text).
      start(async () => {
        setPhase('extracting')
        try {
          // 20-second cap. If extraction stalls, fall back to the client-side regex
          // parser so the form at least populates with what regex can pull.
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 25_000),
          )
          const r = await Promise.race([extractListing(imported), timeout])
          if (r.source === 'regex' && r.error) setWarning(r.error)
          else setStatus(`Extracted ${imported.length.toLocaleString()} chars from bookmarklet.`)
          // Merge bookmarklet metadata onto the AI/regex listing.
          onExtracted(
            { ...r.listing, sourceUrl, imageUrls },
            r.source,
            r.error,
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error'
          // Fall back to client-side regex so the user isn't left empty-handed.
          const fallback = parseListingWithRegex(imported)
          onExtracted({ ...fallback, sourceUrl, imageUrls }, 'regex')
          setWarning(
            `AI extraction failed (${msg}). Form populated with regex fallback — please double-check fields.`,
          )
        } finally {
          setPhase('idle')
        }
      })
    }

    handleImport()
    window.addEventListener('hashchange', handleImport)
    return () => window.removeEventListener('hashchange', handleImport)
    // onExtracted is intentionally not a dep — we want the closure captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isUrl = URL_RE.test(text.trim())

  const buttonLabel = pending
    ? phase === 'fetching'
      ? 'Fetching URL…'
      : 'Extracting…'
    : isUrl
      ? 'Fetch & extract'
      : 'Extract with AI'

  return (
    <Card className="listing-input-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Listing input</CardTitle>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Paste a LoopNet/Crexi URL — or paste listing text directly..."
          value={text}
          onChange={e => {
            setText(e.target.value)
            editedRef.current = true
          }}
          className="text-sm h-48 max-h-48 resize-none"
        />
        <div className="flex items-center gap-2">
          <Button
            disabled={pending || !text.trim()}
            onClick={() =>
              start(async () => {
                setWarning(null)
                setStatus(null)
                try {
                  let payload = text
                  if (isUrl) {
                    setPhase('fetching')
                    const f = await fetchListingText(text)
                    if (f.error || !f.text) {
                      setWarning(`URL fetch failed: ${f.error ?? 'no content'}`)
                      return
                    }
                    payload = f.text
                    setStatus(`Fetched ${f.text.length.toLocaleString()} chars from URL.`)
                  }

                  setPhase('extracting')
                  const timeout = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 25_000),
                  )
                  const r = await Promise.race([extractListing(payload), timeout])
                  if (r.source === 'regex' && r.error) setWarning(r.error)
                  onExtracted(r.listing, r.source, r.error)
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'unknown error'
                  // Fall back to client-side regex parsing so the user isn't stuck.
                  const fallback = parseListingWithRegex(text)
                  onExtracted(fallback, 'regex')
                  setWarning(
                    `AI extraction failed (${msg}). Form populated with regex fallback — please double-check fields.`,
                  )
                } finally {
                  setPhase('idle')
                }
              })
            }
          >
            {buttonLabel}
          </Button>
          <span className="text-sm text-muted-foreground">
            {isUrl ? 'URL detected — will fetch and parse.' : 'or fill the form manually below.'}
          </span>
        </div>
        {status && !warning && (
          <p className="text-sm text-good bg-good/10 ring-1 ring-inset ring-good/25 rounded-md px-3 py-2">
            {status}
          </p>
        )}
        {warning && (
          <p className="text-sm text-caution bg-caution/10 ring-1 ring-inset ring-caution/25 rounded-md px-3 py-2">
            {warning}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
