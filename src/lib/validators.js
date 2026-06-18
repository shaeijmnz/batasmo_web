export const VALID_EMAIL_MESSAGE = 'Please enter a valid email address (example: name@domain.com).';
export const GMAIL_REQUIRED_MESSAGE = 'Please enter a valid Gmail address ending with @gmail.com.';
export const VALID_PHONE_MESSAGE = 'Please enter a valid 11-digit Philippine mobile number (example: 09XXXXXXXXX).';
export const PH_MOBILE_REQUIRED_MESSAGE = VALID_PHONE_MESSAGE;
export const NUMBERS_ONLY_MESSAGE = 'Contact number must contain numbers only.';
export const VALID_PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.';

const GMAIL_SUFFIX = '@gmail.com';
const PH_MOBILE_PATTERN = /^09\d{9}$/;

export function isValidEmail(value) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email);
}

/** Client signup / walk-in: must be valid email and @gmail.com */
export function isGmailEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return isValidEmail(email) && email.endsWith(GMAIL_SUFFIX);
}

export function isValidPhoneNumber(value) {
  const phone = String(value || '').trim();
  return /^\d{11}$/.test(phone);
}

/** Philippine mobile: 11 digits starting with 09 */
export function isPhilippineMobile(value) {
  return PH_MOBILE_PATTERN.test(String(value || '').trim());
}

export function sanitizePhoneInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

/** Mask 11-digit PH mobile for display (09******12). */
export function maskPhilippinePhone(value) {
  const d = String(value || '').replace(/\D/g, '');
  if (d.length < 4) return 'your mobile number';
  if (d.length === 11) {
    return `${d.slice(0, 2)}******${d.slice(-2)}`;
  }
  return `${d.slice(0, 3)}***${d.slice(-2)}`;
}

export function isStrongPassword(value) {
  const password = String(value || '');
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
}

/** Live checklist aligned with `isStrongPassword` (order: length, lower, upper, digit, symbol). */
export function getPasswordRuleChecks(value) {
  const s = String(value || '');
  return [
    { ok: s.length >= 8, text: 'At least 8 characters' },
    { ok: /[a-z]/.test(s), text: 'One lowercase letter' },
    { ok: /[A-Z]/.test(s), text: 'One uppercase letter' },
    { ok: /\d/.test(s), text: 'One number' },
    { ok: /[^A-Za-z\d]/.test(s), text: 'One symbol' },
  ];
}

export function normalizeAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/** User-facing login error (client, admin, attorney share Login.js). */
export function mapLoginErrorMessage(error) {
  const raw = String(error?.message || error || '').trim();
  if (!raw) return 'Login failed. Please try again.';
  if (raw.startsWith('LOCKOUT:')) return raw;

  const normalized = raw.toLowerCase();
  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid email or password') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('wrong password') ||
    normalized.includes('incorrect password')
  ) {
    return 'Incorrect password.';
  }
  if (normalized.includes('user not found')) {
    return 'Incorrect password.';
  }
  if (normalized.includes('email not confirmed') || normalized.includes('email not verified')) {
    return raw;
  }
  if (normalized.includes('too many requests') || normalized.includes('rate limit')) {
    return 'Too many login attempts. Please wait a moment and try again.';
  }
  if (
    normalized === 'load failed' ||
    normalized === 'failed to fetch' ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('cannot reach the batasmo database')
  ) {
    return 'Cannot connect to BatasMo servers. The database may be offline — restore Supabase and redeploy Vercel with updated environment variables.';
  }
  return raw;
}

export function formatLockoutMessage(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  const clock = `${min}:${sec < 10 ? '0' : ''}${sec}`;
  return `Too many failed attempts. Account locked. Try again in ${clock}.`;
}
