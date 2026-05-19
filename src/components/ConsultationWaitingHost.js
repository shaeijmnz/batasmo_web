import { useCallback, useEffect, useRef, useState } from 'react'
import ConsultationWaitingPopup from './ConsultationWaitingPopup'
import { subscribeConsultationWaitingNotifier } from '../lib/consultationChatPresence'
import {
  fetchAttorneyUpcomingAppointments,
  fetchClientChatEligibleAppointments,
  isConsultationChatWindowOpen,
  normalizeRole,
} from '../lib/userApi'

/**
 * App-wide listener: shows waiting popup when the other party is already in the
 * consultation chat but this user is on another page.
 */
export default function ConsultationWaitingHost({ page, pageParams, profile, onNavigate }) {
  const [popup, setPopup] = useState(null)
  const role = normalizeRole(profile?.role)
  const isClient = role === 'Client'
  const isAttorney = role === 'Attorney'
  const appointmentMetaRef = useRef({})

  const isViewingChat = useCallback(
    (appointmentId) => {
      if (!appointmentId) return false
      if (isClient && page === 'chat-room') return true
      if (isAttorney && page === 'attorney-messages') return true
      const paramId = String(pageParams?.appointmentId || '')
      if (!paramId) return false
      return String(appointmentId) === paramId
    },
    [page, pageParams?.appointmentId, isClient, isAttorney],
  )

  useEffect(() => {
    if (!profile?.id || (!isClient && !isAttorney)) {
      setPopup(null)
      return undefined
    }

    let cancelled = false
    let detach = () => {}

    const loadAndSubscribe = async () => {
      try {
        const meta = {}
        let ids = []

        if (isClient) {
          const rows = await fetchClientChatEligibleAppointments(profile.id)
          if (cancelled) return
          rows.forEach((row) => {
            ids.push(row.id)
            meta[row.id] = row.name
          })
        } else {
          const rows = await fetchAttorneyUpcomingAppointments(profile.id)
          if (cancelled) return
          rows
            .filter((row) =>
              isConsultationChatWindowOpen({
                status: row.status,
                scheduledAt: row.scheduledAt,
                slotDate: row.slotDate,
                slotTime: row.slotTime,
                paymentStatus: row.paymentStatus || 'unpaid',
              }),
            )
            .forEach((row) => {
              ids.push(row.id)
              meta[row.id] = row.name
            })
        }

        appointmentMetaRef.current = meta
        detach()

        detach = subscribeConsultationWaitingNotifier({
          appointmentIds: ids,
          role: isAttorney ? 'attorney' : 'client',
          userId: profile.id,
          isViewingChat,
          getOtherPartyName: (id) =>
            appointmentMetaRef.current[id] || (isAttorney ? 'Client' : 'Attorney'),
          onWaitingPopup: (payload) => setPopup(payload),
        })
      } catch (error) {
        console.warn('[consult-wait] global notifier setup failed', error?.message || error)
      }
    }

    loadAndSubscribe()
    const intervalId = window.setInterval(loadAndSubscribe, 60000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      detach()
      setPopup(null)
    }
  }, [profile?.id, isClient, isAttorney, isViewingChat])

  if (!popup) return null

  const handleGoToChatroom = () => {
    const appointmentId = popup.appointmentId
    setPopup(null)
    if (!appointmentId) return
    if (isClient) onNavigate('chat-room', { appointmentId })
    else if (isAttorney) onNavigate('attorney-messages', { appointmentId })
  }

  return (
    <ConsultationWaitingPopup
      title={popup.title}
      body={popup.body}
      onClose={() => setPopup(null)}
      onGoToChatroom={handleGoToChatroom}
    />
  )
}
