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

const videoAlertStorageKey = (appointmentId, role) =>
  `consult-video-shown:${String(appointmentId)}:${role === 'attorney' ? 'attorney' : 'client'}`

const hasShownVideoAlert = (appointmentId, role) => {
  try {
    return sessionStorage.getItem(videoAlertStorageKey(appointmentId, role)) === '1'
  } catch {
    return false
  }
}

const markVideoAlertShown = (appointmentId, role) => {
  try {
    sessionStorage.setItem(videoAlertStorageKey(appointmentId, role), '1')
  } catch {
    /* ignore */
  }
}

/**
 * Listen-only: notify when the other party starts a video call while this user
 * is outside the chatroom (e.g. attorney dashboard).
 */
export function watchConsultationVideoCallAlerts({ watches = [], role, onVideoCallPopup }) {
  const normalizedRole = role === 'attorney' ? 'attorney' : 'client'
  const otherRole = OTHER_ROLE[normalizedRole]
  const channels = []

  watches.forEach(({ appointmentId, otherPartyName }) => {
    if (!appointmentId || hasShownVideoAlert(appointmentId, normalizedRole)) return

    const channel = supabase.channel(`consultation-video-alert:${appointmentId}`)

    const maybeAlert = (videoMeetingId) => {
      const meetingId = String(videoMeetingId || '').trim()
      if (!meetingId || hasShownVideoAlert(appointmentId, normalizedRole)) return

      markVideoAlertShown(appointmentId, normalizedRole)
      if (typeof onVideoCallPopup !== 'function') return

      const label = otherRole === 'attorney' ? 'Attorney' : 'Client'
      const name = String(otherPartyName || '').trim() || label
      onVideoCallPopup({
        appointmentId,
        title: `${name} started a video call`,
        body: 'Open the consultation chat to join the video session.',
      })
    }

    ;(async () => {
      try {
        const { data } = await supabase
          .from('consultation_rooms')
          .select('video_meeting_id')
          .eq('appointment_id', appointmentId)
          .maybeSingle()
        if (data?.video_meeting_id) {
          maybeAlert(data.video_meeting_id)
        }
      } catch {
        /* Realtime listener still covers new calls */
      }
    })()

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consultation_rooms',
          filter: `appointment_id=eq.${appointmentId}`,
        },
        (payload) => {
          const previous = String(payload?.old?.video_meeting_id || '').trim()
          const next = String(payload?.new?.video_meeting_id || '').trim()
          if (!next || previous === next) return
          maybeAlert(next)
        },
      )
      .subscribe()

    channels.push(channel)
  })

  return () => {
    channels.forEach((channel) => {
      supabase.removeChannel(channel)
    })
  }
}
