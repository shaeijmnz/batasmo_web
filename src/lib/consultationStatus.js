/**
 * Shared consultation / video-call status for admin UI.
 */

export const isOngoingVideoCallRoom = (room) =>
  Boolean(room?.video_meeting_id) && !room?.is_closed

export const countOngoingVideoCallRooms = (rooms = []) =>
  (rooms || []).filter((room) => isOngoingVideoCallRoom(room)).length

/** Admin Consultations session list */
export function getConsultationSessionStatus({ appointmentStatus, isPaid, room }) {
  const value = String(appointmentStatus || '').toLowerCase()
  if (value === 'completed' || room?.is_closed) return 'Completed'
  if (isOngoingVideoCallRoom(room)) return 'In Progress'
  if (isPaid) return 'Scheduled'
  return null
}

/** Admin dashboard queue row badge */
export function getQueueRequestDisplayStatus(appointmentStatus, room) {
  if (isOngoingVideoCallRoom(room)) return 'In Progress'
  const value = String(appointmentStatus || '').toLowerCase()
  if (value === 'started' || value === 'in_progress' || value === 'in-progress' || value === 'active') {
    return 'In Progress'
  }
  if (value === 'completed') return 'Completed'
  if (value === 'confirmed' || value === 'rescheduled') return 'Scheduled'
  return 'Pending'
}
