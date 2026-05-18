import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'
import jwt from 'jsonwebtoken'
import { isWelcomeEmailConfigured, sendAttorneyWelcomeEmail } from './lib/welcomeEmail.js'
import { isSignupOtpEmailConfigured } from './lib/signupOtpEmail.js'
import { dispatchSignupEmailOtp } from './lib/signupOtpDispatch.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000'
const ALLOWED_ORIGIN_BASE = String(ALLOWED_ORIGIN).trim().replace(/\/+$/, '')
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const PAYMONGO_SECRET_KEY = String(process.env.PAYMONGO_SECRET_KEY || '').trim()
const AZURE_FACE_KEY = String(process.env.AZURE_FACE_KEY || '').trim()
const AZURE_FACE_ENDPOINT = String(process.env.AZURE_FACE_ENDPOINT || '').trim().replace(/\/+$/, '')
/** Face++ (Megvii) — no Azure subscription needed. https://console.faceplusplus.com */
const FACEPLUS_API_KEY = String(process.env.FACEPLUS_API_KEY || '').trim()
const FACEPLUS_API_SECRET = String(process.env.FACEPLUS_API_SECRET || '').trim()
const FACEPLUS_API_BASE = String(process.env.FACEPLUS_API_BASE || 'https://api-us.faceplusplus.com')
  .trim()
  .replace(/\/+$/, '')
// Root URL avoids deep-link + auth race (PayMongo "back to merchant" should land on client home, not login).
const PAYMENT_SUCCESS_URL = String(process.env.PAYMENT_SUCCESS_URL || `${ALLOWED_ORIGIN_BASE}/`).trim()
const PAYMENT_CANCEL_URL = String(process.env.PAYMENT_CANCEL_URL || `${ALLOWED_ORIGIN_BASE}/my-appointments`).trim()
const GEMINI_MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
]
const RAW_CHATBOT_PROVIDER_MODE = String(process.env.CHATBOT_PROVIDER_MODE || 'auto').toLowerCase()
const CHATBOT_PROVIDER_MODE =
  RAW_CHATBOT_PROVIDER_MODE === 'free' || RAW_CHATBOT_PROVIDER_MODE === 'auto'
    ? RAW_CHATBOT_PROVIDER_MODE
    : 'auto'

const INTENT_KEYWORDS = {
  booking: ['book', 'booking', 'appointment', 'consultation', 'schedule', 'magbook', 'book consultation', 'konsulta'],
  notarial: ['notary', 'notarial', 'notarize', 'affidavit', 'pa notaryo', 'panotaryo'],
  payment: ['payment', 'paid', 'unpaid', 'transaction', 'receipt', 'bayad', 'magbayad'],
  pricing: ['how much', 'price', 'pricing', 'fee', 'cost', 'magkano', 'bayarin'],
}

const LEGAL_RISK_KEYWORDS = [
  'punch',
  'hit someone',
  'slap',
  'assault',
  'battery',
  'makulong',
  'kaso',
  'criminal case',
  'manuntok',
  'nanuntok',
  'sinuntok',
]

const TAGALOG_HINT_WORDS = [
  'ano',
  'paano',
  'magkano',
  'kailangan',
  'pwede',
  'hindi',
  'kung',
  'saan',
  'bakit',
  'konsulta',
  'notaryo',
  'bayad',
  'oras',
]

const hasGeminiKey = Boolean(String(GEMINI_API_KEY || '').trim())
const effectiveProviderMode =
  CHATBOT_PROVIDER_MODE === 'auto' && !hasGeminiKey ? 'free' : CHATBOT_PROVIDER_MODE

if (CHATBOT_PROVIDER_MODE === 'auto' && !hasGeminiKey) {
  console.warn('[chatbot] GEMINI_API_KEY not set; switching provider mode from auto to free')
}

const genAI = hasGeminiKey ? new GoogleGenerativeAI(GEMINI_API_KEY) : null

const sendMessageWithModelRetry = async ({ userMessage, conversationHistory }) => {
  if (!genAI) {
    throw new Error('Gemini client unavailable: GEMINI_API_KEY is missing')
  }

  let lastError = null

  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const chat = model.startChat({
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
        systemInstruction: SYSTEM_PROMPT,
        history: conversationHistory,
      })

      const result = await chat.sendMessage(userMessage)
      return {
        modelName,
        aiRawResponse: result.response.text(),
      }
    } catch (error) {
      lastError = error
      console.warn(`[chatbot] Model ${modelName} failed:`, error?.message || error)
    }
  }

  throw lastError || new Error('All Gemini model candidates failed')
}

const buildProviderFailureReply = (error) => {
  const details = String(error?.message || '')
  const lowered = details.toLowerCase()

  if (lowered.includes('429') || lowered.includes('quota')) {
    return {
      intent: 'provider_error',
      reply:
        'Gemini is connected but your current API key/project quota is exhausted or not enabled yet. Please enable billing or use a key/project with available Gemini quota, then try again.',
      actions: [],
      source: 'gemini-error',
      errorCode: 'quota_exceeded',
    }
  }

  if (lowered.includes('503') || lowered.includes('high demand')) {
    return {
      intent: 'provider_error',
      reply:
        'Gemini 2.5 is currently experiencing high demand. Please retry in a minute, or we can switch to a less busy Gemini model for now.',
      actions: [],
      source: 'gemini-error',
      errorCode: 'service_unavailable',
    }
  }

  return {
    intent: 'provider_error',
    reply:
      'Gemini is connected but temporarily unavailable right now. Please try again shortly.',
    actions: [],
    source: 'gemini-error',
    errorCode: 'unknown_provider_error',
  }
}

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const detectLanguage = (message) => {
  const text = normalizeText(message)
  if (!text) return 'en'

  const tagalogHits = TAGALOG_HINT_WORDS.filter((word) => text.includes(word)).length
  return tagalogHits >= 1 ? 'tl' : 'en'
}

