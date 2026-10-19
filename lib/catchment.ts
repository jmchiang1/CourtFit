// Client-safe trade-area config, shared by the server-side census fetcher
// (lib/census-core.ts) and the map UI (components/PropertiesMap.tsx). Kept free
// of any server-only imports so it can be bundled on the client.

// Badminton drive-time catchment (minutes). Badminton is a destination sport —
// players will travel — so the catchment is fairly wide. Tunable.
export const DRIVE_MINUTES = 20
