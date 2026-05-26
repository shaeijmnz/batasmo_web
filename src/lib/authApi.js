import { getSupabaseConfigError, supabase } from './supabaseClient'
import { resetUserApiRuntimeState } from './userApi'
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

export const getBackendApiBase = () =>
  String(
    process.env.REACT_APP_PAYMENT_API_URL ||
      process.env.REACT_APP_CHATBOT_API_URL ||
      '',
  )
    .trim()
    .replace(/\/+$/, '')

const signupProfilePayload = ({
  userId,
  normalizedEmail,
  fullName,
  normalizedRole,
  phone,
  otpChannel,
}) => ({
  id: userId,
  email: normalizedEmail,
  full_name: fullName,
  role: normalizedRole,
  phone: phone || null,
  preferred_otp_channel: otpChannel,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

async function signUpWithSupabaseOtp({
  normalizedEmail,
  password,
  fullName,
  normalizedRole,
  phone,
  otpChannel,
}) {
  const configError = getSupabaseConfigError()
  if (configError) {
    throw new Error(configError)
  }

  let data
  let error
  try {
    const result = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          role: normalizedRole,
          signup_otp_completed: false,
        },
      },
    })
    data = result.data
    error = result.error
  } catch (networkError) {
    throw new Error(normalizeAuthNetworkError(networkError))
  }

  if (error) {
    const msg = String(error.message || '')
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
      throw new Error('This Gmail is already registered. Please log in instead.')
    }
    throw new Error(normalizeAuthNetworkError(error, msg || 'Could not create account. Please try again.'))
  }

  if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
    throw new Error('This Gmail is already registered. Please log in instead.')
  }

  if (data?.user?.id) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        signupProfilePayload({
          userId: data.user.id,
          normalizedEmail,
          fullName,
          normalizedRole,
          phone,
          otpChannel,
        }),
        { onConflict: 'id' },
      )

    if (profileError) {
      console.error('[signup] profile upsert failed', profileError)
    }

    if (normalizedRole === 'Attorney') {
      const { error: attorneyProfileError } = await supabase
        .from('attorney_profiles')
        .upsert(
          {
            user_id: data.user.id,
            is_verified: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )

      if (attorneyProfileError) {
        console.error('[signup] attorney profile upsert failed', attorneyProfileError)
      }
    }
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData?.session) {
      await supabase.auth.signOut()
    }
  } catch (signOutError) {
    console.warn('[signup] signOut after signup', signOutError?.message || signOutError)
  }

  return {
    userId: data?.user?.id || null,
    email: normalizedEmail,
    preferredOtpChannel: otpChannel,
  }
}

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'admin') return 'Admin'
  if (value === 'attorney') return 'Attorney'
  return 'Client'
}

const normalizeAuthNetworkError = (error, fallback = 'Could not reach the server. Check your connection and try again.') => {
  const msg = String(error?.message || error || '').trim()
  if (!msg || msg === 'Load failed' || msg === 'Failed to fetch' || msg.includes('NetworkError')) {
    return fallback
  }
  return msg
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
  phone,
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

  const signupBody = {
    email: normalizedEmail,
    password,
    fullName,
    role: normalizedRole,
    phone: phone || null,
    preferredOtpChannel: otpChannel,
  }

  const base = getBackendApiBase()

  if (base) {
    try {
      const response = await fetch(`${base}/auth/signup-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupBody),
      })

      const payload = await response.json().catch(() => ({}))
      if (response.ok && payload?.pendingId) {
        return {
          pendingId: payload.pendingId,
          email: payload?.email || normalizedEmail,
          preferredOtpChannel: payload?.preferredOtpChannel || otpChannel,
        }
      }

      const backendMsg = String(payload?.error || '').trim()
      if (backendMsg && response.status !== 404) {
        throw new Error(normalizeAuthNetworkError({ message: backendMsg }, backendMsg))
      }
      console.warn('[signup] backend signup-start unavailable, using Supabase OTP flow')
    } catch (backendError) {
      const msg = String(backendError?.message || '')
      if (msg && !msg.includes('Load failed') && !msg.includes('Failed to fetch')) {
        throw backendError
      }
      console.warn('[signup] backend signup-start failed, using Supabase OTP flow', msg)
    }
  }

  const supabaseResult = await signUpWithSupabaseOtp({
    normalizedEmail,
    password,
    fullName,
    normalizedRole,
    phone,
    otpChannel,
  })

  if (supabaseResult.userId) {
    localStorage.setItem(PENDING_SIGNUP_USER_ID_KEY, String(supabaseResult.userId))
  }

  return supabaseResult
}

/**
 * Resend signup verification code (pending signup — no Supabase auth user yet).
 */
export async function sendSignupVerificationEmail({ email, pendingId }) {
  const normalizedEmail = normalizeAuthEmail(email)
  if (!normalizedEmail && !pendingId) throw new Error('Email is required.')

  const base = getBackendApiBase()
  if (base && normalizedEmail) {
    try {
      const response = await fetch(`${base}/auth/signup-resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, pendingId: pendingId || undefined }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.ok) {
        return payload
      }
      throw new Error(
        payload?.error || payload?.message || `Failed to send verification email (${response.status}).`,
      )
    } catch (backendError) {
      const msg = String(backendError?.message || '')
      if (msg && !msg.includes('Load failed') && !msg.includes('Failed to fetch')) {
        throw backendError
      }
    }
  }

  if (!normalizedEmail) {
    throw new Error('Email is required.')
  }

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
    })
    if (error) {
      throw new Error(error.message || 'Failed to send verification email.')
    }
    return { success: true }
  } catch (networkError) {
    throw new Error(normalizeAuthNetworkError(networkError))
  }
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
  const result = await invokeOtpFunction('signup-sms-otp-verify', body)
  await markSignupOtpCompleted()
  return result
}