const normalizeSpaces = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const truncateText = (value, max = 520) => {
  const text = normalizeSpaces(value)
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}...`
}

const extractMathExpression = (message) => {
  const raw = String(message || '').toLowerCase().trim()
  if (!raw) return null

  const stripped = raw
    .replace(/what\s+is/gi, '')
    .replace(/calculate/gi, '')
    .replace(/solve/gi, '')
    .replace(/ano\s+ang/gi, '')
    .replace(/magkano\s+ang/gi, '')
    .replace(/ilan\s+ang/gi, '')
    .replace(/equals?/gi, '')
    .replace(/is/gi, '')
    .replace(/ay/gi, '')
    .replace(/[?=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const candidate = stripped.replace(/x/g, '*').replace(/÷/g, '/').replace(/×/g, '*')
  if (!candidate) return null

  // Strictly allow only numeric arithmetic characters.
  if (!/^[0-9+\-*/().\s]+$/.test(candidate)) {
    return null
  }

  // Must contain at least one operator and one digit.
  if (!/[+\-*/]/.test(candidate) || !/[0-9]/.test(candidate)) {
    return null
  }

  return candidate
}

const computeSimpleMath = (message, language = 'en') => {
  const expression = extractMathExpression(message)
  if (!expression) return null

  try {
    const value = Function(`"use strict"; return (${expression});`)()
    if (!Number.isFinite(value)) return null

    const displayValue = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)))
    return {
      intent: 'general',
      reply:
        language === 'tl'
          ? `Ang sagot sa ${expression} ay ${displayValue}.`
          : `${expression} = ${displayValue}`,
      actions: [],
      source: 'free-logic',
    }
  } catch {
    return null
  }
}

const isNoisySnippet = (value) => {
  const text = normalizeText(value)
  return text.includes('changelog') || text.includes('wikipedia may refer to')
}

const isLegalRiskQuestion = (message) => {
  const text = normalizeText(message)
  return LEGAL_RISK_KEYWORDS.some((word) => text.includes(word))
}

const buildLegalRiskReply = (language = 'en') => {
  if (language === 'tl') {
    return {
      intent: 'legal',
      reply:
        'Sa maraming lugar, ang pananakit o panununtok ay maaaring pumasok sa assault o battery. Posibleng kahihinatnan nito ang kasong kriminal, multa, pagkakakulong, at civil liability para sa danyos. Depende ang parusa sa ebidensya, tindi ng pinsala, at lokal na batas. Kung totoong sitwasyon ito, kumonsulta sa lisensyadong abogado para sa tamang legal advice.',
      actions: [{ label: 'Mag-book ng consultation', page: 'book-appointment' }],
      source: 'legal-general',
    }
  }

  return {
    intent: 'legal',
    reply:
      'In many places, punching someone can be treated as assault or battery. Possible consequences include criminal charges, fines, jail time, and civil liability for damages. Penalties depend on injuries, evidence, and local law. If this is a real situation, consult a licensed attorney for advice specific to your case.',
    actions: [{ label: 'Book consultation', page: 'book-appointment' }],
    source: 'legal-general',
  }
}

const detectBatasMoIntent = (message) => {
  const text = normalizeText(message)
  if (!text) return 'general'

  if (INTENT_KEYWORDS.pricing.some((word) => text.includes(word))) return 'pricing'
  if (INTENT_KEYWORDS.booking.some((word) => text.includes(word))) return 'booking'
  if (INTENT_KEYWORDS.notarial.some((word) => text.includes(word))) return 'notarial'
  if (INTENT_KEYWORDS.payment.some((word) => text.includes(word))) return 'payment'

  return 'general'
}

const buildBatasMoIntentReply = (intent, language = 'en') => {
  if (intent === 'pricing') {
    if (language === 'tl') {
      return {
        intent: 'pricing',
        reply:
          'Ang consultation at notarial fees sa BatasMo ay maaaring mag-iba depende sa abogado, uri ng serbisyo, at schedule. Buksan ang Book Consultation para makita ang available na attorneys at rates bago mag-confirm.',
        actions: [
          { label: 'Mag-book ng consultation', page: 'book-appointment' },
          { label: 'Transaction history', page: 'transaction-history' },
        ],
        source: 'batasmo-intent',
      }
    }

    return {
      intent: 'pricing',
      reply:
        'Consultation and notarial fees in BatasMo can vary by attorney, service type, and schedule. Open Book Consultation to check available attorneys and rates, then confirm the final amount before booking.',
      actions: [
        { label: 'Book consultation', page: 'book-appointment' },
        { label: 'Transaction history', page: 'transaction-history' },
      ],
      source: 'batasmo-intent',
    }
  }

  if (intent === 'booking') {
    if (language === 'tl') {
      return {
        intent: 'booking',
        reply:
          'Para mag-book ng consultation sa BatasMo, pumunta sa Book Consultation, pumili ng abogado, pumili ng available na slot, at i-confirm ang request.',
        actions: [{ label: 'Mag-book ng consultation', page: 'book-appointment' }],
        source: 'batasmo-intent',
      }
    }

    return {
      intent: 'booking',
      reply:
        'To book a consultation in BatasMo, go to Book Consultation, choose an attorney, pick an available slot, then confirm your request.',
      actions: [{ label: 'Book consultation', page: 'book-appointment' }],
      source: 'batasmo-intent',
    }
  }

  if (intent === 'notarial') {
    if (language === 'tl') {
      return {
        intent: 'notarial',
        reply:
          'Para sa notarial request, buksan ang Notarial Request, ilagay ang detalye ng dokumento, at i-submit. Ire-review ito ng assigned attorney at ia-update ang status mo.',
        actions: [{ label: 'Notarial request', page: 'notarial-request' }],
        source: 'batasmo-intent',
      }
    }

    return {
      intent: 'notarial',
      reply:
        'For notarial requests, open Notarial Request, provide your document details, and submit. The assigned attorney will review and update your status.',
      actions: [{ label: 'Notarial request', page: 'notarial-request' }],
      source: 'batasmo-intent',
    }
  }

  if (intent === 'payment') {
    if (language === 'tl') {
      return {
        intent: 'payment',
        reply:
          'Para sa payment at transaction concerns, buksan ang Transaction History para makita ang paid at unpaid items at ma-verify ang status ng consultation payment.',
        actions: [{ label: 'Transaction history', page: 'transaction-history' }],
        source: 'batasmo-intent',
      }
    }

    return {
      intent: 'payment',
      reply:
        'For payment and transaction concerns, open Transaction History to review paid and unpaid items and verify your consultation payment status.',
      actions: [{ label: 'Transaction history', page: 'transaction-history' }],
      source: 'batasmo-intent',
    }
  }

  return null
}

const fetchDuckDuckGoAnswer = async (message) => {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
    message
  )}&format=json&no_html=1&skip_disambig=1`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`DuckDuckGo API error (${response.status})`)
  }

  const data = await response.json()
  if (data?.AbstractText) {
    return data.AbstractText
  }

  if (Array.isArray(data?.RelatedTopics) && data.RelatedTopics.length > 0) {
    const first = data.RelatedTopics.find((item) => typeof item?.Text === 'string')
    if (first?.Text) {
      return first.Text
    }
  }

  return null
}

const rewriteSearchQuery = (message) => {
  const text = normalizeText(message)
  if (text.includes('punch') || text.includes('assault') || text.includes('hit someone')) {
    return 'legal consequences of assault and battery'
  }
  return message
}

const fetchWikipediaSummary = async (message) => {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      message
    )}&limit=1&namespace=0&format=json`

    const searchResponse = await fetch(searchUrl)
    if (!searchResponse.ok) return null

    const searchData = await searchResponse.json()
    const title = Array.isArray(searchData?.[1]) ? searchData[1][0] : null
    if (!title) return null

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title
    )}`
    const summaryResponse = await fetch(summaryUrl)
    if (!summaryResponse.ok) return null

    const summaryData = await summaryResponse.json()
    if (typeof summaryData?.extract === 'string' && summaryData.extract.trim()) {
      return summaryData.extract.trim()
    }
    return null
  } catch {
    return null
  }
}

const runFreeAssistant = async (message) => {
  const language = detectLanguage(message)
  const intent = detectBatasMoIntent(message)
  const actionReply = buildBatasMoIntentReply(intent, language)
  if (actionReply) {
    return actionReply
  }

  const mathReply = computeSimpleMath(message, language)
  if (mathReply) {
    return mathReply
  }

  if (isLegalRiskQuestion(message)) {
    return buildLegalRiskReply(language)
  }

  const [wikiAnswer, ddgAnswer] = await Promise.all([
    fetchWikipediaSummary(message),
    fetchDuckDuckGoAnswer(message),
  ])

  if (wikiAnswer && !isNoisySnippet(wikiAnswer)) {
    return {
      intent: 'general',
      reply: truncateText(wikiAnswer, 520),
      actions: [],
      source: 'free-web',
    }
  }

  if (ddgAnswer && !isNoisySnippet(ddgAnswer)) {
    return {
      intent: 'general',
      reply: truncateText(ddgAnswer, 520),
      actions: [],
      source: 'free-web',
    }
  }

  return {
    intent: 'general',
    reply:
      language === 'tl'
        ? 'Makakatulong ako sa general questions, pero wala akong mahanap na reliable na web answer ngayon. Paki-rephrase ang tanong mo.'
        : 'I can help with general questions, but I could not find a reliable web answer right now. Please try rephrasing your question.',
    actions: [],
    source: 'free-web',
  }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
  })
)

app.use(express.json({ limit: '10mb' }))

// ============================================================================
// PAYMENT HELPERS (PAYMONGO + SUPABASE)
// ============================================================================

const normalizePaymentMethod = (method) => {
  const normalized = String(method || '').trim().toLowerCase()
  return normalized === 'maya' ? 'paymaya' : normalized
}

const isPaymentMethodSupported = (method) => {
  const normalized = normalizePaymentMethod(method)
  return normalized === 'gcash' || normalized === 'paymaya' || normalized === 'qrph'
}

const requirePaymentConfig = () => {
  if (!PAYMONGO_SECRET_KEY) {
    throw new Error('PAYMONGO_SECRET_KEY is not configured.')
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are not configured.')
  }
}

const requireSupabaseServiceConfig = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are not configured.')
  }
}

const supabaseRestHeaders = () => ({
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

const paymongoAuthHeader = () =>
  `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64')}`

const mapPaymongoToInternalStatus = (attributes = {}) => {
  const checkoutStatus = String(attributes?.payment_intent?.attributes?.status || '').toLowerCase()
  if (checkoutStatus === 'succeeded') return 'paid'
  if (checkoutStatus === 'awaiting_next_action' || checkoutStatus === 'awaiting_payment_method') return 'pending'
  if (checkoutStatus === 'processing') return 'pending'
  if (checkoutStatus === 'canceled' || checkoutStatus === 'cancelled') return 'failed'

  const sessionPayments = Array.isArray(attributes?.payments) ? attributes.payments : []
  for (const p of sessionPayments) {
    const st = String(p?.attributes?.status || '').toLowerCase()
    if (st === 'paid' || st === 'succeeded') return 'paid'
    if (st === 'failed') return 'failed'
  }

  const intentPayments = Array.isArray(attributes?.payment_intent?.attributes?.payments)
    ? attributes.payment_intent.attributes.payments
    : []
  for (const p of intentPayments) {
    const st = String(p?.attributes?.status || '').toLowerCase()
    if (st === 'paid' || st === 'succeeded') return 'paid'
    if (st === 'failed') return 'failed'
  }

  const firstPaymentStatus = String(sessionPayments[0]?.attributes?.status || '').toLowerCase()
  if (firstPaymentStatus === 'pending') return 'pending'

  return 'pending'
}

const supabaseSelectSingle = async ({ table, query }) => {
  const endpoint = `${SUPABASE_URL}/rest/v1/${table}?${query}&select=*`
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: supabaseRestHeaders(),
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Supabase select failed (${response.status})`)
  }
  return Array.isArray(payload) ? payload[0] || null : null
}

const supabaseInsertTransaction = async ({
  appointmentId,
  clientId,
  attorneyId,
  amount,
  paymentMethod,
}) => {
  const endpoint = `${SUPABASE_URL}/rest/v1/transactions`
  const body = {
    appointment_id: appointmentId,
    client_id: clientId,
    attorney_id: attorneyId,
    amount: Number(amount || 0),
    currency: 'PHP',
    payment_status: 'pending',
    payment_method: paymentMethod,
    provider_reference: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: supabaseRestHeaders(),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(payload) || !payload[0]?.id) {
    throw new Error(payload?.message || payload?.error || `Failed to create pending transaction (${response.status})`)
  }
  return payload[0]
}

const supabaseUpdateTransactionStatus = async ({ transactionId, paymentStatus, providerReference }) => {
  const query = new URLSearchParams({ id: `eq.${transactionId}` }).toString()
  const endpoint = `${SUPABASE_URL}/rest/v1/transactions?${query}`
  const body = {
    payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  }
  if (providerReference) {
    body.provider_reference = providerReference
  }

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: supabaseRestHeaders(),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Failed to update transaction (${response.status})`)
  }
  return Array.isArray(payload) ? payload[0] || null : null
}

