import 'server-only'

// Property photos live on these CDNs; broker headshots / agency logos don't,
// and we drop them with SKIP (same heuristic as the bookmarklet).
const PROPERTY_CDN = /images?\d*\.loopnet\.com|images?\d*\.crexi\.com/i
const SKIP = /people|agent|broker|avatar|profile|headshot|logo|sprite|icon/i
const IMG_URL = /https?:\/\/[^\s)"'<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^\s)"'<>]*)?/gi

/**
 * Scrape listing photos from a source URL via Jina Reader (r.jina.ai), the same
 * browser-rendering proxy used for text extraction — so it gets past the anti-bot
 * defenses that block raw server fetches of LoopNet/Crexi. We ask for an image
 * summary and pull every image URL out of the returned markdown.
 *
 * Returns up to `limit` property-photo URLs (best-effort; never throws).
 */
export async function fetchListingImages(
  url: string | null,
  limit = 8,
): Promise<string[]> {
  const trimmed = url?.trim()
  if (!trimmed || !/^https?:\/\//.test(trimmed)) return []

  try {
    const resp = await fetch(`https://r.jina.ai/${trimmed}`, {
      headers: {
        'X-Return-Format': 'markdown',
        'X-With-Images-Summary': 'true',
      },
    })
    if (!resp.ok) {
      console.log(`[listing-images] Jina ${resp.status} for ${trimmed}`)
      return []
    }
    const body = await resp.text()

    const all = new Set<string>()
    for (const m of body.matchAll(IMG_URL)) all.add(m[0])

    const usable = [...all].filter((u) => !SKIP.test(u))
    // Prefer known property-photo CDNs; fall back to any non-skipped image so
    // non-LoopNet/Crexi listings still get something.
    const preferred = usable.filter((u) => PROPERTY_CDN.test(u))
    const picked = preferred.length ? preferred : usable
    console.log(
      `[listing-images] body=${body.length}b allImgs=${all.size} usable=${usable.length} cdn=${preferred.length}` +
        (all.size ? ` sample=${[...all].slice(0, 3).join(' , ')}` : ''),
    )
    return picked.slice(0, limit)
  } catch {
    return []
  }
}
