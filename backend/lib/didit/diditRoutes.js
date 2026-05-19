import { Router } from 'express'

const getDiditApiBase = () =>
  String(process.env.DIDIT_API_BASE || 'https://verification.didit.me')
    .trim()
    .replace(/\/+$/, '')

const diditSessionApi = () => `${getDiditApiBase()}/v3/session/`

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
  const response = await fetch(diditSessionApi(), {
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
    const configured = isDiditApiKeyConfigured()
    const sessionReady = isDiditSessionConfigured()
    res.json({
      ok: configured && sessionReady,
      configured,
      sessionReady,
      hasWorkflow: Boolean(getDiditWorkflowId()),
    })
  })

  const fetchSessionDecision = async (sessionId) => {
    const response = await fetch(`${diditSessionApi()}${encodeURIComponent(sessionId)}/decision/`, {
      method: 'GET',
      headers: { 'x-api-key': getDiditApiKey() },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.detail ||
        payload?.error ||
        `Unable to fetch Didit session (${response.status})`
      const err = new Error(String(message))
      err.status = response.status
      throw err
    }
    return payload
  }

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

  const handleSessionPoll = async (req, res) => {
    if (!requireMobile(req, res)) return
    if (!isDiditApiKeyConfigured()) {
      return res.status(503).json({ error: 'Didit is not configured (DIDIT_API_KEY).' })
    }

    const sessionId = String(req.params?.sessionId || '').trim()
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' })
    }

    try {
      const payload = await fetchSessionDecision(sessionId)
      return res.json(payload)
    } catch (error) {
      const status = Number(error?.status) || 500
      return res.status(status).json({ error: error?.message || 'Unable to fetch Didit session.' })
    }
  }

  // Mobile polls approval (doc: GET /didit/session/:id)
  router.get('/session/:sessionId', handleSessionPoll)
  router.get('/session/:sessionId/decision', handleSessionPoll)

  return router
}
