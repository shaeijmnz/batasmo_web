import { useEffect, useRef, useState } from 'react'
import ConsultationWaitingPopup from './ConsultationWaitingPopup'
import {
  acquireConsultationPresence,
  isCallHandled,
  isConsultationChatOpen,
  markCallHandled,
  otherConsultRole,
  roleNoun,
  startCallRinging,
} from '../lib/consultationChatPresence'
import {
  fetchAttorneyUpcomingAppointments,
  fetchClientChatEligibleAppointments,
  isConsultationChatWindowOpen,
  normalizeRole,
} from '../lib/userApi'

const CHAT_PAGE_BY_ROLE = {
  client: 'chat-room',
  attorney: 'attorney-messages',
}

const WATCH_REFRESH_MS = 60_000

const resolveRole = (profile) => {
  const role = normalizeRole(profile?.role || '')
  if (role === 'Client') return 'client'
  if (role === 'Attorney') return 'attorney'
  return null
}

async function loadOpenConsultations(role, userId) {
  if (role === 'client') {
    const rows = await fetchClientChatEligibleAppointments(userId)
    return rows.map((row) => ({ appointmentId: String(row.id), otherPartyName: row.name || 'Attorney' }))
  }
  const rows = await fetchAttorneyUpcomingAppointments(userId)
  return rows
    .filter((row) =>
      isConsultationChatWindowOpen({
        status: row.status,
        scheduledAt: row.scheduledAt,
        slotDate: row.slotDate,
        slotTime: row.slotTime,
        paymentStatus: row.paymentStatus || 'unpaid',
      }),
    )
    .map((row) => ({ appointmentId: String(row.id), otherPartyName: row.name || 'Client' }))
}

/**
 * Outside the consultation chat page: "<Name> is in the consultation chatroom" and
 * incoming-call ringing for every open consultation. Silent on the chat page itself,
 * which handles its own notices.
 */
export default function ConsultationPresenceHost({ profile, currentPage, onNavigate }) {
  const role = resolveRole(profile)
  const userId = profile?.id ? String(profile.id) : ''
  const chatPage = role ? CHAT_PAGE_BY_ROLE[role] : ''
  const onChatPage = Boolean(chatPage) && currentPage === chatPage

  const [watches, setWatches] = useState([])
  const [enteredNotice, setEnteredNotice] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const handlesRef = useRef(new Map())
  const onChatPageRef = useRef(onChatPage)
  const namesRef = useRef({})
  const displayNameRef = useRef('')
  const seenJoinsRef = useRef(new Set())
  onChatPageRef.current = onChatPage
  displayNameRef.current = profile?.full_name || profile?.name || profile?.email || ''
  namesRef.current = Object.fromEntries(watches.map((item) => [item.appointmentId, item.otherPartyName]))

  useEffect(() => {
    if (!role || !userId) {
      setWatches([])
      return undefined
    }
    let cancelled = false
    const refresh = async () => {
      try {
        const list = await loadOpenConsultations(role, userId)
        if (cancelled) return
        setWatches((previous) => {
          const same =
            previous.length === list.length &&
            previous.every(
              (item, index) =>
                item.appointmentId === list[index].appointmentId &&
                item.otherPartyName === list[index].otherPartyName,
            )
          return same ? previous : list
        })
      } catch {
        // Keep the current watch list; next refresh retries.
      }
    }
    refresh()
    const intervalId = window.setInterval(refresh, WATCH_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [role, userId, currentPage])

  const watchKey = watches.map((item) => item.appointmentId).join(',')

  useEffect(() => {
    if (!role || !userId || !watchKey) return undefined
    const handles = handlesRef.current
    const fallbackName = otherConsultRole(role) === 'attorney' ? 'Attorney' : 'Client'

    const cleanups = watchKey.split(',').map((appointmentId) => {
      const handle = acquireConsultationPresence({
        appointmentId,
        role,
        userId,
        displayName: displayNameRef.current,
        mode: 'watch',
      })
      if (!handle) return () => {}
      handles.set(appointmentId, handle)

      // Ring whenever the other party is in the call, however long ago they joined.
      // Once this consultation's chat page is open, the page rings instead.
      const evaluateCall = (summary) => {
        const callStartedAt = summary?.inCall ? summary.callStartedAt : null
        const ring =
          callStartedAt &&
          !isConsultationChatOpen(appointmentId) &&
          !isCallHandled(appointmentId, callStartedAt)
        if (!ring) {
          setIncomingCall((current) => (current?.appointmentId === appointmentId ? null : current))
          return
        }
        const name = summary.displayName || namesRef.current[appointmentId] || fallbackName
        setIncomingCall((current) =>
          current?.appointmentId === appointmentId && current.callStartedAt === callStartedAt
            ? current
            : { appointmentId, name, callStartedAt },
        )
      }

      const stopLocal = handle.onLocalChange(() => evaluateCall(handle.lastPeer()))

      const stopPeer = handle.onPeer((summary) => {
        const name = summary.displayName || namesRef.current[appointmentId] || fallbackName
        // On the chat page the "in the chatroom" notice belongs to the page; only remember it.
        const silent = onChatPageRef.current

        evaluateCall(summary)

        if (summary.joinedAt) {
          const joinKey = `${appointmentId}:${summary.joinedAt}`
          if (!seenJoinsRef.current.has(joinKey)) {
            seenJoinsRef.current.add(joinKey)
            if (!silent) setEnteredNotice({ appointmentId, name })
          }
        } else {
          setEnteredNotice((current) => (current?.appointmentId === appointmentId ? null : current))
        }
      })

      return () => {
        stopPeer()
        stopLocal()
        handle.release()
        if (handles.get(appointmentId) === handle) handles.delete(appointmentId)
      }
    })

    return () => {
      cleanups.forEach((cleanup) => cleanup())
      setEnteredNotice(null)
      setIncomingCall(null)
    }
  }, [role, userId, watchKey])

  useEffect(() => {
    if (onChatPage) setEnteredNotice(null)
  }, [onChatPage])

  useEffect(() => {
    if (!incomingCall) return undefined
    return startCallRinging({
      onTimeout: () => {
        markCallHandled(incomingCall.appointmentId, incomingCall.callStartedAt)
        setIncomingCall(null)
      },
    })
  }, [incomingCall])

  if (!role) return null

  if (incomingCall) {
    const { appointmentId, name, callStartedAt } = incomingCall
    return (
      <ConsultationWaitingPopup
        title={`${name} is calling you`}
        body="Video call for your consultation. Tap Join to connect."
        actionLabel="Join"
        onAction={() => {
          markCallHandled(appointmentId, callStartedAt)
          setIncomingCall(null)
          onNavigate(chatPage, { appointmentId, joinCall: true })
        }}
        closeLabel="Decline"
        onClose={() => {
          markCallHandled(appointmentId, callStartedAt)
          setIncomingCall(null)
          handlesRef.current.get(appointmentId)?.sendCallDeclined({ name: displayNameRef.current })
        }}
        closeOnBackdrop={false}
      />
    )
  }

  if (onChatPage) return null

  if (enteredNotice) {
    const { appointmentId, name } = enteredNotice
    return (
      <ConsultationWaitingPopup
        title={`${name} is in the consultation chatroom`}
        body={`Your ${roleNoun(otherConsultRole(role))} is already in the consultation chatroom and is waiting for you.`}
        actionLabel="Go to Chatroom"
        onAction={() => {
          setEnteredNotice(null)
          onNavigate(chatPage, { appointmentId })
        }}
        closeLabel="Not Now"
        onClose={() => setEnteredNotice(null)}
      />
    )
  }

  return null
}
