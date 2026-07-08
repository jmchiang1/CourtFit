'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PROPERTY_STATUSES, type PropertyStatus } from '@/lib/property-status'

export async function updatePropertyStatus(id: string, status: PropertyStatus) {
  if (!PROPERTY_STATUSES.includes(status)) return { error: 'invalid_status' as const }

  const sb = await createSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: 'not_authenticated' as const }

  const { error } = await sb
    .from('properties')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/')
  return { ok: true as const }
}