export async function signInWithEmail({ email, password }) {
  const configError = getSupabaseConfigError()
  if (configError) {
    throw new Error(configError)
  }

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

function readSignupResumePassword() {
  try {
    const raw = sessionStorage.getItem(OTP_RESUME_SIGNUP_KEY)
    if (!raw) return ''
    const resume = JSON.parse(raw)
    return String(resume?.password || '')
  } catch {
    return ''
  }
}

/** Fresh sign-in after server marks verified — avoids stale JWT that triggers sign-out guards. */
async function ensureSessionAfterOtpVerify({ email, password }) {
  const normalizedEmail = normalizeAuthEmail(email)
  const signupPassword = String(password || readSignupResumePassword() || '')
  if (!signupPassword) {
    throw new Error('Signup session expired. Please sign up again.')
  }

  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: signupPassword,
  })
  if (error || !data?.session?.user) {
    throw new Error(error?.message || 'Could not sign you in after verification.')
  }
  return data.session
}

async function loadClientProfileForSession(session) {
  const user = session?.user
  if (!user?.id) {
    throw new Error('No active session after verification.')
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, address, role, age, guardian_name, guardian_contact, guardian_details')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.warn('[signup] profile fetch after OTP', error.message || error)
  }

  let resume = null
  try {
    const raw = sessionStorage.getItem(OTP_RESUME_SIGNUP_KEY)
    if (raw) resume = JSON.parse(raw)
  } catch {
    resume = null
  }

  return (
    profile || {
      id: user.id,
      email: user.email || resume?.email || '',
      full_name: resume?.fullName || user.user_metadata?.full_name || '',
      role: normalizeRole(user.user_metadata?.role || 'Client'),
      phone: resume?.phone || null,
      address: null,
      age: null,
      guardian_name: null,
      guardian_contact: null,
      guardian_details: '',
    }
  )
}

async function markSignupVerifiedOnBackend({ email, pendingId }) {
  const base = getBackendApiBase()
  if (!base) return

  const response = await fetch(`${base}/auth/signup-mark-verified`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: normalizeAuthEmail(email),
      pendingId: pendingId ? String(pendingId).trim() : undefined,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error || 'Could not finalize signup on server.')
  }
}

/**
 * Email signup OTP: verify code → session → profile. Caller must use onAuthSuccess(profile)
 * for home navigation (never Login). Wrapped with beginSignupOtpFinishing in OtpVerification.
 */
export async function verifySignUpOtp({ email, token, password, pendingId }) {
  const normalizedEmail = normalizeAuthEmail(email)
  const normalizedToken = String(token || '').replace(/\D/g, '')
  const signupPassword = String(password || readSignupResumePassword() || '')
  let lastError = null
  let otpVerified = false

  for (const type of ['email', 'signup']) {
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type,
    })
    if (!error) {
      lastError = null
      otpVerified = true
      break
    }
    lastError = error
  }

  if (!otpVerified) {
    const base = getBackendApiBase()
    const pwd = String(password || readSignupResumePassword() || '')
    if (base && pendingId && pwd) {
      await completePendingSignup({
        email: normalizedEmail,
        pendingId,
        otp: normalizedToken,
        password: pwd,
      })
    } else {
      throw new Error(lastError?.message || 'Invalid or expired verification code.')
    }
  }

  await markSignupVerifiedOnBackend({ email: normalizedEmail, pendingId })

  const session = await ensureSessionAfterOtpVerify({
    email: normalizedEmail,
    password: signupPassword,
  })

  await markSignupOtpCompleted()
  await supabase.auth.refreshSession()
  resetUserApiRuntimeState()

  const user = session.user
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

    try {
      const resumeRaw = sessionStorage.getItem(OTP_RESUME_SIGNUP_KEY)
      if (resumeRaw) {
        const resume = JSON.parse(resumeRaw)
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email || resume.email,
            full_name: resume.fullName || user.user_metadata?.full_name || '',
            role: 'Client',
            phone: resume.phone || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
      }
    } catch (profileError) {
      console.warn('[signup] post-verify profile upsert failed', profileError)
    }
  }

  const profile = await loadClientProfileForSession(session)
  return { success: true, profile, session }
}

export async function resendSignUpOtp({ email, pendingId }) {
  return sendSignupVerificationEmail({ email, pendingId })
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