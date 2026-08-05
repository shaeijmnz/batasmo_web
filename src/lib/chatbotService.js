import { supabase } from './supabaseClient'
import { requestInformationalAssistant } from './aiAssistantApi'

const CHATBOT_DISCLAIMER =
  'This chatbot provides general information only and is not legal advice.'

const conversationToAssistantHistory = (conversation) => {
  if (!Array.isArray(conversation)) return []
  return conversation
    .filter((entry) => entry && (entry.from === 'user' || entry.from === 'ai'))
    .map((entry) => ({
      role: entry.from === 'ai' ? 'assistant' : 'user',
      content: String(entry.text || '').trim(),
    }))
    .filter((entry) => entry.content)
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
  let result

  try {
    const assistantResult = await requestInformationalAssistant({
      message,
      history: conversationToAssistantHistory(conversation),
    })
    result = {
      intent: String(assistantResult.kind || 'informational'),
      reply: assistantResult.reply,
      actions: [],
    }
  } catch (error) {
    console.warn('[chatbot] informational assistant failed', error)
    const detail = error instanceof Error ? error.message : 'Unable to reach the assistant.'
    result = {
      intent: 'error',
      reply: detail,
      actions: [{ label: 'Book consultation', page: 'book-appointment' }],
    }
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
