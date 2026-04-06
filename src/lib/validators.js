export const VALID_EMAIL_MESSAGE = 'Please enter valid email (must have @, .com, .edu, etc.).';
export const VALID_PHONE_MESSAGE = 'Please enter valid number.';

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
