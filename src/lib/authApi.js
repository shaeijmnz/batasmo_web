import { supabase } from './supabaseClient'
import {
  isSignupVerificationComplete,
  markSignupOtpCompleted,
  signOutIfSignupIncomplete,
} from './signupVerification'
import {
  isGmailEmail,
  isPhilippineMobile,
  isStrongPassword,
  isValidEmail,
  GMAIL_REQUIRED_MESSAGE,
  PH_MOBILE_REQUIRED_MESSAGE,
  VALID_PASSWORD_MESSAGE,
  normalizeAuthEmail,
} from './validators'

export const PENDING_OTP_CHANNEL_KEY = 'batasmo_pending_otp_channel'
export const PENDING_SIGNUP_USER_ID_KEY = 'batasmo_pending_signup_user_id'
export const PENDING_SIGNUP_ID_KEY = 'batasmo_pending_signup_id'
export const PENDING_SMS_PHONE_KEY = 'batasmo_pending_sms_phone'
export const OTP_RESUME_LOGIN_KEY = 'batasmo_otp_resume_login'
export const OTP_RESUME_SIGNUP_KEY = 'batasmo_otp_resume_signup'
export const SIGNUP_OTP_SENT_KEY = 'batasmo_signup_otp_sent'

const getBackendApiBase = () =>
  String(
    process.env.REACT_APP_PAYMENT_API_URL ||
      process.env.REACT_APP_CHATBOT_API_URL ||
      '',
  )
    .trim()
    .replace(/\/+$/, '')

const humanizeSignupEmailError = (message) => {
  const raw = String(message || '').trim()
  const m = raw.toLowerCase()
  if (!raw) return 'Failed to send verification email.'
  if (m.includes('timeout') || m.includes('etimedout') || m.includes('econnrefused')) {
    return 'Still sending your code — wait a moment, then tap Resend Code. Also check Spam.'
  }
  return raw
}

export async function fetchSignupOtpDeliveryStatus({ email, pendingId }) {
  const base = getBackendApiBase()
  if (!base) return { found: false, sent: false }

  const params = new URLSearchParams()
  const normalizedEmail = normalizeAuthEmail(email)
  if (pendingId) params.set('pendingId', String(pendingId).trim())
  if (normalizedEmail) params.set('email', normalizedEmail)

  const response = await fetch(`${base}/auth/signup-otp-status?${params.toString()}`)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { found: false, sent: false, error: payload?.error }
  }
  return payload
}

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'admin') return 'Admin'
  if (value === 'secretary') return 'Secretary'
  if (value === 'attorney') return 'Attorney'
  return 'Client'
}

export async function checkEmailLockout(email) {
  try {
    const { data } = await supabase.rpc('check_login_lockout', { user_email: email })
    if (typeof data === 'boolean') {
      return data ? 600 : 0
    }
    return Math.max(0, Math.floor(Number(data) || 0))
  } catch {
    return 0
  }
}

export async function signUpWithEmail({
  email,
  password,
  fullName,
  role,
  sex,
  phone,
  age,
  address,
  guardianName,
  guardianContact,
  preferredOtpChannel = 'email',
}) {
  const normalizedEmail = normalizeAuthEmail(email)
  const normalizedRole = normalizeRole(role)
  const otpChannel = preferredOtpChannel === 'sms' ? 'sms' : 'email'

  if (!String(fullName || '').trim()) {
    throw new Error('Full name is required.')
  }
  if (!isGmailEmail(normalizedEmail)) {
    throw new Error(GMAIL_REQUIRED_MESSAGE)
  }
  if (!isPhilippineMobile(phone)) {
    throw new Error(PH_MOBILE_REQUIRED_MESSAGE)
  }
  if (!isStrongPassword(password)) {
    throw new Error(VALID_PASSWORD_MESSAGE)
  }
  const parsedAge = Number(age)
  if (!Number.isFinite(parsedAge) || parsedAge < 1) {
    throw new Error('Please enter a valid age.')
  }
  if (!String(address || '').trim()) {
    throw new Error('Address is required.')
  }
  if (parsedAge < 18) {
    if (!String(guardianName || '').trim()) {
      throw new Error('Guardian name is required for minors.')
    }
    if (!isPhilippineMobile(guardianContact)) {
      throw new Error('Please enter a valid 11-digit guardian mobile number (09XXXXXXXXX).')
    }
  }

  const normalizedSex = String(sex || '').trim().toLowerCase()
  const safeSex =
    normalizedSex === 'male' || normalizedSex === 'female' || normalizedSex === 'others'
      ? normalizedSex
      : null

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: fullName,
        role: normalizedRole,
        signup_otp_completed: false,
        sex: safeSex,
        phone: phone || null,
        age: parsedAge,
        address: address || null,
        guardian_name: guardianName || null,
        guardian_contact: guardianContact || null,
        preferred_otp_channel: otpChannel,
      },
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  if (data?.user) {
    const nowIso = new Date().toISOString()
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email: normalizedEmail,
      full_name: fullName,
      role: normalizedRole,
      sex: safeSex,
      phone: phone || null,
      age: parsedAge,
      address: address || null,
      guardian_name: guardianName || null,
      guardian_contact: guardianContact || null,
      preferred_otp_channel: otpChannel,
      created_at: nowIso,
      updated_at: nowIso,
    })

    if (profileError) {
      console.error('Failed to create profile:', profileError)
    }

    if (normalizedRole === 'Attorney') {
      const { error: attorneyProfileError } = await supabase
        .from('attorney_profiles')
        .upsert(
          {
            user_id: data.user.id,
            is_verified: false,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' },
        )

      if (attorneyProfileError) {
        console.error('Failed to initialize attorney profile:', attorneyProfileError)
      }
    }

    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut()
    }
  }

  return {
    user: data?.user,
    preferredOtpChannel: otpChannel,
    otpSent: otpChannel === 'email',
  }
}

