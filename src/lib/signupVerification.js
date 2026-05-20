import { supabase } from './supabaseClient'

/**
 * Signup OTP contract (do not break):
 * 1. User enters 6-digit code on OtpVerification
 * 2. verifySignUpOtp → backend mark verified → fresh signInWithPassword → profile
 * 3. onAuthSuccess(profile) → Client home (never Login)
 * While finishing, isSignupOtpFinishing() blocks auth listener / getCurrentSessionProfile sign-out.
 */
export const SIGNUP_OTP_FINISHING_KEY = 'batasmo_signup_otp_finishing'

export function beginSignupOtpFinishing() {
  try {
    sessionStorage.setItem(SIGNUP_OTP_FINISHING_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function endSignupOtpFinishing() {
  try {
    sessionStorage.removeItem(SIGNUP_OTP_FINISHING_KEY)
  } catch {
    /* ignore */
  }
}

export function isSignupOtpFinishing() {
  try {
    return sessionStorage.getItem(SIGNUP_OTP_FINISHING_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Client signups must complete email/SMS OTP before dashboard access.
 * - signup_otp_completed === true  → verified
 * - signup_otp_completed === false → must finish OTP (new signups)
 * - undefined (legacy accounts)    → fall back to email_confirmed_at
 */
const isClientAccount = (user) => {
  const role = String(user?.user_metadata?.role || 'Client').trim().toLowerCase()
  return role !== 'attorney' && role !== 'admin'
}

export function isSignupVerificationComplete(user) {
  if (!user) return false

  const meta = user.user_metadata || {}
  if (meta.signup_otp_completed === true) return true
  if (meta.signup_otp_completed === false) {
    if (user.email_confirmed_at) return true
    if (isSignupOtpFinishing()) return true
    return false
  }

  const pendingEmail = String(
    typeof localStorage !== 'undefined' ? localStorage.getItem('batasmo_pending_otp_email') : '',
  )
    .trim()
    .toLowerCase()
  const userEmail = String(user.email || '')
    .trim()
    .toLowerCase()
  if (pendingEmail && userEmail && pendingEmail === userEmail) {
    return false
  }

  // Legacy accounts created before signup_otp_completed existed.
  if (isClientAccount(user)) {
    return Boolean(user.email_confirmed_at)
  }

  return Boolean(user.email_confirmed_at)
}

export async function markSignupOtpCompleted() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return
  }
  const { error } = await supabase.auth.updateUser({
    data: { signup_otp_completed: true },
  })
  if (error) {
    const msg = String(error.message || '')
    if (msg.toLowerCase().includes('auth session missing')) {
      return
    }
    throw new Error(error.message || 'Could not finalize account verification.')
  }
}

export async function signOutIfSignupIncomplete(user) {
  if (!user || isSignupVerificationComplete(user)) {
    return false
  }
  await supabase.auth.signOut()
  return true
}