const supabaseConfirmAppointment = async ({ appointmentId }) => {
  const query = new URLSearchParams({ id: `eq.${appointmentId}` }).toString()
  const endpoint = `${SUPABASE_URL}/rest/v1/appointments?${query}`
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: supabaseRestHeaders(),
    body: JSON.stringify({
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Failed to confirm appointment (${response.status})`)
  }
}

const toTwoDigits = (n) => String(Number(n) || 0).padStart(2, '0')

const parseSlotDateTimeNode = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null
  const rawTime = String(timeValue).trim()
  const ampmMatch = rawTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampmMatch) {
    let hour = Number(ampmMatch[1])
    const minute = Number(ampmMatch[2])
    const meridiem = ampmMatch[3].toUpperCase()
    if (meridiem === 'PM' && hour < 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    const parsed = new Date(`${dateValue}T${toTwoDigits(hour)}:${toTwoDigits(minute)}:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const m24 = rawTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!m24) return null
  const hour = Number(m24[1])
  const minute = Number(m24[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }
  const parsed = new Date(`${dateValue}T${toTwoDigits(hour)}:${toTwoDigits(minute)}:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const supabaseRestGetMany = async ({ table, query }) => {
  const endpoint = `${SUPABASE_URL}/rest/v1/${table}?${query}&select=*`
  const response = await fetch(endpoint, { method: 'GET', headers: supabaseRestHeaders() })
  const payload = await response.json().catch(() => [])
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Supabase list ${table} failed (${response.status})`)
  }
  return Array.isArray(payload) ? payload : []
}

const supabaseRestPatch = async ({ table, query, body }) => {
  const endpoint = `${SUPABASE_URL}/rest/v1/${table}?${query}`
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: supabaseRestHeaders(),
    body: JSON.stringify(body),
  })
  if (response.status === 204) {
    return null
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Supabase patch ${table} failed (${response.status})`)
  }
  return payload
}

const resolveNewScheduledFromSlotRow = (slot) => {
  if (!slot) return null
  if (slot.date && slot.time) {
    return parseSlotDateTimeNode(slot.date, slot.time)
  }
  if (slot.start_time) {
    const d = new Date(slot.start_time)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const verifySupabaseUserJwt = async (jwt) => {
  if (!jwt || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing auth token or Supabase configuration.')
  }
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || 'Invalid or expired session.')
  }
  if (!payload?.id) throw new Error('Invalid session user.')
  return payload
}

const verifyCallerIsAdmin = async (jwt) => {
  const user = await verifySupabaseUserJwt(jwt)
  const profile = await supabaseSelectSingle({
    table: 'profiles',
    query: new URLSearchParams({ id: `eq.${user.id}` }).toString(),
  })
  const role = String(profile?.role || '').toLowerCase()
  if (role !== 'admin') {
    throw new Error('Only Admin users can perform this action.')
  }
  return user.id
}

const WALK_IN_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

const isValidEmailAddress = (email) =>
  /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(email || '').trim())

const isGmailAddress = (email) => {
  const normalized = String(email || '').trim().toLowerCase()
  return isValidEmailAddress(normalized) && normalized.endsWith('@gmail.com')
}

const isStrongAccountPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(String(password || ''))

const generateWalkInPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*'
  const pool = upper + lower + digits + symbols
  const pick = (chars) => chars[crypto.randomInt(chars.length)]
  const bytes = crypto.randomBytes(8)
  const rest = Array.from(bytes, (b) => pool[b % pool.length]).join('')
  return `${pick(upper)}${pick(lower)}${pick(digits)}${pick(symbols)}${rest}`
}

/**
 * Create a Supabase Auth user (email pre-confirmed) + Client profile — walk-in registration.
 * Password is optional: when omitted, the system generates one and flags must_change_password.
 */
const supabaseAdminCreateWalkInClient = async ({ email, password, fullName }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  let safePassword = String(password || '').trim()
  const displayName = String(fullName || '').trim() || 'Walk-in Client'
  let passwordWasGenerated = false

  if (!isGmailAddress(normalizedEmail)) {
    throw new Error('A valid Gmail address ending with @gmail.com is required.')
  }
  if (!safePassword) {
    safePassword = generateWalkInPassword()
    passwordWasGenerated = true
  } else if (!passwordWasGenerated && !isStrongAccountPassword(safePassword)) {
    throw new Error(
      'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.',
    )
  }

  const userMetadata = {
    full_name: displayName,
    role: 'Client',
  }
  if (passwordWasGenerated) {
    userMetadata.must_change_password = true
  }

  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: normalizedEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: userMetadata,
    }),
  })

  const authPayload = await authResponse.json().catch(() => null)
  if (!authResponse.ok) {
    const msg =
      authPayload?.msg ||
      authPayload?.message ||
      authPayload?.error_description ||
      authPayload?.error ||
      `Failed to create account (${authResponse.status}).`
    throw new Error(String(msg))
  }

  const userId = authPayload?.id || authPayload?.user?.id
  if (!userId) {
    throw new Error('Account was created but no user id was returned.')
  }

  const nowIso = new Date().toISOString()
  const profileBody = {
    id: userId,
    email: normalizedEmail,
    full_name: displayName,
    role: 'Client',
    preferred_otp_channel: 'email',
    created_at: nowIso,
    updated_at: nowIso,
  }

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...supabaseRestHeaders(),
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(profileBody),
  })

  const profilePayload = await profileRes.json().catch(() => null)
  if (!profileRes.ok) {
    console.warn('[admin walk-in] profile upsert failed', profilePayload)
    throw new Error(
      profilePayload?.message ||
        profilePayload?.error ||
        'User was created but saving the client profile failed. Check Supabase logs.',
    )
  }

  return {
    userId,
    email: normalizedEmail,
    fullName: displayName,
    generatedPassword: passwordWasGenerated ? safePassword : undefined,
    mustChangePassword: passwordWasGenerated,
  }
}

/**
 * Create a Supabase Auth user (email pre-confirmed) + Attorney profile rows.
 */
const supabaseAdminCreateWalkInAttorney = async ({ email, password, fullName, specialty }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const safePassword = String(password || '')
  const displayName = String(fullName || '').trim() || 'Attorney'
  const specialtyRaw = String(specialty || '').trim()

  if (!isValidEmailAddress(normalizedEmail)) {
    throw new Error('A valid email address is required.')
  }
  if (!isStrongAccountPassword(safePassword)) {
    throw new Error(
      'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.',
    )
  }
  if (!String(fullName || '').trim()) {
    throw new Error('Attorney name is required.')
  }

  const specialties = specialtyRaw
    ? specialtyRaw.split(',').map((part) => part.trim()).filter(Boolean)
    : ['General Practice']

  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: normalizedEmail,
      password: safePassword,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        role: 'Attorney',
      },
    }),
  })

  const authPayload = await authResponse.json().catch(() => null)
  if (!authResponse.ok) {
    const msg =
      authPayload?.msg ||
      authPayload?.message ||
      authPayload?.error_description ||
      authPayload?.error ||
      `Failed to create account (${authResponse.status}).`
    throw new Error(String(msg))
  }

  const userId = authPayload?.id || authPayload?.user?.id
  if (!userId) {
    throw new Error('Account was created but no user id was returned.')
  }

  const nowIso = new Date().toISOString()
  const profileBody = {
    id: userId,
    email: normalizedEmail,
    full_name: displayName,
    role: 'Attorney',
    preferred_otp_channel: 'email',
    created_at: nowIso,
    updated_at: nowIso,
  }

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...supabaseRestHeaders(),
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(profileBody),
  })

  const profilePayload = await profileRes.json().catch(() => null)
  if (!profileRes.ok) {
    console.warn('[admin walk-in attorney] profile upsert failed', profilePayload)
    throw new Error(
      profilePayload?.message ||
        profilePayload?.error ||
        'User was created but saving the attorney profile failed. Check Supabase logs.',
    )
  }

  const attorneyProfileBody = {
    user_id: userId,
    specialties,
    years_experience: 0,
    consultation_fee: 2000,
    bio: '',
    is_verified: true,
    prc_id: `PRC-${String(userId).slice(0, 8).toUpperCase()}`,
    updated_at: nowIso,
  }

  const attorneyProfileRes = await fetch(`${SUPABASE_URL}/rest/v1/attorney_profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      ...supabaseRestHeaders(),
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(attorneyProfileBody),
  })

  const attorneyProfilePayload = await attorneyProfileRes.json().catch(() => null)
  if (!attorneyProfileRes.ok) {
    console.warn('[admin walk-in attorney] attorney_profiles upsert failed', attorneyProfilePayload)
    throw new Error(
      attorneyProfilePayload?.message ||
        attorneyProfilePayload?.error ||
        'User was created but saving attorney details failed. Check Supabase logs.',
    )
  }

  return {
    userId,
    email: normalizedEmail,
    fullName: displayName,
    specialties,
    password: safePassword,
  }
}

