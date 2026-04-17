import { fetchBookableAttorneys, getAvailability } from './userApi'
import { supabase } from './supabaseClient'

const CHATBOT_DISCLAIMER =
  'This chatbot provides general information only and is not legal advice.'

const CHATBOT_FALLBACK_REPLY =
  'Sorry, I can only provide general info. You can ask me about consultation booking, available slots, notarial requests, or payment status.'

const OPEN_INTENT_KEYWORDS = {
  greeting: ['hello', 'hi', 'good morning', 'good afternoon', 'good evening', 'kamusta', 'kumusta', 'hey'],
  booking: ['book', 'booking', 'appointment', 'consultation', 'schedule', 'magbook', 'book consultation', 'paano magbook', 'konsulta'],
  availability: ['available', 'availability', 'slot', 'time slot', 'oras', 'schedule today', 'anong oras', 'bakante'],
  notarial: ['notary', 'notarial', 'affidavit', 'document', 'notarize', 'pa notaryo', 'panotaryo'],
  payment: ['payment', 'paid', 'unpaid', 'transaction', 'receipt', 'bayad', 'magkano', 'magbayad'],
}

const aiEndpoint = String(process.env.REACT_APP_CHATBOT_API_URL || '').trim()

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const detectIntent = (message) => {
  const text = normalizeText(message)
  if (!text) return 'fallback'

  if (OPEN_INTENT_KEYWORDS.greeting.some((word) => text.includes(word))) {
    return 'greeting'
  }
  if (OPEN_INTENT_KEYWORDS.availability.some((word) => text.includes(word))) {
    return 'availability'
  }
  if (OPEN_INTENT_KEYWORDS.booking.some((word) => text.includes(word))) {
    return 'booking'
  }
  if (OPEN_INTENT_KEYWORDS.notarial.some((word) => text.includes(word))) {
    return 'notarial'
  }
  if (OPEN_INTENT_KEYWORDS.payment.some((word) => text.includes(word))) {
    return 'payment'
  }

  return 'fallback'
}

