import { supabase } from './supabaseClient'

export const PENDING_OTP_CHANNEL_KEY = 'batasmo_pending_otp_channel'
export const PENDING_SIGNUP_USER_ID_KEY = 'batasmo_pending_signup_user_id'
export const PENDING_SMS_PHONE_KEY = 'batasmo_pending_sms_phone'
export const OTP_RESUME_LOGIN_KEY = 'batasmo_otp_resume_login'
export const OTP_RESUME_SIGNUP_KEY = 'batasmo_otp_resume_signup'

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'admin') return 'Admin'
  if (value === 'attorney') return 'Attorney'
  return 'Client'
}

export async function checkEmailLockout(email) {
  try {
    const { data } = await supabase.rpc('check_login_lockout', { user_email: email })
    return Number(data) || 0
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
  age,
  address,
  guardianName,
  guardianContact,
  preferredOtpChannel = 'email',
}) {
  const normalizedRole = normalizeRole(role)
  const otpChannel = preferredOtpChannel === 'sms' ? 'sms' : 'email'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: normalizedRole,
      },
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  if (data?.session && data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: normalizedRole,
      phone: phone || null,
      age: age || null,
      address: address || null,
      guardian_name: guardianName || null,
      guardian_contact: guardianContact || null,
      preferred_otp_channel: otpChannel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )

      if (attorneyProfileError) {
        console.error('Failed to initialize attorney profile:', attorneyProfileError)
      }
    }

    data.user.role = normalizedRole
    data.user.name = fullName
    data.user.phone = phone
    data.user.address = address

    // If Supabase returns a session before email is confirmed, end the session so the user
    // must complete email or SMS OTP before reaching the dashboard.
    if (!data.user.email_confirmed_at) {
      await supabase.auth.signOut()
    }
  }

  return { token: data?.session?.access_token, user: data?.user, preferredOtpChannel: otpChannel }
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
  const normalizedEmail = String(email || '').trim().toLowerCase()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    const normalized = String(error.message || '').toLowerCase()
    
    // Check lockout only on failure
    const lockoutTime = await checkEmailLockout(normalizedEmail)
    if (lockoutTime > 0) {
      throw new Error(`LOCKOUT:${lockoutTime}`)
    }

    // Log failed login in background (don't wait)
    if (normalized.includes('credential') || normalized.includes('invalid')) {
      void Promise.resolve(
        supabase.rpc('log_failed_login', { user_email: normalizedEmail }),
      ).catch(() => {})
    }
    throw new Error(error.message)
  }

  // Clear failed logins in background (don't wait)
  void Promise.resolve(
    supabase.rpc('clear_failed_logins', { user_email: normalizedEmail }),
  ).catch(() => {})

  if (data?.user) {
    const meta = data.user.user_metadata || {}
    const dbRole = normalizeRole(meta.role || 'Client')
    const dbName = meta.full_name || normalizedEmail

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
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })

  if (error) {
    throw new Error(error.message)
  }

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
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
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

export async function updatePasswordForCurrentUser({ newPassword }) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}