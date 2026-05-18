/**
 * Generate Supabase signup OTP and deliver via Render SMTP/Resend.
 */

import { sendSignupOtpEmail, isSignupOtpEmailConfigured } from './signupOtpEmail.js'

const MAX_SENDS_PER_HOUR = 8
const MIN_MS_BETWEEN_SENDS = 55_000

const authAdminHeaders = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
})

const extractOtp = (payload) => {
  const raw =
    payload?.email_otp || payload?.properties?.email_otp || payload?.user?.email_otp || ''
  const digits = String(raw).replace(/\D/g, '')
  return digits.length >= 6 ? digits.slice(0, 6) : ''
}

export async function adminGenerateSignupOtp({ supabaseUrl, serviceKey, email, password }) {
  const headers = authAdminHeaders(serviceKey)
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const attempts = []
  if (password) attempts.push({ type: 'signup', email: normalizedEmail, password: String(password) })
  attempts.push({ type: 'signup', email: normalizedEmail })
  attempts.push({ type: 'magiclink', email: normalizedEmail })

  let lastError = 'Could not generate verification code.'

  for (const body of attempts) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      lastError = payload?.msg || payload?.message || payload?.error_description || payload?.error || lastError
      continue
    }
    const otp = extractOtp(payload)
    if (otp) return { otp }
  }

  throw new Error(lastError)
}

const resolveUnconfirmedUserId = async ({ supabaseUrl, serviceKey, email, userId }) => {
  const id = String(userId || '').trim()
  if (id) return id

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_unconfirmed_user_id_by_email`, {
    method: 'POST',
    headers: { ...authAdminHeaders(serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify({ p_email: email }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error('Unable to find this signup account.')
  return String(payload || '').trim()
}

const fetchAuthUser = async ({ supabaseUrl, serviceKey, userId }) => {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'GET',
    headers: authAdminHeaders(serviceKey),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error('Invalid user.')
  return payload?.user || payload
}

const checkSendRateLimit = async ({ supabaseUrl, serviceKey, userId }) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const countUrl =
    `${supabaseUrl}/rest/v1/signup_sms_send_log?user_id=eq.${encodeURIComponent(userId)}` +
    `&created_at=gte.${encodeURIComponent(oneHourAgo)}&select=id`

  const countRes = await fetch(countUrl, {
    method: 'HEAD',
    headers: { ...authAdminHeaders(serviceKey), Prefer: 'count=exact' },
  })
  const countHeader = countRes.headers.get('content-range') || ''
  const match = countHeader.match(/\/(\d+)$/)
  if (match && Number(match[1]) >= MAX_SENDS_PER_HOUR) {
    throw new Error('Email send limit reached. Try again later.')
  }

  const lastUrl =
    `${supabaseUrl}/rest/v1/signup_sms_send_log?user_id=eq.${encodeURIComponent(userId)}` +
    '&order=created_at.desc&limit=1&select=created_at'
  const lastRes = await fetch(lastUrl, { method: 'GET', headers: authAdminHeaders(serviceKey) })
  const rows = await lastRes.json().catch(() => [])
  const last = Array.isArray(rows) ? rows[0]?.created_at : null
  if (last) {
    const delta = Date.now() - new Date(last).getTime()
    if (delta < MIN_MS_BETWEEN_SENDS) {
      throw new Error(`Please wait ${Math.ceil((MIN_MS_BETWEEN_SENDS - delta) / 1000)}s before resending.`)
    }
  }
}

const logEmailSend = async ({ supabaseUrl, serviceKey, userId }) => {
  await fetch(`${supabaseUrl}/rest/v1/signup_sms_send_log`, {
    method: 'POST',
    headers: { ...authAdminHeaders(serviceKey), Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: userId }),
  })
}

export async function dispatchSignupEmailOtp({ supabaseUrl, serviceKey, email, userId, password }) {
  if (!isSignupOtpEmailConfigured()) {
    throw new Error('Verification email is not set up on the server. Configure Gmail SMTP on Render.')
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Email is required.')

  const resolvedUserId = await resolveUnconfirmedUserId({
    supabaseUrl,
    serviceKey,
    email: normalizedEmail,
    userId,
  })
  if (!resolvedUserId) throw new Error('Unable to send verification email for this account.')

  const user = await fetchAuthUser({ supabaseUrl, serviceKey, userId: resolvedUserId })
  if (String(user?.email || '').toLowerCase() !== normalizedEmail) {
    throw new Error('Email does not match account.')
  }
  if (user?.email_confirmed_at) throw new Error('Account already verified.')

  await checkSendRateLimit({ supabaseUrl, serviceKey, userId: resolvedUserId })

  const { otp } = await adminGenerateSignupOtp({
    supabaseUrl,
    serviceKey,
    email: normalizedEmail,
    password,
  })

  const emailResult = await sendSignupOtpEmail({
    email: normalizedEmail,
    otp,
    fullName: String(user?.user_metadata?.full_name || '').trim(),
  })
  if (!emailResult.sent) {
    throw new Error(emailResult.error || 'Failed to send verification email.')
  }

  await logEmailSend({ supabaseUrl, serviceKey, userId: resolvedUserId })
  return { ok: true, userId: resolvedUserId, emailSent: true }
}
