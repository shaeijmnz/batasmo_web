export const VALID_EMAIL_MESSAGE = 'Please enter a valid email address (example: name@domain.com).';
export const VALID_PHONE_MESSAGE = 'Please enter a valid contact number.';
export const VALID_PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.';

export function isValidEmail(value) {
  const email = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email);
}

export function isValidPhoneNumber(value) {
  const phone = String(value || '').trim();
  return /^\d{11}$/.test(phone);
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
