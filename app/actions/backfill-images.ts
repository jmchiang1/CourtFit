'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchListingImages } from '@/lib/extract/listing-images'
import type { ExtractedListing } from '@/types/analysis'

/**
 * Backfill listing photos for the current user's properties that have a source
 * URL but no images yet (e.g. imported by hand, or before the bookmarklet
 * captured photos). Re-scrapes each listing via Jina Reader and stores the
 * photos into listing_json.imageUrls. Sequential to stay polite to the proxy.
 * Returns how many rows were filled so the caller knows whether to reload.
 */
export async function backfillImages(): Promise<{ updated: number }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { updated: 0 }

  const { data: rows } = await sb
    .from('properties')
    .select('id, listing_json')

  if (!rows?.length) return { updated: 0 }

  let updated = 0
  for (const r of rows) {
    const listing = r.listing_json as ExtractedListing
    const hasImages = (listing.imageUrls?.length ?? 0) > 0
    if (hasImages || !listing.sourceUrl) {
      if (!hasImages) console.log(`[backfill-images] skip "${listing.address}" — no sourceUrl`)
      continue
    }

    const images = await fetchListingImages(listing.sourceUrl)
    console.log(
      `[backfill-images] "${listing.address}" src=${listing.sourceUrl} → ${images.length} images`,
    )
    if (!images.length) continue

    const { error } = await sb
      .from('properties')
      .update({
        listing_json: { ...listing, imageUrls: images },
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id)
    if (!error) updated++
  }

  if (updated > 0) revalidatePath('/')
  return { updated }
}