/**
 * Admin reschedule using the service role (bypasses RLS on appointments / slots).
 */
const supabaseAdminRescheduleConsultation = async ({ appointmentId, newSlotId }) => {
  const appt = await supabaseSelectSingle({
    table: 'appointments',
    query: new URLSearchParams({ id: `eq.${appointmentId}` }).toString(),
  })
  if (!appt) throw new Error('Appointment not found.')

  // Enforce "at least 1 day before" — reschedules cannot happen on the same
  // calendar day as the consultation (Asia/Manila).
  if (appt.scheduled_at) {
    const schedDate = new Date(appt.scheduled_at)
    if (!Number.isNaN(schedDate.getTime())) {
      try {
        const phDateKey = (d) =>
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(d)
        const todayKey = phDateKey(new Date())
        const consultationKey = phDateKey(schedDate)
        if (consultationKey <= todayKey) {
          throw new Error(
            'Reschedule must be done at least 1 day before the consultation date — same-day reschedules are not allowed.',
          )
        }
      } catch (e) {
        if (e?.message && e.message.includes('Reschedule must be done')) throw e
        // Intl failure — fall back to a 24h check just to be safe.
        if (schedDate.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
          throw new Error(
            'Reschedule must be done at least 1 day before the consultation date — same-day reschedules are not allowed.',
          )
        }
      }
    }
  }

  const newSlot = await supabaseSelectSingle({
    table: 'availability_slots',
    query: new URLSearchParams({ id: `eq.${newSlotId}` }).toString(),
  })
  if (!newSlot) throw new Error('Selected slot no longer exists.')
  if (newSlot.is_booked) throw new Error('Selected slot is already booked.')
  if (appt.attorney_id && newSlot.attorney_id && appt.attorney_id !== newSlot.attorney_id) {
    throw new Error('Selected slot belongs to a different attorney than this appointment.')
  }

  const parsedStart = resolveNewScheduledFromSlotRow(newSlot)
  if (!parsedStart) throw new Error('Selected slot has invalid date/time.')
  const newScheduledIso = parsedStart.toISOString()
  const nowIso = new Date().toISOString()

  let oldSlotIdToFree = appt.slot_id || null
  if (!oldSlotIdToFree && appt.attorney_id && appt.slot_date && appt.slot_time) {
    const candidates = await supabaseRestGetMany({
      table: 'availability_slots',
      query: new URLSearchParams({
        attorney_id: `eq.${appt.attorney_id}`,
        date: `eq.${appt.slot_date}`,
      }).toString(),
    })
    const targetMs = parseSlotDateTimeNode(appt.slot_date, appt.slot_time)?.getTime() || 0
    const match = candidates.find((row) => {
      const parsed = parseSlotDateTimeNode(appt.slot_date, row.time)
      return parsed && parsed.getTime() === targetMs
    })
    oldSlotIdToFree = match?.id || null
  }

  if (oldSlotIdToFree && oldSlotIdToFree !== newSlot.id) {
    try {
      await supabaseRestPatch({
        table: 'availability_slots',
        query: new URLSearchParams({ id: `eq.${oldSlotIdToFree}` }).toString(),
        body: { is_booked: false, updated_at: nowIso },
      })
    } catch (e) {
      console.warn('[admin-reschedule] free old slot failed', e?.message || e)
    }
  }

  await supabaseRestPatch({
    table: 'availability_slots',
    query: new URLSearchParams({ id: `eq.${newSlot.id}`, is_booked: 'eq.false' }).toString(),
    body: { is_booked: true, updated_at: nowIso },
  })

  const slotDate = newSlot.date || (newSlot.start_time ? newScheduledIso.slice(0, 10) : null)
  const slotTime =
    newSlot.time ||
    (newSlot.start_time
      ? (() => {
          const d = new Date(newSlot.start_time)
          const h = d.getHours()
          const m = d.getMinutes()
          const period = h >= 12 ? 'PM' : 'AM'
          const nh = h % 12 || 12
          return `${toTwoDigits(nh)}:${toTwoDigits(m)} ${period}`
        })()
      : null)

  const richUpdate = {
    scheduled_at: newScheduledIso,
    slot_id: newSlot.id,
    slot_date: slotDate,
    slot_time: slotTime,
    status: 'rescheduled',
    updated_at: nowIso,
  }

  try {
    await supabaseRestPatch({
      table: 'appointments',
      query: new URLSearchParams({ id: `eq.${appointmentId}` }).toString(),
      body: richUpdate,
    })
  } catch (e) {
    console.warn('[admin-reschedule] full appointment update failed, retrying minimal', e?.message || e)
    try {
      await supabaseRestPatch({
        table: 'appointments',
        query: new URLSearchParams({ id: `eq.${appointmentId}` }).toString(),
        body: {
          scheduled_at: newScheduledIso,
          status: 'rescheduled',
          updated_at: nowIso,
        },
      })
    } catch (e2) {
      await supabaseRestPatch({
        table: 'availability_slots',
        query: new URLSearchParams({ id: `eq.${newSlot.id}` }).toString(),
        body: { is_booked: false, updated_at: nowIso },
      })
      throw e2
    }
  }

  const whenLabel = parsedStart.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const clientName = await resolveClientDisplayNameForAbandon(appt.client_id)
  const marker = `[adminresched:${appointmentId}:${newScheduledIso.slice(0, 24)}]`

  if (appt.attorney_id) {
    await supabaseInsertNotification({
      userId: appt.attorney_id,
      title: 'Appointment rescheduled by Admin',
      body: `${clientName}'s ${appt.title || 'consultation'} was moved to ${whenLabel} by an admin.`,
      type: 'consultation',
    })
  }
  if (appt.client_id) {
    await supabaseInsertNotification({
      userId: appt.client_id,
      title: 'Your consultation was rescheduled',
      body: `Admin moved your ${appt.title || 'consultation'} to ${whenLabel}.`,
      type: 'reschedule',
    })
  }

  const admins = await supabaseRestGetMany({
    table: 'profiles',
    query: new URLSearchParams({ role: 'eq.Admin' }).toString(),
  })
  for (const row of admins) {
    if (!row?.id) continue
    try {
      await supabaseInsertNotification({
        userId: row.id,
        title: 'Admin reschedule recorded',
        body: `Appointment ${String(appointmentId).slice(0, 8)}… moved to ${whenLabel}. ${marker}`,
        type: 'admin_general',
      })
    } catch (e) {
      console.warn('[admin-reschedule] admin echo notify failed', row.id, e?.message || e)
    }
  }

  return { newScheduledIso, slotId: newSlot.id, whenLabel }
}

const resolveClientDisplayNameForAbandon = async (clientId) => {
  if (!clientId) return 'A client'
  try {
    const row = await supabaseSelectSingle({
      table: 'profiles',
      query: new URLSearchParams({ id: `eq.${clientId}` }).toString(),
    })
    return (
      String(row?.full_name || '').trim() ||
      String(row?.email || '').trim() ||
      'A client'
    )
  } catch {
    return 'A client'
  }
}

/**
 * Cancels a pending unpaid consultation using the service role (bypasses RLS).
 * Frees the slot, marks pending transactions as failed, and flips the attorney
 * notification to "Booking Cancelled".
 */
