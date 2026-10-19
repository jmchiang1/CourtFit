import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (code) {
    const sb = await createSupabaseServerClient()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (error) console.error('[auth/callback] code exchange failed:', error.message)
  } else if (url.searchParams.get('error')) {
    console.error('[auth/callback] provider error:', url.searchParams.get('error_description'))
  }
  return NextResponse.redirect(new URL('/', url))
}
