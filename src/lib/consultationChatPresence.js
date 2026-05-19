import { supabase } from './supabaseClient'

const OTHER_ROLE = {
  client: 'attorney',
  attorney: 'client',
}

const shownStorageKey = (appointmentId, role) =>
  `consult-wait-shown:${String(appointmentId)}:${role === 'attorney' ? 'attorney' : 'client'}`

const hasShownWaitingAlert = (appointmentId, role) => {
  try {
    return sessionStorage.getItem(shownStorageKey(appointmentId, role)) === '1'
  } catch {
    return false
  }
}

const markWaitingAlertShown = (appointmentId, role) => {
  try {
    sessionStorage.setItem(shownStorageKey(appointmentId, role), '1')
  } catch {
    /* ignore */
  }
}

const buildWaitingCopy = ({ otherRole, otherPartyName }) => {
  const label = otherRole === 'attorney' ? 'Attorney' : 'Client'
  const name = String(otherPartyName || '').trim() || label
  if (otherRole === 'attorney') {
    return {
      title: `${name} is waiting in the chatroom`,
      body: 'Your attorney is already in the consultation chatroom. Open the chat to join the session.',
    }
  }
  return {
    title: `${name} is waiting in the chatroom`,
    body: 'Your client is already in the consultation chatroom. Open the chat to join the session.',
  }
}

const listPresences = (channel) => {
  const state = channel.presenceState()
  const all = []
  Object.values(state || {}).forEach((entries) => {
    ;(entries || []).forEach((entry) => all.push(entry))
  })
  return all
}

const earliestJoinedAt = (entries) => {
  const stamps = (entries || [])
    .map((entry) => entry?.joinedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
  return stamps.length ? Math.min(...stamps) : null
}

const fireWaitingPopup = ({ appointmentId, role, otherRole, otherPartyName, onWaitingPopup }) => {
  if (hasShownWaitingAlert(appointmentId, role)) return false
  markWaitingAlertShown(appointmentId, role)
  if (typeof onWaitingPopup === 'function') {
    onWaitingPopup(buildWaitingCopy({ otherRole, otherPartyName }))
  }
  return true
}

/**
 * Listen-only presence: notify this user while they are NOT in the chatroom yet
 * (e.g. dashboard / appointments list) when the other party enters first.
 */
export function watchConsultationPresenceAlerts({ watches = [], role, onWaitingPopup }) {
  const normalizedRole = role === 'attorney' ? 'attorney' : 'client'
  const otherRole = OTHER_ROLE[normalizedRole]
  const channels = []

  watches.forEach(({ appointmentId, otherPartyName }) => {
    if (!appointmentId || hasShownWaitingAlert(appointmentId, normalizedRole)) return

    const channel = supabase.channel(`consultation-presence:${appointmentId}`)
    const maybeAlert = () => {
      const others = listPresences(channel).filter((entry) => entry.role === otherRole)
      if (!others.length) return
      fireWaitingPopup({
        appointmentId,
        role: normalizedRole,
        otherRole,
        otherPartyName,
        onWaitingPopup,
      })
    }

    channel
      .on('presence', { event: 'sync' }, maybeAlert)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const otherJoined = (newPresences || []).some((entry) => entry.role === otherRole)
        if (otherJoined) maybeAlert()
      })
      .subscribe()

    channels.push(channel)
  })

  return () => {
    channels.forEach((channel) => {
      supabase.removeChannel(channel)
    })
  }
}

/**
 * In-chat presence: show a one-time popup only for the party who enters second
 * (the other person is already in the room). Never repeats while both are inside.
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
  let selfTracked = false
  let selfJoinedAt = null

  const channel = supabase.channel(`consultation-presence:${appointmentId}`, {
    config: { presence: { key: `${normalizedRole}:${userId}` } },
  })

  const notifyIfJoinedSecond = () => {
    if (!selfTracked || hasShownWaitingAlert(appointmentId, normalizedRole)) return

    const presences = listPresences(channel)
    const others = presences.filter((entry) => entry.role === otherRole)
    if (!others.length) return

    const otherFirstAt = earliestJoinedAt(others)
    const ourJoinedAt = selfJoinedAt ? new Date(selfJoinedAt).getTime() : null

    // Only the party who entered after the other should see the popup.
    if (ourJoinedAt != null && otherFirstAt != null && ourJoinedAt <= otherFirstAt) {
      return
    }

    fireWaitingPopup({
      appointmentId,
      role: normalizedRole,
      otherRole,
      otherPartyName,
      onWaitingPopup,
    })
  }

  channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      try {
        selfJoinedAt = new Date().toISOString()
        await channel.track({
          role: normalizedRole,
          userId: String(userId),
          displayName:
            String(displayName || '').trim() ||
            (normalizedRole === 'attorney' ? 'Attorney' : 'Client'),
          joinedAt: selfJoinedAt,
        })
        selfTracked = true
        notifyIfJoinedSecond()
      } catch (error) {
        console.warn('[chat-presence] track failed', error?.message || error)
      }
    })

  return () => {
    selfTracked = false
    selfJoinedAt = null
    channel.untrack().catch(() => {})
    supabase.removeChannel(channel)
  }
}