const supabaseAbandonPendingConsultation = async (appointmentId) => {
  if (!appointmentId) return { ok: false, reason: 'missing_id' }

  const appt = await supabaseSelectSingle({
    table: 'appointments',
    query: new URLSearchParams({ id: `eq.${appointmentId}` }).toString(),
  })
  if (!appt) return { ok: false, reason: 'appointment_not_found' }

  const st = String(appt.status || '').toLowerCase()
  if (st === 'cancelled' || st === 'completed') return { ok: true, reason: 'already_final' }

  const paidRows = await supabaseRestGetMany({
    table: 'transactions',
    query: new URLSearchParams({
      appointment_id: `eq.${appointmentId}`,
      payment_status: 'eq.paid',
    }).toString(),
  })
  if (paidRows.length > 0) return { ok: true, reason: 'already_paid' }

  if (st !== 'pending') return { ok: true, reason: 'not_pending_status' }

  const nowIso = new Date().toISOString()

  await supabaseRestPatch({
    table: 'appointments',
    query: new URLSearchParams({ id: `eq.${appointmentId}` }).toString(),
    body: { status: 'cancelled', updated_at: nowIso },
  })

  const pendingTxRows = await supabaseRestGetMany({
    table: 'transactions',
    query: new URLSearchParams({
      appointment_id: `eq.${appointmentId}`,
      payment_status: 'eq.pending',
    }).toString(),
  })
  for (const row of pendingTxRows) {
    if (!row?.id) continue
    try {
      await supabaseRestPatch({
        table: 'transactions',
        query: new URLSearchParams({ id: `eq.${row.id}` }).toString(),
        body: { payment_status: 'failed', updated_at: nowIso },
      })
    } catch (e) {
      console.warn('[payments] abandon: failed to mark transaction failed', row.id, e?.message || e)
    }
  }

  let slotIdToFree = appt.slot_id || null
  const attorneyId = appt.attorney_id
  const slotDate = appt.slot_date
  const slotTime = appt.slot_time

  if (!slotIdToFree && attorneyId && slotDate && slotTime) {
    try {
      const candidateSlots = await supabaseRestGetMany({
        table: 'availability_slots',
        query: new URLSearchParams({
          attorney_id: `eq.${attorneyId}`,
          date: `eq.${slotDate}`,
        }).toString(),
      })
      const targetParsed = parseSlotDateTimeNode(slotDate, slotTime)
      const targetMs = targetParsed?.getTime() || 0
      const matched = candidateSlots.find((slot) => {
        const slotParsed = parseSlotDateTimeNode(slotDate, slot?.time)
        return slotParsed && slotParsed.getTime() === targetMs
      })
      slotIdToFree = matched?.id || null
    } catch (e) {
      console.warn('[payments] abandon: slot candidate lookup failed', e?.message || e)
    }
  }

  if (slotIdToFree) {
    try {
      await supabaseRestPatch({
        table: 'availability_slots',
        query: new URLSearchParams({ id: `eq.${slotIdToFree}` }).toString(),
        body: { is_booked: false, updated_at: nowIso },
      })
    } catch (e) {
      console.warn('[payments] abandon: slot free by id failed', e?.message || e)
    }
  } else if (attorneyId && slotDate && slotTime) {
    try {
      await supabaseRestPatch({
        table: 'availability_slots',
        query: new URLSearchParams({
          attorney_id: `eq.${attorneyId}`,
          date: `eq.${slotDate}`,
          time: `eq.${slotTime}`,
        }).toString(),
        body: { is_booked: false, updated_at: nowIso },
      })
    } catch (e) {
      console.warn('[payments] abandon: slot free raw match failed', e?.message || e)
    }
  }

  if (attorneyId) {
    try {
      const clientName = await resolveClientDisplayNameForAbandon(appt.client_id)
      const whenLabel = appt.scheduled_at
        ? new Date(appt.scheduled_at).toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'the scheduled time'
      const dedupeMarker = `[appt:${appointmentId}]`
      const notifRows = await supabaseRestGetMany({
        table: 'notifications',
        query: new URLSearchParams({
          user_id: `eq.${attorneyId}`,
          type: 'eq.consultation',
          body: `ilike.*${appointmentId}*`,
        }).toString(),
      })
      const cancelTitle = 'Booking Cancelled'
      const cancelBody = `${clientName} cancelled their booking for ${appt.title || 'a consultation'} on ${whenLabel}. ${dedupeMarker}`

      if (notifRows.length > 0) {
        for (const n of notifRows) {
          if (!n?.id) continue
          await supabaseRestPatch({
            table: 'notifications',
            query: new URLSearchParams({ id: `eq.${n.id}` }).toString(),
            body: { title: cancelTitle, body: cancelBody, is_read: false },
          })
        }
      } else {
        await supabaseInsertNotification({
          userId: attorneyId,
          title: cancelTitle,
          body: cancelBody,
          type: 'consultation',
        })
      }
    } catch (e) {
      console.warn('[payments] abandon: notification flip failed', e?.message || e)
    }
  }

  return { ok: true, reason: 'cancelled' }
}

const supabaseInsertNotification = async ({ userId, title, body, type = 'general' }) => {
  if (!userId) return
  const endpoint = `${SUPABASE_URL}/rest/v1/notifications`
  const payload = {
    user_id: userId,
    title: String(title || 'Notification'),
    body: String(body || ''),
    type: String(type || 'general'),
    is_read: false,
    created_at: new Date().toISOString(),
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: supabaseRestHeaders(),
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(result?.message || result?.error || `Failed to create notification (${response.status})`)
  }
}

const createPaymongoCheckoutSession = async ({
  amount,
  appointmentId,
  transactionId,
  paymentMethod,
}) => {
  const lineAmount = Math.max(1, Math.round(Number(amount || 0) * 100))
  const method = normalizePaymentMethod(paymentMethod)

  const body = {
    data: {
      attributes: {
        billing: {
          name: 'BatasMo Client',
        },
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        line_items: [
          {
            currency: 'PHP',
            amount: lineAmount,
            name: 'BatasMo Consultation Booking',
            quantity: 1,
          },
        ],
        payment_method_types: [method],
        description: `Consultation payment for appointment ${appointmentId}`,
        success_url: `${PAYMENT_SUCCESS_URL}?payment=success&tx=${transactionId}&appointmentId=${appointmentId}`,
        cancel_url: `${PAYMENT_CANCEL_URL}?payment=cancelled&tx=${transactionId}&appointmentId=${appointmentId}`,
        metadata: {
          appointment_id: String(appointmentId),
          transaction_id: String(transactionId),
        },
      },
    },
  }

  const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
    method: 'POST',
    headers: {
      Authorization: paymongoAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail || payload?.error || `PayMongo create session failed (${response.status})`
    throw new Error(detail)
  }
  const data = payload?.data
  if (!data?.id || !data?.attributes?.checkout_url) {
    throw new Error('PayMongo returned an invalid checkout session response.')
  }
  return {
    checkoutSessionId: data.id,
    checkoutUrl: data.attributes.checkout_url,
  }
}

