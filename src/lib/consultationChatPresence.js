import { supabase } from './supabaseClient'

// Realtime contract shared with the mobile app (topic, presence payload, broadcast).
// Changing any field name here breaks web <-> mobile notices.

const OTHER_ROLE = {
  client: 'attorney',
  attorney: 'client',
}

export const RING_TIMEOUT_MS = 30_000
export const NO_ANSWER_TIMEOUT_MS = 30_000

export const normalizeConsultRole = (role) =>
  String(role || '').toLowerCase() === 'attorney' ? 'attorney' : 'client'

export const otherConsultRole = (role) => OTHER_ROLE[normalizeConsultRole(role)]

const presenceTopic = (appointmentId) => `consultation-presence:${appointmentId}`

const toMs = (value) => {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

const earliestValue = (entries, field) => {
  let best = null
  let bestMs = null
  entries.forEach((entry) => {
    const ms = toMs(entry?.[field])
    if (ms == null) return
    if (bestMs == null || ms < bestMs) {
      best = entry[field]
      bestMs = ms
    }
  })
  return best
}

export const isRecentIso = (value, windowMs) => {
  const ms = toMs(value)
  return ms != null && Date.now() - ms < windowMs
}

export function summarizePeer(channel, myRole) {
  const otherRole = otherConsultRole(myRole)
  const all = []
  Object.values(channel.presenceState() || {}).forEach((list) => {
    ;(list || []).forEach((entry) => all.push(entry))
  })
  const inChatEntries = all.filter(
    (entry) => entry?.role === otherRole && entry?.inChat !== false && !entry?.watching,
  )
  const callEntries = all.filter((entry) => entry?.role === otherRole && entry?.inCall === true)
  const named = inChatEntries[0] || callEntries[0] || null
  return {
    present: inChatEntries.length > 0 || callEntries.length > 0,
    joinedAt: earliestValue(inChatEntries, 'joinedAt'),
    inCall: callEntries.length > 0,
    callStartedAt: earliestValue(callEntries, 'callStartedAt'),
    displayName: String(named?.displayName || '').trim(),
  }
}

// One channel per appointment per tab. supabase.channel(topic) returns the same object
// for the same topic, so the chat page and the global watcher share it via ref-counting.
// Teardown waits a moment so page-to-page hand-offs reuse the channel instead of churning,
// and a new channel only subscribes after a stale one on the same topic is fully removed.
const TEARDOWN_GRACE_MS = 1500
const registry = new Map()
const pendingTeardowns = new Map()

const buildTrackPayload = (entry) => {
  const inChat = entry.chatHolders > 0
  const inCall = inChat && entry.inCall
  return {
    role: entry.role,
    userId: entry.userId,
    displayName: entry.displayName,
    inChat,
    watching: !inChat,
    joinedAt: inChat ? entry.joinedAt : null,
    inCall,
    callStartedAt: inCall ? entry.callStartedAt : null,
  }
}

const holderCount = (entry) => entry.chatHolders + entry.watchHolders

const pushTrack = (entry) => {
  if (!entry.subscribed || !entry.channel) return
  const request =
    holderCount(entry) > 0 ? entry.channel.track(buildTrackPayload(entry)) : entry.channel.untrack()
  request.catch((error) => {
    console.warn('[consult-presence] track failed', error?.message || error)
  })
}

const scheduleTeardown = (entry) => {
  clearTimeout(entry.teardownTimer)
  entry.teardownTimer = setTimeout(() => {
    if (holderCount(entry) > 0 || registry.get(entry.appointmentId) !== entry) return
    registry.delete(entry.appointmentId)
    entry.disposed = true
    const { channel } = entry
    if (!channel) return
    const removal = supabase
      .removeChannel(channel)
      .catch(() => {})
      .finally(() => {
        if (pendingTeardowns.get(entry.appointmentId) === removal) {
          pendingTeardowns.delete(entry.appointmentId)
        }
      })
    pendingTeardowns.set(entry.appointmentId, removal)
  }, TEARDOWN_GRACE_MS)
}

const ensureEntry = ({ appointmentId, role, userId, displayName }) => {
  const existing = registry.get(appointmentId)
  if (existing && existing.role === role && existing.userId === userId) {
    clearTimeout(existing.teardownTimer)
    return existing
  }
  if (existing) {
    clearTimeout(existing.teardownTimer)
    existing.disposed = true
  }

  const entry = {
    appointmentId,
    role,
    userId,
    displayName,
    chatHolders: 0,
    watchHolders: 0,
    joinedAt: null,
    inCall: false,
    callStartedAt: null,
    subscribed: false,
    synced: false,
    disposed: false,
    teardownTimer: null,
    peerListeners: new Set(),
    declineListeners: new Set(),
    channel: null,
  }
  registry.set(appointmentId, entry)

  ;(async () => {
    const topic = presenceTopic(appointmentId)
    await pendingTeardowns.get(appointmentId)
    const stale = supabase.getChannels().filter((channel) => channel.topic === `realtime:${topic}`)
    if (stale.length) {
      await Promise.all(stale.map((channel) => supabase.removeChannel(channel).catch(() => {})))
    }
    if (entry.disposed) return
    attachChannel(entry, topic)
  })()

  return entry
}

const attachChannel = (entry, topic) => {
  const { role, userId } = entry
  const channel = supabase.channel(topic, {
    config: {
      presence: { key: `${role}:${userId}` },
      broadcast: { self: false },
    },
  })

  const emitPeer = () => {
    if (!entry.synced) return
    const summary = summarizePeer(channel, role)
    entry.peerListeners.forEach((listener) => {
      try {
        listener(summary)
      } catch (error) {
        console.warn('[consult-presence] listener failed', error?.message || error)
      }
    })
  }

  // presenceState() is only updated after join/leave callbacks return.
  const emitPeerDeferred = () => {
    setTimeout(emitPeer, 0)
  }

  channel
    .on('presence', { event: 'sync' }, () => {
      entry.synced = true
      emitPeer()
    })
    .on('presence', { event: 'join' }, emitPeerDeferred)
    .on('presence', { event: 'leave' }, emitPeerDeferred)
    .on('broadcast', { event: 'call-declined' }, ({ payload }) => {
      if (payload?.toRole !== role) return
      entry.declineListeners.forEach((listener) => {
        try {
          listener(payload)
        } catch (error) {
          console.warn('[consult-presence] decline listener failed', error?.message || error)
        }
      })
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        entry.subscribed = true
        pushTrack(entry)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        entry.subscribed = false
      }
    })

  entry.channel = channel
}

