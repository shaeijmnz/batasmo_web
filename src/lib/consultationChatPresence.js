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

const clearPopupShownForSession = (storageKey) => {
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // ignore
  }
}

const presenceJoinedAtMs = (entry) => {
  const raw = entry?.joinedAt
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : 0
}

const listChannelPresences = (channel) => {
  const state = channel.presenceState()
  const all = []
  Object.values(state || {}).forEach((entries) => {
    ;(entries || []).forEach((entry) => all.push(entry))
  })
  return all
}

/** True when the other party was in the room before this user (by joinedAt). */
const otherWasWaitingBeforeMe = (all, normalizedRole, userId) => {
  const otherRole = OTHER_ROLE[normalizedRole]
  const mine = all.filter(
    (entry) => entry.role === normalizedRole && String(entry.userId) === String(userId),
  )
  const others = all.filter((entry) => entry.role === otherRole)
  if (!others.length) return false
  if (!mine.length) return true

  const myJoined = Math.max(...mine.map(presenceJoinedAtMs))
  const otherTimes = others.map(presenceJoinedAtMs).filter((t) => t > 0)
  if (!otherTimes.length) return true
  return Math.min(...otherTimes) < myJoined
}

/**
 * Listen-only presence: notify when the other party is in chat but this user is not
 * (e.g. on home/dashboard). Does not track presence — in-chat attach handles that.
 */
export function subscribeConsultationWaitingNotifier({
  appointmentIds = [],
  role,
  userId,
  isViewingChat,
  getOtherPartyName,
  onWaitingPopup,
}) {
  if (!userId || !appointmentIds.length) {
    return () => {}
  }

  const normalizedRole = role === 'attorney' ? 'attorney' : 'client'
  const otherRole = OTHER_ROLE[normalizedRole]
  let disposed = false
  const cleanups = []

  appointmentIds.forEach((appointmentId) => {
    if (!appointmentId) return

    const storageKey = `${consultationWaitingPopupStorageKey(appointmentId, normalizedRole, userId)}:away`
    let hasShownForThisWait = wasPopupShownForSession(storageKey)
    let notifyTimer = null

    const channel = supabase.channel(`consultation-presence:${appointmentId}`, {
      config: { presence: { key: `listen:${normalizedRole}:${userId}` } },
    })

    const checkAway = () => {
      if (disposed) return
      if (typeof isViewingChat === 'function' && isViewingChat(appointmentId)) return

      const all = listChannelPresences(channel)
      const selfIn = all.some(
        (entry) =>
          entry.role === normalizedRole && String(entry.userId) === String(userId),
      )
      const otherIn = all.some((entry) => entry.role === otherRole)

      if (!otherIn) {
        hasShownForThisWait = false
        clearPopupShownForSession(storageKey)
        return
      }

      if (selfIn || hasShownForThisWait) return

      hasShownForThisWait = true
      markPopupShownForSession(storageKey)

      if (typeof onWaitingPopup === 'function') {
        onWaitingPopup({
          ...buildWaitingCopy({
            otherRole,
            otherPartyName:
              typeof getOtherPartyName === 'function'
                ? getOtherPartyName(appointmentId)
                : '',
          }),
          appointmentId,
        })
      }
    }

    const scheduleCheck = () => {
      if (disposed) return
      if (notifyTimer) window.clearTimeout(notifyTimer)
      notifyTimer = window.setTimeout(() => {
        notifyTimer = null
        checkAway()
      }, NOTIFY_DEBOUNCE_MS)
    }

    channel.on('presence', { event: 'sync' }, scheduleCheck).subscribe((status) => {
      if (disposed || status !== 'SUBSCRIBED') return
      scheduleCheck()
    })

    cleanups.push(() => {
      if (notifyTimer) {
        window.clearTimeout(notifyTimer)
        notifyTimer = null
      }
      supabase.removeChannel(channel)
    })
  })

  return () => {
    disposed = true
    cleanups.forEach((fn) => fn())
  }
}

/**
 * In-chat presence: track this user and show a popup only if they arrive after the other party.
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

  const notifyIfArrivedAfterOther = () => {
    if (disposed || !selfTracked || hasShownWaitingPopup) return

    const all = listChannelPresences(channel)
    if (!otherWasWaitingBeforeMe(all, normalizedRole, userId)) return

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
      notifyIfArrivedAfterOther()
    }, NOTIFY_DEBOUNCE_MS)
  }

  channel.on('presence', { event: 'sync' }, scheduleNotify).subscribe(async (status) => {
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
