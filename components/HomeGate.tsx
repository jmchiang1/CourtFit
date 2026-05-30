'use client'

import { useState } from 'react'
import { AppHome } from '@/components/AppHome'
import { Splash } from '@/components/Splash'

/**
 * Entry gate for `/`. Signed-in users go straight to the dashboard. Everyone
 * else sees the splash until they choose "Try without an account", which drops
 * them into the dashboard running on local demo data.
 */
export function HomeGate({ signedIn }: { signedIn: boolean }) {
  const [tryDemo, setTryDemo] = useState(false)

  if (signedIn) return <AppHome />
  if (tryDemo) return <AppHome demo />
  return <Splash onTry={() => setTryDemo(true)} />
}
