import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const MODEL_DISCOVERY_CACHE_MS = 5 * 60 * 1000
const MODEL_FALLBACK_PREFERENCES = ['gemini-2.0-flash', 'gemini-2.0-flash-lite']
const MAX_HISTORY_TURNS = 12
const MAX_MESSAGE_LENGTH = 2000

let cachedGenerateContentModels: { expiresAt: number; models: string[] } | null = null

const isFreeProviderMode = (): boolean => {
  const mode = String(Deno.env.get('CHATBOT_PROVIDER_MODE') || '').trim().toLowerCase()
  return mode === 'free' || mode === 'presentation'
}

const DISCLAIMER =
  'Ito ay pangkalahatang impormasyon lamang at hindi legal advice. Para sa sitwasyon mo, mag-book ng consultation sa BatasMo attorney.'

const buildPresentationReply = (message: string): string => {
  const trimmed = message.trim()
  const q = trimmed.toLowerCase()

  const isGreeting =
    /^(hi|hello|hey)[\s,!?.]*$/i.test(trimmed) ||
    /^(kamusta|kumusta)\b/i.test(q) ||
    /^good (morning|afternoon|evening)\b/i.test(q)

  if (isGreeting) {
    return (
      'Kumusta! Ako ang BatasMo Informational Assistant. Makakatulong ako sa pangkalahatang impormasyon tungkol sa batas at proseso sa Pilipinas. ' +
      DISCLAIMER
    )
  }

  if (q.includes('affidavit') || q.includes('salaysay') || q.includes('loss')) {
    return (
      'Karaniwan sa affidavit of loss sa Pilipinas: idinidetalye ang pagkawala ng dokumento, petsa/lugar, paglalarawan ng item, at deklarasyon na wala kang intensiyong manlinlang. ' +
      'Ang eksaktong format at karagdagang rekisitos (notaryo, LGU, ahensya) depende sa tatanggap na opisina. ' +
      DISCLAIMER
    )
  }

  if (q.includes('notary') || q.includes('notarial') || q.includes('notaryo')) {
    return (
      'Ang notarial services sa Pilipinas ay karaniwang isinasagawa ng licensed notary public. Dala ang orihinal na dokumento at valid ID; ang notaryo magve-verify ng pagkakakilanlan at lagda. ' +
      DISCLAIMER
    )
  }

  if (q.includes('consult') || q.includes('book') || q.includes('appointment') || q.includes('abogado') || q.includes('attorney')) {
    return (
      'Maaari kang mag-book ng consultation sa app para makausap ang licensed BatasMo attorney tungkol sa konkretong kaso mo. Ang chatbot na ito ay para sa pangkalahatang impormasyon lamang. ' +
      DISCLAIMER
    )
  }

  if (q.includes('civil code') || q.includes('batas') || q.includes('law') || q.includes('legal')) {
    return (
      'Maraming aspeto ng karaniwang transaksyon sa Pilipinas ang nakasaad sa Civil Code (hal. kontrata, obligasyon, property). ' +
      'Kung may partikular kang tanong, mas mainam na ilahad ito sa consultation. ' +
      DISCLAIMER
    )
  }

  return (
    'Salamat sa tanong. Makapagbibigay ako ng pangkalahatang impormasyon tungkol sa proseso at konsepto sa ilalim ng Philippine law, pero hindi ako makapagbibigay ng legal advice o hatol kung panalo ka sa kaso. ' +
    'Gamitin ang Book Consultation sa app para sa personal na sitwasyon. ' +
    DISCLAIMER
  )
}

const SYSTEM_PROMPT = `You are the BatasMo Informational Assistant, representing a local law firm in the Philippines.

You must base all your answers strictly on Philippine Law, specifically the Civil Code of the Philippines and local legal procedures.

CRITICAL RULE: You are an informational tool only. You must NEVER provide legal advice, legal opinions, or case-specific rulings. You cannot tell a user if they will win a case or what specific legal action they should take.

If a user asks a general question (e.g., 'What are the requirements for an affidavit of loss?'), provide the general Philippine requirements.

If a user asks for specific legal advice regarding their personal situation, politely refuse, state that you cannot give legal advice, and guide them to use the 'Book Consultation' feature to speak with a licensed BatasMo attorney.`

type SanitizedHistoryTurn = {
  role: 'user' | 'assistant'
  content: string
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

const sanitizeHistory = (history: unknown): SanitizedHistoryTurn[] => {
  if (!Array.isArray(history)) return []

  return history
    .slice(-MAX_HISTORY_TURNS)
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || '').trim(),
    }))
    .filter((item) => Boolean(item.content))
}

