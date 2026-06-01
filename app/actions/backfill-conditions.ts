'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { assessCondition } from '@/lib/condition'
import type { ExtractedListing } from '@/types/analysis'

/**
 * Backfill the AI condition assessment for the current user's saved properties
 * that don't have one yet (saved before this feature existed, or where the
 * assessment previously failed).
 *
 * Each assessment is a vision call (a few seconds), so this processes a small
 * `limit` per invocation and returns how many still need it — the caller loops
 * until `remaining` hits 0, which keeps any single request well under serverless
 * function timeouts and lets the UI fill in progressively.
 */
export async function backfillConditions(
  limit = 3,
): Promise<{ updated: number; remaining: number }> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { updated: 0, remaining: 0 }

  const { data: rows } = await sb
    .from('properties')
    .select('id, listing_json')
    .is('condition_json', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!rows?.length) return { updated: 0, remaining: 0 }

  let updated = 0
  for (const r of rows) {
    const condition = await assessCondition(r.listing_json as ExtractedListing)
    if (!condition) continue
    const { error } = await sb
      .from('properties')
      .update({ condition_json: condition, condition_at: new Date().toISOString() })
      .eq('id', r.id)
    if (!error) updated++
  }

  const { count } = await sb
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .is('condition_json', null)

  if (updated > 0) revalidatePath('/')
  return { updated, remaining: count ?? 0 }
}