const fetchPaymongoCheckoutStatus = async (checkoutSessionId) => {
  const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`, {
    method: 'GET',
    headers: {
      Authorization: paymongoAuthHeader(),
      'Content-Type': 'application/json',
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail || payload?.error || `PayMongo status fetch failed (${response.status})`
    throw new Error(detail)
  }
  const attributes = payload?.data?.attributes || {}
  return {
    raw: attributes,
    mappedStatus: mapPaymongoToInternalStatus(attributes),
  }
}

// ============================================================================
// SYSTEM PROMPT FOR GEMINI
// ============================================================================

const SYSTEM_PROMPT = `You are a helpful AI assistant powered by Gemini. You can answer general knowledge questions, provide information on any topic, and assist with general inquiries.

**Key Points:**
1. You are knowledgeable about: general topics, legal information, business advice, technology, education, and more
2. For legal matters: Provide general information only - NOT legal advice. Include disclaimer when needed.
3. Support both English and Filipino languages
4. Be conversational, helpful, and accurate
5. When relevant to the user's question, you can mention that BatasMo offers legal services like consultations, notarial services, etc.

**Response Format:**
Always respond with JSON:
{
  "intent": "general|booking|consultation|notarial|payment|legal|greeting|other",
  "reply": "Your response here",
  "actions": []
}

**Available Actions (only suggest when relevant):**
- "page": "book-appointment" - For booking consultations
- "page": "notarial-request" - For notarial services
- "page": "transaction-history" - For payments/transactions
- "page": "my-appointments" - For viewing appointments

**Examples:**
- User: "What is civil law?" → Answer the question fully, no disclaimer needed, no actions
- User: "I need legal help" → Answer question, mention BatasMo services, add action button
- User: "How do I book?" → Answer booking info, add "book-appointment" action
- User: "What's quantum physics?" → Answer normally, no BatasMo mention, no actions

Always return valid JSON. Be helpful and informative on any topic!`

// ============================================================================
// HELPER: BUILD CONVERSATION HISTORY FOR CONTEXT
// ============================================================================

const buildConversationHistory = (conversation) => {
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return []
  }

  const messages = conversation
    .filter((msg) => msg && msg.from && msg.text)
    .map((msg) => ({
      role: msg.from === 'user' ? 'user' : 'assistant',
      parts: [{ text: msg.text }],
    }))

  // Gemini requires first message to be from user, so skip initial assistant messages
  const firstUserIndex = messages.findIndex((msg) => msg.role === 'user')
  if (firstUserIndex === -1) {
    return [] // No user messages, return empty
  }

  return messages.slice(firstUserIndex)
}

// ============================================================================
// CHATBOT MESSAGE ENDPOINT
// ============================================================================

app.post('/chatbot/message', async (req, res) => {
  try {
    const { message, conversation, user, disclaimer } = req.body

    // Validate input
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid message field',
      })
    }

    const userMessage = String(message).trim()
    if (userMessage.length === 0) {
      return res.status(400).json({
        error: 'Message cannot be empty',
      })
    }

    if (effectiveProviderMode === 'free') {
      const freeReply = await runFreeAssistant(userMessage)
      return res.json(freeReply)
    }

    // Build conversation history for context
    const conversationHistory = buildConversationHistory(conversation)

    // Send user message and get response (2.5-first with retry fallback)
    const { aiRawResponse, modelName } = await sendMessageWithModelRetry({
      userMessage,
      conversationHistory,
    })

    // Parse AI response as JSON
    let aiResponse
    try {
      // Try to extract JSON from response (in case AI adds extra text)
      const jsonMatch = aiRawResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      aiResponse = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.warn('[chatbot] Failed to parse AI JSON response, using fallback')
      aiResponse = {
        intent: 'fallback',
        reply:
          'I appreciate your question. For specific legal guidance, please contact one of our attorneys directly.',
        actions: [
          { label: 'Book consultation', page: 'book-appointment' },
        ],
      }
    }

    // Ensure response has required fields
    if (!aiResponse.reply) {
      aiResponse.reply = 'I am here to help. How can I assist you today?'
    }
    if (!aiResponse.intent) {
      aiResponse.intent = 'general'
    }
    if (!Array.isArray(aiResponse.actions)) {
      aiResponse.actions = []
    }

    aiResponse.model = modelName
    aiResponse.source = 'gemini'

    // Return response
    return res.json(aiResponse)
  } catch (error) {
    console.error('[chatbot] Error:', error)

    if (effectiveProviderMode === 'auto') {
      try {
        const { message } = req.body
        const freeReply = await runFreeAssistant(message)
        return res.json(freeReply)
      } catch (freeError) {
        console.error('[chatbot] Free assistant fallback failed:', freeError)
      }
    }

    // Return provider-aware response so the frontend does not silently mask the issue.
    return res.json(buildProviderFailureReply(error))
  }
})

// ============================================================================
// HEALTH CHECK
// ============================================================================

// ── VideoSDK helpers ──────────────────────────────────────────────────────────

const buildVideoSdkToken = () => {
  const apiKey = process.env.VIDEOSDK_API_KEY
  const secret = process.env.VIDEOSDK_API_SECRET
  if (!apiKey || !secret) throw new Error('VideoSDK credentials not configured on server.')

  const payload = {
    apikey: apiKey,
    permissions: ['allow_join', 'allow_mod'],
    version: 2,
  }
  return jwt.sign(payload, secret, { expiresIn: '120m', algorithm: 'HS256' })
}

const videoMeetingCreationLocks = new Map()

const videoSdkCustomRoomIdForAppointment = (appointmentId) =>
  `batasmo-appt-${String(appointmentId || '').trim()}`

const createVideoSdkRoom = async (customRoomId) => {
  const token = buildVideoSdkToken()
  const body = customRoomId ? { customRoomId } : {}

  const response = await fetch('https://api.videosdk.live/v2/rooms', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const raw = await response.text()
  if (!response.ok) {
    console.error('[videosdk] Room creation failed:', response.status, raw)
    throw new Error(`VideoSDK room creation failed: ${raw}`)
  }

  const parsed = JSON.parse(raw)
  if (!parsed?.roomId) {
    throw new Error('VideoSDK did not return a roomId.')
  }

  return { roomId: parsed.roomId, token }
}

const assertAppointmentVideoAccess = async (userId, appointmentId) => {
  requireSupabaseServiceConfig()
  const appointment = await supabaseSelectSingle({
    table: 'appointments',
    query: new URLSearchParams({ id: `eq.${appointmentId}` }).toString(),
  })
  if (!appointment) {
    throw new Error('Appointment not found.')
  }

  const uid = String(userId)
  if (uid !== String(appointment.client_id) && uid !== String(appointment.attorney_id)) {
    throw new Error('You are not allowed to join this consultation video call.')
  }

  return appointment
}

const resolveVideoMeetingForAppointment = async (appointmentId) => {
  requireSupabaseServiceConfig()

  let consultationRoom = await supabaseSelectSingle({
    table: 'consultation_rooms',
    query: new URLSearchParams({ appointment_id: `eq.${appointmentId}` }).toString(),
  })

  if (!consultationRoom) {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/consultation_rooms`, {
      method: 'POST',
      headers: {
        ...supabaseRestHeaders(),
        Prefer: 'return=representation,resolution=merge-duplicates',
      },
      body: JSON.stringify({ appointment_id: appointmentId, is_closed: false }),
    })
    const inserted = await insertRes.json().catch(() => null)
    if (insertRes.ok && Array.isArray(inserted) && inserted[0]?.id) {
      consultationRoom = inserted[0]
    } else {
      consultationRoom = await supabaseSelectSingle({
        table: 'consultation_rooms',
        query: new URLSearchParams({ appointment_id: `eq.${appointmentId}` }).toString(),
      })
    }
  }

  if (!consultationRoom?.id) {
    throw new Error('Consultation room not found for this appointment.')
  }

  if (consultationRoom.video_meeting_id) {
    return {
      meetingId: consultationRoom.video_meeting_id,
      roomId: consultationRoom.id,
      token: buildVideoSdkToken(),
    }
  }

  const customRoomId = videoSdkCustomRoomIdForAppointment(appointmentId)
  const { roomId: meetingId, token } = await createVideoSdkRoom(customRoomId)

  await supabaseRestPatch({
    table: 'consultation_rooms',
    query: new URLSearchParams({ id: `eq.${consultationRoom.id}` }).toString(),
    body: { video_meeting_id: meetingId },
  })

  return { meetingId, roomId: consultationRoom.id, token }
}

const getOrCreateVideoMeetingLocked = async (appointmentId) => {
  if (videoMeetingCreationLocks.has(appointmentId)) {
    return videoMeetingCreationLocks.get(appointmentId)
  }

  const work = (async () => {
    const existing = await supabaseSelectSingle({
      table: 'consultation_rooms',
      query: new URLSearchParams({ appointment_id: `eq.${appointmentId}` }).toString(),
    })
    if (existing?.video_meeting_id) {
      return {
        meetingId: existing.video_meeting_id,
        roomId: existing.id,
        token: buildVideoSdkToken(),
      }
    }
    return resolveVideoMeetingForAppointment(appointmentId)
  })()

  videoMeetingCreationLocks.set(appointmentId, work)
  try {
    return await work
  } finally {
    videoMeetingCreationLocks.delete(appointmentId)
  }
}