const toGeminiContents = (history: SanitizedHistoryTurn[], message: string) => {
  const merged = [...history]
  const last = merged[merged.length - 1]

  // Keep one final user turn for the latest prompt if it was not already included.
  if (!last || last.role !== 'user' || last.content !== message) {
    merged.push({ role: 'user', content: message })
  }

  // Gemini requests should start with a user turn. The UI seed message is assistant-only,
  // so drop leading assistant turns to prevent invalid chat role ordering.
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }

  if (merged.length === 0) {
    merged.push({ role: 'user', content: message })
  }

  return merged.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }))
}

const readGeminiReply = (payload: any): string => {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => String(part?.text || '').trim())
    .filter(Boolean)
    .join('\n')

  return String(text || '').trim()
}

const normalizeModelName = (value: unknown): string => String(value || '').trim().replace(/^models\//, '')

const listGenerateContentModels = async (apiKey: string): Promise<string[]> => {
  const now = Date.now()
  if (cachedGenerateContentModels && cachedGenerateContentModels.expiresAt > now) {
    return cachedGenerateContentModels.models
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models` +
    `?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(endpoint, { method: 'GET' })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = String(payload?.error?.message || response.statusText || 'Model discovery failed')
    throw new Error(detail)
  }

  const models = Array.isArray(payload?.models) ? payload.models : []
  const discovered = models
    .filter((model: any) =>
      Array.isArray(model?.supportedGenerationMethods) &&
      model.supportedGenerationMethods.includes('generateContent'),
    )
    .map((model: any) => normalizeModelName(model?.name))
    .filter(Boolean)

  const uniqueModels = [...new Set(discovered)]

  cachedGenerateContentModels = {
    expiresAt: now + MODEL_DISCOVERY_CACHE_MS,
    models: uniqueModels,
  }

  return uniqueModels
}

const getModelCandidates = async (configuredModel: string, apiKey: string): Promise<string[]> => {
  const preferred = [configuredModel, DEFAULT_GEMINI_MODEL, ...MODEL_FALLBACK_PREFERENCES]
    .map(normalizeModelName)
    .filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index)

  try {
    const available = await listGenerateContentModels(apiKey)
    if (!available.length) return preferred

    const availableSet = new Set(available)
    const preferredAvailable = preferred.filter((modelName) => availableSet.has(modelName))
    if (preferredAvailable.length > 0) {
      return preferredAvailable
    }

    const flashModel = available.find((modelName) => modelName.includes('flash'))
    if (flashModel) {
      return [flashModel]
    }

    return [available[0]]
  } catch (error) {
    console.warn('[informational-ai-assistant] Model discovery failed:', error)
    return preferred
  }
}

const generateInformationalReply = async (params: {
  apiKey: string
  model: string
  message: string
  history: SanitizedHistoryTurn[]
}) => {
  const candidateModels = await getModelCandidates(params.model, params.apiKey)
  const modelErrors: string[] = []

  for (let index = 0; index < candidateModels.length; index += 1) {
    const modelName = candidateModels[index]
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}` +
      `:generateContent?key=${encodeURIComponent(params.apiKey)}`

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: toGeminiContents(params.history, params.message),
        generationConfig: {
          temperature: 0.25,
          topP: 0.9,
          maxOutputTokens: 1024,
        },
      }),
    })

    const geminiJson = await geminiRes.json().catch(() => ({}))

    if (!geminiRes.ok) {
      const detail = String(geminiJson?.error?.message || geminiRes.statusText || 'Gemini request failed')
      modelErrors.push(`${modelName}: ${detail}`)

      if (index < candidateModels.length - 1) {
        continue
      }

      throw new Error(modelErrors.join(' || '))
    }

    const reply = readGeminiReply(geminiJson)
    if (reply) {
      return reply
    }

    modelErrors.push(`${modelName}: Gemini returned an empty response`)
  }

  throw new Error(modelErrors.join(' || ') || 'Gemini request failed')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const geminiApiKey = String(Deno.env.get('GEMINI_API_KEY') || '').trim()
  const geminiModel = String(Deno.env.get('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL
  const useFreePresentationMode = isFreeProviderMode()

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  if (!geminiApiKey && !useFreePresentationMode) {
    return json({ error: 'AI service unavailable' }, 500)
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser()

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json().catch(() => null)
  const message = String(body?.message || '').trim().slice(0, MAX_MESSAGE_LENGTH)
  const history = sanitizeHistory(body?.history)

  if (!message) {
    return json({ error: 'Message is required' }, 400)
  }

  if (useFreePresentationMode) {
    const reply = buildPresentationReply(message)
    return json({ reply, kind: 'informational' }, 200)
  }

  try {
    const reply = await generateInformationalReply({
      apiKey: geminiApiKey,
      model: geminiModel,
      message,
      history,
    })

    return json({ reply, kind: 'answer' }, 200)
  } catch (error) {
    console.error('[informational-ai-assistant] Gemini error:', error)
    const detail = error instanceof Error ? error.message : 'Failed to generate assistant response'
    return json({ error: `Failed to generate assistant response: ${detail}` }, 500)
  }
})