/**
 * mode 'chat'  → this tab has the consultation chat page open (inChat: true).
 * mode 'watch' → background watcher only (watching: true); ignored by the other side
 *                for "in the chatroom" purposes.
 */
export function acquireConsultationPresence({ appointmentId, role, userId, displayName, mode = 'watch' }) {
  if (!appointmentId || !userId) return null

  const myRole = normalizeConsultRole(role)
  const id = String(appointmentId)
  const entry = ensureEntry({
    appointmentId: id,
    role: myRole,
    userId: String(userId),
    displayName:
      String(displayName || '').trim() || (myRole === 'attorney' ? 'Attorney' : 'Client'),
  })
  if (String(displayName || '').trim()) entry.displayName = String(displayName).trim()

  const isChat = mode === 'chat'
  if (isChat) {
    entry.chatHolders += 1
    if (entry.chatHolders === 1) entry.joinedAt = new Date().toISOString()
  } else {
    entry.watchHolders += 1
  }
  pushTrack(entry)

  const ownPeerListeners = new Set()
  const ownDeclineListeners = new Set()
  let released = false

  return {
    onPeer(listener) {
      entry.peerListeners.add(listener)
      ownPeerListeners.add(listener)
      if (entry.synced) {
        setTimeout(() => {
          if (!released && entry.peerListeners.has(listener)) {
            listener(summarizePeer(entry.channel, myRole))
          }
        }, 0)
      }
      return () => {
        entry.peerListeners.delete(listener)
        ownPeerListeners.delete(listener)
      }
    },
    onCallDeclined(listener) {
      entry.declineListeners.add(listener)
      ownDeclineListeners.add(listener)
      return () => {
        entry.declineListeners.delete(listener)
        ownDeclineListeners.delete(listener)
      }
    },
    setInCall(value) {
      if (!isChat || released) return
      const next = Boolean(value)
      if (entry.inCall === next) return
      entry.inCall = next
      entry.callStartedAt = next ? new Date().toISOString() : null
      pushTrack(entry)
    },
    sendCallDeclined({ name } = {}) {
      if (released || !entry.channel) return
      entry.channel
        .send({
          type: 'broadcast',
          event: 'call-declined',
          payload: {
            fromRole: myRole,
            toRole: otherConsultRole(myRole),
            name: String(name || entry.displayName || '').trim(),
          },
        })
        .catch((error) => {
          console.warn('[consult-presence] decline broadcast failed', error?.message || error)
        })
    },
    release() {
      if (released) return
      released = true
      ownPeerListeners.forEach((listener) => entry.peerListeners.delete(listener))
      ownDeclineListeners.forEach((listener) => entry.declineListeners.delete(listener))

      if (isChat) {
        entry.chatHolders = Math.max(0, entry.chatHolders - 1)
        if (entry.chatHolders === 0) {
          entry.joinedAt = null
          entry.inCall = false
          entry.callStartedAt = null
        }
      } else {
        entry.watchHolders = Math.max(0, entry.watchHolders - 1)
      }

      pushTrack(entry)
      if (holderCount(entry) === 0) scheduleTeardown(entry)
    },
  }
}

export function vibrateDevice(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    /* unsupported */
  }
}

/** Repeats the ring vibration until stopped or RING_TIMEOUT_MS elapses. */
export function startCallRinging({ onTimeout } = {}) {
  vibrateDevice([1000, 800])
  const intervalId = setInterval(() => vibrateDevice([1000, 800]), 1800)
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(intervalId)
    clearTimeout(timeoutId)
    vibrateDevice(0)
  }
  const timeoutId = setTimeout(() => {
    stop()
    if (typeof onTimeout === 'function') onTimeout()
  }, RING_TIMEOUT_MS)
  return stop
}

export const roleNoun = (role) => (normalizeConsultRole(role) === 'attorney' ? 'attorney' : 'client')
