/**
 * Welcome email for admin-created attorney accounts.
 * Configure Resend (recommended) or Gmail SMTP — see backend/.env.example
 */

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim()
const WELCOME_EMAIL_FROM = String(process.env.WELCOME_EMAIL_FROM || '').trim()
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim()
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_USER = String(process.env.SMTP_USER || '').trim()
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim()
const APP_LOGIN_URL = String(process.env.APP_LOGIN_URL || '').trim()

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const isWelcomeEmailConfigured = () =>
  Boolean(RESEND_API_KEY && WELCOME_EMAIL_FROM) ||
  Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && WELCOME_EMAIL_FROM)

const buildAttorneyWelcomeHtml = ({ fullName, email, password, loginUrl }) => {
  const safeName = escapeHtml(fullName || 'Attorney')
  const safeEmail = escapeHtml(email)
  const safePassword = escapeHtml(password)
  const safeLogin = escapeHtml(loginUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f1eb;font-family:Inter,Segoe UI,sans-serif;color:#152238;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1eb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e0d4;box-shadow:0 12px 32px rgba(21,34,56,0.08);">
        <tr><td style="background:linear-gradient(135deg,#152238,#1e3a5f);padding:28px 32px;">
          <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#d4a017;font-weight:700;">BatasMo</p>
          <h1 style="margin:10px 0 0;font-size:22px;color:#ffffff;font-weight:800;">Welcome, ${safeName}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
            Your email has been registered as an <strong>Attorney</strong> on BatasMo. Use the credentials below to sign in.
          </p>
          <table role="presentation" width="100%" style="background:#f8f6f2;border:1px solid #e8e0d4;border-radius:10px;margin:0 0 20px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:700;">Login email</p>
              <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#152238;">${safeEmail}</p>
              <p style="margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:700;">Password</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#152238;font-family:ui-monospace,Menlo,monospace;">${safePassword}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#64748b;">
            For security, change your password after your first login if your admin allows it.
          </p>
          <a href="${safeLogin}" style="display:inline-block;background:#152238;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;">Sign in to BatasMo</a>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #e8e0d4;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
            If you did not expect this account, contact your BatasMo administrator.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const buildAttorneyWelcomeText = ({ fullName, email, password, loginUrl }) =>
  [
    `Welcome to BatasMo, ${fullName || 'Attorney'}!`,
    '',
    'Your account has been created as an Attorney.',
    '',
    `Login email: ${email}`,
    `Password: ${password}`,
    '',
    `Sign in: ${loginUrl}`,
    '',
    'Please change your password after first login when possible.',
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
export async function sendAttorneyWelcomeEmail({
  email,
  fullName,
  password,
  loginUrl,
}) {
  const to = String(email || '').trim().toLowerCase()
  const safePassword = String(password || '')
  if (!to || !safePassword) {
    return { sent: false, error: 'Missing email or password.' }
  }

  if (!isWelcomeEmailConfigured()) {
    console.warn('[welcome-email] not configured — set RESEND_API_KEY or SMTP_* in backend env')
    return { sent: false, skipped: true, error: 'Email service is not configured on the server.' }
  }

  const subject = 'Welcome to BatasMo — your attorney account'
  const resolvedLoginUrl = loginUrl || APP_LOGIN_URL || 'https://batasmo-web.vercel.app/login'
  const html = buildAttorneyWelcomeHtml({
    fullName,
    email: to,
    password: safePassword,
    loginUrl: resolvedLoginUrl,
  })
  const text = buildAttorneyWelcomeText({
    fullName,
    email: to,
    password: safePassword,
    loginUrl: resolvedLoginUrl,
  })

  try {
    if (RESEND_API_KEY) {
      await sendViaResend({ to, subject, html, text })
    } else {
      await sendViaSmtp({ to, subject, html, text })
    }
    return { sent: true }
  } catch (error) {
    console.error('[welcome-email] send failed', error?.message || error)
    return { sent: false, error: error?.message || 'Failed to send welcome email.' }
  }
}
