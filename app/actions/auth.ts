'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function signInWithGoogle() {
  const sb = await createSupabaseServerClient()
  const origin = (await headers()).get('origin') ?? 'http://localhost:3000'
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/api/auth/callback` },
  })
  if (error || !data.url) return { error: error?.message ?? 'Could not start Google sign-in' }
  redirect(data.url)
}

export async function signOut() {
  const sb = await createSupabaseServerClient()
  await sb.auth.signOut()
  redirect('/')
}