const buildApiUrl = (baseUrl, path) => {
  const sanitizedBase = String(baseUrl || '').replace(/\/+$/, '')
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`
  return `${sanitizedBase}${normalizedPath}`
}

const logConversation = async ({ userId, role, message, reply, intent }) => {
  if (!userId) return

  try {
    await supabase.from('chatbot_logs').insert({
      user_id: userId,
      role: role || 'Client',
      message,
      response: reply,
      intent,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    const details = String(error?.message || '').toLowerCase()
    if (details.includes('does not exist') || details.includes('chatbot_logs')) {
      return
    }
    console.warn('[chatbot] log insert failed', error)
  }
}

const buildGreetingReply = (profile) => {
  const name = String(profile?.full_name || 'Client').split(' ')[0]
  return {
    intent: 'greeting',
    reply: `Hi ${name}. I can help with consultation booking, available slots, notarial requests, and payments. ${CHATBOT_DISCLAIMER}`,
    actions: [
      { label: 'Book consultation', page: 'book-appointment' },
      { label: 'Notarial request', page: 'notarial-request' },
      { label: 'Transaction history', page: 'transaction-history' },
    ],
  }
}

const buildBookingReply = async () => {
  const attorneys = await fetchBookableAttorneys({ onlyVerified: true })
  const topAttorneys = attorneys.slice(0, 3)

  if (!topAttorneys.length) {
    return {
      intent: 'booking',
      reply:
        'I cannot find available attorneys right now. Please open Book Consultation to refresh available profiles and slots.',
      actions: [{ label: 'Open booking', page: 'book-appointment' }],
    }
  }

  const summary = topAttorneys
    .map((attorney) => {
      const firstSlot = attorney.availableSlots?.[0]
      if (!firstSlot) return `- ${attorney.name} (${attorney.specialty})`
      return `- ${attorney.name}: ${firstSlot.dateLabel}, ${firstSlot.timeLabel}`
    })
    .join('\n')

  return {
    intent: 'booking',
    reply: `Here are available options for consultation:\n${summary}\n\nOpen booking to confirm your schedule.`,
    actions: [{ label: 'Open booking', page: 'book-appointment' }],
  }
}

const buildAvailabilityReply = async () => {
  const attorneys = await fetchBookableAttorneys({ onlyVerified: true })
  const withSlots = attorneys.filter((attorney) => Array.isArray(attorney.availableSlots) && attorney.availableSlots.length > 0)

  if (!withSlots.length) {
    return {
      intent: 'availability',
      reply: 'No available consultation slots were found right now. Please try again in a moment.',
      actions: [{ label: 'Refresh booking page', page: 'book-appointment' }],
    }
  }

  const top = withSlots.slice(0, 3)
  const lines = top.map((attorney) => {
    const slot = attorney.availableSlots[0]
    return `- ${attorney.name}: ${slot.dateLabel}, ${slot.timeLabel}`
  })

  return {
    intent: 'availability',
    reply: `Current available slots:\n${lines.join('\n')}`,
    actions: [{ label: 'Book now', page: 'book-appointment' }],
  }
}

const buildNotarialReply = () => ({
  intent: 'notarial',
  reply:
    'For notarial services, prepare a valid ID, upload document details, and submit your request. A licensed attorney will review and update your request status.',
  actions: [{ label: 'Open notarial request', page: 'notarial-request' }],
})

const buildPaymentReply = async (profile) => {
  const userId = profile?.id
  if (!userId) {
    return {
      intent: 'payment',
      reply: 'Please log in again so I can check your payment-related pages.',
      actions: [{ label: 'Go to transaction history', page: 'transaction-history' }],
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const attorneyList = await fetchBookableAttorneys({ onlyVerified: false })
  const attorneyId = attorneyList?.[0]?.id
  if (attorneyId) {
    await getAvailability(attorneyId, today).catch(() => [])
  }

  return {
    intent: 'payment',
    reply: 'You can review paid and unpaid items in Transaction History. If an appointment says unpaid, complete payment first before entering the consultation room.',
    actions: [{ label: 'Open transaction history', page: 'transaction-history' }],
  }
}

const runLocalIntent = async ({ message, profile }) => {
  const intent = detectIntent(message)

  if (intent === 'greeting') return buildGreetingReply(profile)
  if (intent === 'booking') return buildBookingReply()
  if (intent === 'availability') return buildAvailabilityReply()
  if (intent === 'notarial') return buildNotarialReply()
  if (intent === 'payment') return buildPaymentReply(profile)

  return {
    intent: 'fallback',
    reply: CHATBOT_FALLBACK_REPLY,
    actions: [
      { label: 'Book consultation', page: 'book-appointment' },
      { label: 'Notarial request', page: 'notarial-request' },
    ],
  }
}

const runExternalApiIntent = async ({ message, profile, conversation }) => {
  if (!aiEndpoint) return null

  const response = await fetch(buildApiUrl(aiEndpoint, '/chatbot/message'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation: conversation || [],
      user: {
        id: profile?.id || null,
        role: profile?.role || 'Client',
        full_name: profile?.full_name || 'Client',
      },
      disclaimer: CHATBOT_DISCLAIMER,
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    if (payload?.reply) {
      return {
        intent: payload.intent || 'provider_error',
        reply: String(payload.reply),
        actions: Array.isArray(payload.actions) ? payload.actions : [],
      }
    }
    throw new Error(`Chatbot API error (${response.status})`)
  }

  if (!payload?.reply) {
    throw new Error('Chatbot API returned an invalid payload.')
  }

  return {
    intent: payload.intent || 'external',
    reply: String(payload.reply),
    actions: Array.isArray(payload.actions) ? payload.actions : [],
  }
}

export const initialChatbotMessages = [
  {
    from: 'ai',
    text: `Hello. I am your BatasMo assistant. ${CHATBOT_DISCLAIMER}`,
    actions: [
      { label: 'Book consultation', page: 'book-appointment' },
      { label: 'Notarial request', page: 'notarial-request' },
    ],
  },
]

export async function sendChatbotMessage({ message, profile, conversation = [] }) {
  let result = null

  try {
    result = await runExternalApiIntent({ message, profile, conversation })
  } catch (error) {
    console.warn('[chatbot] external provider failed, switching to local intent', error)
  }

  if (!result) {
    result = await runLocalIntent({ message, profile })
  }

  await logConversation({
    userId: profile?.id,
    role: profile?.role || 'Client',
    message,
    reply: result.reply,
    intent: result.intent,
  })

  return result
}
