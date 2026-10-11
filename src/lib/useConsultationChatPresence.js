import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acquireConsultationPresence,
  isCallHandled,
  markCallHandled,
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
  const peerRef = useRef(null)
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
    peerRef.current = null
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
    const shownJoins = new Set()

    const stopPeer = handle.onPeer((summary) => {
      const isFirst = previous === null
      const prev = previous
      previous = summary
      peerRef.current = summary
      setPeer(summary)

      // Ring whenever the other party is in the call and I'm not, including when
      // they were already in it before I opened the chat.
      const callStartedAt = summary.inCall ? summary.callStartedAt : null
      if (!callStartedAt) {
        setIncomingCall(null)
      } else if (myInCallRef.current) {
        markCallHandled(appointmentId, callStartedAt)
      } else if (!isCallHandled(appointmentId, callStartedAt)) {
        const name = resolvePeerName(summary)
        setIncomingCall((current) =>
          current?.callStartedAt === callStartedAt ? current : { name, callStartedAt },
        )
      }

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
    return startCallRinging({
      onTimeout: () => {
        markCallHandled(appointmentId, incomingCall.callStartedAt)
        setIncomingCall(null)
      },
    })
  }, [incomingCall, appointmentId])

  const setInCall = useCallback(
    (value) => {
      myInCallRef.current = Boolean(value)
      if (value) {
        const peerCall = peerRef.current?.inCall ? peerRef.current.callStartedAt : null
        markCallHandled(appointmentId, peerCall)
        setIncomingCall(null)
      }
      handleRef.current?.setInCall(Boolean(value))
    },
    [appointmentId],
  )

  const showNoAnswer = useCallback(() => {
    setCallNotice({
      title: 'No answer',
      body: `${resolvePeerName(peer)} didn't answer. You can stay in the call or try again later.`,
    })
  }, [peer, resolvePeerName])

  const declineIncomingCall = useCallback(() => {
    markCallHandled(appointmentId, incomingCall?.callStartedAt)
    setIncomingCall(null)
    handleRef.current?.sendCallDeclined({ name: displayNameRef.current })
  }, [appointmentId, incomingCall])

  const joinIncomingCall = useCallback(() => {
    markCallHandled(appointmentId, incomingCall?.callStartedAt)
    setIncomingCall(null)
    if (typeof onJoinRef.current === 'function') onJoinRef.current()
  }, [appointmentId, incomingCall])

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
