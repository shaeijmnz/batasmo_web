import { Router } from 'express'

const DIDIT_SESSION_API = 'https://verification.didit.me/v3/session/'

const getDiditApiKey = () => String(process.env.DIDIT_API_KEY || '').trim()
const getDiditWorkflowId = () => String(process.env.DIDIT_WORKFLOW_ID || '').trim()
const getDiditCallbackUrl = () =>
  String(process.env.DIDIT_CALLBACK_URL || 'batasmoapp://didit-callback').trim()

export function isDiditApiKeyConfigured() {
  return Boolean(getDiditApiKey())
}

export function isDiditSessionConfigured() {
  return Boolean(getDiditApiKey() && getDiditWorkflowId())
}

async function createDiditSession({ vendorData, callback }) {
  const response = await fetch(DIDIT_SESSION_API, {
    method: 'POST',
    headers: {
      'x-api-key': getDiditApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflow_id: getDiditWorkflowId(),
      callback: callback || getDiditCallbackUrl(),
      vendor_data: vendorData,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.detail ||
      payload?.error ||
      (Array.isArray(payload?.errors) ? payload.errors[0]?.detail : null) ||
      `Didit API error (${response.status})`
    const err = new Error(String(message))
    err.status = response.status
    throw err
  }
  return payload
}

export function createDiditRouter({ checkMobileAuth }) {
  const router = Router()
  const requireMobile = typeof checkMobileAuth === 'function' ? checkMobileAuth : () => true

  router.get('/health', (_req, res) => {
    res.json({
      configured: isDiditApiKeyConfigured(),
      sessionReady: isDiditSessionConfigured(),
    })
  })

  router.post('/session', async (req, res) => {
    if (!requireMobile(req, res)) return
    if (!isDiditSessionConfigured()) {
      return res.status(503).json({ error: 'Didit is not configured (DIDIT_API_KEY / DIDIT_WORKFLOW_ID).' })
    }

    try {
      const vendorData =
        String(req.body?.vendorData || req.body?.vendor_data || req.body?.userId || '').trim() ||
        `batasmo-mobile-${Date.now()}`
      const callback = String(req.body?.callback || getDiditCallbackUrl()).trim()

      const session = await createDiditSession({ vendorData, callback })
      return res.json({
        session_id: session.session_id,
        session_token: session.session_token,
        url: session.url,
        status: session.status,
        vendor_data: session.vendor_data,
        workflow_id: session.workflow_id,
      })
    } catch (error) {
      const status = Number(error?.status) || 500
      return res.status(status).json({ error: error?.message || 'Unable to create Didit session.' })
    }
  })

  router.get('/session/:sessionId/decision', async (req, res) => {
    if (!requireMobile(req, res)) return
    if (!isDiditApiKeyConfigured()) {
      return res.status(503).json({ error: 'Didit is not configured (DIDIT_API_KEY).' })
    }

    const sessionId = String(req.params?.sessionId || '').trim()
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' })
    }

    try {
      const response = await fetch(`${DIDIT_SESSION_API}${encodeURIComponent(sessionId)}/decision/`, {
        method: 'GET',
        headers: { 'x-api-key': getDiditApiKey() },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        return res.status(response.status).json({
          error: payload?.message || payload?.detail || payload?.error || 'Unable to fetch Didit decision.',
        })
      }
      return res.json(payload)
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'Unable to fetch Didit decision.' })
    }
  })

  return router
}
