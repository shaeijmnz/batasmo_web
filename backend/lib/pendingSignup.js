/**
 * Client self-signup: store pending record + OTP first; create Supabase auth user only after verify.
 */

import crypto from 'crypto'
import { sendSignupOtpEmail, isSignupOtpEmailConfigured } from './signupOtpEmail.js'

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_SENDS_PER_HOUR = 8
const MIN_MS_BETWEEN_SENDS = 55_000
const SUPABASE_FETCH_MS = 30_000

const fetchWithTimeout = async (url, options = {}, ms = SUPABASE_FETCH_MS) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Database request timed out. Please try again in a moment.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
const IPROG_OTP_SEND = 'https://sms.iprogtech.com/api/v1/otp/send_otp'
const IPROG_OTP_VERIFY = 'https://sms.iprogtech.com/api/v1/otp/verify_otp'
const SMS_EXPIRES_MINUTES = 15

const hashSecret = (value, salt = '') =>
  crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex')

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export const verifyPasswordHash = (password, stored) => {
  const raw = String(stored || '')
  const [salt, expected] = raw.split(':')
  if (!salt || !expected) return false
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(derived, 'hex'))
  } catch {
    return false
  }
}

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000))

const normalizePhMobile = (input) => {
  const d = String(input || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('09')) return d
  if (d.length === 12 && d.startsWith('639')) return `0${d.slice(3)}`
  if (d.length === 10 && d.startsWith('9')) return `0${d}`
  return null
}

const restHeaders = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

const authHeaders = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
})

async function restSelect({ supabaseUrl, serviceKey, table, query }) {
  const res = await fetchWithTimeout(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: restHeaders(serviceKey),
  })
  const rows = await res.json().catch(() => [])
  if (!res.ok) {
    throw new Error(rows?.message || rows?.error || `Query failed (${res.status})`)
  }
  return Array.isArray(rows) ? rows : []
}

async function emailExistsInProfiles({ supabaseUrl, serviceKey, email }) {
  const rows = await restSelect({
    supabaseUrl,
    serviceKey,
    table: 'profiles',
    query: `email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
  })
  return rows.length > 0
}

async function getPendingByEmail({ supabaseUrl, serviceKey, email }) {
  const rows = await restSelect({
    supabaseUrl,
    serviceKey,
    table: 'pending_client_signups',
    query: `email_norm=eq.${encodeURIComponent(email)}&select=*&limit=1`,
  })
  return rows[0] || null
}

async function getPendingById({ supabaseUrl, serviceKey, pendingId }) {
  const rows = await restSelect({
    supabaseUrl,
    serviceKey,
    table: 'pending_client_signups',
    query: `id=eq.${encodeURIComponent(pendingId)}&select=*&limit=1`,
  })
  return rows[0] || null
}

async function deletePending({ supabaseUrl, serviceKey, pendingId }) {
  await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/pending_client_signups?id=eq.${encodeURIComponent(pendingId)}`,
    {
      method: 'DELETE',
      headers: restHeaders(serviceKey),
    },
  )
}

async function checkSendRateLimit({ supabaseUrl, serviceKey, pendingId }) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const url =
    `${supabaseUrl}/rest/v1/pending_client_signup_send_log?pending_id=eq.${encodeURIComponent(pendingId)}` +
    `&created_at=gte.${encodeURIComponent(oneHourAgo)}&select=id`
  const res = await fetchWithTimeout(url, {
    method: 'HEAD',
    headers: { ...restHeaders(serviceKey), Prefer: 'count=exact' },
  })
  const range = res.headers.get('content-range') || ''
  const match = range.match(/\/(\d+)$/)
  if (match && Number(match[1]) >= MAX_SENDS_PER_HOUR) {
    throw new Error('Send limit reached. Try again later.')
  }

  const pending = await getPendingById({ supabaseUrl, serviceKey, pendingId })
  if (pending?.otp_sent_at) {
    const delta = Date.now() - new Date(pending.otp_sent_at).getTime()
    if (delta < MIN_MS_BETWEEN_SENDS) {
      throw new Error(`Please wait ${Math.ceil((MIN_MS_BETWEEN_SENDS - delta) / 1000)}s before resending.`)
    }
  }
}

