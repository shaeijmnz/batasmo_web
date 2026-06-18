/** Render backend used by the live Vercel site when env vars are not set at build time. */
export const DEFAULT_PRODUCTION_API_URL = 'https://batasmo-web.onrender.com'

/** PayMongo / signup / chatbot backend base URL for the React app. */
export function resolvePublicApiBaseUrl() {
  const raw =
    process.env.REACT_APP_PAYMENT_API_URL ||
    process.env.REACT_APP_CHATBOT_API_URL ||
    (process.env.NODE_ENV === 'production' ? DEFAULT_PRODUCTION_API_URL : 'http://localhost:4000')
  return String(raw || '').trim().replace(/\/+$/, '')
}
