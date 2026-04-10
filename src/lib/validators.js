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

export function isStrongPassword(value) {
  const password = String(value || '');
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
}
