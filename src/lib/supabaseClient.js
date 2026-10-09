import { createClient } from '@supabase/supabase-js'

// Defaults used when Vercel env vars are not set (anon key is public in the browser bundle).
const DEFAULT_URL = 'https://sjmmyqeqiigmclcgcadr.supabase.co'
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqbW15cWVxaWlnbWNsY2djYWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDY2MDEsImV4cCI6MjA4ODM4MjYwMX0.pBslZg2JQqoqRKNhaOE-uWHpWxSf0jULvV0awyC0NUI'

export const SUPABASE_URL = String(process.env.REACT_APP_SUPABASE_URL || DEFAULT_URL).trim()
const SUPABASE_ENV_ANON_KEY = String(process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim()
const isLegacyAnonJwt = (value) => String(value || '').startsWith('eyJ')
const SUPABASE_ANON_KEY = isLegacyAnonJwt(SUPABASE_ENV_ANON_KEY)
  ? SUPABASE_ENV_ANON_KEY
  : DEFAULT_ANON_KEY

export const SUPABASE_PUBLISHABLE_KEY_WARNING =
  'Login needs the legacy anon key (starts with eyJ), not sb_publishable_. In Supabase: Settings → API Keys → Legacy anon, public — then set REACT_APP_SUPABASE_ANON_KEY on Vercel and redeploy.'

export const SUPABASE_REACHABILITY_ERROR =
  'Cannot reach the LegalLink database (Supabase). The project may be paused or deleted. In Supabase Dashboard restore or create a project, then set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables and redeploy.'

/** Returns a user-facing message when Supabase env is missing or uses a publishable/secret key. */
export function getSupabaseConfigError() {
  if (!SUPABASE_ANON_KEY) {
    return 'Missing REACT_APP_SUPABASE_ANON_KEY. Add your Supabase legacy anon key (eyJ…) in Vercel → Settings → Environment Variables, then redeploy.'
  }
  if (!SUPABASE_ANON_KEY.startsWith('eyJ')) {
    return 'REACT_APP_SUPABASE_ANON_KEY must be the legacy anon JWT (starts with eyJ…).'
  }
  return ''
}

/** True when fetch/auth failed because the Supabase host is unreachable. */
export function isSupabaseNetworkError(error) {
  const msg = String(error?.message || error || '').trim().toLowerCase()
  return (
    !msg ||
    msg === 'load failed' ||
    msg === 'failed to fetch' ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('err_name_not_resolved') ||
    msg.includes('enotfound')
  )
}

/** Ping Supabase auth health — returns false when the project URL does not resolve or is offline. */
export async function checkSupabaseReachable() {
  const configError = getSupabaseConfigError()
  if (configError) return { ok: false, error: configError }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: SUPABASE_ANON_KEY },
    })
    if (!response.ok) {
      return { ok: false, error: SUPABASE_REACHABILITY_ERROR }
    }
    return { ok: true, error: '' }
  } catch {
    return { ok: false, error: SUPABASE_REACHABILITY_ERROR }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Safari/WebKit often rejects parallel fetches with "TypeError: Load failed" even when the
 * server is healthy. Retry transient network failures (and 5xx) a few times before giving up so
 * dashboard pages stop showing "Load failed".
 */
const fetchWithRetry = async (input, init = {}, attempt = 0) => {
  const MAX_ATTEMPTS = 3
  try {
    const response = await fetch(input, init)
    if (response.status >= 500 && response.status < 600 && attempt < MAX_ATTEMPTS - 1) {
      await sleep(350 * (attempt + 1))
      return fetchWithRetry(input, init, attempt + 1)
    }
    return response
  } catch (error) {
    const isAbort = init?.signal?.aborted || String(error?.name || '') === 'AbortError'
    if (!isAbort && isSupabaseNetworkError(error) && attempt < MAX_ATTEMPTS - 1) {
      await sleep(350 * (attempt + 1))
      return fetchWithRetry(input, init, attempt + 1)
    }
    throw error
  }
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
    },
    global: {
      fetch: (...args) => fetchWithRetry(...args),
    },
  },
)

/** True for browser auth-lock contention errors ("lock was stolen", "Lock broken ... 'steal' option"). */
export function isAuthLockError(error) {
  const text = String(error?.message || error || '').toLowerCase()
  return (
    String(error?.name || '') === 'AbortError' ||
    text.includes('aborterror') ||
    text.includes('lock broken') ||
    text.includes("'steal' option") ||
    text.includes('stolen') ||
    text.includes('navigatorlock')
  )
}

let inflightSessionRequest = null

const readSessionWithLockRetry = async () => {
  const MAX_ATTEMPTS = 3
  let lastResult = { data: { session: null }, error: null }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      lastResult = await supabase.auth.getSession()
      if (!lastResult?.error || !isAuthLockError(lastResult.error)) return lastResult
    } catch (error) {
      if (!isAuthLockError(error)) throw error
      lastResult = { data: { session: null }, error }
    }
    await sleep(120 * (attempt + 1))
  }
  return lastResult
}

/**
 * Same result shape as supabase.auth.getSession(), but concurrent callers share one
 * request and auth-lock contention is retried instead of surfacing as a logout.
 */
export function getSharedSession() {
  if (!inflightSessionRequest) {
    inflightSessionRequest = readSessionWithLockRetry().finally(() => {
      inflightSessionRequest = null
    })
  }
  return inflightSessionRequest
}

/**
 * Same result shape as supabase.auth.getUser(), read from the local session.
 * auth.getUser() holds the auth lock for a network round-trip, which makes parallel
 * dashboard requests time out and steal the lock from each other.
 */
export async function getAuthUser() {
  const { data, error } = await getSharedSession()
  return { data: { user: data?.session?.user ?? null }, error: error ?? null }
}