async function logSend({ supabaseUrl, serviceKey, pendingId }) {
  try {
    await fetchWithTimeout(`${supabaseUrl}/rest/v1/pending_client_signup_send_log`, {
      method: 'POST',
      headers: { ...restHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({ pending_id: pendingId }),
    })
  } catch (error) {
    console.warn('[signup] send log write failed:', error?.message || error)
  }
}

async function iprogSendOtp(apiToken, phone) {
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
  if (String(st).toLowerCase() === 'success' || st === 200) return { ok: true }
  return { ok: false, message: json?.message || res.statusText || 'SMS send failed' }
}

async function iprogVerifyOtp(apiToken, phone, otp) {
  const res = await fetch(IPROG_OTP_VERIFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_token: apiToken, phone_number: phone, otp }),
  })
  const json = await res.json().catch(() => ({}))
  const ok =
    json?.status === 'success' ||
    json?.status === 200 ||
    String(json?.message || '').toLowerCase().includes('verified')
  return { ok, message: json?.message }
}

async function upsertPending({ supabaseUrl, serviceKey, row }) {
  const existing = await getPendingByEmail({ supabaseUrl, serviceKey, email: row.email_norm })
  const nowIso = new Date().toISOString()

  if (existing?.id) {
    const res = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/pending_client_signups?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method: 'PATCH',
        headers: restHeaders(serviceKey),
        body: JSON.stringify({ ...row, updated_at: nowIso }),
      },
    )
    const payload = await res.json().catch(() => null)
    if (!res.ok) throw new Error(payload?.message || 'Could not save signup.')
    return Array.isArray(payload) ? payload[0] : { ...existing, ...row }
  }

  const res = await fetchWithTimeout(`${supabaseUrl}/rest/v1/pending_client_signups`, {
    method: 'POST',
    headers: restHeaders(serviceKey),
    body: JSON.stringify({ ...row, created_at: nowIso, updated_at: nowIso }),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new Error(payload?.message || 'Could not save signup.')
  return Array.isArray(payload) ? payload[0] : payload
}

async function markPendingOtpSent({ supabaseUrl, serviceKey, pendingId }) {
  await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/pending_client_signups?id=eq.${encodeURIComponent(pendingId)}`,
    {
      method: 'PATCH',
      headers: restHeaders(serviceKey),
      body: JSON.stringify({
        otp_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    },
  ).catch((err) => console.warn('[signup] could not update otp_sent_at', err?.message))
}

async function sendEmailOtpForPending({ pending, otp }) {
  if (!isSignupOtpEmailConfigured()) {
    return {
      sent: false,
      error: 'Email is not configured on the server.',
    }
  }
  return sendSignupOtpEmail({
    email: pending.email_norm,
    otp,
    fullName: pending.full_name,
  })
}

/** Fire-and-forget after signup-start so Create Account returns quickly. */
function queueSignupOtpEmail({ supabaseUrl, serviceKey, pending, otp }) {
  setImmediate(() => {
    void (async () => {
      const result = await sendEmailOtpForPending({ pending, otp })
      if (result.sent) {
        await markPendingOtpSent({ supabaseUrl, serviceKey, pendingId: pending.id })
      } else {
        console.warn('[signup] background OTP email failed:', result.error)
      }
    })()
  })
}

export async function getPendingSignupOtpStatus({ supabaseUrl, serviceKey, pendingId, email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const pending =
    (pendingId && (await getPendingById({ supabaseUrl, serviceKey, pendingId }))) ||
    (normalizedEmail && (await getPendingByEmail({ supabaseUrl, serviceKey, email: normalizedEmail })))

  if (!pending) {
    return { found: false, sent: false }
  }
  return {
    found: true,
    sent: Boolean(pending.otp_sent_at),
    pendingId: pending.id,
    email: pending.email_norm,
  }
}

async function createSupabaseClientAccount({ supabaseUrl, serviceKey, pending, password }) {
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders(serviceKey),
    body: JSON.stringify({
      email: pending.email_norm,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: pending.full_name,
        role: pending.role || 'Client',
        signup_otp_completed: true,
      },
    }),
  })
  const authPayload = await authResponse.json().catch(() => null)
  if (!authResponse.ok) {
    const msg =
      authPayload?.msg ||
      authPayload?.message ||
      authPayload?.error_description ||
      authPayload?.error ||
      `Failed to create account (${authResponse.status}).`
    throw new Error(String(msg))
  }

  const userId = authPayload?.id || authPayload?.user?.id
  if (!userId) throw new Error('Account created but no user id returned.')

  const nowIso = new Date().toISOString()
  const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: { ...restHeaders(serviceKey), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: userId,
      email: pending.email_norm,
      full_name: pending.full_name,
      role: pending.role || 'Client',
      sex: pending.sex || null,
      phone: pending.phone || null,
      age: pending.age ?? null,
      address: pending.address || null,
      guardian_name: pending.guardian_name || null,
      guardian_contact: pending.guardian_contact || null,
      preferred_otp_channel: pending.preferred_otp_channel || 'email',
      created_at: nowIso,
      updated_at: nowIso,
    }),
  })
  if (!profileRes.ok) {
    const profilePayload = await profileRes.json().catch(() => null)
    throw new Error(
      profilePayload?.message || profilePayload?.error || 'Failed to save profile after signup.',
    )
  }

  return { userId }
}

export async function startPendingClientSignup({
  supabaseUrl,
  serviceKey,
  iprogApiKey,
  payload,
}) {
  const email = String(payload.email || '').trim().toLowerCase()
  const password = String(payload.password || '')
  const channel = payload.preferredOtpChannel === 'sms' ? 'sms' : 'email'

  if (!email || !password) throw new Error('Email and password are required.')

  if (await emailExistsInProfiles({ supabaseUrl, serviceKey, email })) {
    throw new Error('This email is already registered. Try logging in instead.')
  }

  const otp = generateOtp()
  const otpExpires = new Date(Date.now() + OTP_TTL_MS).toISOString()
  const phone = normalizePhMobile(payload.phone)

  const pending = await upsertPending({
    supabaseUrl,
    serviceKey,
    row: {
      email_norm: email,
      password_hash: hashPassword(password),
      full_name: String(payload.fullName || '').trim(),
      role: 'Client',
      sex: payload.sex || null,
      phone,
      age: payload.age ?? null,
      address: String(payload.address || '').trim() || null,
      guardian_name: payload.guardianName || null,
      guardian_contact: payload.guardianContact || null,
      preferred_otp_channel: channel,
      otp_hash: channel === 'email' ? hashSecret(otp, email) : null,
      otp_expires_at: channel === 'email' ? otpExpires : null,
      otp_sent_at: null,
    },
  })

  await checkSendRateLimit({ supabaseUrl, serviceKey, pendingId: pending.id })

  let otpSent = false

  if (channel === 'email') {
    if (!isSignupOtpEmailConfigured()) {
      throw new Error(
        'Email verification is not configured on the server (Gmail SMTP on Render).',
      )
    }
    queueSignupOtpEmail({ supabaseUrl, serviceKey, pending, otp })
  } else {
    if (!iprogApiKey) throw new Error('SMS verification is not configured (IPROG_API_KEY).')
    if (!phone) throw new Error('A valid Philippine mobile number is required for SMS OTP.')
    const sent = await iprogSendOtp(iprogApiKey, phone)
    if (!sent.ok) throw new Error(sent.message || 'Could not send SMS code.')
    otpSent = true
    await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/pending_client_signups?id=eq.${encodeURIComponent(pending.id)}`,
      {
        method: 'PATCH',
        headers: restHeaders(serviceKey),
        body: JSON.stringify({ otp_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      },
    )
  }

  return {
    pendingId: pending.id,
    email,
    preferredOtpChannel: channel,
    otpSent: channel === 'email' ? false : otpSent,
    emailQueued: channel === 'email',
  }
}

export async function resendPendingSignupOtp({
  supabaseUrl,
  serviceKey,
  iprogApiKey,
  email,
  pendingId,
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const pending =
    (pendingId && (await getPendingById({ supabaseUrl, serviceKey, pendingId }))) ||
    (normalizedEmail && (await getPendingByEmail({ supabaseUrl, serviceKey, email: normalizedEmail })))

  if (!pending) throw new Error('Signup session not found. Please sign up again.')

  await checkSendRateLimit({ supabaseUrl, serviceKey, pendingId: pending.id })

  const channel = pending.preferred_otp_channel === 'sms' ? 'sms' : 'email'

  if (channel === 'email') {
    const otp = generateOtp()
    const otpExpires = new Date(Date.now() + OTP_TTL_MS).toISOString()
    const emailResult = await sendEmailOtpForPending({ pending, otp })
    if (!emailResult?.sent) {
      throw new Error(emailResult?.error || 'Failed to send verification email.')
    }
    await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/pending_client_signups?id=eq.${encodeURIComponent(pending.id)}`,
      {
        method: 'PATCH',
        headers: restHeaders(serviceKey),
        body: JSON.stringify({
          otp_hash: hashSecret(otp, pending.email_norm),
          otp_expires_at: otpExpires,
          otp_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      },
    )
    await logSend({ supabaseUrl, serviceKey, pendingId: pending.id })
    return { pendingId: pending.id, email: pending.email_norm, otpSent: true }
  } else {
    if (!iprogApiKey) throw new Error('SMS verification is not configured.')
    const phone = normalizePhMobile(pending.phone)
    if (!phone) throw new Error('No mobile number on this signup.')
    const sent = await iprogSendOtp(iprogApiKey, phone)
    if (!sent.ok) throw new Error(sent.message || 'Could not resend SMS.')
    await fetch(
      `${supabaseUrl}/rest/v1/pending_client_signups?id=eq.${encodeURIComponent(pending.id)}`,
      {
        method: 'PATCH',
        headers: restHeaders(serviceKey),
        body: JSON.stringify({ otp_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      },
    )
  }

  await logSend({ supabaseUrl, serviceKey, pendingId: pending.id })
  return { pendingId: pending.id, email: pending.email_norm }
}

export async function completePendingClientSignup({
  supabaseUrl,
  serviceKey,
  iprogApiKey,
  email,
  pendingId,
  otp,
  password,
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const token = String(otp || '').replace(/\D/g, '')
  if (token.length !== 6) throw new Error('Invalid verification code.')

  const pending =
    (pendingId && (await getPendingById({ supabaseUrl, serviceKey, pendingId }))) ||
    (normalizedEmail && (await getPendingByEmail({ supabaseUrl, serviceKey, email: normalizedEmail })))

  if (!pending) throw new Error('Signup session not found. Please sign up again.')
  if (String(pending.email_norm).toLowerCase() !== normalizedEmail) {
    throw new Error('Email does not match signup.')
  }

  const plainPassword = String(password || '')
  if (!plainPassword || !verifyPasswordHash(plainPassword, pending.password_hash)) {
    throw new Error('Password mismatch. Please sign up again from the start.')
  }

  const channel = pending.preferred_otp_channel === 'sms' ? 'sms' : 'email'

  if (channel === 'email') {
    if (!pending.otp_hash || !pending.otp_expires_at) {
      throw new Error('No email verification pending.')
    }
    if (new Date(pending.otp_expires_at).getTime() < Date.now()) {
      throw new Error('Verification code expired. Tap Resend Code.')
    }
    if (hashSecret(token, pending.email_norm) !== pending.otp_hash) {
      throw new Error('Invalid or expired verification code.')
    }
  } else {
    if (!iprogApiKey) throw new Error('SMS verification is not configured.')
    const phone = normalizePhMobile(pending.phone)
    if (!phone) throw new Error('No mobile number on this signup.')
    const verified = await iprogVerifyOtp(iprogApiKey, phone, token)
    if (!verified.ok) throw new Error(verified.message || 'Invalid or expired SMS code.')
  }

  if (await emailExistsInProfiles({ supabaseUrl, serviceKey, email: normalizedEmail })) {
    await deletePending({ supabaseUrl, serviceKey, pendingId: pending.id })
    throw new Error('This email is already registered. Try logging in.')
  }

  const { userId } = await createSupabaseClientAccount({
    supabaseUrl,
    serviceKey,
    pending,
    password: plainPassword,
  })

  await deletePending({ supabaseUrl, serviceKey, pendingId: pending.id })

  return { ok: true, userId, email: normalizedEmail }
}
