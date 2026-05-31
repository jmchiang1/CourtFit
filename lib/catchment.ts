// Client-safe trade-area config, shared by the server-side census fetcher
// (lib/census-core.ts) and the map UI (components/PropertiesMap.tsx). Kept free
// of any server-only imports so it can be bundled on the client.

// Sport-specific drive-time catchments (minutes). Badminton is a destination
// sport — players travel further — so its catchment is wider; pickleball is
// casual and local. Tunable.
export const DRIVE_MINUTES = { badminton: 20, pickleball: 12 } as const
