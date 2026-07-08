'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Per-device set of verdict-modal panel keys the user has hidden. Persisted in
// localStorage so a section hidden on one property stays hidden on every other
// property (and across reloads) until it's shown again. Backed by an external
// store so every mounted consumer stays in sync the instant the set changes.
const KEY = 'cf-hidden-sections'
const EMPTY: string[] = []

let cache: string[] = EMPTY
let initialized = false
const listeners = new Set<() => void>()

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function ensureInit() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  cache = load()
  // Cross-tab / cross-instance sync.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    cache = load()
    listeners.forEach((l) => l())
  })
}

function subscribe(cb: () => void) {
  ensureInit()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): string[] {
  ensureInit()
  return cache
}

// Stable reference for SSR / first hydration render — nothing is hidden until
// the client reads localStorage, which useSyncExternalStore then reconciles.
function getServerSnapshot(): string[] {
  return EMPTY
}

function commit(next: string[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* localStorage unavailable — keep the in-memory value for this session */
  }
  listeners.forEach((l) => l())
}

export function useSectionVisibility() {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const isHidden = useCallback((key: string) => hidden.includes(key), [hidden])
  const hide = useCallback((key: string) => {
    if (!cache.includes(key)) commit([...cache, key])
  }, [])
  const toggle = useCallback((key: string) => {
    commit(cache.includes(key) ? cache.filter((k) => k !== key) : [...cache, key])
  }, [])
  const showAll = useCallback(() => {
    if (cache.length) commit([])
  }, [])

  return { hidden, isHidden, hide, toggle, showAll }
}
