import { supabase } from './supabaseClient'

const OTHER_ROLE = {
  client: 'attorney',
  attorney: 'client',
}

const POPUP_SHOWN_PREFIX = 'batasmo_consult_wait_popup:'
const NOTIFY_DEBOUNCE_MS = 500

export const consultationWaitingPopupStorageKey = (appointmentId, role, userId) =>
  `${POPUP_SHOWN_PREFIX}${appointmentId}:${role}:${userId}`

const buildWaitingCopy = ({ otherRole, otherPartyName }) => {
  const label = otherRole === 'attorney' ? 'Attorney' : 'Client'
  const name = String(otherPartyName || '').trim() || label
  if (otherRole === 'attorney') {
    return {
      title: `${name} is waiting in the chatroom`,
      body: 'Your attorney entered the consultation chatroom first and is waiting for you to join.',
    }
  }
  return {
    title: `${name} is waiting in the chatroom`,
    body: 'Your client entered the consultation chatroom first and is waiting for you to join.',
  }
}

const wasPopupShownForSession = (storageKey) => {
  try {
    return sessionStorage.getItem(storageKey) === '1'
  } catch {
    return false
  }
}

const markPopupShownForSession = (storageKey) => {
  try {
    sessionStorage.setItem(storageKey, '1')
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Realtime presence for consultation chat: when one party is already in the
 * room and the other opens the chat, show a waiting popup once (no spam).
 */
export function attachConsultationChatPresence({
  appointmentId,
  role,
  userId,
  displayName,
  otherPartyName,
  onWaitingPopup,
}) {
  if (!appointmentId || !userId) {
    return () => {}
  }

  const normalizedRole = role === 'attorney' ? 'attorney' : 'client'
  const otherRole = OTHER_ROLE[normalizedRole]
  const storageKey = consultationWaitingPopupStorageKey(appointmentId, normalizedRole, userId)

  let selfTracked = false
  let hasShownWaitingPopup = wasPopupShownForSession(storageKey)
  let notifyTimer = null
  let disposed = false

  const channel = supabase.channel(`consultation-presence:${appointmentId}`, {
    config: { presence: { key: `${normalizedRole}:${userId}` } },
  })

  const listPresences = () => {
    const state = channel.presenceState()
    const all = []
    Object.values(state || {}).forEach((entries) => {
      ;(entries || []).forEach((entry) => all.push(entry))
    })
    return all
  }

  const notifyIfOtherAlreadyWaiting = () => {
    if (disposed || !selfTracked || hasShownWaitingPopup) return

    const otherPresent = listPresences().some((entry) => entry.role === otherRole)
    if (!otherPresent) return

    hasShownWaitingPopup = true
    markPopupShownForSession(storageKey)

    if (typeof onWaitingPopup === 'function') {
      onWaitingPopup(buildWaitingCopy({ otherRole, otherPartyName }))
    }
  }

  const scheduleNotify = () => {
    if (disposed || hasShownWaitingPopup) return
    if (notifyTimer) window.clearTimeout(notifyTimer)
    notifyTimer = window.setTimeout(() => {
      notifyTimer = null
      notifyIfOtherAlreadyWaiting()
    }, NOTIFY_DEBOUNCE_MS)
  }

  channel
    .on('presence', { event: 'sync' }, scheduleNotify)
    .on('presence', { event: 'join' }, scheduleNotify)
    .subscribe(async (status) => {
      if (disposed || status !== 'SUBSCRIBED') return
      try {
        await channel.track({
          role: normalizedRole,
          userId: String(userId),
          displayName:
            String(displayName || '').trim() ||
            (normalizedRole === 'attorney' ? 'Attorney' : 'Client'),
          joinedAt: new Date().toISOString(),
        })
        selfTracked = true
        scheduleNotify()
      } catch (error) {
        console.warn('[chat-presence] track failed', error?.message || error)
      }
    })

  return () => {
    disposed = true
    selfTracked = false
    if (notifyTimer) {
      window.clearTimeout(notifyTimer)
      notifyTimer = null
    }
    channel.untrack().catch(() => {})
    supabase.removeChannel(channel)
  }
}