// ── VideoSDK token endpoint ───────────────────────────────────────────────────
app.get('/videosdk-token', (req, res) => {
  try {
    const token = buildVideoSdkToken()
    res.json({ token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── VideoSDK create room endpoint ─────────────────────────────────────────────
// Creates a VideoSDK room server-side (avoids CORS + auth issues from the browser).
// Returns { roomId, token } — roomId to join, token for the React SDK.
app.post('/videosdk-create-room', async (req, res) => {
  try {
    const customRoomId = String(req.body?.customRoomId || '').trim() || null
    const { roomId, token } = await createVideoSdkRoom(customRoomId)
    res.json({ roomId, token })
  } catch (err) {
    console.error('[videosdk] /videosdk-create-room error:', err)
    res.status(500).json({ error: err.message })
  }
})

// One shared VideoSDK room per appointment (client + attorney join the same meetingId).
app.post('/videosdk-meeting-for-appointment', async (req, res) => {
  try {
    requireSupabaseServiceConfig()

    const authHeader = String(req.headers.authorization || '').trim()
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!jwt) {
      return res.status(401).json({ error: 'Authorization Bearer token is required.' })
    }

    const user = await verifySupabaseUserJwt(jwt)
    const appointmentId = String(req.body?.appointmentId || '').trim()
    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required.' })
    }

    await assertAppointmentVideoAccess(user.id, appointmentId)
    const result = await getOrCreateVideoMeetingLocked(appointmentId)
    return res.json(result)
  } catch (err) {
    console.error('[videosdk] /videosdk-meeting-for-appointment error:', err)
    const msg = err?.message || 'Unable to prepare video meeting.'
    const status = msg.includes('not allowed') || msg.includes('not found') ? 403 : 500
    return res.status(status).json({ error: msg })
  }
})

// ── Real GCash/Maya payment session (PayMongo) ───────────────────────────────
app.post('/payments/appointments/create-session', async (req, res) => {
  try {
    requirePaymentConfig()

    const appointmentId = String(req.body?.appointmentId || '').trim()
    const clientId = String(req.body?.clientId || '').trim()
    const attorneyId = String(req.body?.attorneyId || '').trim()
    const amount = Number(req.body?.amount || 0)
    const paymentMethod = normalizePaymentMethod(req.body?.method || 'gcash')

    if (!appointmentId || !clientId || !attorneyId) {
      return res.status(400).json({ error: 'appointmentId, clientId, and attorneyId are required.' })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be greater than 0.' })
    }
    if (!isPaymentMethodSupported(paymentMethod)) {
      return res.status(400).json({ error: 'Only gcash, paymaya, or qrph are supported.' })
    }

    const pendingTx = await supabaseInsertTransaction({
      appointmentId,
      clientId,
      attorneyId,
      amount,
      paymentMethod:
        paymentMethod === 'gcash'
          ? 'GCash'
          : paymentMethod === 'paymaya'
            ? 'Maya'
            : paymentMethod === 'qrph'
              ? 'QRPh'
              : 'GCash',
    })

    const session = await createPaymongoCheckoutSession({
      amount,
      appointmentId,
      transactionId: pendingTx.id,
      paymentMethod,
    })

    await supabaseUpdateTransactionStatus({
      transactionId: pendingTx.id,
      paymentStatus: 'pending',
      providerReference: session.checkoutSessionId,
    })

    return res.status(200).json({
      transactionId: pendingTx.id,
      checkoutSessionId: session.checkoutSessionId,
      checkoutUrl: session.checkoutUrl,
      status: 'pending',
    })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unable to create payment session.' })
  }
})

// Client abandoned PayMongo / closed checkout — uses service role so RLS
// cannot block flipping the appointment to cancelled + freeing the slot.
app.post('/payments/appointments/abandon', async (req, res) => {
  try {
    requirePaymentConfig()

    const appointmentId = String(req.body?.appointmentId || '').trim()
    const clientId = String(req.body?.clientId || '').trim()
    const transactionId = String(req.body?.transactionId || '').trim()

    if (!appointmentId || !clientId) {
      return res.status(400).json({ error: 'appointmentId and clientId are required.' })
    }

    const appt = await supabaseSelectSingle({
      table: 'appointments',
      query: new URLSearchParams({ id: `eq.${appointmentId}` }).toString(),
    })
    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found.' })
    }
    if (String(appt.client_id) !== clientId) {
      return res.status(403).json({ error: 'Not allowed to abandon this appointment.' })
    }

    if (transactionId) {
      const tx = await supabaseSelectSingle({
        table: 'transactions',
        query: new URLSearchParams({ id: `eq.${transactionId}` }).toString(),
      })
      if (!tx) {
        return res.status(404).json({ error: 'Transaction not found.' })
      }
      if (String(tx.client_id) !== clientId || String(tx.appointment_id) !== appointmentId) {
        return res.status(403).json({ error: 'Transaction does not match appointment.' })
      }
    }

    const result = await supabaseAbandonPendingConsultation(appointmentId)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unable to abandon checkout.' })
  }
})

// Admin lists a specific client's active (non-final) appointments — service
// role bypasses RLS so admin can see anything regardless of policies.
app.get('/admin/clients/:clientId/active-appointments', async (req, res) => {
  try {
    requireSupabaseServiceConfig()

    const authHeader = String(req.headers.authorization || '').trim()
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!jwt) return res.status(401).json({ error: 'Authorization Bearer token is required.' })
    await verifyCallerIsAdmin(jwt)

    const clientId = String(req.params?.clientId || '').trim()
    if (!clientId) return res.status(400).json({ error: 'clientId is required.' })

    const rows = await supabaseRestGetMany({
      table: 'appointments',
      query: new URLSearchParams({
        client_id: `eq.${clientId}`,
        order: 'scheduled_at.asc',
      }).toString(),
    })

    const FINAL = new Set(['cancelled', 'rejected', 'completed'])
    const active = rows.filter((r) => !FINAL.has(String(r.status || '').toLowerCase()))

    // Hydrate attorney names (one extra round-trip; small fan-out is fine).
    const attorneyIds = [...new Set(active.map((r) => r.attorney_id).filter(Boolean))]
    const attorneyNameById = new Map()
    if (attorneyIds.length) {
      const attyRows = await supabaseRestGetMany({
        table: 'profiles',
        query: new URLSearchParams({
          id: `in.(${attorneyIds.join(',')})`,
        }).toString(),
      })
      for (const a of attyRows) {
        attorneyNameById.set(a.id, a.full_name || '')
      }
    }

    const list = active.map((r) => ({
      id: r.id,
      title: r.title || 'Consultation',
      status: r.status || '',
      scheduledAt: r.scheduled_at || '',
      slotId: r.slot_id || '',
      slotDate: r.slot_date || '',
      slotTime: r.slot_time || '',
      attorneyId: r.attorney_id || '',
      attorneyName: attorneyNameById.get(r.attorney_id) || '',
    }))

    return res.status(200).json({ appointments: list })
  } catch (error) {
    const msg = error?.message || 'Failed to load client appointments.'
    const status =
      msg.includes('Only Admin') || msg.includes('Invalid') || msg.includes('session')
        ? 403
        : msg.includes('Bearer')
          ? 401
          : 500
    return res.status(status).json({ error: msg })
  }
})

// Walk-in / front-desk: admin creates a Client account (email + password, email confirmed).
app.post('/admin/clients/walk-in', async (req, res) => {
  try {
    requireSupabaseServiceConfig()

    const authHeader = String(req.headers.authorization || '').trim()
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!jwt) {
      return res.status(401).json({ error: 'Authorization Bearer token is required.' })
    }

    await verifyCallerIsAdmin(jwt)

    const email = String(req.body?.email || '').trim()
    const password = String(req.body?.password || '')
    const fullName = String(req.body?.fullName || '').trim()

    const result = await supabaseAdminCreateWalkInClient({ email, password, fullName })
    return res.status(201).json(result)
  } catch (error) {
    const msg = error?.message || 'Unable to create client account.'
    const lower = msg.toLowerCase()
    const status =
      msg.includes('Only Admin') || msg.includes('Invalid') || msg.includes('session')
        ? 403
        : msg.includes('Bearer')
          ? 401
          : lower.includes('valid email') ||
              lower.includes('password must') ||
              lower.includes('already been registered') ||
              lower.includes('already registered') ||
              lower.includes('user already') ||
              lower.includes('duplicate key')
            ? 400
            : 500
    return res.status(status).json({ error: msg })
  }
})

// Admin creates an Attorney login (email + password, email confirmed).
app.post('/admin/attorneys/walk-in', async (req, res) => {
  try {
    requireSupabaseServiceConfig()

    const authHeader = String(req.headers.authorization || '').trim()
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!jwt) {
      return res.status(401).json({ error: 'Authorization Bearer token is required.' })
    }

    await verifyCallerIsAdmin(jwt)

    const email = String(req.body?.email || '').trim()
    const password = String(req.body?.password || '')
    const fullName = String(req.body?.fullName || '').trim()
    const specialty = String(req.body?.specialty || '').trim()

    const result = await supabaseAdminCreateWalkInAttorney({
      email,
      password,
      fullName,
      specialty,
    })

    const loginBase = String(process.env.APP_LOGIN_URL || '').trim()
    const loginUrl =
      loginBase ||
      `${ALLOWED_ORIGIN_BASE}/login`

    const emailResult = await sendAttorneyWelcomeEmail({
      email: result.email,
      fullName: result.fullName,
      password: result.password,
      loginUrl,
    })

    const { password: _omitPassword, ...safeResult } = result
    return res.status(201).json({
      ...safeResult,
      welcomeEmailSent: Boolean(emailResult.sent),
      welcomeEmailSkipped: Boolean(emailResult.skipped),
      welcomeEmailError: emailResult.sent ? undefined : emailResult.error,
    })
  } catch (error) {
    const msg = error?.message || 'Unable to create attorney account.'
    const lower = msg.toLowerCase()
    const status =
      msg.includes('Only Admin') || msg.includes('Invalid') || msg.includes('session')
        ? 403
        : msg.includes('Bearer')
          ? 401
          : lower.includes('valid email') ||
              lower.includes('password must') ||
              lower.includes('name is required') ||
              lower.includes('already been registered') ||
              lower.includes('already registered') ||
              lower.includes('user already') ||
              lower.includes('duplicate key')
            ? 400
            : 500
    return res.status(status).json({ error: msg })
  }
})

// Admin reschedules a client's consultation — service role bypasses RLS.
app.post('/admin/appointments/reschedule', async (req, res) => {
  try {
    requireSupabaseServiceConfig()

    const authHeader = String(req.headers.authorization || '').trim()
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    if (!jwt) {
      return res.status(401).json({ error: 'Authorization Bearer token is required.' })
    }

    await verifyCallerIsAdmin(jwt)

    const appointmentId = String(req.body?.appointmentId || '').trim()
    const newSlotId = String(req.body?.newSlotId || '').trim()
    if (!appointmentId || !newSlotId) {
      return res.status(400).json({ error: 'appointmentId and newSlotId are required.' })
    }

    const result = await supabaseAdminRescheduleConsultation({ appointmentId, newSlotId })
    return res.status(200).json(result)
  } catch (error) {
    const msg = error?.message || 'Unable to reschedule appointment.'
    const status =
      msg.includes('Only Admin') || msg.includes('Invalid') || msg.includes('session')
        ? 403
        : msg.includes('Not authenticated') || msg.includes('Bearer')
          ? 401
          : 500
    return res.status(status).json({ error: msg })
  }
})

