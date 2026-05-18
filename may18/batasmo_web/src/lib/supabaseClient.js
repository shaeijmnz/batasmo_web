import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sjmmyqeqiigmclcgcadr.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_iWOdzcbgaRwBnpkLo_HVUA_fPgC1UuZ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
  },
})
