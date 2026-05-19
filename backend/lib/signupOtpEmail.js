/**
 * Signup verification OTP email (6-digit code) — Resend API (recommended on Render) or Gmail SMTP.
 */

import dns from 'dns'
import { isWelcomeEmailConfigured } from './welcomeEmail.js'

const smtpLookup = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, family: 4 }, callback)
}

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim()
const WELCOME_EMAIL_FROM = String(process.env.WELCOME_EMAIL_FROM || '').trim()
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim()
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_USER = String(process.env.SMTP_USER || '').trim()
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim()
const APP_LOGIN_URL = String(process.env.APP_LOGIN_URL || 'https://batasmo-web.vercel.app/login').trim()
const OTP_EMAIL_PREFER = String(process.env.OTP_EMAIL_PREFER || 'auto').trim().toLowerCase()

export const isSignupOtpEmailConfigured = () => isWelcomeEmailConfigured()

const smtpReady = () => Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && WELCOME_EMAIL_FROM)
const resendReady = () => Boolean(RESEND_API_KEY && WELCOME_EMAIL_FROM)
const isResendSandboxFrom = () => WELCOME_EMAIL_FROM.toLowerCase().includes('onboarding@resend.dev')

export const getSignupOtpEmailStatus = () => {
  const smtp = smtpReady()
  const resend = resendReady()
  const sandbox = resend && isResendSandboxFrom() && !smtp
  let primary = 'none'
  if (resend && !sandbox && (OTP_EMAIL_PREFER === 'resend' || OTP_EMAIL_PREFER === 'auto' || !smtp)) {
    primary = 'resend'
  } else if (smtp) {
    primary = 'smtp'
  } else if (resend) {
    primary = 'resend'
  }
  return {
    configured: smtp || resend,
    primary,
    smtp,
    resend,
    resendSandboxOnly: sandbox,
    recommendResendOnRender: smtp && !resend,
  }
}

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const formatOtpForDisplay = (otp) =>
  String(otp || '')
    .replace(/\D/g, '')
    .slice(0, 6)
    .split('')
    .join(' ')

const resolveAppBaseUrl = () => {
  const fromLogin = APP_LOGIN_URL.replace(/\/login\/?$/i, '')
  if (fromLogin) return fromLogin
  return 'https://batasmo-web.vercel.app'
}

const buildSignupOtpHtml = ({ otp, fullName }) => {
  const safeOtp = escapeHtml(formatOtpForDisplay(otp))
  const safeName = escapeHtml(fullName || 'there')
  const appBase = resolveAppBaseUrl()
  const logoUrl = `${appBase}/auth/logo.jpg`
  const verifyUrl = appBase

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BatasMo OTP Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#0b1018;font-family:Georgia,'Times New Roman',serif;color:#f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0b1018;padding:32px 16px;">
    <tr>
      <td align="center">
        <div style="font-size:42px;line-height:1.1;font-style:italic;font-weight:700;color:#d4af37;letter-spacing:1px;margin:0 0 20px;">BatasMo!</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:linear-gradient(180deg,#121a26 0%,#0d131c 100%);border-radius:16px;border:1px solid #2a3544;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,0.45);">
          <tr>
            <td style="padding:32px 28px 12px;text-align:center;">
              <img src="${logoUrl}" alt="Anarna Law" width="88" height="88" style="display:block;margin:0 auto 18px;border-radius:12px;object-fit:contain;" />
              <h1 style="margin:0 0 12px;font-size:28px;font-weight:700;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">
                Welcome to BatasMo!
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#b8c0cc;font-family:Arial,Helvetica,sans-serif;">
                Hi ${safeName}, we're excited to have you on board. To secure your account, please use the One-Time Password (OTP) below to verify your email address.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px;">
              <div style="border:2px solid #d4af37;border-radius:12px;padding:22px 16px;text-align:center;background:rgba(212,175,55,0.06);">
                <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#d4af37;font-family:'Courier New',Courier,monospace;line-height:1.2;">
                  ${safeOtp}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;text-align:center;">
              <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(180deg,#e8c96a 0%,#c9a227 100%);color:#1a1208;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.12em;padding:14px 32px;border-radius:8px;text-transform:uppercase;">
                Verify and proceed
              </a>
              <p style="margin:18px 0 0;font-size:13px;color:#8b95a3;font-family:Arial,Helvetica,sans-serif;">
                This code will expire in <strong style="color:#d4af37;">10 minutes</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#080d12;text-align:center;font-size:12px;line-height:1.5;color:#7d8796;font-family:Arial,Helvetica,sans-serif;">
              Need help? <a href="mailto:support@batasmo.ph" style="color:#d4af37;text-decoration:none;">support@batasmo.ph</a><br />
              © ${new Date().getFullYear()} BatasMo. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const buildSignupOtpText = ({ otp, fullName }) =>
  [
    `Hi ${fullName || 'there'},`,
    '',
    'Welcome to BatasMo!',
    '',
    'Your verification code is:',
    '',
    String(otp || ''),
    '',
    'This code expires in 10 minutes.',
    '',
    `Open BatasMo: ${resolveAppBaseUrl()}`,
    '',
    'If you did not create an account, you can ignore this email.',
  ].join('\n')

const RESEND_TIMEOUT_MS = 20_000
const SMTP_ATTEMPT_MS = 14_000

const withTimeout = async (promise, ms, message) => {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timeoutId)
  }
}

const sendViaResend = async ({ to, subject, html, text }) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: WELCOME_EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = payload?.message || payload?.error || `Resend error (${response.status})`
    throw new Error(String(msg))
  }
  return payload
}

