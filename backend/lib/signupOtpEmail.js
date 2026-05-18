/**
 * Signup OTP email — uses same Resend / Gmail SMTP as attorney welcome email.
 */

import { isWelcomeEmailConfigured } from './welcomeEmail.js'

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim()
const WELCOME_EMAIL_FROM = String(process.env.WELCOME_EMAIL_FROM || '').trim()
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim()
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_USER = String(process.env.SMTP_USER || '').trim()
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim()

export const isSignupOtpEmailConfigured = () => isWelcomeEmailConfigured()

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const buildSignupOtpHtml = ({ otp, fullName }) => {
  const safeOtp = escapeHtml(otp)
  const safeName = escapeHtml(fullName || 'there')

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#080d12,#102035);padding:20px 24px;">
          <div style="font-size:30px;font-weight:800;color:#fff;">BatasMo</div>
        </td></tr>
        <tr><td style="padding:28px 26px;text-align:center;">
          <p style="margin:0 0 8px;font-size:16px;color:#4b5563;">Hi ${safeName},</p>
          <p style="margin:0;font-size:16px;line-height:1.55;color:#4b5563;">Use this OTP to verify your BatasMo account:</p>
        </td></tr>
        <tr><td style="padding:0 26px 12px;">
          <div style="background:#f6f8fb;border:1px solid #dbe4f0;border-radius:12px;padding:18px;text-align:center;">
            <div style="font-size:12px;letter-spacing:1px;font-weight:700;color:#6b7280;">YOUR OTP CODE</div>
            <div style="margin-top:8px;font-size:42px;letter-spacing:6px;font-weight:800;color:#102035;">${safeOtp}</div>
            <p style="margin-top:10px;font-size:13px;color:#6b7280;">Expires in <strong>10 minutes</strong>.</p>
          </div>
        </td></tr>
        <tr><td style="padding:8px 26px 24px;">
          <div style="background:#fff9ec;border:1px solid #f4deb0;border-radius:10px;padding:14px;font-size:14px;color:#7a5a23;">
            <strong>Keep this code private.</strong> BatasMo will never ask for your OTP by phone or chat.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const buildSignupOtpText = ({ otp, fullName }) =>
  [
    `Hi ${fullName || 'there'},`,
    '',
    'Your BatasMo verification code is:',
    '',
    String(otp || ''),
    '',
    'This code expires in 10 minutes.',
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
  const code = String(otp || '').replace(/\D/g, '')
  if (!to || code.length < 6) {
    return { sent: false, error: 'Missing email or OTP.' }
  }

  if (!isSignupOtpEmailConfigured()) {
    return {
      sent: false,
      skipped: true,
      error: 'Email service is not configured on the server (set SMTP_* or RESEND_API_KEY on Render).',
    }
  }

  const subject = `${code} is your BatasMo verification code`
  const html = buildSignupOtpHtml({ otp: code, fullName })
  const text = buildSignupOtpText({ otp: code, fullName })
  const smtpReady = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && WELCOME_EMAIL_FROM)

  try {
    if (smtpReady) {
      await sendViaSmtp({ to, subject, html, text })
    } else if (RESEND_API_KEY) {
      await sendViaResend({ to, subject, html, text })
    } else {
      return { sent: false, skipped: true, error: 'Email service is not configured on the server.' }
    }
    return { sent: true }
  } catch (error) {
    console.error('[signup-otp-email] send failed', error?.message || error)
    return { sent: false, error: error?.message || 'Failed to send verification email.' }
  }
}
