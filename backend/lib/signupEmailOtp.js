/**
 * Signup email OTP via Render SMTP (Gmail / etc.).
 * Supabase Auth often returns HTTP 200 without delivering mail when project SMTP is misconfigured.
 */

import crypto from 'crypto'
import nodemailer from 'nodemailer'

const OTP_TTL_MS = 15 * 60 * 1000
const MIN_MS_BETWEEN_SENDS = 55_000

export const getSmtpConfig = () => {
  const host = String(process.env.SMTP_HOST || '').trim()
  const user = String(process.env.SMTP_USER || process.env.SMTP_EMAIL || '').trim()
  const pass = String(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const from = String(process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || user || '').trim()
  const secure =
    String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465

  if (!host || !user || !pass) {
    return null
  }

  return { host, port, user, pass, from: from || user, secure }
}

export const isSmtpConfigured = () => Boolean(getSmtpConfig())

const otpSecret = (serviceRoleKey) =>
  String(process.env.SIGNUP_OTP_SECRET || serviceRoleKey || 'batasmo-signup-otp')

export const hashSignupOtp = (email, otp, serviceRoleKey) =>
  crypto.createHmac('sha256', otpSecret(serviceRoleKey)).update(`${email}:${otp}`).digest('hex')

export const generateSignupOtpCode = () => String(Math.floor(100000 + Math.random() * 900000))

const buildOtpEmailHtml = ({ code, fullName }) => {
  const name = fullName ? `Hi ${fullName},` : 'Hi,'
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="background:#102035;padding:20px 24px;color:#fff;font-size:24px;font-weight:800;">⚖️ BatasMo</td></tr>
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 12px;font-size:16px;">${name}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4b5563;">Your verification code for BatasMo signup:</p>
      <div style="text-align:center;background:#f6f8fb;border:1px solid #dbe4f0;border-radius:12px;padding:18px;">
        <div style="font-size:12px;letter-spacing:1px;font-weight:700;color:#6b7280;">YOUR OTP CODE</div>
        <div style="margin-top:8px;font-size:42px;letter-spacing:6px;font-weight:800;color:#102035;">${code}</div>
      </div>
      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Valid for 15 minutes. If you did not sign up, ignore this email.</p>
    </td></tr>
  </table>
</body></html>`
}

export const sendSignupOtpEmail = async ({ to, code, fullName }) => {
  const smtp = getSmtpConfig()
  if (!smtp) {
    throw new Error(
      'Email is not configured on the server. Add SMTP_HOST, SMTP_USER, and SMTP_PASS on Render, then redeploy.',
    )
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  })

  await transporter.sendMail({
    from: `"BatasMo" <${smtp.from}>`,
    to,
    subject: `Your BatasMo verification code: ${code}`,
    text: `Your BatasMo verification code is ${code}. It expires in 15 minutes.`,
    html: buildOtpEmailHtml({ code, fullName }),
  })
}

export const storeSignupOtpOnUser = async ({
  userId,
  email,
  code,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  getAdminUser,
}) => {
  const existing = await getAdminUser(userId)
  const prevMeta = existing?.user_metadata || existing?.raw_user_meta_data || {}
  const now = Date.now()
  const lastSent = prevMeta.signup_email_otp_sent_at
    ? new Date(prevMeta.signup_email_otp_sent_at).getTime()
    : 0
  if (lastSent && now - lastSent < MIN_MS_BETWEEN_SENDS) {
    throw new Error('Please wait about a minute before requesting another code.')
  }

  const expiresAt = new Date(now + OTP_TTL_MS).toISOString()
  const hash = hashSignupOtp(email, code, SUPABASE_SERVICE_ROLE_KEY)

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_metadata: {
        ...prevMeta,
        signup_email_otp_hash: hash,
        signup_email_otp_expires_at: expiresAt,
        signup_email_otp_sent_at: new Date(now).toISOString(),
        signup_otp_completed: false,
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || payload?.msg || 'Could not store verification code.')
  }
}

export const verifyStoredSignupOtp = async ({
  userId,
  email,
  otp,
  SUPABASE_SERVICE_ROLE_KEY,
  getAdminUser,
}) => {
  const user = await getAdminUser(userId)
  if (!user) {
    throw new Error('Account not found. Please sign up again.')
  }

  const meta = user.user_metadata || user.raw_user_meta_data || {}
  const hash = String(meta.signup_email_otp_hash || '')
  const expiresAt = meta.signup_email_otp_expires_at

  if (!hash || !expiresAt) {
    throw new Error('No verification code on file. Tap Resend Code to get a new email.')
  }

  if (Date.now() > new Date(expiresAt).getTime()) {
    throw new Error('Verification code expired. Tap Resend Code for a new one.')
  }

  const expected = hashSignupOtp(email, otp, SUPABASE_SERVICE_ROLE_KEY)
  if (hash !== expected) {
    throw new Error('Invalid verification code. Check the 6 digits and try again.')
  }

  return user
}

export const clearSignupOtpOnUser = async ({
  userId,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  getAdminUser,
}) => {
  const existing = await getAdminUser(userId)
  const prevMeta = existing?.user_metadata || existing?.raw_user_meta_data || {}
  const {
    signup_email_otp_hash: _h,
    signup_email_otp_expires_at: _e,
    signup_email_otp_sent_at: _s,
    ...rest
  } = prevMeta

  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_metadata: {
        ...rest,
        signup_otp_completed: true,
      },
    }),
  })
}

export const issueAndSendSignupEmailOtp = async ({
  userId,
  email,
  fullName,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  getAdminUser,
}) => {
  const code = generateSignupOtpCode()
  await storeSignupOtpOnUser({
    userId,
    email,
    code,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    getAdminUser,
  })
  await sendSignupOtpEmail({ to: email, code, fullName })
  console.log(`[signup] SMTP OTP sent to ${email}`)
  return { sent: true, channel: 'smtp' }
}
