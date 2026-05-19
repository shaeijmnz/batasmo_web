import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://sjmmyqeqiigmclcgcadr.supabase.co'

const SUPABASE_URL = String(process.env.REACT_APP_SUPABASE_URL || DEFAULT_URL).trim()
const SUPABASE_ANON_KEY = String(process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim()

export const SUPABASE_PUBLISHABLE_KEY_WARNING =
  'Login needs the legacy anon key (starts with eyJ), not sb_publishable_. In Supabase: Settings → API Keys → Legacy anon, public — then set REACT_APP_SUPABASE_ANON_KEY on Vercel and redeploy.'

/** Returns a user-facing message when Supabase env is missing or uses a publishable/secret key. */
export function getSupabaseConfigError() {
  if (!SUPABASE_ANON_KEY) {
    return 'Missing REACT_APP_SUPABASE_ANON_KEY. Add your Supabase legacy anon key (eyJ…) in Vercel → Settings → Environment Variables, then redeploy.'
  }
  if (SUPABASE_ANON_KEY.startsWith('sb_publishable_') || SUPABASE_ANON_KEY.startsWith('sb_secret_')) {
    return SUPABASE_PUBLISHABLE_KEY_WARNING
  }
  if (!SUPABASE_ANON_KEY.startsWith('eyJ')) {
    return 'REACT_APP_SUPABASE_ANON_KEY must be the legacy anon JWT (starts with eyJ…).'
  }
  return ''
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY || 'missing-supabase-anon-key',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
    },
  },
)
