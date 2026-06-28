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
  'Cannot reach the BatasMo database (Supabase). The project may be paused or deleted. In Supabase Dashboard restore or create a project, then set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables and redeploy.'

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

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
    },
  },
)
