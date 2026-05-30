import { createSupabaseServerClient } from '@/lib/supabase/server'
import { HomeGate } from '@/components/HomeGate'

export default async function Page() {
  let signedIn = false
  try {
    const sb = await createSupabaseServerClient()
    const { data } = await sb.auth.getUser()
    signedIn = !!data.user
  } catch {
    // Supabase not configured — fall through to the splash / demo experience.
  }

  return <HomeGate signedIn={signedIn} />
}