// ── Payment status sync (polling fallback if webhook not yet integrated) ─────
app.get('/payments/appointments/status/:transactionId', async (req, res) => {
  try {
    requirePaymentConfig()
    const transactionId = String(req.params?.transactionId || '').trim()
    if (!transactionId) {
      return res.status(400).json({ error: 'transactionId is required.' })
    }

    const tx = await supabaseSelectSingle({
      table: 'transactions',
      query: new URLSearchParams({ id: `eq.${transactionId}` }).toString(),
    })

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found.' })
    }

    const checkoutSessionId = String(tx.provider_reference || '').trim()
    const previousStatus = String(tx.payment_status || 'pending').toLowerCase()
    let effectiveStatus = previousStatus

    if (checkoutSessionId) {
      const checkout = await fetchPaymongoCheckoutStatus(checkoutSessionId)
      effectiveStatus = checkout.mappedStatus

      if (effectiveStatus !== String(tx.payment_status || '').toLowerCase()) {
        await supabaseUpdateTransactionStatus({
          transactionId: tx.id,
          paymentStatus: effectiveStatus,
          providerReference: checkoutSessionId,
        })
      }

      if (effectiveStatus === 'paid' && tx.appointment_id) {
        await supabaseConfirmAppointment({ appointmentId: tx.appointment_id })
      }

      if (effectiveStatus === 'paid' && previousStatus !== 'paid' && tx.client_id) {
        try {
          await supabaseInsertNotification({
            userId: tx.client_id,
            title: 'Payment Confirmed',
            body: `Your consultation payment has been received successfully. Ref #${tx.id}`,
            type: 'payment',
          })
        } catch (notificationError) {
          console.warn('[payments] failed to create client payment notification', notificationError?.message || notificationError)
        }
      }

      if (effectiveStatus === 'failed' && tx.appointment_id) {
        try {
          await supabaseAbandonPendingConsultation(tx.appointment_id)
        } catch (abandonErr) {
          console.warn('[payments] abandon after checkout failed', abandonErr?.message || abandonErr)
        }
      }
    }

    return res.status(200).json({
      transactionId: tx.id,
      appointmentId: tx.appointment_id || null,
      status: effectiveStatus,
      referenceNo: null,
      providerReference: tx.provider_reference || null,
    })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unable to check payment status.' })
  }
})

// ── Face verification (Face++ preferred, Azure optional) ────────────────────
// POST /verify-identity
// Body: { selfieBase64: string, idBase64: string }
// Returns: { verified: boolean, confidence: number, isIdentical?: boolean, provider?: string }

const stripDataUriBase64 = (input) => String(input || '').replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '')

const MIN_FACE_MATCH_CONFIDENCE = Number(process.env.FACE_VERIFY_MIN_CONFIDENCE || 75)

async function verifyIdentityFacePlusPlus(selfieBase64, idBase64) {
  const form = new URLSearchParams()
  form.append('api_key', FACEPLUS_API_KEY)
  form.append('api_secret', FACEPLUS_API_SECRET)
  form.append('image_base64_1', stripDataUriBase64(selfieBase64))
  form.append('image_base64_2', stripDataUriBase64(idBase64))

  const url = `${FACEPLUS_API_BASE}/facepp/v3/compare`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })

  const body = await response.json()
  if (body.error_message) {
    console.error('[face++] compare error:', body)
    throw new Error(String(body.error_message))
  }

  // Face++ returns confidence 0–100 (same person likelihood)
  const confidence = Math.round(Number(body.confidence ?? 0))
  const verified = confidence >= MIN_FACE_MATCH_CONFIDENCE
  return { verified, confidence, isIdentical: verified, provider: 'faceplusplus' }
}

async function verifyIdentityAzure(selfieBase64, idBase64) {
  const detectUrl = `${AZURE_FACE_ENDPOINT}/face/v1.0/detect?returnFaceId=true&detectionModel=detection_03&recognitionModel=recognition_04`
  const headers = { 'Ocp-Apim-Subscription-Key': AZURE_FACE_KEY, 'Content-Type': 'application/octet-stream' }

  const detectFace = async (base64, label) => {
    const clean = stripDataUriBase64(base64)
    const buffer = Buffer.from(clean, 'base64')
    const response = await fetch(detectUrl, { method: 'POST', headers, body: buffer })
    const json = await response.json()
    if (!response.ok) {
      console.error(`[azure-face] detect ${label} failed:`, json)
      throw new Error(`Face detection failed for ${label}: ${json?.error?.message || response.status}`)
    }
    if (!Array.isArray(json) || json.length === 0) {
      throw new Error(`No face detected in the ${label}. Please ensure the image is clear and well-lit.`)
    }
    return json[0].faceId
  }

  const [selfieFaceId, idFaceId] = await Promise.all([
    detectFace(selfieBase64, 'selfie'),
    detectFace(idBase64, 'government ID'),
  ])

  const verifyRes = await fetch(`${AZURE_FACE_ENDPOINT}/face/v1.0/verify`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_FACE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ faceId1: selfieFaceId, faceId2: idFaceId }),
  })

  const verifyBody = await verifyRes.json()
  if (!verifyRes.ok) {
    console.error('[azure-face] verify failed:', verifyBody)
    throw new Error(`Verification error: ${verifyBody?.error?.message || verifyRes.status}`)
  }

  const confidence = Math.round((verifyBody.confidence ?? 0) * 100)
  const verified = Boolean(verifyBody.isIdentical) && confidence >= MIN_FACE_MATCH_CONFIDENCE
  return {
    verified,
    confidence,
    isIdentical: Boolean(verifyBody.isIdentical),
    provider: 'azure',
  }
}

app.post('/verify-identity', async (req, res) => {
  const selfieBase64 = String(req.body?.selfieBase64 || '').trim()
  const idBase64 = String(req.body?.idBase64 || '').trim()

  if (!selfieBase64 || !idBase64) {
    return res.status(400).json({ error: 'selfieBase64 and idBase64 are required.' })
  }

  const hasFacePlus = FACEPLUS_API_KEY && FACEPLUS_API_SECRET
  const hasAzure = AZURE_FACE_KEY && AZURE_FACE_ENDPOINT

  if (!hasFacePlus && !hasAzure) {
    return res.status(503).json({
      error:
        'Face verification is not configured. Add FACEPLUS_API_KEY and FACEPLUS_API_SECRET (recommended), or AZURE_FACE_KEY and AZURE_FACE_ENDPOINT, to backend .env.',
    })
  }

  try {
    const result = hasFacePlus
      ? await verifyIdentityFacePlusPlus(selfieBase64, idBase64)
      : await verifyIdentityAzure(selfieBase64, idBase64)
    return res.json(result)
  } catch (err) {
    console.error('[verify-identity] error:', err)
    return res.status(500).json({ error: err.message })
  }
})

app.post('/auth/signup-email-otp', async (req, res) => {
  try {
    requireSupabaseServiceConfig()
    const email = String(req.body?.email || '').trim()
    const userId = String(req.body?.userId || '').trim()
    const password = req.body?.password != null ? String(req.body.password) : ''

    if (!isGmailAddress(email)) {
      return res.status(400).json({ error: 'A valid Gmail address is required.' })
    }

    const result = await dispatchSignupEmailOtp({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SUPABASE_SERVICE_ROLE_KEY,
      email,
      userId,
      password,
    })
    return res.status(200).json(result)
  } catch (error) {
    const msg = error?.message || 'Unable to send verification email.'
    const lower = msg.toLowerCase()
    const status =
      lower.includes('wait') || lower.includes('limit')
        ? 429
        : lower.includes('configured') ||
            lower.includes('required') ||
            lower.includes('already verified') ||
            lower.includes('unable')
          ? 400
          : 500
    console.error('[signup-email-otp]', msg)
    return res.status(status).json({ error: msg })
  }
})

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providerMode: effectiveProviderMode,
    configuredProviderMode: CHATBOT_PROVIDER_MODE,
    hasGeminiKey,
    modelCandidates: GEMINI_MODEL_CANDIDATES,
    welcomeEmailConfigured: isWelcomeEmailConfigured(),
    signupOtpEmailConfigured: isSignupOtpEmailConfigured(),
  })
})

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════════════════════╗
║  BatasMo Chatbot Backend (Gemini 2.5)                  ║
║  Listening on: http://localhost:${PORT}              ║
║  API Endpoint: POST /chatbot/message                   ║
║  Health Check: GET /health                             ║
╚═════════════════════════════════════════════════════════╝
  `)
})

// ============================================================================
// ERROR HANDLING
// ============================================================================

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})
