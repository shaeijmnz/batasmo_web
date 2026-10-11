import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acquireConsultationPresence,
  normalizeConsultRole,
  otherConsultRole,
  roleNoun,
  startCallRinging,
  vibrateDevice,
} from './consultationChatPresence'

/**
 * Presence for the consultation chat page: tracks "in chat"/"in call", raises the
 * "joined the chat" notice, incoming-call ringing, and call-declined / no-answer notices.
 * Returns `popup` props for ConsultationWaitingPopup (incoming call has priority).
 */
export default function useConsultationChatPresence({
  appointmentId,
  role,
  userId,
  displayName,
  otherPartyName,
  enabled = true,
  onJoinIncomingCall,
}) {
  const myRole = normalizeConsultRole(role)
  const [peer, setPeer] = useState(null)
  const [enteredNotice, setEnteredNotice] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callNotice, setCallNotice] = useState(null)
  const handleRef = useRef(null)
  const myInCallRef = useRef(false)
  const displayNameRef = useRef(displayName)
  const otherNameRef = useRef(otherPartyName)
  const onJoinRef = useRef(onJoinIncomingCall)
  displayNameRef.current = displayName
  otherNameRef.current = otherPartyName
  onJoinRef.current = onJoinIncomingCall

  const resolvePeerName = useCallback(
    (summary) =>
      String(summary?.displayName || '').trim() ||
      String(otherNameRef.current || '').trim() ||
      (otherConsultRole(myRole) === 'attorney' ? 'Attorney' : 'Client'),
    [myRole],
  )

  useEffect(() => {
    setPeer(null)
    setEnteredNotice(null)
    setIncomingCall(null)
    setCallNotice(null)
    myInCallRef.current = false
    if (!enabled || !appointmentId || !userId) return undefined

    const handle = acquireConsultationPresence({
      appointmentId,
      role: myRole,
      userId,
      displayName: displayNameRef.current,
      mode: 'chat',
    })
    if (!handle) return undefined
    handleRef.current = handle

    let previous = null
    const seenCalls = new Set()
    const shownJoins = new Set()

    const stopPeer = handle.onPeer((summary) => {
      const isFirst = previous === null
      const prev = previous
      previous = summary
      setPeer(summary)

      if (summary.inCall && summary.callStartedAt && !seenCalls.has(summary.callStartedAt)) {
        seenCalls.add(summary.callStartedAt)
        if (!isFirst && !myInCallRef.current) {
          setIncomingCall({ name: resolvePeerName(summary), callStartedAt: summary.callStartedAt })
        }
      }
      if (!summary.inCall) setIncomingCall(null)

      // First summary only records who is already here; the header shows them online.
      if (isFirst) return
      if (summary.joinedAt && summary.joinedAt !== prev.joinedAt) {
        const key = `${appointmentId}:${summary.joinedAt}`
        if (shownJoins.has(key)) return
        shownJoins.add(key)
        vibrateDevice(250)
        setEnteredNotice({
          title: `${resolvePeerName(summary)} joined the chat`,
          body: `Your ${roleNoun(otherConsultRole(myRole))} just entered the consultation chatroom.`,
        })
      }
    })

    const stopDecline = handle.onCallDeclined((payload) => {
      const name = String(payload?.name || '').trim() || resolvePeerName(previous)
      setCallNotice({ title: 'Call declined', body: `${name} declined the video call.` })
    })

    return () => {
      stopPeer()
      stopDecline()
      handle.release()
      if (handleRef.current === handle) handleRef.current = null
      myInCallRef.current = false
    }
  }, [appointmentId, userId, myRole, enabled, resolvePeerName])

  useEffect(() => {
    if (!incomingCall) return undefined
    return startCallRinging({ onTimeout: () => setIncomingCall(null) })
  }, [incomingCall])

  const setInCall = useCallback((value) => {
    myInCallRef.current = Boolean(value)
    if (value) setIncomingCall(null)
    handleRef.current?.setInCall(Boolean(value))
  }, [])

  const showNoAnswer = useCallback(() => {
    setCallNotice({
      title: 'No answer',
      body: `${resolvePeerName(peer)} didn't answer. You can stay in the call or try again later.`,
    })
  }, [peer, resolvePeerName])

  const declineIncomingCall = useCallback(() => {
    setIncomingCall(null)
    handleRef.current?.sendCallDeclined({ name: displayNameRef.current })
  }, [])

  const joinIncomingCall = useCallback(() => {
    setIncomingCall(null)
    if (typeof onJoinRef.current === 'function') onJoinRef.current()
  }, [])

  let popup = null
  if (incomingCall) {
    popup = {
      title: `${incomingCall.name} is calling you`,
      body: 'Video call for your consultation. Tap Join to connect.',
      actionLabel: 'Join',
      onAction: joinIncomingCall,
      closeLabel: 'Decline',
      onClose: declineIncomingCall,
      closeOnBackdrop: false,
    }
  } else if (callNotice) {
    popup = { ...callNotice, onClose: () => setCallNotice(null) }
  } else if (enteredNotice) {
    popup = { ...enteredNotice, onClose: () => setEnteredNotice(null) }
  }

  return {
    peer,
    peerInCall: Boolean(peer?.inCall),
    setInCall,
    showNoAnswer,
    popup,
  }
}