/**
 * Resend signup verification code (pending signup — no Supabase auth user yet).
 */
export async function sendSignupVerificationEmail({ email, pendingId }) {
  const normalizedEmail = normalizeAuthEmail(email)
  if (!normalizedEmail && !pendingId) throw new Error('Email is required.')

  const base = getBackendApiBase()
  if (!base) {
    throw new Error('Signup service is not configured (REACT_APP_PAYMENT_API_URL).')
  }

  const body = {}
  if (normalizedEmail) body.email = normalizedEmail
  if (pendingId) body.pendingId = String(pendingId).trim()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 70_000)
  let response
  try {
    response = await fetch(`${base}/auth/signup-resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        'Resend request timed out. Check your connection, wait a moment, then tap Resend again.',
      )
    }
    throw new Error('Could not reach the signup server. Check your connection and try again.')
  } finally {
    clearTimeout(timeoutId)
  }

  const rawText = await response.text().catch(() => '')
  let payload = {}
  if (rawText) {
    try {
      payload = JSON.parse(rawText)
    } catch {
      payload = {}
    }
  }
  if (!response.ok) {
    throw new Error(humanizeSignupEmailError(payload?.error || 'Failed to send verification email.'))
  }
  return payload
}

/**
 * Verify OTP and create Supabase account (auth + profile) — only after this does email appear in Supabase.
 */
export async function completePendingSignup({ email, pendingId, otp, password }) {
  const base = getBackendApiBase()
  if (!base) {
    throw new Error('Signup service is not configured (REACT_APP_PAYMENT_API_URL).')
  }

  const response = await fetch(`${base}/auth/signup-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: normalizeAuthEmail(email),
      pendingId: pendingId ? String(pendingId).trim() : undefined,
      otp: String(otp || '').replace(/\D/g, ''),
      password: String(password || ''),
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error || 'Verification failed.')
  }
  return payload
}

/**
 * On non-2xx, supabase-js sets `data` to null and puts the raw Response on `error.context`
 * (see @supabase/functions-js FunctionsClient). Parse JSON so UI shows the function message.
 */
async function readEdgeFunctionErrorPayload(error) {
  const res = error?.context
  if (!res || typeof res.text !== 'function') return null
  try {
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return { error: text }
    }
  } catch {
    return null
  }
}

/** Edge providers may return `error` as a string or nested object — never pass objects into `new Error`. */
function normalizeEdgeFunctionMessage(raw, fallback = 'Request failed') {
  if (raw == null || raw === '') return fallback
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  if (typeof raw === 'object') {
    if (typeof raw.message === 'string') return raw.message
    if (typeof raw.error === 'string') return raw.error
    if (typeof raw.detail === 'string') return raw.detail
    try {
      return JSON.stringify(raw)
    } catch {
      return fallback
    }
  }
  return String(raw)
}

async function invokeOtpFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let payload = data && typeof data === 'object' ? data : null
    if (!payload?.error) {
      payload = await readEdgeFunctionErrorPayload(error)
    }
    const msg = normalizeEdgeFunctionMessage(
      payload?.error != null ? payload.error : error.message,
      'Request failed',
    )
    const err = new Error(msg)
    if (payload?.code != null) {
      err.code = typeof payload.code === 'string' ? payload.code : String(payload.code)
    }
    throw err
  }
  if (data?.error) {
    const err = new Error(normalizeEdgeFunctionMessage(data.error, 'Request failed'))
    if (data.code != null) {
      err.code = typeof data.code === 'string' ? data.code : String(data.code)
    }
    throw err
  }
  return data
}

