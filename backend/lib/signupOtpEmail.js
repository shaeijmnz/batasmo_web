/**
 * Signup verification OTP email (6-digit code) — uses Render SMTP/Resend.
 */

import { isWelcomeEmailConfigured } from './welcomeEmail.js'

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim()
const WELCOME_EMAIL_FROM = String(process.env.WELCOME_EMAIL_FROM || '').trim()
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim()
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_USER = String(process.env.SMTP_USER || '').trim()
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim()
const APP_LOGIN_URL = String(process.env.APP_LOGIN_URL || 'https://batasmo-web.vercel.app/login').trim()

export const isSignupOtpEmailConfigured = () => isWelcomeEmailConfigured()

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

const sendViaSmtp = async ({ to, subject, html, text }) => {
  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  })

  await transport.sendMail({
    from: WELCOME_EMAIL_FROM,
    to,
    subject,
    html,
    text,
  })
}

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
    console.warn('[signup-otp-email] not configured — set SMTP_* or RESEND_API_KEY in backend env')
    return { sent: false, skipped: true, error: 'Verification email is not configured on the server.' }
  }

  const subject = 'Your BatasMo verification code'
  const html = buildSignupOtpHtml({ otp: code, fullName })
  const text = buildSignupOtpText({ otp: code, fullName })

  const smtpReady = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && WELCOME_EMAIL_FROM)
  const resendSandboxOnly =
    !smtpReady &&
    WELCOME_EMAIL_FROM.toLowerCase().includes('onboarding@resend.dev')

  if (resendSandboxOnly) {
    return {
      sent: false,
      error:
        'Resend test sender only delivers to one inbox. Configure Gmail SMTP on Render (SMTP_HOST, SMTP_USER, SMTP_PASS, WELCOME_EMAIL_FROM).',
    }
  }

  try {
    if (smtpReady) {
      await sendViaSmtp({ to, subject, html, text })
    } else if (RESEND_API_KEY) {
      await sendViaResend({ to, subject, html, text })
    } else {
      return { sent: false, skipped: true, error: 'Verification email is not configured on the server.' }
    }
    return { sent: true }
  } catch (error) {
    console.error('[signup-otp-email] send failed', error?.message || error)
    return { sent: false, error: error?.message || 'Failed to send verification email.' }
  }
}
