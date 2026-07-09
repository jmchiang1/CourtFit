'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** Toggle the manual "interested" star on a property (see 0007_interested.sql). */
export async function updatePropertyInterested(id: string, interested: boolean) {
  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' as const }

  const { error } = await sb
    .from('properties')
    .update({ interested, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/')
  return { ok: true as const }
}
