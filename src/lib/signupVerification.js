import { supabase } from './supabaseClient'

/**
 * Client signups must complete email/SMS OTP before dashboard access.
 * - signup_otp_completed === true  → verified
 * - signup_otp_completed === false → must finish OTP (new signups)
 * - undefined (legacy accounts)    → fall back to email_confirmed_at
 */
const isClientAccount = (user) => {
  const role = String(user?.user_metadata?.role || 'Client').trim().toLowerCase()
  return role !== 'attorney' && role !== 'admin' && role !== 'secretary'
}

export function isSignupVerificationComplete(user) {
  if (!user) return false

  const meta = user.user_metadata || {}
  if (meta.signup_otp_completed === true) return true
  if (meta.signup_otp_completed === false) return false

  // Legacy client accounts created before signup_otp_completed existed.
  if (isClientAccount(user)) {
    return Boolean(user.email_confirmed_at)
  }

  return Boolean(user.email_confirmed_at)
}

export async function markSignupOtpCompleted() {
  const { error } = await supabase.auth.updateUser({
    data: { signup_otp_completed: true },
  })
  if (error) {
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
