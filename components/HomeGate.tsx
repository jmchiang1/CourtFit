'use client'

import { useState } from 'react'
import { AppHome } from '@/components/AppHome'
import { Header } from '@/components/Header'
import { Splash } from '@/components/Splash'

/**
 * Entry gate for `/`. Signed-in users go straight to the dashboard. Everyone
 * else sees the (header-less) splash until they choose "Try without an account",
 * which drops them into the dashboard running on local demo data. The header
 * lives here rather than the root layout so it never shows over the splash.
 */
export function HomeGate({ signedIn, email }: { signedIn: boolean; email: string | null }) {
  const [tryDemo, setTryDemo] = useState(false)

  if (signedIn || tryDemo) {
    return (
      <>
        <Header email={email} />
        <AppHome demo={!signedIn} />
      </>
    )
  }
  return <Splash onTry={() => setTryDemo(true)} />
}
