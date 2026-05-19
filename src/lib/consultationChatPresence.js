import { supabase } from './supabaseClient'

const OTHER_ROLE = {
  client: 'attorney',
  attorney: 'client',
}

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

/**
 * Realtime presence for consultation chat: when one party is already in the
 * room and the other opens the chat, show a waiting popup on the second party.
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
  let hasShownWaitingPopup = false

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
    if (!selfTracked || hasShownWaitingPopup) return
    const otherPresent = listPresences().some((entry) => entry.role === otherRole)
    if (!otherPresent) return
    hasShownWaitingPopup = true
    if (typeof onWaitingPopup === 'function') {
      onWaitingPopup(buildWaitingCopy({ otherRole, otherPartyName }))
    }
  }

  channel
    .on('presence', { event: 'sync' }, () => {
      notifyIfOtherAlreadyWaiting()
    })
    .on('presence', { event: 'join' }, () => {
      notifyIfOtherAlreadyWaiting()
    })
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      try {
        await channel.track({
          role: normalizedRole,
          userId: String(userId),
          displayName: String(displayName || '').trim() || (normalizedRole === 'attorney' ? 'Attorney' : 'Client'),
          joinedAt: new Date().toISOString(),
        })
        selfTracked = true
        notifyIfOtherAlreadyWaiting()
      } catch (error) {
        console.warn('[chat-presence] track failed', error?.message || error)
      }
    })

  return () => {
    selfTracked = false
    channel.untrack().catch(() => {})
    supabase.removeChannel(channel)
  }
}
