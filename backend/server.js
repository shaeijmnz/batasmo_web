import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'
import jwt from 'jsonwebtoken'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
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

// ── VideoSDK token endpoint ───────────────────────────────────────────────────
app.get('/videosdk-token', (req, res) => {
  const apiKey = process.env.VIDEOSDK_API_KEY
  const secret = process.env.VIDEOSDK_API_SECRET

  if (!apiKey || !secret) {
    return res.status(500).json({ error: 'VideoSDK credentials not configured on server.' })
  }

  const payload = {
    apikey: apiKey,
    permissions: ['allow_join', 'allow_mod'],
    version: 2,
  }

  const token = jwt.sign(payload, secret, { expiresIn: '120m', algorithm: 'HS256' })
  res.json({ token })
})

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providerMode: effectiveProviderMode,
    configuredProviderMode: CHATBOT_PROVIDER_MODE,
    hasGeminiKey,
    modelCandidates: GEMINI_MODEL_CANDIDATES,
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
