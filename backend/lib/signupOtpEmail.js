/**
 * Signup verification OTP email (6-digit code) — Gmail SMTP only (sent on Create Account).
 */

import dns from 'dns'
import { isWelcomeEmailConfigured } from './welcomeEmail.js'

const smtpLookup = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, family: 4 }, callback)
}

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim()
const WELCOME_EMAIL_FROM = String(process.env.WELCOME_EMAIL_FROM || '').trim()
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim()
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_USER = String(process.env.SMTP_USER || '').trim()
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim()
const APP_LOGIN_URL = String(process.env.APP_LOGIN_URL || 'https://batasmo-web.vercel.app/login').trim()
const smtpReady = () => Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && WELCOME_EMAIL_FROM)
const resendReady = () => Boolean(RESEND_API_KEY && WELCOME_EMAIL_FROM)

export const isSignupOtpEmailConfigured = () => smtpReady() || resendReady()

export const getSignupOtpEmailStatus = () => ({
  configured: isSignupOtpEmailConfigured(),
  primary: smtpReady() ? 'gmail-smtp' : resendReady() ? 'api-backup' : 'none',
  smtp: smtpReady(),
  resendBackup: resendReady(),
  hint: smtpReady()
    ? 'OTP via Gmail SMTP (port 587 on Render). RESEND_API_KEY optional backup if SMTP times out.'
    : 'Set SMTP_* on Render, or RESEND_API_KEY + WELCOME_EMAIL_FROM.',
})

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

const RESEND_TIMEOUT_MS = 15_000
const SMTP_ATTEMPT_MS = 12_000

const sendViaResend = async ({ to, subject, html, text }) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS)
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
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
      const msg = payload?.message || payload?.error || `Mail API error (${response.status})`
      throw new Error(String(msg))
    }
    return payload
  } finally {
    clearTimeout(timeoutId)
  }
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
      await sendViaSmtpOnce({ to, subject, html, text, ...a })
      return
    } catch (err) {
      lastError = err
      if (!isTransientSmtpFailure(err)) throw err
    }
  }
  throw lastError || new Error('SMTP send failed.')
}

/**
 * @returns {{ sent: boolean, skipped?: boolean, error?: string, transport?: string }}
 */
export async function sendSignupOtpEmail({ email, otp, fullName }) {
  const to = String(email || '').trim().toLowerCase()
  const code = String(otp || '').replace(/\D/g, '').slice(0, 6)
  if (!to || code.length !== 6) {
    return { sent: false, error: 'Missing email or OTP.' }
  }

  if (!isSignupOtpEmailConfigured()) {
    return {
      sent: false,
      skipped: true,
      error:
        'Email is not configured on the server (Gmail SMTP or mail API).',
    }
  }

  const subject = 'Your BatasMo verification code'
  const html = buildSignupOtpHtml({ otp: code, fullName })
  const text = buildSignupOtpText({ otp: code, fullName })
  const mail = { to, subject, html, text }

  if (smtpReady()) {
    try {
      await sendViaSmtp(mail)
      console.info('[signup-otp-email] sent via Gmail SMTP to', to)
      return { sent: true, transport: 'smtp' }
    } catch (smtpError) {
      console.warn('[signup-otp-email] Gmail SMTP failed:', smtpError?.message || smtpError)
      if (!resendReady()) {
        return {
          sent: false,
          error:
            'Could not send via Gmail. Check SMTP_PORT=587 and App Password on Render, or try Resend Code.',
        }
      }
    }
  }

  if (resendReady()) {
    try {
      await sendViaResend(mail)
      console.info('[signup-otp-email] sent via mail API (SMTP unavailable) to', to)
      return { sent: true, transport: 'api' }
    } catch (apiError) {
      return { sent: false, error: apiError?.message || 'Failed to send verification email.' }
    }
  }

  return { sent: false, error: 'Could not send verification email.' }
}
