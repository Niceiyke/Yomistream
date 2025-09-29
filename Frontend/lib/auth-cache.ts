// lib/auth-cache.ts
import { createClient } from "@/lib/supabase/client"

// Simple in-memory cache. Resets on page reload.
let sessionCache: { value: any | null; expiresAt: number } = {
  value: null,
  expiresAt: 0,
}

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

const supabase = createClient()

// Invalidate cache on auth state changes
supabase.auth.onAuthStateChange((_event, _session) => {
  sessionCache = { value: null, expiresAt: 0 }
})

export async function getSessionCached(ttlMs: number = DEFAULT_TTL_MS) {
  const now = Date.now()
  if (sessionCache.value && sessionCache.expiresAt > now) {
    return sessionCache.value
  }
  const { data } = await supabase.auth.getSession()
  sessionCache = { value: data, expiresAt: now + ttlMs }
  return data
}

export async function getAccessTokenCached(ttlMs: number = DEFAULT_TTL_MS): Promise<string | undefined> {
  const sessionData = await getSessionCached(ttlMs)
  return sessionData.session?.access_token
}
