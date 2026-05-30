import 'server-only'

// The implementation lives in ./census-core (no `server-only` guard) so build
// scripts can reuse the exact same Census/TIGERweb fetch logic. App code should
// import from here, which keeps the fetcher off any client bundle.
export * from './census-core'