const isTransientSmtpFailure = (err) => {
  const msg = String(err?.message || err?.code || '').toLowerCase()
  return (
    msg.includes('timeout') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('greeting') ||
    msg.includes('socket') ||
    msg.includes('connection')
  )
}

const sendViaSmtpOnce = async ({ to, subject, html, text, port, secure, requireTLS }) => {
  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    requireTLS: Boolean(requireTLS),
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: SMTP_ATTEMPT_MS,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { minVersion: 'TLSv1.2' },
    lookup: smtpLookup,
  })

  try {
    await transport.sendMail({ from: WELCOME_EMAIL_FROM, to, subject, html, text })
  } finally {
    transport.close?.()
  }
}

const sendViaSmtp = async ({ to, subject, html, text }) => {
  const hostLower = SMTP_HOST.toLowerCase()
  const isGmailHost = hostLower.includes('gmail.com') || hostLower.includes('googlemail.com')
  const configuredPort = Number(SMTP_PORT) || 465

  const attempts = []
  if (isGmailHost) {
    if (configuredPort !== 587) {
      attempts.push({ port: 587, secure: false, requireTLS: true })
    }
    if (configuredPort !== 465) {
      attempts.push({ port: 465, secure: true, requireTLS: false })
    }
    if (attempts.length === 0) {
      attempts.push({ port: configuredPort, secure: configuredPort === 465, requireTLS: false })
    }
  } else {
    attempts.push({ port: configuredPort, secure: configuredPort === 465, requireTLS: false })
  }

  let lastError = null
  for (const a of attempts) {
    try {
      await withTimeout(
        sendViaSmtpOnce({ to, subject, html, text, ...a }),
        SMTP_ATTEMPT_MS,
        'SMTP connection timed out',
      )
      return
    } catch (err) {
      lastError = err
      if (!isTransientSmtpFailure(err)) throw err
    }
  }
  throw lastError || new Error('SMTP send failed.')
}

const smtpFailureHelp =
  'Gmail SMTP from Render is not connecting. Fix: (1) Add RESEND_API_KEY on Render (free at resend.com — works for all Gmail addresses). (2) Or set SMTP_PORT=587 and redeploy. (3) Or use SMS verification on sign up.'

const shouldTryResendFirst = () => {
  if (!resendReady()) return false
  if (isResendSandboxFrom() && smtpReady()) return false
  if (OTP_EMAIL_PREFER === 'smtp') return false
  if (OTP_EMAIL_PREFER === 'resend') return true
  return true
}

const shouldTrySmtp = () => smtpReady() && OTP_EMAIL_PREFER !== 'resend'

/**
 * @returns {{ sent: boolean, skipped?: boolean, error?: string }}
 */
export async function sendSignupOtpEmail({ email, otp, fullName }) {
  const to = String(email || '').trim().toLowerCase()
  const code = String(otp || '').replace(/\D/g, '').slice(0, 6)
  if (!to || code.length !== 6) {
    return { sent: false, error: 'Missing email or OTP.' }
  }

  if (!isSignupOtpEmailConfigured()) {
    return { sent: false, skipped: true, error: 'Verification email is not configured on the server.' }
  }

  if (isResendSandboxFrom() && !smtpReady()) {
    return {
      sent: false,
      error:
        'Resend test sender (onboarding@resend.dev) only delivers to the Resend account email. Add Gmail SMTP or verify a domain on Resend.',
    }
  }

  const subject = 'Your BatasMo verification code'
  const html = buildSignupOtpHtml({ otp: code, fullName })
  const text = buildSignupOtpText({ otp: code, fullName })
  const mail = { to, subject, html, text }

  const errors = []

  if (shouldTryResendFirst()) {
    try {
      await withTimeout(
        sendViaResend(mail),
        RESEND_TIMEOUT_MS,
        'Resend API timed out',
      )
      console.info('[signup-otp-email] sent via Resend to', to)
      return { sent: true, transport: 'resend' }
    } catch (err) {
      const msg = err?.message || String(err)
      console.warn('[signup-otp-email] Resend failed:', msg)
      errors.push(`Resend: ${msg}`)
      if (!shouldTrySmtp()) {
        return { sent: false, error: msg }
      }
    }
  }

  if (shouldTrySmtp()) {
    try {
      await sendViaSmtp(mail)
      console.info('[signup-otp-email] sent via SMTP to', to)
      return { sent: true, transport: 'smtp' }
    } catch (err) {
      const msg = err?.message || String(err)
      console.warn('[signup-otp-email] SMTP failed:', msg)
      errors.push(`SMTP: ${msg}`)
    }
  }

  if (resendReady() && !shouldTryResendFirst()) {
    try {
      await withTimeout(sendViaResend(mail), RESEND_TIMEOUT_MS, 'Resend API timed out')
      return { sent: true, transport: 'resend' }
    } catch (err) {
      errors.push(`Resend: ${err?.message || err}`)
    }
  }

  const combined = errors.join(' | ') || 'Failed to send verification email.'
  const isTimeout = combined.toLowerCase().includes('timeout')
  return {
    sent: false,
    error: isTimeout && !resendReady() ? `${combined}. ${smtpFailureHelp}` : combined,
  }
}
