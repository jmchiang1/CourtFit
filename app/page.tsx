import { createSupabaseServerClient } from '@/lib/supabase/server'
import { HomeGate } from '@/components/HomeGate'

export default async function Page() {
  let email: string | null = null
  try {
    const sb = await createSupabaseServerClient()
    const { data } = await sb.auth.getUser()
    email = data.user?.email ?? null
  } catch {
    // Supabase not configured — fall through to the splash / demo experience.
  }

  return <HomeGate signedIn={!!email} email={email} />
}
