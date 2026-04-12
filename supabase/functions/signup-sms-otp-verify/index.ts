/**
 * Verifies IPROG SMS OTP and confirms email in Supabase Auth. Deploy: supabase functions deploy signup-sms-otp-verify
 * Body: { email, otp, userId? }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IPROG_OTP_VERIFY = 'https://sms.iprogtech.com/api/v1/otp/verify_otp'
const MAX_FAILS = 5
const FAIL_WINDOW_MS = 15 * 60 * 1000

function normalizePhMobile(input: string): string | null {
  const d = String(input || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('09')) return d
  if (d.length === 12 && d.startsWith('639')) return `0${d.slice(3)}`
  if (d.length === 10 && d.startsWith('9')) return `0${d}`
  return null
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
    const otp = String(body?.otp || '').replace(/\D/g, '')

    if (!emailRaw || otp.length !== 6) {
      return new Response(JSON.stringify({ error: 'Invalid verification request.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (!userId) {
      const { data: resolvedId, error: rpcErr } = await supabaseAdmin.rpc('get_unconfirmed_user_id_by_email', {
        p_email: emailRaw,
      })
      if (rpcErr || !resolvedId) {
        return new Response(JSON.stringify({ error: 'Unable to verify this account.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      userId = String(resolvedId)
    }

    const since = new Date(Date.now() - FAIL_WINDOW_MS).toISOString()
    const { count: failCount } = await supabaseAdmin
      .from('signup_sms_verify_fail_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)

    if ((failCount ?? 0) >= MAX_FAILS) {
      return new Response(JSON.stringify({ error: 'Too many failed attempts. Try again later or use email OTP.' }), {
        status: 429,
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
      return new Response(JSON.stringify({ ok: true, alreadyConfirmed: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('phone, otp_sms_number')
      .eq('id', userId)
      .maybeSingle()

    const phone =
      normalizePhMobile(profile?.otp_sms_number || '') || normalizePhMobile(profile?.phone || '')

    if (!phone) {
      return new Response(JSON.stringify({ code: 'PHONE_REQUIRED', error: 'No mobile number on file.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(IPROG_OTP_VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_token: iprogToken,
        phone_number: phone,
        otp,
      }),
    })
    const json = await res.json().catch(() => ({}))
    const ok =
      json?.status === 'success' ||
      json?.status === 200 ||
      String(json?.message || '')
        .toLowerCase()
        .includes('verified')

    if (!ok) {
      await supabaseAdmin.from('signup_sms_verify_fail_log').insert({ user_id: userId })
      return new Response(JSON.stringify({ error: json?.message || 'Invalid or expired OTP.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })
    if (updErr) {
      console.error('confirm email', updErr)
      return new Response(JSON.stringify({ error: 'Could not complete verification.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin
      .from('profiles')
      .update({
        preferred_otp_channel: 'sms',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
