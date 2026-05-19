/**
 * Sends signup SMS OTP via IPROG (send_otp). Deploy: supabase functions deploy signup-sms-otp-send
 * Do not reuse generic names like send-sms-hook — those often host webhook receivers and expect signature headers.
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IPROG_API_TOKEN
 * Body: { email, userId?, otpPhone? }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IPROG_OTP_SEND = 'https://sms.iprogtech.com/api/v1/otp/send_otp'
const SMS_EXPIRES_MINUTES = 15
const MAX_SENDS_PER_HOUR = 8
const MIN_MS_BETWEEN_SENDS = 55_000

function normalizePhMobile(input: string): string | null {
  const d = String(input || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('09')) return d
  if (d.length === 12 && d.startsWith('639')) return `0${d.slice(3)}`
  if (d.length === 10 && d.startsWith('9')) return `0${d}`
  return null
}

async function iprogSendOtp(apiToken: string, phone: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(IPROG_OTP_SEND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_token: apiToken,
      phone_number: phone,
      expires_in_minutes: SMS_EXPIRES_MINUTES,
    }),
  })
  const json = await res.json().catch(() => ({}))
  const st = json?.status
  if (String(st).toLowerCase() === 'success' || st === 200) {
    return { ok: true }
  }
  return { ok: false, message: json?.message || res.statusText || 'SMS send failed' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const iprogToken = Deno.env.get('IPROG_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!iprogToken || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    let userId = String(body?.userId || '').trim()
    const emailRaw = String(body?.email || '').trim().toLowerCase()
    const otpPhoneRaw = body?.otpPhone != null ? String(body.otpPhone) : ''

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (!userId && emailRaw) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count } = await supabaseAdmin
        .from('signup_sms_lookup_log')
        .select('id', { count: 'exact', head: true })
        .eq('email_norm', emailRaw)
        .gte('created_at', oneHourAgo)
      if ((count ?? 0) > 30) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      await supabaseAdmin.from('signup_sms_lookup_log').insert({ email_norm: emailRaw })

      const { data: resolvedId, error: rpcErr } = await supabaseAdmin.rpc('get_unconfirmed_user_id_by_email', {
        p_email: emailRaw,
      })
      if (rpcErr || !resolvedId) {
        return new Response(JSON.stringify({ error: 'Unable to send SMS for this account.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      userId = String(resolvedId)
    }

    if (!userId || !emailRaw) {
      return new Response(JSON.stringify({ error: 'Missing userId or email.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const u = userData.user
    if (String(u.email || '').toLowerCase() !== emailRaw) {
      return new Response(JSON.stringify({ error: 'Email does not match account.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (u.email_confirmed_at) {
      return new Response(JSON.stringify({ error: 'Account already verified.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const meta = u.user_metadata || {}
    const normalizeRole = (r: string) => {
      const v = String(r || '').toLowerCase()
      if (v === 'admin') return 'Admin'
      if (v === 'attorney') return 'Attorney'
      return 'Client'
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: sendCount } = await supabaseAdmin
      .from('signup_sms_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo)

    if ((sendCount ?? 0) >= MAX_SENDS_PER_HOUR) {
      return new Response(JSON.stringify({ error: 'SMS send limit reached. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: lastSendRow } = await supabaseAdmin
      .from('signup_sms_send_log')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const last = lastSendRow?.created_at
    if (last) {
      const delta = Date.now() - new Date(last).getTime()
      if (delta < MIN_MS_BETWEEN_SENDS) {
        const waitSec = Math.ceil((MIN_MS_BETWEEN_SENDS - delta) / 1000)
        return new Response(JSON.stringify({ error: `Please wait ${waitSec}s before resending.` }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('phone, otp_sms_number')
      .eq('id', userId)
      .maybeSingle()

    if (profErr) {
      console.error('profile fetch', profErr)
    }

    if (otpPhoneRaw) {
      const normalized = normalizePhMobile(otpPhoneRaw)
      if (!normalized) {
        return new Response(JSON.stringify({ error: 'Invalid mobile number format.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const nowIso = new Date().toISOString()
      if (profile) {
        await supabaseAdmin
          .from('profiles')
          .update({
            otp_sms_number: normalized,
            preferred_otp_channel: 'sms',
            updated_at: nowIso,
          })
          .eq('id', userId)
      } else {
        await supabaseAdmin.from('profiles').upsert(
          {
            id: userId,
            email: emailRaw,
            full_name: String(meta.full_name || emailRaw.split('@')[0] || 'User'),
            role: normalizeRole(String(meta.role || 'Client')),
            phone: normalized,
            otp_sms_number: normalized,
            preferred_otp_channel: 'sms',
            created_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'id' },
        )
      }
    }

    const { data: profileAfter } = await supabaseAdmin
      .from('profiles')
      .select('phone, otp_sms_number')
      .eq('id', userId)
      .maybeSingle()

    const phone =
      normalizePhMobile(profileAfter?.otp_sms_number || '') ||
      normalizePhMobile(profileAfter?.phone || '') ||
      normalizePhMobile(profile?.otp_sms_number || '') ||
      normalizePhMobile(profile?.phone || '')

    if (!phone) {
      return new Response(JSON.stringify({ code: 'PHONE_REQUIRED', error: 'Add a mobile number to receive SMS.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sent = await iprogSendOtp(iprogToken, phone)
    if (!sent.ok) {
      return new Response(JSON.stringify({ error: sent.message || 'SMS provider error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin.from('signup_sms_send_log').insert({ user_id: userId })

    return new Response(
      JSON.stringify({ ok: true, userId, expiresInMinutes: SMS_EXPIRES_MINUTES }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