/**
 * Request SMS OTP via IPROG (Edge Function). Does not replace email OTP flows.
 */
export async function requestSignupSmsOtp({ userId, email, otpPhone }) {
  const body = {
    email: String(email || '').trim().toLowerCase(),
  }
  if (userId) body.userId = String(userId).trim()
  if (otpPhone) body.otpPhone = String(otpPhone).trim()

  // Must match a deployed Edge Function name (see supabase/functions/signup-sms-otp-send).
  return invokeOtpFunction('signup-sms-otp-send', body)
}

/**
 * Verify SMS OTP via IPROG and confirm email (Edge Function). Then sign in with password on the client.
 */
export async function verifySignupSmsOtp({ userId, email, token }) {
  const body = {
    email: String(email || '').trim().toLowerCase(),
    otp: String(token || '').replace(/\D/g, ''),
  }
  if (userId) body.userId = String(userId).trim()

  // Must match a deployed Edge Function name (see supabase/functions/signup-sms-otp-verify).
  return invokeOtpFunction('signup-sms-otp-verify', body)
}

export async function signInWithEmail({ email, password }) {
  const normalizedEmail = normalizeAuthEmail(email)

  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required.')
  }
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Please enter a valid email address.')
  }

  const lockoutBefore = await checkEmailLockout(normalizedEmail)
  if (lockoutBefore > 0) {
    throw new Error(`LOCKOUT:${lockoutBefore}`)
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    const normalized = String(error.message || '').toLowerCase()

    if (normalized.includes('credential') || normalized.includes('invalid')) {
      try {
        await supabase.rpc('log_failed_login', { user_email: normalizedEmail })
      } catch {
        /* ignore */
      }
    }

    const lockoutAfter = await checkEmailLockout(normalizedEmail)
    if (lockoutAfter > 0) {
      throw new Error(`LOCKOUT:${lockoutAfter}`)
    }

    throw new Error(error.message)
  }

  // Clear failed logins in background (don't wait)
  void Promise.resolve(
    supabase.rpc('clear_failed_logins', { user_email: normalizedEmail }),
  ).catch(() => {})

  if (data?.user) {
    if (!isSignupVerificationComplete(data.user)) {
      await signOutIfSignupIncomplete(data.user)
      const err = new Error('SIGNUP_OTP_REQUIRED')
      err.code = 'SIGNUP_OTP_REQUIRED'
      err.email = normalizedEmail
      throw err
    }

    const meta = data.user.user_metadata || {}
    let dbRole = normalizeRole(meta.role || 'Client')
    let dbName = meta.full_name || normalizedEmail

    // Prefer `profiles.role` so Admin (and other roles) stay correct even if auth metadata is stale.
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileRow?.role) {
      dbRole = normalizeRole(profileRow.role)
    }
    if (profileRow?.full_name) {
      dbName = String(profileRow.full_name).trim() || dbName
    }

    // Update profile in background (don't wait)
    void Promise.resolve(
      supabase.from('profiles').upsert(
        {
          id: data.user.id,
          email: data.user.email,
          full_name: dbName,
          role: dbRole,
        },
        { onConflict: 'id' },
      ),
    ).catch(() => {})

    data.user.role = dbRole
    data.user.name = dbName
  }

  return {
    user: data.user,
    token: data.session?.access_token,
  }
}

export async function verifySignUpOtp({ email, token }) {
  const normalizedToken = String(token || '').replace(/\D/g, '')
  let lastError = null
  for (const type of ['signup', 'email']) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: normalizedToken,
      type,
    })
    if (!error) {
      lastError = null
      break
    }
    lastError = error
  }
  if (lastError) throw new Error(lastError.message)

  await markSignupOtpCompleted()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id) {
    const role = normalizeRole(user.user_metadata?.role)
    if (role === 'Attorney') {
      await supabase
        .from('attorney_profiles')
        .upsert(
          {
            user_id: user.id,
            is_verified: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
    }
  }

  return { success: true }
}

export async function resendSignUpOtp({ email }) {
  const normalizedEmail = normalizeAuthEmail(email)
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function startPasswordRecovery({ email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function resendPasswordRecoveryOtp({ email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function verifyRecoveryOtp({ email, token }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedToken = String(token || '').trim()
  const { error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email',
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function updatePasswordForCurrentUser({ newPassword, clearMustChangePassword = false }) {
  const payload = { password: newPassword }
  if (clearMustChangePassword) {
    payload.data = { must_change_password: false }
  }

  const { error } = await supabase.auth.updateUser(payload)

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function currentUserMustChangePassword() {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw new Error(error.message)
  }
  return Boolean(data?.user?.user_metadata?.must_change_password)
}