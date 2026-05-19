import { supabase } from './supabaseClient'
import { parseNotificationImageUrl } from './announcementImages'
import { isSignupVerificationComplete, signOutIfSignupIncomplete } from './signupVerification'
import {
  getConsultationBranchesForAttorney,
  parseConsultationBranchFromTitle,
} from './consultationBranches'

const isMissingRelationError = (error) =>
  error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('does not exist')

const normalizeStringArray = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item || '').trim())
    .filter(Boolean)

const LANDING_CONTENT_DEFAULTS = {
  hero_title: 'Legal & Notarial Services Now in Your Pocket',
  hero_subtitle:
    'Experience the convenience of managing all your legal matters on the go. Expert advice and certified notarial services are now just a tap away.',
  services_title: 'Our Services',
  services_subtitle: 'Comprehensive legal solutions tailored for your business and personal needs.',
  attorneys_title: 'Meet Our Attorneys',
  attorneys_subtitle: 'Browse verified legal experts and choose the attorney that best matches your concern.',
}

const ATTORNEY_APPOINTMENTS_CACHE_TTL_MS = 5000
const REALTIME_REFRESH_DEBOUNCE_MS = 300
const attorneyAppointmentsCache = new Map()

const isMissingColumnError = (error, columnName) =>
  error?.code === '42703' &&
  String(error?.message || '')
    .toLowerCase()
    .includes(String(columnName || '').toLowerCase())

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const normalizeDateTimeForUi = (value) => {
  if (!value) return { date: 'TBD', time: 'TBD', parsed: null }

  const raw = String(value).trim()
  const hasTimezoneInfo = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw)

  let parsed
  if (hasTimezoneInfo) {
    parsed = new Date(raw.replace(' ', 'T').replace(/\+00$/, 'Z'))
  } else {
    const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
    if (localMatch) {
      parsed = new Date(
        Number(localMatch[1]),
        Number(localMatch[2]) - 1,
        Number(localMatch[3]),
        Number(localMatch[4]),
        Number(localMatch[5]),
      )
    } else {
      parsed = new Date(raw)
    }
  }

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { date: 'TBD', time: 'TBD', parsed: null }
  }

  return {
    date: parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
    parsed,
  }
}

/** Positive-fee consultations only count towards analytics/profile totals after they are paid. */
const isPaidOrFreeConsultation = (appt) => {
  const fee = Number(appt?.amount ?? 0)
  if (!Number.isFinite(fee) || fee <= 0) return true
  return Boolean(appt?.consultationPaid)
}

/**
 * Time window during which a freshly cancelled appointment is still surfaced on
 * the attorney's queue (so they see the booking flip to "Cancelled" before it
 * naturally drops off). Kept in sync with the realtime refresh delay below.
 */
const RECENTLY_CANCELLED_WINDOW_MS = 10000

const isRecentlyCancelledAppointment = (appt) => {
  if (String(appt?.status || '').toLowerCase() !== 'cancelled') return false
  const updatedAtMs = appt?.updated_at ? new Date(appt.updated_at).getTime() : 0
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) return false
  return Date.now() - updatedAtMs < RECENTLY_CANCELLED_WINDOW_MS
}

async function fetchPaidAppointmentIdsForIdList(appointmentIds) {
  const unique = [...new Set((appointmentIds || []).filter(Boolean))]
  if (!unique.length) return new Set()

  const paid = new Set()
  const chunkSize = 120
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('transactions')
      .select('appointment_id')
      .in('appointment_id', chunk)
      .eq('payment_status', 'paid')

    if (error) throw error
    ;(data || []).forEach((row) => {
      if (row?.appointment_id) paid.add(row.appointment_id)
    })
  }
  return paid
}

const mapAppointmentRow = (row) => {
  const client = Array.isArray(row?.client) ? row.client[0] : row?.client
  const attorney = Array.isArray(row?.attorney) ? row.attorney[0] : row?.attorney
  const slotDateTime = row?.slot_date && row?.slot_time ? parseSlotDateTime(row.slot_date, row.slot_time) : null
  const schedule =
    (slotDateTime ? slotDateTime.toISOString() : null) ||
    row?.scheduled_at ||
    row?.preferred_date ||
    row?.updated_at ||
    row?.created_at ||
    null
  const datetime = normalizeDateTimeForUi(schedule)
  return {
    ...row,
    client_name: client?.full_name || 'Client',
    attorney_name: attorney?.full_name || 'Attorney',
    scheduled_value: schedule,
    date_label: datetime.date,
    time_label: datetime.time,
    parsed_scheduled_at: datetime.parsed,
  }
}

const formatNotificationTimestamp = (value) => {
  if (!value) return 'Now'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Now'
  return parsed.toLocaleString()
}

const buildDerivedAttorneyNotifications = ({ appointments = [], paidTransactions = [] }) => {
  const appointmentById = new Map(
    (appointments || []).map((item) => [item.id, item]),
  )

  const bookingEvents = (appointments || [])
    .filter((item) => {
      const status = String(item?.status || '').toLowerCase()
      return status !== 'cancelled' && status !== 'rejected'
    })
    .map((item) => {
      const createdAt = item?.created_at || item?.updated_at || null
      if (!createdAt) return null
      return {
        id: `derived-booking-${item.id}`,
        text: `${item.client_name || 'A client'} booked ${item.title || 'a consultation'} on ${item.date_label} at ${item.time_label}.`,
        time: formatNotificationTimestamp(createdAt),
        unread: true,
        sortAt: new Date(createdAt).getTime() || 0,
      }
    })
    .filter(Boolean)

  const paymentEvents = (paidTransactions || [])
    .map((tx) => {
      const createdAt = tx?.created_at || null
      if (!createdAt) return null
      const appointment = tx?.appointment_id ? appointmentById.get(tx.appointment_id) : null
      const clientName = appointment?.client_name || 'A client'
      const title = appointment?.title || 'a consultation'
      const amount = Number(tx?.amount || 0)

      return {
        id: `derived-paid-${tx.id || `${tx.appointment_id || 'appt'}-${createdAt}`}`,
        text: `${clientName} paid ${amount > 0 ? `PHP ${amount.toLocaleString()}` : 'for'} ${title}.`,
        time: formatNotificationTimestamp(createdAt),
        unread: true,
        sortAt: new Date(createdAt).getTime() || 0,
      }
    })
    .filter(Boolean)

  return [...bookingEvents, ...paymentEvents]
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 20)
    .map(({ sortAt, ...notification }) => notification)
}

const invalidateAttorneyAppointmentsCache = (userId) => {
  if (userId) {
    attorneyAppointmentsCache.delete(userId)
    return
  }

  attorneyAppointmentsCache.clear()
}

export const resetUserApiRuntimeState = () => {
  invalidateAttorneyAppointmentsCache()
  sessionProfileCache = null
  lastSessionProfileTime = 0
}

/** Appointment statuses treated as an active live consultation (chat alerts suppressed for client). */
const CONSULTATION_IN_CALL_STATUSES = new Set(['started', 'in_progress', 'in-progress', 'active'])

async function fetchStaffUserIds() {
  const { data, error } = await supabase.from('profiles').select('id').in('role', ['Admin', 'Secretary'])
  if (error) {
    console.warn('[notify] fetchStaffUserIds failed', error)
    return []
  }
  return (data || []).map((row) => row.id).filter(Boolean)
}

/* ============================================================================
 * SUPPORT MESSAGES (Client ↔ Admin)
 * ----------------------------------------------------------------------------
 * Table: public.support_messages
 *   id, client_id, sender_id, sender_role ('client'|'admin'), message,
 *   is_read, created_at
 *
 * Realtime is enabled via `alter publication supabase_realtime add table ...`
 * in the migration. The migration also adds RLS so clients only see/insert
 * their own thread and admins can read/write all.
 * ==========================================================================*/

const SUPPORT_TABLE = 'support_messages'

const mapSupportMessage = (row) => ({
  id: row.id,
  clientId: row.client_id,
  senderId: row.sender_id,
  senderRole: row.sender_role,
  message: row.message || '',
  isRead: Boolean(row.is_read),
  createdAt: row.created_at || null,
})

export async function fetchClientSupportThread(clientId, options = {}) {
  if (!clientId) return []
  const limit = Number(options?.limit || 200)

  const { data, error } = await supabase
    .from(SUPPORT_TABLE)
    .select('id, client_id, sender_id, sender_role, message, is_read, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(Number.isFinite(limit) ? limit : 200)

  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }

  return (data || []).map(mapSupportMessage)
}

export async function fetchClientSupportUnreadCount(clientId) {
  if (!clientId) return 0
  const { count, error } = await supabase
    .from(SUPPORT_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('sender_role', 'admin')
    .eq('is_read', false)
  if (error) {
    if (isMissingRelationError(error)) return 0
    console.warn('[support] fetchClientSupportUnreadCount failed', error)
    return 0
  }
  return Number(count || 0)
}

export async function sendClientSupportMessage({ clientId, message }) {
  if (!clientId) throw new Error('clientId is required.')
  const body = String(message || '').trim()
  if (!body) throw new Error('Message cannot be empty.')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated.')
  if (String(user.id) !== String(clientId)) {
    throw new Error('You can only send messages from your own account.')
  }

  const { data, error } = await supabase
    .from(SUPPORT_TABLE)
    .insert({
      client_id: clientId,
      sender_id: user.id,
      sender_role: 'client',
      message: body,
      is_read: false,
    })
    .select('id, client_id, sender_id, sender_role, message, is_read, created_at')
    .single()

  if (error) throw error

  try {
    const clientName = await resolveClientDisplayName(clientId)
    const staffIds = await fetchStaffUserIds()
    await insertNotificationsForUserIds(staffIds, {
      title: 'New support message',
      body: `${clientName}: ${body.slice(0, 140)} [support:${clientId}]`,
      type: 'admin_general',
    })
  } catch (notifyError) {
    console.warn('[support] admin notify after client send failed', notifyError)
  }

  return mapSupportMessage(data)
}

export async function markClientSupportMessagesAsRead(clientId) {
  if (!clientId) return
  const { error } = await supabase
    .from(SUPPORT_TABLE)
    .update({ is_read: true })
    .eq('client_id', clientId)
    .eq('sender_role', 'admin')
    .eq('is_read', false)
  if (error && !isMissingRelationError(error)) {
    console.warn('[support] markClientSupportMessagesAsRead failed', error)
  }
}

export function subscribeToClientSupport(clientId, onChange) {
  if (!clientId) return () => {}
  const channel = supabase
    .channel(`support_client_${clientId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: SUPPORT_TABLE,
        filter: `client_id=eq.${clientId}`,
      },
      () => {
        try {
          onChange?.()
        } catch (err) {
          console.warn('[support] client subscriber callback error', err)
        }
      },
    )
    .subscribe()

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      // ignore
    }
  }
}

/** Admin side: list all clients who have a thread, with the latest message preview + unread count from client. */
export async function fetchAdminSupportThreads(options = {}) {
  const limit = Number(options?.limit || 100)

  const { data, error } = await supabase
    .from(SUPPORT_TABLE)
    .select('id, client_id, sender_id, sender_role, message, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 100)

  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }

  const byClient = new Map()
  for (const row of data || []) {
    const cid = row.client_id
    if (!cid) continue
    const existing = byClient.get(cid)
    if (!existing) {
      byClient.set(cid, {
        clientId: cid,
        lastMessage: row.message || '',
        lastSenderRole: row.sender_role,
        lastAt: row.created_at,
        unreadFromClient: row.sender_role === 'client' && !row.is_read ? 1 : 0,
      })
    } else if (row.sender_role === 'client' && !row.is_read) {
      existing.unreadFromClient += 1
    }
  }

  const clientIds = [...byClient.keys()]
  if (!clientIds.length) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', clientIds)
  if (profilesError) {
    console.warn('[support] fetchAdminSupportThreads profile lookup failed', profilesError)
  }
  const profileById = new Map((profiles || []).map((p) => [p.id, p]))

  return [...byClient.values()]
    .map((row) => {
      const profile = profileById.get(row.clientId)
      return {
        ...row,
        clientName: profile?.full_name || profile?.email || 'Client',
      }
    })
    .sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')))
}

export async function fetchAdminSupportMessages(clientId) {
  if (!clientId) return []
  const { data, error } = await supabase
    .from(SUPPORT_TABLE)
    .select('id, client_id, sender_id, sender_role, message, is_read, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }
  return (data || []).map(mapSupportMessage)
}

export async function sendAdminSupportMessage({ clientId, message }) {
  if (!clientId) throw new Error('clientId is required.')
  const body = String(message || '').trim()
  if (!body) throw new Error('Message cannot be empty.')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated.')

  const { data, error } = await supabase
    .from(SUPPORT_TABLE)
    .insert({
      client_id: clientId,
      sender_id: user.id,
      sender_role: 'admin',
      message: body,
      is_read: false,
    })
    .select('id, client_id, sender_id, sender_role, message, is_read, created_at')
    .single()

  if (error) throw error

  try {
    await supabase.from('notifications').insert({
      user_id: clientId,
      title: 'Message from BatasMo Admin',
      body: `${body.slice(0, 140)} [support:${clientId}]`,
      type: 'admin_general',
      is_read: false,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[support] client notify after admin send failed', e)
  }

  return mapSupportMessage(data)
}

export async function markAdminSupportMessagesAsRead(clientId) {
  if (!clientId) return
  const { error } = await supabase
    .from(SUPPORT_TABLE)
    .update({ is_read: true })
    .eq('client_id', clientId)
    .eq('sender_role', 'client')
    .eq('is_read', false)
  if (error && !isMissingRelationError(error)) {
    console.warn('[support] markAdminSupportMessagesAsRead failed', error)
  }
}

export function subscribeToAdminSupport(onChange) {
  const channel = supabase
    .channel('support_admin_all')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: SUPPORT_TABLE,
      },
      () => {
        try {
          onChange?.()
        } catch (err) {
          console.warn('[support] admin subscriber callback error', err)
        }
      },
    )
    .subscribe()

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      // ignore
    }
  }
}

/* ============================================================================
 * ADMIN SCHEDULE HELPER (used inside the admin support drawer)
 * --------------------------------------------------------------------------*/

export async function fetchAttorneysForAdminPicker() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'Attorney')
    .order('full_name', { ascending: true })

  if (error) {
    console.warn('[admin-schedule] fetchAttorneysForAdminPicker failed', error)
    return []
  }
  return (data || []).map((row) => ({
    id: row.id,
    name: row.full_name || row.email || 'Attorney',
  }))
}

export async function fetchAttorneyFreeSlotsForDate(attorneyId, dateIso) {
  if (!attorneyId || !dateIso) return []

  const { data, error } = await supabase
    .from('availability_slots')
    .select('id, date, time, is_booked')
    .eq('attorney_id', attorneyId)
    .eq('date', dateIso)
    .eq('is_booked', false)
    .order('time', { ascending: true })

  if (error && !isMissingColumnError(error, 'date') && !isMissingColumnError(error, 'time')) {
    throw error
  }

  if (data && !error) {
    return (data || []).map((slot) => {
      const start = parseSlotDateTime(slot.date, slot.time)
      return {
        id: slot.id,
        date: slot.date || dateIso,
        time: slot.time || '',
        startIso: start ? start.toISOString() : '',
        label: start
          ? start.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
          : slot.time || 'TBD',
      }
    })
  }

  // Fallback for schemas using start_time
  const dayStart = new Date(`${dateIso}T00:00:00`).toISOString()
  const dayEnd = new Date(`${dateIso}T23:59:59`).toISOString()
  const { data: fallback, error: fbErr } = await supabase
    .from('availability_slots')
    .select('id, start_time, is_booked')
    .eq('attorney_id', attorneyId)
    .eq('is_booked', false)
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)
    .order('start_time', { ascending: true })
  if (fbErr) throw fbErr
  return (fallback || []).map((slot) => {
    const start = slot.start_time ? new Date(slot.start_time) : null
    return {
      id: slot.id,
      date: dateIso,
      time: start ? formatSlotTime(start) : '',
      startIso: start ? start.toISOString() : '',
      label: start
        ? start.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
        : 'TBD',
    }
  })
}

export async function fetchClientActiveAppointmentsForAdmin(clientId) {
  if (!clientId) return []

  // Prefer the Render backend (service role) so the admin can see ALL the
  // client's active appointments regardless of RLS on the browser client.
  try {
    const session = (await supabase.auth.getSession())?.data?.session
    if (session?.access_token) {
      const baseUrl = resolvePaymentApiBaseUrl()
      const response = await fetch(
        `${baseUrl}/admin/clients/${encodeURIComponent(clientId)}/active-appointments`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (response.ok && Array.isArray(payload.appointments)) {
        return payload.appointments
      }
      if (response.status === 401 || response.status === 403) {
        console.warn('[admin-schedule] backend list HTTP', response.status, payload?.error || payload)
      } else {
        console.warn('[admin-schedule] backend list HTTP', response.status, payload?.error || payload)
      }
    }
  } catch (err) {
    console.warn('[admin-schedule] backend list request failed, falling back to direct Supabase', err?.message || err)
  }

  // Fallback: direct browser query (may be blocked by RLS but worth a try).
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, title, status, scheduled_at, slot_id, slot_date, slot_time, attorney_id, attorney:attorney_id(full_name)',
    )
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.warn('[admin-schedule] fetchClientActiveAppointmentsForAdmin fallback failed', error)
    return []
  }

  const FINAL = new Set(['cancelled', 'rejected', 'completed'])
  return (data || [])
    .filter((row) => !FINAL.has(String(row.status || '').toLowerCase()))
    .map((row) => ({
      id: row.id,
      title: row.title || 'Consultation',
      status: row.status || '',
      scheduledAt: row.scheduled_at || '',
      slotId: row.slot_id || '',
      slotDate: row.slot_date || '',
      slotTime: row.slot_time || '',
      attorneyId: row.attorney_id || '',
      attorneyName: row.attorney?.full_name || '',
    }))
}

/**
 * Admin walk-in: create a Client auth user (email confirmed) + profile via Render backend.
 */
export async function adminCreateWalkInClient({ email, password, fullName }) {
  const session = (await supabase.auth.getSession())?.data?.session
  if (!session?.access_token) {
    throw new Error('You must be signed in as admin or secretary to add a client.')
  }
  const baseUrl = resolvePaymentApiBaseUrl()
  const body = {
    email: String(email || '').trim().toLowerCase(),
    fullName: String(fullName || '').trim() || undefined,
  }
  const trimmedPassword = String(password || '').trim()
  if (trimmedPassword) {
    body.password = trimmedPassword
  }
  const response = await fetch(`${baseUrl}/admin/clients/walk-in`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Request failed (${response.status}).`)
  }
  return payload
}

/**
 * Admin: create an Attorney auth user (email confirmed) + profile via Render backend.
 */
export async function adminCreateWalkInAttorney({ email, password, fullName, specialty }) {
  const session = (await supabase.auth.getSession())?.data?.session
  if (!session?.access_token) {
    throw new Error('You must be signed in as admin to add an attorney.')
  }
  const baseUrl = resolvePaymentApiBaseUrl()
  const response = await fetch(`${baseUrl}/admin/attorneys/walk-in`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      password: String(password || ''),
      fullName: String(fullName || '').trim(),
      specialty: String(specialty || '').trim() || undefined,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Request failed (${response.status}).`)
  }
  return payload
}

/**
 * Admin-driven reschedule: frees the old slot, books the new slot, updates the
 * appointment to point at the new slot, and notifies the client + attorney +
 * other admins.
 *
 * Prefer the Render backend (`POST /admin/appointments/reschedule`) so updates
 * succeed even when RLS blocks the browser Supabase client; falls back to the
 * browser client if the backend is unreachable.
 */
export async function adminRescheduleAppointment({ appointmentId, newSlotId }) {
  const session = (await supabase.auth.getSession())?.data?.session
  if (session?.access_token) {
    try {
      const baseUrl = resolvePaymentApiBaseUrl()
      const response = await fetch(`${baseUrl}/admin/appointments/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ appointmentId, newSlotId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.ok) {
        return {
          newScheduledIso: payload.newScheduledIso,
          slotId: payload.slotId,
        }
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(payload?.error || payload?.message || 'Not authorized to reschedule.')
      }
      console.warn('[admin-schedule] backend reschedule HTTP', response.status, payload?.error || payload)
    } catch (e) {
      if (e?.message && (e.message.includes('Not authorized') || e.message.includes('Invalid session'))) {
        throw e
      }
      console.warn('[admin-schedule] backend reschedule request failed, using direct Supabase', e?.message || e)
    }
  }

  if (!appointmentId) throw new Error('appointmentId required')
  if (!newSlotId) throw new Error('newSlotId required')

  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .select('id, attorney_id, client_id, title, slot_id, slot_date, slot_time, scheduled_at, status')
    .eq('id', appointmentId)
    .maybeSingle()
  if (apptErr) throw apptErr
  if (!appt) throw new Error('Appointment not found.')

  const { data: newSlot, error: newSlotErr } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('id', newSlotId)
    .maybeSingle()
  if (newSlotErr) throw newSlotErr
  if (!newSlot) throw new Error('Selected slot no longer exists.')
  if (newSlot.is_booked) throw new Error('Selected slot is already booked.')
  if (appt.attorney_id && newSlot.attorney_id && appt.attorney_id !== newSlot.attorney_id) {
    throw new Error('Selected slot belongs to a different attorney than this appointment.')
  }

  let parsedStart = parseSlotDateTime(newSlot.date, newSlot.time)
  if (!parsedStart && newSlot.start_time) {
    const d = new Date(newSlot.start_time)
    parsedStart = Number.isNaN(d.getTime()) ? null : d
  }
  if (!parsedStart) throw new Error('Selected slot has invalid date/time.')
  const newScheduledIso = parsedStart.toISOString()
  const nowIso = new Date().toISOString()

  const slotDateForUpdate =
    newSlot.date || (newSlot.start_time ? newScheduledIso.slice(0, 10) : null)
  const slotTimeForUpdate =
    newSlot.time ||
    (newSlot.start_time
      ? formatSlotTime(new Date(newSlot.start_time))
      : null)

  // Free the previous slot first so it can be rebooked by others. Best-effort.
  let oldSlotIdToFree = appt.slot_id || null
  if (!oldSlotIdToFree && appt.attorney_id && appt.slot_date && appt.slot_time) {
    const { data: candidates } = await supabase
      .from('availability_slots')
      .select('id, time')
      .eq('attorney_id', appt.attorney_id)
      .eq('date', appt.slot_date)
    if (Array.isArray(candidates) && candidates.length) {
      const targetMs = parseSlotDateTime(appt.slot_date, appt.slot_time)?.getTime() || 0
      const match = candidates.find((row) => {
        const parsed = parseSlotDateTime(appt.slot_date, row.time)
        return parsed && parsed.getTime() === targetMs
      })
      oldSlotIdToFree = match?.id || null
    }
  }
  if (oldSlotIdToFree && oldSlotIdToFree !== newSlot.id) {
    const { error: freeErr } = await supabase
      .from('availability_slots')
      .update({ is_booked: false, updated_at: nowIso })
      .eq('id', oldSlotIdToFree)
    if (freeErr) console.warn('[admin-schedule] free old slot failed', freeErr)
  }

  // Book the new slot
  const { error: bookErr } = await supabase
    .from('availability_slots')
    .update({ is_booked: true, updated_at: nowIso })
    .eq('id', newSlot.id)
    .eq('is_booked', false)
  if (bookErr) {
    console.warn('[admin-schedule] new slot booking failed', bookErr)
    throw new Error('Failed to reserve the new slot. It may have just been booked.')
  }

  // Build the appointment update payload. Try the rich version first; fall
  // back to the minimal version if some columns do not exist on this DB.
  const richUpdate = {
    scheduled_at: newScheduledIso,
    slot_id: newSlot.id,
    slot_date: slotDateForUpdate,
    slot_time: slotTimeForUpdate,
    status: 'rescheduled',
    updated_at: nowIso,
  }

  let { error: updateErr } = await supabase
    .from('appointments')
    .update(richUpdate)
    .eq('id', appointmentId)

  if (updateErr) {
    console.warn('[admin-schedule] full update failed, retrying minimal', updateErr)
    const minimalUpdate = {
      scheduled_at: newScheduledIso,
      status: 'rescheduled',
      updated_at: nowIso,
    }
    const retry = await supabase.from('appointments').update(minimalUpdate).eq('id', appointmentId)
    if (retry.error) {
      // Roll back the new slot booking so we don't strand it.
      await supabase
        .from('availability_slots')
        .update({ is_booked: false, updated_at: nowIso })
        .eq('id', newSlot.id)
      throw retry.error
    }
  }

  // Cache invalidation
  invalidateAvailabilityCache(appt.attorney_id, appt.slot_date)
  invalidateAvailabilityCache(newSlot.attorney_id || appt.attorney_id, newSlot.date || slotDateForUpdate)
  invalidateAttorneyAppointmentsCache(appt.attorney_id)

  // Notifications
  const whenLabel = parsedStart.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  try {
    const clientName = await resolveClientDisplayName(appt.client_id)
    if (appt.attorney_id) {
      await supabase.from('notifications').insert({
        user_id: appt.attorney_id,
        title: 'Appointment rescheduled by Admin',
        body: `${clientName}'s ${appt.title || 'consultation'} was moved to ${whenLabel} by an admin.`,
        type: 'consultation',
        is_read: false,
        created_at: nowIso,
      })
    }
    if (appt.client_id) {
      await supabase.from('notifications').insert({
        user_id: appt.client_id,
        title: 'Your consultation was rescheduled',
        body: `Admin moved your ${appt.title || 'consultation'} to ${whenLabel}.`,
        type: 'reschedule',
        is_read: false,
        created_at: nowIso,
      })
    }
    await notifyAdminsWithBodyMarker({
      title: 'Admin reschedule recorded',
      body: `Appointment ${String(appointmentId).slice(0, 8)}… moved to ${whenLabel}.`,
      type: 'admin_general',
      marker: `[adminresched:${appointmentId}:${newScheduledIso.slice(0, 24)}]`,
    })
  } catch (notifErr) {
    console.warn('[admin-schedule] notify after reschedule failed', notifErr)
  }

  return { newScheduledIso, slotId: newSlot.id }
}

async function insertNotificationsForUserIds(userIds, { title, body, type = 'general' }) {
  const unique = [...new Set((userIds || []).filter(Boolean))]
  if (!unique.length) return
  const nowIso = new Date().toISOString()
  const chunkSize = 80
  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize)
    const rows = slice.map((user_id) => ({
      user_id,
      title: String(title || 'Notification'),
      body: String(body || ''),
      type: String(type || 'general'),
      is_read: false,
      created_at: nowIso,
    }))
    const { error } = await supabase.from('notifications').insert(rows)
    if (error) console.warn('[notify] insertNotificationsForUserIds failed', error)
  }
}

/** One notification per admin user, skipped if that admin already has this marker in any notification body. */
async function notifyAdminsWithBodyMarker({ title, body, type = 'admin_general', marker }) {
  if (!marker) return
  const staffIds = await fetchStaffUserIds()
  for (const uid of staffIds) {
    try {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', uid)
        .ilike('body', `%${marker}%`)
        .limit(1)
      if (existing?.length) continue
      await insertNotificationsForUserIds([uid], {
        title,
        body: `${body} ${marker}`.trim(),
        type,
      })
    } catch (e) {
      console.warn('[notify] admin marker notify failed', e)
    }
  }
}

async function throttleUpdateOrInsertAttorneyNotify({ attorneyId, marker, title, body, type, windowMs }) {
  if (!attorneyId || !marker) return
  const { data: rows } = await supabase
    .from('notifications')
    .select('id, created_at')
    .eq('user_id', attorneyId)
    .ilike('body', `%${marker}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  const nowIso = new Date().toISOString()
  if (rows?.length) {
    const row = rows[0]
    const t = new Date(row.created_at).getTime()
    if (Number.isFinite(t) && Date.now() - t < windowMs) {
      const { error } = await supabase
        .from('notifications')
        .update({ title, body: `${body} ${marker}`.trim(), is_read: false })
        .eq('id', row.id)
      if (error) console.warn('[notify] throttle update failed', error)
      return
    }
  }
  const { error } = await supabase.from('notifications').insert({
    user_id: attorneyId,
    title,
    body: `${body} ${marker}`.trim(),
    type,
    is_read: false,
    created_at: nowIso,
  })
  if (error) console.warn('[notify] throttle insert failed', error)
}

async function notifyConsultationChatOutsideActiveCall({ appointmentId, senderId, preview }) {
  if (!appointmentId || !senderId) return
  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, attorney_id, client_id, title, status')
      .eq('id', appointmentId)
      .maybeSingle()
    if (!appt?.attorney_id) return
    if (String(senderId) !== String(appt.client_id)) return
    const st = String(appt.status || '').toLowerCase()
    if (CONSULTATION_IN_CALL_STATUSES.has(st)) return
    const clientName = await resolveClientDisplayName(appt.client_id)
    const clip = String(preview || '').trim().slice(0, 120)
    const marker = `[chatwait:${appointmentId}]`
    const title = 'New chat message (outside live call)'
    const bodyText = `${clientName} sent a message in ${appt.title || 'consultation'} chat.${clip ? ` "${clip}"` : ''}`
    await throttleUpdateOrInsertAttorneyNotify({
      attorneyId: appt.attorney_id,
      marker,
      title,
      body: bodyText,
      type: 'consultation',
      windowMs: 180000,
    })
    const bucket = Math.floor(Date.now() / 180000)
    await notifyAdminsWithBodyMarker({
      title: 'Client chat (consultation room)',
      body: `${clientName} — ${appt.title || 'consultation'} (${String(appointmentId).slice(0, 8)}…).${clip ? ` ${clip}` : ''}`,
      type: 'admin_general',
      marker: `[admchat:${appointmentId}:${bucket}]`,
    })
  } catch (e) {
    console.warn('[notify] chat outside call failed', e)
  }
}

/**
 * Reminder (15–30 minutes before start) and possible no-show alerts for the
 * attorney. Safe to call on an interval from the attorney dashboard.
 */
export async function runAttorneyConsultationScheduleNotifications(attorneyId) {
  if (!attorneyId) return
  try {
    const appointments = await fetchAttorneyAppointments(attorneyId, { force: false })
    const now = Date.now()
    for (const a of appointments) {
      const st = String(a.status || '').toLowerCase()
      if (st === 'cancelled' || st === 'completed') continue
      const schedMs = a.parsed_scheduled_at?.getTime()
      if (!schedMs || Number.isNaN(schedMs)) continue

      const windowStart = schedMs - 30 * 60 * 1000
      const windowEnd = schedMs - 15 * 60 * 1000
      if (now >= windowStart && now <= windowEnd) {
        const eligible =
          st === 'confirmed' ||
          st === 'rescheduled' ||
          (st === 'pending' && isPaidOrFreeConsultation(a))
        if (!eligible) continue
        const marker = `[schreminder:${a.id}]`
        const { data: ex } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', attorneyId)
          .ilike('body', `%${marker}%`)
          .limit(1)
        if (ex?.length) continue
        const label = a.client_name || 'Client'
        await supabase.from('notifications').insert({
          user_id: attorneyId,
          title: 'Upcoming consultation',
          body: `Reminder: ${label} — ${a.title || 'Consultation'} starts in 15–30 minutes. ${marker}`,
          type: 'reminder',
          is_read: false,
          created_at: new Date().toISOString(),
        })
      }

      const pastGrace = schedMs + 15 * 60 * 1000
      if (
        now >= pastGrace &&
        (st === 'confirmed' || st === 'rescheduled') &&
        isPaidOrFreeConsultation(a) &&
        !CONSULTATION_IN_CALL_STATUSES.has(st)
      ) {
        const marker = `[noshow:${a.id}]`
        const { data: ex } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', attorneyId)
          .ilike('body', `%${marker}%`)
          .limit(1)
        if (ex?.length) continue
        const label = a.client_name || 'Client'
        await supabase.from('notifications').insert({
          user_id: attorneyId,
          title: 'Possible client no-show',
          body: `15+ minutes past the scheduled time for ${label} (${a.title || 'consultation'}) and the session is not in progress. ${marker}`,
          type: 'consultation',
          is_read: false,
          created_at: new Date().toISOString(),
        })
        await notifyAdminsWithBodyMarker({
          title: 'Possible no-show (consultation)',
          body: `Appointment ${String(a.id).slice(0, 8)}… is past start without in-progress status.`,
          type: 'admin_general',
          marker: `[admnoshow:${a.id}]`,
        })
      }
    }
  } catch (e) {
    console.warn('[schedule-notifs] runAttorneyConsultationScheduleNotifications failed', e)
  }
}

async function fetchAttorneyAppointments(userId, options = {}) {
  const force = Boolean(options?.force)
  const cached = attorneyAppointmentsCache.get(userId)
  const now = Date.now()

  if (
    !force &&
    cached?.data &&
    now - cached.updatedAt < ATTORNEY_APPOINTMENTS_CACHE_TTL_MS
  ) {
    return cached.data
  }

  const { data, error } = await supabase
    .from('appointments')
    .select(
      `
      *,
      client:client_id(full_name),
      attorney:attorney_id(full_name)
    `,
    )
    .or(`client_id.eq.${userId},attorney_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = data || []
  const paidIds = await fetchPaidAppointmentIdsForIdList(rows.map((r) => r.id))
  const mapped = rows.map((row) => ({
    ...mapAppointmentRow(row),
    consultationPaid: paidIds.has(row.id),
  }))
  attorneyAppointmentsCache.set(userId, {
    data: mapped,
    updatedAt: now,
  })

  return mapped
}

const resolveAttorneyImage = (name, preferredImageUrl) => {
  if (preferredImageUrl) return preferredImageUrl

  const normalized = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^atty\s+/, '')
    .trim()

  if (normalized.includes('jeanne') && normalized.includes('anarna')) {
    return '/assets/attorneys/jeanne-luz-castillo-anarna.jpg'
  }

  if (normalized.includes('alston') && normalized.includes('anarna')) {
    return '/assets/attorneys/alston-kevin-anarna.jpg'
  }

  if (normalized.includes('allen') && normalized.includes('anarna')) {
    return '/assets/attorneys/allen-kristopher-anarna.png'
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Attorney')}&background=f5a623&color=111827`
}

export function normalizeRole(roleText) {
  const role = (roleText || '').toLowerCase()
  if (role === 'admin') return 'Admin'
  if (role === 'secretary') return 'Secretary'
  if (role === 'attorney') return 'Attorney'
  return 'Client'
}

export function pageFromRole(roleText) {
  const role = normalizeRole(roleText)
  if (role === 'Admin') return 'admin-home'
  if (role === 'Secretary') return 'secretary-home'
  if (role === 'Attorney') return 'attorney-home'
  return 'home-logged'
}

let sessionProfileCache = null
let lastSessionProfileTime = 0
const SESSION_PROFILE_CACHE_TTL_MS = 5000

export async function getCurrentSessionProfile() {
  const now = Date.now()

  const isAuthLockError = (error) => {
    const text = String(error?.message || error || '').toLowerCase()
    return text.includes('lock broken') || text.includes("'steal' option") || text.includes('aborterror')
  }
  
  // Return cached profile if still fresh
  if (sessionProfileCache && now - lastSessionProfileTime < SESSION_PROFILE_CACHE_TTL_MS) {
    return sessionProfileCache
  }

  let session = null
  let sessionError = null

  try {
    const sessionRes = await supabase.auth.getSession()
    session = sessionRes?.data?.session || null
    sessionError = sessionRes?.error || null
  } catch (error) {
    sessionError = error
  }

  // Retry once if auth lock contention occurs in browser.
  if (sessionError && isAuthLockError(sessionError)) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    try {
      const retryRes = await supabase.auth.getSession()
      session = retryRes?.data?.session || null
      sessionError = retryRes?.error || null
    } catch (retryError) {
      sessionError = retryError
    }
  }

  if (sessionError) {
    // Return safe fallback instead of crashing UI on lock contention.
    if (isAuthLockError(sessionError)) {
      const fallback = { session: null, profile: null }
      sessionProfileCache = fallback
      lastSessionProfileTime = now
      return fallback
    }
    throw sessionError
  }
  if (!session?.user) {
    sessionProfileCache = { session: null, profile: null }
    lastSessionProfileTime = now
    return sessionProfileCache
  }

  if (!isSignupVerificationComplete(session.user)) {
    await signOutIfSignupIncomplete(session.user)
    sessionProfileCache = { session: null, profile: null }
    lastSessionProfileTime = now
    return sessionProfileCache
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, address, role, age, guardian_name, guardian_contact, guardian_details')
    .eq('id', session.user.id)
    .maybeSingle()

  // Do not block login/session hydration if profiles query is restricted or temporarily slow.
  if (profileError) {
    const fallbackResult = {
      session,
      profile: {
        id: session.user.id,
        full_name: session.user.user_metadata?.full_name || '',
        email: session.user.email || '',
        phone: '',
        address: '',
        role: normalizeRole(session.user.user_metadata?.role || 'Client'),
        age: null,
        guardian_name: '',
        guardian_contact: '',
        guardian_details: '',
      },
    }

    sessionProfileCache = fallbackResult
    lastSessionProfileTime = now
    return fallbackResult
  }

  const result = {
    session,
    profile: profile || {
      id: session.user.id,
      full_name: session.user.user_metadata?.full_name || '',
      email: session.user.email || '',
      phone: '',
      address: '',
      role: 'Client',
      age: null,
      guardian_name: '',
      guardian_contact: '',
      guardian_details: '',
    },
  }

  sessionProfileCache = result
  lastSessionProfileTime = now
  return result
}

export async function upsertProfile(profile) {
  const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' })
  if (error) throw error
}

export async function signOutUser() {
  invalidateAttorneyAppointmentsCache()

  const isSessionMissingError = (error) =>
    String(error?.message || '').toLowerCase().includes('session') &&
    String(error?.message || '').toLowerCase().includes('missing')

  const globalSignOut = await supabase.auth.signOut({ scope: 'global' })
  if (globalSignOut.error && !isSessionMissingError(globalSignOut.error)) {
    console.error('[auth] global sign out failed', globalSignOut.error)
  }

  const localSignOut = await supabase.auth.signOut({ scope: 'local' })
  if (localSignOut.error && !isSessionMissingError(localSignOut.error)) {
    throw localSignOut.error
  }
}

export async function fetchClientHomeData(userId) {
  const [appointmentsRes, notificationsRes, transactionsRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, title, scheduled_at, status, attorney:attorney_id(full_name), amount')
      .eq('client_id', userId)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('transactions')
      .select('appointment_id, payment_status')
      .eq('client_id', userId),
  ])

  if (appointmentsRes.error) throw appointmentsRes.error
  if (notificationsRes.error) throw notificationsRes.error
  if (transactionsRes.error) throw transactionsRes.error

  const paymentByAppointment = new Map(
    (transactionsRes.data || []).map((tx) => [tx.appointment_id, tx.payment_status]),
  )

  const appointments = (appointmentsRes.data || [])
    .filter((item) => {
      const status = String(item.status || '').toLowerCase()
      return (
        status === 'pending' ||
        status === 'confirmed' ||
        status === 'rescheduled' ||
        status === 'started' ||
        status === 'in_progress' ||
        status === 'in-progress' ||
        status === 'active'
      )
    })
    .map((item) => {
      const scheduled = item.scheduled_at ? new Date(item.scheduled_at) : null
      const hasScheduled = scheduled && !Number.isNaN(scheduled.getTime())
      const derivedSlotDate = hasScheduled ? scheduled.toISOString().slice(0, 10) : null
      const derivedSlotTime = hasScheduled ? formatSlotTime(scheduled) : null

      return {
        id: item.id,
        name: item.attorney?.full_name || 'Attorney',
        area: item.title || 'Consultation',
        date: item.scheduled_at,
        time: item.scheduled_at,
        scheduledAt: item.scheduled_at || null,
        slotDate: derivedSlotDate,
        slotTime: derivedSlotTime,
        status: item.status || 'pending',
        payment: paymentByAppointment.get(item.id) === 'paid' ? 'Paid' : 'Unpaid',
        chatAccessible: isConsultationChatWindowOpen({
          status: item.status,
          scheduledAt: item.scheduled_at,
          slotDate: derivedSlotDate,
          slotTime: derivedSlotTime,
        }),
      }
    })

  const notifications = (notificationsRes.data || []).map((n) => ({
    id: n.id,
    type: n.type || 'general',
    title: n.title,
    desc: n.body,
    time: n.created_at ? new Date(n.created_at).toLocaleString() : 'Now',
    read: n.is_read,
  }))

  return { appointments, notifications }
}

export async function fetchClientNotifications(userId, options = {}) {
  if (!userId) return []

  const limit = Number(options?.limit || 20)
  const appointmentsQuery = supabase
    .from('appointments')
    .select('id, title, scheduled_at, status, updated_at, attorney:attorney_id(full_name)')
    .eq('client_id', userId)
    .eq('status', 'rescheduled')
    .order('updated_at', { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 20)

  let notificationsRes = await supabase
    .from('notifications')
    .select('id, title, body, type, is_read, created_at, data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 20)

  if (notificationsRes.error && isMissingColumnError(notificationsRes.error, 'data')) {
    notificationsRes = await supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Number.isFinite(limit) ? limit : 20)
  }

  const [appointmentsRes] = await Promise.all([appointmentsQuery])

  if (notificationsRes.error) throw notificationsRes.error
  if (appointmentsRes.error) throw appointmentsRes.error

  const storedNotifications = (notificationsRes.data || []).map((item) => {
    const payload = item.data && typeof item.data === 'object' ? item.data : {}
    const appointmentId =
      payload.appointment_id || payload.appointmentId || payload.appointment || null
    return {
      id: item.id,
      type: item.type || 'general',
      title: item.title || 'Notification',
      desc: item.body || '',
      time: formatNotificationTimestamp(item.created_at),
      read: Boolean(item.is_read),
      createdAt: item.created_at || null,
      appointmentId: appointmentId ? String(appointmentId) : null,
    }
  })

  const derivedRescheduleNotifications = (appointmentsRes.data || []).map((appointment) => {
    const scheduled = normalizeDateTimeForUi(appointment.scheduled_at)
    const createdAt = appointment.updated_at || appointment.scheduled_at || null
    return {
      id: `derived-reschedule-${appointment.id}-${createdAt || 'now'}`,
      type: 'reschedule',
      title: 'Appointment Rescheduled',
      desc: `${appointment.attorney?.full_name || 'Your attorney'} moved ${appointment.title || 'your consultation'} to ${scheduled.date} at ${scheduled.time}.`,
      time: formatNotificationTimestamp(createdAt),
      read: false,
      createdAt,
    }
  })

  return [...storedNotifications, ...derivedRescheduleNotifications]
    .reduce((acc, item) => {
      if (!acc.some((existing) => existing.id === item.id)) {
        acc.push(item)
      }
      return acc
    }, [])
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime() || 0
      const bTime = new Date(b.createdAt || 0).getTime() || 0
      return bTime - aTime
    })
    .slice(0, Number.isFinite(limit) ? limit : 20)
}

export function subscribeToClientNotifications(userId, onChange) {
  if (!userId) return () => {}

  const channel = supabase
    .channel(`client-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        if (typeof onChange === 'function') {
          onChange()
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function fetchAttorneyHomeData(userId, options = {}) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [appointments, notificationsRes, notarialRes, transactionsRes] = await Promise.all([
    fetchAttorneyAppointments(userId, options),
    supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('notarial_requests')
      .select('id')
      .eq('attorney_id', userId),
    supabase
      .from('transactions')
      .select('id, amount, payment_status, created_at, appointment_id, client_id')
      .eq('attorney_id', userId)
      .eq('payment_status', 'paid')
      .gte('created_at', monthStart),
  ])

  if (notificationsRes.error) throw notificationsRes.error
  if (notarialRes.error) throw notarialRes.error
  if (transactionsRes.error) throw transactionsRes.error

  const pendingCount = appointments.filter(
    (a) => String(a.status || '').toLowerCase() === 'pending',
  ).length

  const myAppointmentCount = appointments.filter((a) => {
    const status = String(a.status || '').toLowerCase()
    return status === 'confirmed' || status === 'rescheduled'
  }).length

  const consultations = appointments
    .filter((a) => {
      const status = String(a.status || '').toLowerCase()
      if (
        status === 'pending' ||
        status === 'confirmed' ||
        status === 'rescheduled' ||
        status === 'started' ||
        status === 'in_progress' ||
        status === 'in-progress' ||
        status === 'active'
      ) {
        return true
      }
      return isRecentlyCancelledAppointment(a)
    })
    .map((a) => ({
    id: a.id,
    name: a.client_name || 'Client',
    area: a.title || 'Consultation',
    date: a.scheduled_value,
    time: a.scheduled_value,
    scheduledAt: a.scheduled_value,
    slotDate: a.slot_date || null,
    slotTime: a.slot_time || null,
    status: a.status || 'pending',
    paymentStatus: a.consultationPaid ? 'paid' : 'unpaid',
  }))

  const storedNotifications = (notificationsRes.data || []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type || 'general',
    text: `${n.title}: ${n.body}`,
    time: formatNotificationTimestamp(n.created_at),
    createdAt: n.created_at,
    unread: !n.is_read,
  }))

  const derivedNotifications = buildDerivedAttorneyNotifications({
    appointments,
    paidTransactions: transactionsRes.data || [],
  })

  const notifications = [...storedNotifications, ...derivedNotifications]
    .reduce((acc, item) => {
      if (!acc.some((existing) => existing.id === item.id)) {
        acc.push(item)
      }
      return acc
    }, [])
    .slice(0, 20)

  return {
    consultations,
    notifications,
    stats: {
      pendingCount,
      myAppointmentCount,
      notarialCount: (notarialRes.data || []).length,
    },
  }
}

const normalizeAttorneyAppointmentStatusBucket = (statusRaw) => {
  const s = String(statusRaw || '').trim().toLowerCase()
  if (s === 'completed') return 'Completed'
  if (s === 'cancelled' || s === 'rejected') return 'Cancelled'
  if (s === 'confirmed' || s === 'paid' || s === 'pending' || s === 'rescheduled') return 'Upcoming'
  return 'Upcoming'
}

export async function fetchAttorneyConsultationAnalyticsData(userId) {
  const [apptsRes, paidTxRes, profileRes, attorneyRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, title, status, scheduled_at, updated_at, amount')
      .eq('attorney_id', userId),
    supabase
      .from('transactions')
      .select('appointment_id')
      .eq('attorney_id', userId)
      .eq('payment_status', 'paid'),
    supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    supabase.from('attorney_profiles').select('specialties').eq('user_id', userId).maybeSingle(),
  ])

  if (apptsRes.error) throw apptsRes.error
  if (paidTxRes.error) throw paidTxRes.error

  const appointments = apptsRes.data || []
  const paidTxRows = paidTxRes.data || []
  const paidIds = new Set(paidTxRows.map((r) => r.appointment_id).filter(Boolean))

  const branchOptions = getConsultationBranchesForAttorney({
    name: profileRes.data?.full_name || '',
    specialties: normalizeStringArray(attorneyRes.data?.specialties),
  })

  const excludedStatuses = new Set(['rejected', 'cancelled'])
  const branchCounts = new Map(branchOptions.map((label) => [label, 0]))
  let classifiedTotal = 0
  let total = 0

  appointments.forEach((row) => {
    const status = String(row?.status || '').toLowerCase()
    if (excludedStatuses.has(status)) return

    total += 1
    if (!isPaidOrFreeConsultation({ amount: row?.amount, consultationPaid: paidIds.has(row.id) })) return

    const branch = parseConsultationBranchFromTitle(row?.title)
    if (!branch || !branchCounts.has(branch)) return

    branchCounts.set(branch, Number(branchCounts.get(branch) || 0) + 1)
    classifiedTotal += 1
  })

  const branchRows = branchOptions.map((label) => ({
    label,
    count: Number(branchCounts.get(label) || 0),
  }))
  const branchMaxCount = branchRows.reduce((max, row) => Math.max(max, row.count), 0)

  const statusCounts = new Map()
  appointments.forEach((row) => {
    const label = normalizeAttorneyAppointmentStatusBucket(row?.status)
    statusCounts.set(label, Number(statusCounts.get(label) || 0) + 1)
  })
  const status = Array.from(statusCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  return {
    total,
    branches: {
      rows: branchRows,
      total: classifiedTotal,
      maxCount: branchMaxCount,
    },
    status,
  }
}

export async function fetchAttorneyProfile(userId) {
  const [profileRes, attorneyRes, consultationsRes, notarialRes, paidTxRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, address, avatar_url, role, age, guardian_name, guardian_contact')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('attorney_profiles')
      .select('firm_name, years_experience, specialties, bio, consultation_fee, prc_id, is_verified')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('appointments')
      .select('id, amount')
      .eq('attorney_id', userId),
    supabase
      .from('notarial_requests')
      .select('id')
      .eq('attorney_id', userId),
    supabase
      .from('transactions')
      .select('appointment_id')
      .eq('attorney_id', userId)
      .eq('payment_status', 'paid')
      .not('appointment_id', 'is', null),
  ])

  if (profileRes.error) throw profileRes.error
  if (attorneyRes.error) throw attorneyRes.error
  if (consultationsRes.error) throw consultationsRes.error
  if (notarialRes.error) throw notarialRes.error
  if (paidTxRes.error) throw paidTxRes.error

  const paidIds = new Set((paidTxRes.data || []).map((r) => r.appointment_id).filter(Boolean))
  const consultationCount = (consultationsRes.data || []).filter((row) =>
    isPaidOrFreeConsultation({ amount: row?.amount, consultationPaid: paidIds.has(row.id) }),
  ).length

  return {
    profile: profileRes.data,
    attorney: attorneyRes.data,
    consultationCount,
    notarialCount: (notarialRes.data || []).length,
  }
}

export async function saveAttorneyProfile(userId, values) {
  const normalizedSpecialties = normalizeStringArray(values.specializations || values.specialties)
  const fullName = values.fullName || values.full_name || values.name
  const email = values.email
  const phone = values.phone
  const address = values.location || values.address
  const role = normalizeRole(values.role || 'Attorney')

  const avatarFromBase64 = values.avatar_base64
    ? `data:image/jpeg;base64,${values.avatar_base64}`
    : null

  await upsertProfile({
    id: userId,
    full_name: fullName,
    email,
    phone,
    address,
    avatar_url: values.avatar_url || avatarFromBase64 || undefined,
    role: role === 'Admin' ? 'Attorney' : role,
    updated_at: new Date().toISOString(),
  })

  let bio = values.bio || null
  if (values.credential_document_base64) {
    const docDataUri = `data:application/pdf;base64,${values.credential_document_base64}`
    bio = `${bio || ''}\nCredential Document: ${docDataUri}`.trim()
  }

  const { error } = await supabase.from('attorney_profiles').upsert(
    {
      user_id: userId,
      firm_name: values.firm_name || values.role || null,
      years_experience: toNumberOrNull(values.years_experience),
      consultation_fee: toNumberOrNull(values.consultation_fee),
      bio,
      prc_id: values.ibpNumber || values.prc_id || null,
      specialties: normalizedSpecialties,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) throw error
}

export async function upsertClientProfiling(userId, values) {
  const { error } = await supabase
    .from('profiles')
    .update({
      age: Number(values.age || 0),
      address: values.address,
      guardian_name: values.guardianName || null,
      guardian_contact: values.guardianContact || null,
      guardian_details: values.guardianDetails || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) throw error
}

const formatDateTime = (value) => {
  if (!value) return { date: 'TBD', time: 'TBD' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { date: 'TBD', time: 'TBD' }
  return {
    date: parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
  }
}

const toIso = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const toTwoDigits = (value) => String(value).padStart(2, '0')

const parseSlotDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null
  const rawTime = String(timeValue).trim()

  // Format example: 09:00 AM
  const ampmMatch = rawTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampmMatch) {
    let hour = Number(ampmMatch[1])
    const minute = Number(ampmMatch[2])
    const meridiem = ampmMatch[3].toUpperCase()

    if (meridiem === 'PM' && hour < 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0

    const parsed = new Date(`${dateValue}T${toTwoDigits(hour)}:${toTwoDigits(minute)}:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // Format examples: 09:00, 09:00:00, 16:30:00
  const twentyFourHourMatch = rawTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!twentyFourHourMatch) return null

  const hour = Number(twentyFourHourMatch[1])
  const minute = Number(twentyFourHourMatch[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  const parsed = new Date(`${dateValue}T${toTwoDigits(hour)}:${toTwoDigits(minute)}:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatSlotTime = (date) => {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null

  const hour = parsed.getHours()
  const minute = parsed.getMinutes()
  const period = hour >= 12 ? 'PM' : 'AM'
  const normalizedHour = hour % 12 || 12

  return `${toTwoDigits(normalizedHour)}:${toTwoDigits(minute)} ${period}`
}

/** Calendar date in the user's local timezone (matches admin/attorney date pickers). */
const localDateKeyFromDate = (date) => {
  const parsed = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${toTwoDigits(parsed.getMonth() + 1)}-${toTwoDigits(parsed.getDate())}`
}

const mapAvailabilityPersistenceError = (error, fallback = 'Failed to save availability.') => {
  if (!error) return fallback
  const code = String(error.code || '')
  const message = String(error.message || '')
  if (
    code === '42501' ||
    /permission denied|row-level security|violates row-level security policy/i.test(message)
  ) {
    return 'Could not save this schedule. If you are logged in as an attorney, run database/20260517_attorney_manage_availability_slots.sql in Supabase first.'
  }
  return message || fallback
}

const normalizeConcernText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const CONCERN_KEYWORDS = {
  'family relations': ['family', 'annulment', 'custody', 'adoption', 'support'],
  'property ownership': ['property', 'real estate', 'land', 'title', 'registration'],
  'criminal law': ['criminal', 'crime'],
  contracts: ['contract', 'corporate', 'business', 'commercial', 'agreement'],
  'labor law': ['labor', 'employment', 'workplace'],
  'civil law': ['civil', 'litigation', 'estate', 'obligation', 'tort'],
}

const matchConcernToSpecialties = (specialties, concern) => {
  const normalizedConcern = normalizeConcernText(concern)
  if (!normalizedConcern) return true

  const normalizedSpecialties = (Array.isArray(specialties) ? specialties : [])
    .map((item) => normalizeConcernText(item))
    .filter(Boolean)

  if (!normalizedSpecialties.length) return false

  const mappedKeywords = CONCERN_KEYWORDS[normalizedConcern] || []
  const fallbackKeywords = normalizedConcern
    .split(' ')
    .filter((word) => word.length >= 4 && word !== 'legal' && word !== 'law')
  const keywords = [...new Set([...mappedKeywords, ...fallbackKeywords])]

  return normalizedSpecialties.some((specialty) => {
    if (specialty.includes(normalizedConcern) || normalizedConcern.includes(specialty)) {
      return true
    }

    return keywords.some((keyword) => specialty.includes(keyword))
  })
}

export async function fetchAttorneyAvailabilitySlots(userId) {
  const todayDate = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('availability_slots')
    .select('id, date, time, is_booked')
    .eq('attorney_id', userId)
    .eq('is_booked', false)
    .gte('date', todayDate)
    .order('date', { ascending: true })
    .order('time', { ascending: true })

  if (!error) {
    return (data || []).map((slot) => {
      const start = parseSlotDateTime(slot.date, slot.time)
      const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null
      return {
        id: slot.id,
        startTime: start ? start.toISOString() : '',
        endTime: end ? end.toISOString() : '',
        date: slot.date || '',
        startLabel: slot.time || 'TBD',
        endLabel:
          start && end
            ? `${toTwoDigits(((end.getHours() + 11) % 12) + 1)}:${toTwoDigits(end.getMinutes())} ${
                end.getHours() >= 12 ? 'PM' : 'AM'
              }`
            : 'TBD',
      }
    })
  }

  if (!isMissingColumnError(error, 'date') && !isMissingColumnError(error, 'time')) {
    throw error
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('availability_slots')
    .select('id, start_time, end_time, is_booked')
    .eq('attorney_id', userId)
    .eq('is_booked', false)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  if (fallbackError) throw fallbackError

  return (fallbackData || []).map((slot) => {
    const start = slot.start_time ? new Date(slot.start_time) : null
    const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null
    return {
      id: slot.id,
      startTime: start ? start.toISOString() : '',
      endTime: end ? end.toISOString() : '',
      date: start && !Number.isNaN(start.getTime()) ? start.toISOString().slice(0, 10) : '',
      startLabel:
        start && !Number.isNaN(start.getTime())
          ? `${toTwoDigits(((start.getHours() + 11) % 12) + 1)}:${toTwoDigits(start.getMinutes())} ${
              start.getHours() >= 12 ? 'PM' : 'AM'
            }`
          : 'TBD',
      endLabel:
        start && end
          ? `${toTwoDigits(((end.getHours() + 11) % 12) + 1)}:${toTwoDigits(end.getMinutes())} ${end.getHours() >= 12 ? 'PM' : 'AM'}`
          : 'TBD',
    }
  })
}

export async function saveAttorneyAvailabilitySlots({ attorneyId, slots }) {
  const nowIso = new Date().toISOString()
  const todayDate = localDateKeyFromDate(new Date()) || new Date().toISOString().slice(0, 10)
  const now = new Date()
  const submittedSlotCount = Array.isArray(slots) ? slots.length : 0

  const preparedSlots = (Array.isArray(slots) ? slots : [])
    .map((slot) => {
      const startIso = toIso(slot.startTime)
      const endIso = toIso(slot.endTime)
      if (!startIso || !endIso) return null
      const parsedStart = new Date(startIso)
      const parsedEnd = new Date(endIso)
      if (parsedEnd <= parsedStart) return null
      if (parsedStart <= now) return null

      const slotDate = localDateKeyFromDate(parsedStart)
      const slotTime = formatSlotTime(parsedStart)
      if (!slotDate || !slotTime) return null

      return {
        startIso,
        endIso,
        attorney_id: attorneyId,
        date: slotDate,
        time: slotTime,
        is_booked: false,
        updated_at: nowIso,
      }
    })
    .filter((slot) => Boolean(slot?.date && slot?.time))

  if (preparedSlots.length === 0) {
    if (submittedSlotCount > 0) {
      throw new Error('All selected slots are already in the past. Please choose future date/time slots.')
    }

    const { error: clearByDateError } = await supabase
      .from('availability_slots')
      .delete()
      .eq('attorney_id', attorneyId)
      .eq('is_booked', false)
      .gte('date', todayDate)

    if (!clearByDateError) {
      invalidateAvailabilityCache(attorneyId)
      return []
    }

    if (!isMissingColumnError(clearByDateError, 'date')) {
      throw new Error(mapAvailabilityPersistenceError(clearByDateError))
    }

    const { error: clearByStartError } = await supabase
      .from('availability_slots')
      .delete()
      .eq('attorney_id', attorneyId)
      .eq('is_booked', false)
      .gte('start_time', nowIso)

    if (clearByStartError) throw new Error(mapAvailabilityPersistenceError(clearByStartError))
    invalidateAvailabilityCache(attorneyId)
    return []
  }

  const groupedByDate = preparedSlots.reduce((map, slot) => {
    const current = map.get(slot.date) || []
    current.push(slot)
    map.set(slot.date, current)
    return map
  }, new Map())

  const targetDates = new Set(groupedByDate.keys())

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('availability_slots')
    .select('date')
    .eq('attorney_id', attorneyId)
    .eq('is_booked', false)
    .gte('date', todayDate)

  if (existingRowsError && !isMissingColumnError(existingRowsError, 'date')) {
    throw new Error(mapAvailabilityPersistenceError(existingRowsError))
  }

  const existingDates = new Set(
    (existingRows || [])
      .map((row) => row.date)
      .filter(Boolean),
  )

  for (const existingDate of existingDates) {
    if (targetDates.has(existingDate)) continue

    const { error: removeStaleDateError } = await supabase
      .from('availability_slots')
      .delete()
      .eq('attorney_id', attorneyId)
      .eq('date', existingDate)
      .eq('is_booked', false)

    if (removeStaleDateError) {
      if (!isMissingColumnError(removeStaleDateError, 'date')) {
        throw removeStaleDateError
      }
      break
    }
  }

  let lastDateError = null

  for (const [date, dateSlots] of groupedByDate.entries()) {
    const { error: clearError } = await supabase
      .from('availability_slots')
      .delete()
      .eq('attorney_id', attorneyId)
      .eq('date', date)
      .eq('is_booked', false)

    if (clearError) {
      lastDateError = clearError
      break
    }

    const { data: bookedRows, error: bookedError } = await supabase
      .from('availability_slots')
      .select('time')
      .eq('attorney_id', attorneyId)
      .eq('date', date)
      .eq('is_booked', true)

    if (bookedError) {
      lastDateError = bookedError
      break
    }

    const bookedTimes = new Set((bookedRows || []).map((item) => item.time))
    const toInsert = dateSlots
      .filter((slot) => !bookedTimes.has(slot.time))
      .map(({ startIso, endIso, ...insertable }) => insertable)

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from('availability_slots').insert(toInsert)
      if (insertError) {
        lastDateError = insertError
        break
      }
    }
  }

  if (!lastDateError) {
    for (const date of targetDates) {
      invalidateAvailabilityCache(attorneyId, date)
    }
    invalidateAvailabilityCache(attorneyId)
    return fetchAttorneyAvailabilitySlots(attorneyId)
  }

  if (
    !isMissingColumnError(lastDateError, 'date') &&
    !isMissingColumnError(lastDateError, 'time')
  ) {
    throw new Error(mapAvailabilityPersistenceError(lastDateError))
  }

  const fallbackSlots = preparedSlots.map((slot) => ({
    attorney_id: attorneyId,
    start_time: slot.startIso,
    end_time: slot.endIso,
    is_booked: false,
    updated_at: nowIso,
  }))

  const { error: fallbackClearError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('attorney_id', attorneyId)
    .eq('is_booked', false)
    .gte('start_time', nowIso)

  if (fallbackClearError) throw new Error(mapAvailabilityPersistenceError(fallbackClearError))

  const { data, error } = await supabase
    .from('availability_slots')
    .insert(fallbackSlots)
    .select('id, start_time, end_time, is_booked')

  if (error) throw new Error(mapAvailabilityPersistenceError(error))
  invalidateAvailabilityCache(attorneyId)
  return data || []
}

const normalizeDigitalPaymentMethod = (method) => {
  const value = String(method || '').trim().toLowerCase()
  if (value === 'gcash') return 'GCash'
  if (value === 'maya' || value === 'paymaya') return 'Maya'
  if (value === 'qrph' || value === 'qr_ph' || value === 'qr ph') return 'QRPh'
  throw new Error('Supported payment methods are GCash, Maya, or QR Ph.')
}

const normalizeAppointmentStatus = (status) => {
  const value = (status || '').toLowerCase()
  if (value === 'started' || value === 'in_progress' || value === 'in-progress' || value === 'active') {
    return 'APPROVED'
  }
  if (value === 'confirmed') return 'APPROVED'
  if (value === 'rescheduled') return 'PENDING'
  if (value === 'completed') return 'COMPLETED'
  if (value === 'rejected' || value === 'cancelled') return 'REJECTED'
  return 'PENDING'
}

const CHAT_ACTIVE_APPOINTMENT_STATUSES = new Set([
  'started',
  'in_progress',
  'in-progress',
  'active',
  'confirmed',
  'rescheduled',
])

const CHAT_ACCESS_BLOCKED_MESSAGE =
  'Consultation chat is unavailable until the appointment status is marked as started/active.'

const parseChatScheduleDate = ({ scheduledAt, slotDate, slotTime } = {}) => {
  if (slotDate && slotTime) {
    const fromSlot = parseSlotDateTime(slotDate, slotTime)
    if (fromSlot && !Number.isNaN(fromSlot.getTime())) return fromSlot
  }

  const raw = String(scheduledAt || '').trim()
  if (!raw) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && slotTime) {
    const fromDateAndTime = parseSlotDateTime(raw, slotTime)
    if (fromDateAndTime && !Number.isNaN(fromDateAndTime.getTime())) return fromDateAndTime
  }

  return normalizeDateTimeForUi(raw).parsed
}

const buildChatScheduleBlockedMessage = ({ scheduledAt, slotDate, slotTime } = {}) => {
  const parsed = parseChatScheduleDate({ scheduledAt, slotDate, slotTime })
  if (!parsed) return CHAT_ACCESS_BLOCKED_MESSAGE

  const date = parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  return `Consultation chat opens at ${date} ${time} (PH time).`
}

const CHAT_LIMITS = {
  imageMaxBytes: 10 * 1024 * 1024,
  fileMaxBytes: 25 * 1024 * 1024,
  imageMime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  fileMime: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
}

const CHAT_BUCKETS = {
  image: 'chat-images',
  file: 'chat-files',
}

const CHAT_FALLBACK_MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
}

const inferMimeFromFile = (file) => {
  const directType = String(file?.type || '')
    .trim()
    .toLowerCase()

  if (directType) return directType

  const fileName = String(file?.name || '')
  const ext = fileName.includes('.')
    ? fileName.split('.').pop().toLowerCase()
    : ''

  return CHAT_FALLBACK_MIME_BY_EXT[ext] || 'application/octet-stream'
}

const bucketForMessageType = (mime) =>
  String(mime || '').startsWith('image/') ? CHAT_BUCKETS.image : CHAT_BUCKETS.file

const validateChatAttachment = (sizeBytes, mime) => {
  const size = Number(sizeBytes) || 0
  const normalizedMime = String(mime || '').toLowerCase()

  if (normalizedMime.startsWith('image/')) {
    if (!CHAT_LIMITS.imageMime.includes(normalizedMime)) {
      return { ok: false, error: 'Unsupported image type.' }
    }
    if (size > CHAT_LIMITS.imageMaxBytes) {
      return { ok: false, error: 'Image must be 10 MB or smaller.' }
    }
    return { ok: true }
  }

  if (!CHAT_LIMITS.fileMime.includes(normalizedMime)) {
    return { ok: false, error: 'Unsupported file type (PDF, DOC/DOCX, TXT).' }
  }
  if (size > CHAT_LIMITS.fileMaxBytes) {
    return { ok: false, error: 'File must be 25 MB or smaller.' }
  }

  return { ok: true }
}

export const isConsultationChatActiveStatus = (status) =>
  CHAT_ACTIVE_APPOINTMENT_STATUSES.has(String(status || '').toLowerCase())

export const isConsultationChatWindowOpen = ({ status, scheduledAt, slotDate, slotTime, nowValue } = {}) => {
  // DEV BYPASS — remove this line before going to production
  if (process.env.REACT_APP_BYPASS_CHAT_WINDOW === 'true') return true

  if (!isConsultationChatActiveStatus(status)) return false

  // Admin-controlled override: when "Enforce Scheduled Chat Time" is OFF,
  // any active consultation can enter the chat regardless of the start time.
  if (!isAppConfigFlagOn('enforce_schedule_window', true)) return true

  const scheduled = parseChatScheduleDate({ scheduledAt, slotDate, slotTime })
  if (!scheduled) return true

  const now = nowValue instanceof Date ? nowValue : new Date(nowValue || Date.now())
  if (Number.isNaN(now.getTime())) return false

  return now.getTime() >= scheduled.getTime()
}

export async function fetchClientAppointmentsData(userId) {
  const [appointmentsRes, transactionsRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, title, notes, scheduled_at, status, amount, attorney_id, attorney:attorney_id(full_name)')
      .eq('client_id', userId)
      .order('scheduled_at', { ascending: false }),
    supabase
      .from('transactions')
      .select('appointment_id, payment_status')
      .eq('client_id', userId),
  ])

  if (appointmentsRes.error) throw appointmentsRes.error
  if (transactionsRes.error) throw transactionsRes.error

  const paymentByAppointment = new Map(
    (transactionsRes.data || []).map((tx) => [tx.appointment_id, tx.payment_status]),
  )

  return (appointmentsRes.data || []).map((item) => {
    const datetime = formatDateTime(item.scheduled_at)
    const parsedSchedule = new Date(item.scheduled_at)
    const scheduledAtTs = Number.isNaN(parsedSchedule.getTime()) ? 0 : parsedSchedule.getTime()
    const rawStatus = String(item.status || '').toLowerCase()
    const status = normalizeAppointmentStatus(item.status)
    const paymentStatus = (paymentByAppointment.get(item.id) || 'unpaid').toLowerCase()
    const pendingReschedule = parseReschedulePendingFromNotes(item.notes)

    return {
      id: item.id,
      attorney: item.attorney?.full_name || 'Attorney',
      attorneyId: item.attorney_id,
      specialty: item.title || 'Legal Consultation',
      date: datetime.date,
      time: datetime.time,
      type: 'Online Consultation',
      fee: `PHP ${Number(item.amount || 0).toFixed(2)}`,
      amount: Number(item.amount || 0),
      scheduledAt: item.scheduled_at || null,
      scheduledAtTs,
      rawStatus,
      chatAccessible: isConsultationChatWindowOpen({
        status: rawStatus,
        scheduledAt: item.scheduled_at,
        slotDate: item.slot_date,
        slotTime: item.slot_time,
      }),
      status,
      payment: paymentStatus === 'paid' ? 'PAID' : 'UNPAID',
      pendingReschedule,
      message:
        status === 'COMPLETED'
          ? 'Consultation Completed'
          : status === 'APPROVED'
            ? 'Ready for Payment'
            : status === 'REJECTED'
              ? 'Request Closed'
              : 'Waiting for Attorney Approval',
      description:
        item.notes ||
        (status === 'COMPLETED'
          ? 'This consultation has been completed.'
          : status === 'APPROVED'
            ? 'Your request is approved and pending payment confirmation.'
            : status === 'REJECTED'
              ? 'This request was declined or cancelled.'
              : 'Your request is still under review.'),
    }
  })
}

export async function fetchClientChatEligibleAppointments(userId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, title, scheduled_at, status, attorney:attorney_id(full_name)')
    .eq('client_id', userId)
    .order('scheduled_at', { ascending: true })

  if (error) throw error

  return (data || [])
    .filter((item) =>
      isConsultationChatWindowOpen({
        status: item.status,
        scheduledAt: item.scheduled_at,
      }),
    )
    .map((item) => ({
      id: item.id,
      name: item.attorney?.full_name || 'Attorney',
      title: item.title || 'Consultation',
      status: String(item.status || '').toLowerCase(),
      scheduledAt: item.scheduled_at,
      scheduleLabel: item.scheduled_at
        ? new Date(item.scheduled_at).toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'TBD',
    }))
}

export async function fetchClientConsultationLogs(userId) {
  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('id, title, notes, scheduled_at, status, attorney_id, attorney:attorney_id(full_name)')
    .eq('client_id', userId)
    .order('scheduled_at', { ascending: false })

  if (appointmentsError) throw appointmentsError

  const appointmentRows = appointments || []
  if (!appointmentRows.length) return []

  const appointmentIds = appointmentRows.map((item) => item.id)
  const feedbackByAppointmentId = new Map()

  const { data: feedbackRows, error: feedbackError } = await supabase
    .from('consultation_feedback')
    .select('appointment_id, rating, comment')
    .in('appointment_id', appointmentIds)
    .eq('client_id', userId)

  if (!feedbackError) {
    (feedbackRows || []).forEach((item) => {
      feedbackByAppointmentId.set(item.appointment_id, {
        rating: Number(item.rating || 0),
        comment: String(item.comment || ''),
      })
    })
  } else if (!isMissingRelationError(feedbackError)) {
    throw feedbackError
  }

  return appointmentRows
    .filter((item) => {
      const status = String(item.status || '').toLowerCase()
      if (status === 'completed') return true

      const feedback = feedbackByAppointmentId.get(item.id)
      if (feedback && Number(feedback.rating || 0) > 0) return true

      const notes = String(item.notes || '')
      return /\[CLIENT_FEEDBACK:\d\]/.test(notes)
    })
    .map((item) => {
    const dt = normalizeDateTimeForUi(item.scheduled_at)
    const feedback = feedbackByAppointmentId.get(item.id)

    let fallbackRating = 0
    let fallbackComment = ''
    if (!feedback) {
      const notes = String(item.notes || '')
      const ratingMatch = notes.match(/\[CLIENT_FEEDBACK:(\d)\]/)
      const commentMatch = notes.match(/\[CLIENT_FEEDBACK_COMMENT\]([\s\S]*?)\[\/CLIENT_FEEDBACK_COMMENT\]/)
      fallbackRating = Number(ratingMatch?.[1] || 0)
      fallbackComment = String(commentMatch?.[1] || '').trim()
    }

    return {
      id: item.id,
      attorneyName: item.attorney?.full_name || 'Attorney',
      title: item.title || 'Consultation',
      dateLabel: dt.date,
      timeLabel: dt.time,
      rating: feedback ? Number(feedback.rating || 0) : fallbackRating,
      comment: feedback ? String(feedback.comment || '') : fallbackComment,
      scheduledAt: item.scheduled_at,
    }
  })
}

// Resolves the base URL of the Express backend that handles PayMongo. Reads
// REACT_APP_PAYMENT_API_URL first, falls back to REACT_APP_CHATBOT_API_URL,
// then to localhost:4000 for development.
const resolvePaymentApiBaseUrl = () => {
  const raw =
    process.env.REACT_APP_PAYMENT_API_URL ||
    process.env.REACT_APP_CHATBOT_API_URL ||
    'http://localhost:4000'
  return String(raw).replace(/\/+$/, '')
}

const requestPaymentApi = async (path, { method = 'GET', body } = {}) => {
  const baseUrl = resolvePaymentApiBaseUrl()
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`

  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload?.error || payload?.message || `Payment service error (HTTP ${response.status}).`
    const err = new Error(message)
    err.status = response.status
    err.payload = payload
    throw err
  }

  return payload || {}
}

// Starts a PayMongo checkout session via the backend and returns the redirect
// URL plus the local transactionId that the client polls until paid.
export async function payForAppointment({ appointmentId, clientId, attorneyId, amount, method }) {
  if (!appointmentId) throw new Error('appointmentId is required.')
  if (!clientId) throw new Error('clientId is required.')
  if (!attorneyId) throw new Error('attorneyId is required.')

  const numericAmount = Number(amount || 0)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Amount must be greater than 0.')
  }

  const session = await requestPaymentApi('/payments/appointments/create-session', {
    method: 'POST',
    body: {
      appointmentId,
      clientId,
      attorneyId,
      amount: numericAmount,
      method: normalizeDigitalPaymentMethod(method),
    },
  })

  return {
    transactionId: session.transactionId,
    checkoutSessionId: session.checkoutSessionId,
    checkoutUrl: session.checkoutUrl,
    status: session.status || 'pending',
  }
}

// Polls the backend for the latest PayMongo checkout status of a transaction.
// The backend will also flip the local transaction + appointment rows when
// the gateway reports "paid", so the UI just needs to wait until status flips.
export async function getAppointmentPaymentStatus(transactionId) {
  if (!transactionId) throw new Error('transactionId is required.')
  const data = await requestPaymentApi(
    `/payments/appointments/status/${encodeURIComponent(transactionId)}`,
  )
  return {
    status: String(data.status || 'pending').toLowerCase(),
    transactionId: data.transactionId || transactionId,
    appointmentId: data.appointmentId || null,
  }
}

// Cancels checkout server-side (service role). Required when Supabase RLS blocks
// the browser from PATCHing appointments to cancelled.
export async function abandonAppointmentCheckout({ appointmentId, clientId, transactionId }) {
  if (!appointmentId) throw new Error('appointmentId is required.')
  if (!clientId) throw new Error('clientId is required.')

  const body = { appointmentId, clientId }
  if (transactionId) body.transactionId = transactionId

  return requestPaymentApi('/payments/appointments/abandon', {
    method: 'POST',
    body,
  })
}

// Internal: look up the existing "[appt:<id>]" notification for an attorney.
async function findAttorneyAppointmentNotifications({ attorneyId, appointmentId }) {
  if (!attorneyId || !appointmentId) return []
  const dedupeMarker = `[appt:${appointmentId}]`
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', attorneyId)
    .eq('type', 'consultation')
    .ilike('body', `%${dedupeMarker}%`)
  if (error) {
    console.warn('[booking] notification lookup failed', error)
    return []
  }
  return (data || []).map((row) => row.id)
}

async function resolveClientDisplayName(clientId) {
  if (!clientId) return 'A client'
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', clientId)
      .maybeSingle()
    return (
      String(profile?.full_name || '').trim() ||
      String(profile?.email || '').trim() ||
      'A client'
    )
  } catch (lookupError) {
    console.warn('[booking] failed to resolve client name', lookupError)
    return 'A client'
  }
}

/** Fan-out helper: insert one notification row per attorney user_id. */
async function insertNotificationForAttorneys({ attorneyIds, title, body, type = 'general' }) {
  const unique = [...new Set((attorneyIds || []).filter(Boolean))]
  if (!unique.length) return

  const nowIso = new Date().toISOString()
  const rows = unique.map((userId) => ({
    user_id: userId,
    title: String(title || 'Notification'),
    body: String(body || ''),
    type: String(type || 'general'),
    is_read: false,
    created_at: nowIso,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.warn('[notify] attorney fan-out insert failed', error)
  }
}

/** Lookup verified attorneys so we can broadcast notarial-request alerts. */
async function fetchVerifiedAttorneyUserIds() {
  const { data, error } = await supabase
    .from('attorney_profiles')
    .select('user_id')
    .eq('is_verified', true)

  if (error) {
    console.warn('[notify] failed to load verified attorneys', error)
    return []
  }
  return (data || []).map((row) => row?.user_id).filter(Boolean)
}

/**
 * Idempotent insert of a "Client Feedback Received" notification for the
 * attorney. Includes the appointment id marker so polling/retries do not
 * create duplicate rows.
 */
async function notifyAttorneyOfClientFeedback({ attorneyId, clientId, appointmentId, rating, comment }) {
  if (!attorneyId || !appointmentId) return

  const dedupeMarker = `[feedback:${appointmentId}]`

  try {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', attorneyId)
      .ilike('body', `%${dedupeMarker}%`)
      .limit(1)
    if (existing && existing.length > 0) return
  } catch (lookupError) {
    console.warn('[feedback] dedupe lookup failed', lookupError)
  }

  const clientName = await resolveClientDisplayName(clientId)
  const ratingLabel = Number(rating) > 0 ? `${rating}-star` : 'a'
  const commentSuffix = comment ? ` "${String(comment).slice(0, 140)}"` : ''

  const { error: insertError } = await supabase.from('notifications').insert({
    user_id: attorneyId,
    title: 'Client Feedback Received',
    body: `${clientName} left ${ratingLabel} feedback for the consultation.${commentSuffix} ${dedupeMarker}`,
    type: 'consultation',
    is_read: false,
    created_at: new Date().toISOString(),
  })

  if (insertError) {
    console.warn('[feedback] attorney notification insert failed', insertError)
    return
  }

  await notifyAttorneyOfPublicReviewRating({ attorneyId, clientId, appointmentId, rating, comment })
  await notifyAdminsWithBodyMarker({
    title: 'Client consultation feedback',
    body: `${clientName} submitted ${ratingLabel} feedback (appointment ${String(appointmentId).slice(0, 8)}…).`,
    type: 'admin_general',
    marker: `[admfb:${appointmentId}]`,
  })
}

/**
 * Separate bell item: rating is persisted and contributes to public-facing metrics.
 */
async function notifyAttorneyOfPublicReviewRating({ attorneyId, clientId, appointmentId, rating, comment }) {
  if (!attorneyId || !appointmentId) return

  const dedupeMarker = `[pubreview:${appointmentId}]`

  try {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', attorneyId)
      .ilike('body', `%${dedupeMarker}%`)
      .limit(1)
    if (existing && existing.length > 0) return
  } catch (lookupError) {
    console.warn('[pubreview] dedupe lookup failed', lookupError)
  }

  const clientName = await resolveClientDisplayName(clientId)
  const stars = Number(rating) > 0 ? `${rating}-star` : 'a'
  const shortComment = comment ? ` "${String(comment).slice(0, 100)}"` : ''

  const { error: insertError } = await supabase.from('notifications').insert({
    user_id: attorneyId,
    title: 'Public review & rating recorded',
    body: `${clientName}'s ${stars} rating is saved and counts toward your public profile metrics.${shortComment} ${dedupeMarker}`,
    type: 'public_rating',
    is_read: false,
    created_at: new Date().toISOString(),
  })

  if (insertError) {
    console.warn('[pubreview] attorney notification insert failed', insertError)
    return
  }

  await notifyAdminsWithBodyMarker({
    title: 'Consultation rating submitted',
    body: `${clientName} left a ${stars} rating (appointment ${String(appointmentId).slice(0, 8)}…).`,
    type: 'admin_general',
    marker: `[admfbrv:${appointmentId}]`,
  })
}

// Flips the "Pending Consultation Booking" notification on the attorney's
// side to "Booking Confirmed" once payment has been recorded. Idempotent:
// duplicate calls during polling will just no-op after the first update.
export async function notifyAttorneyOfPaidBooking({ appointmentId }) {
  if (!appointmentId) return

  const { data: appt, error: apptError } = await supabase
    .from('appointments')
    .select('id, attorney_id, client_id, title, scheduled_at')
    .eq('id', appointmentId)
    .maybeSingle()

  if (apptError) {
    console.warn('[booking] notifyAttorneyOfPaidBooking lookup failed', apptError)
    return
  }
  if (!appt?.attorney_id) return

  const dedupeMarker = `[appt:${appointmentId}]`
  const clientName = await resolveClientDisplayName(appt.client_id)
  const whenLabel = appt.scheduled_at
    ? new Date(appt.scheduled_at).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'the scheduled time'

  const newTitle = 'Booking Confirmed'
  const newBody = `${clientName} paid for ${appt.title || 'a consultation'} on ${whenLabel}. ${dedupeMarker}`
  const nowIso = new Date().toISOString()

  // Flip the appointment to "confirmed" once payment is captured. Skip when
  // it has already moved past pending (e.g. cancelled by a race) so we don't
  // accidentally resurrect a cancelled row.
  try {
    const { data: currentAppt } = await supabase
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .maybeSingle()
    const currentStatus = String(currentAppt?.status || '').toLowerCase()
    if (currentStatus === 'pending' || currentStatus === '') {
      const { error: statusError } = await supabase
        .from('appointments')
        .update({ status: 'confirmed', updated_at: nowIso })
        .eq('id', appointmentId)
      if (statusError) {
        console.warn('[booking] failed to flip status to confirmed', statusError)
      }
    }
  } catch (statusFlipError) {
    console.warn('[booking] confirmed status flip step failed', statusFlipError)
  }

  const existingIds = await findAttorneyAppointmentNotifications({
    attorneyId: appt.attorney_id,
    appointmentId,
  })

  if (existingIds.length > 0) {
    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        title: newTitle,
        body: newBody,
        is_read: false,
        updated_at: nowIso,
      })
      .in('id', existingIds)
    if (updateError) {
      console.warn('[booking] failed to update attorney notification to confirmed', updateError)
    }
  } else {
    const { error: insertError } = await supabase.from('notifications').insert({
      user_id: appt.attorney_id,
      title: newTitle,
      body: newBody,
      type: 'consultation',
      is_read: false,
      created_at: nowIso,
    })
    if (insertError) {
      console.warn('[booking] failed to create attorney confirmed notification', insertError)
    }
  }

  invalidateAttorneyAppointmentsCache(appt.attorney_id)

  await notifyAdminsWithBodyMarker({
    title: 'Consultation payment received',
    body: `${clientName} paid for ${appt.title || 'a consultation'} (${whenLabel}).`,
    type: 'admin_general',
    marker: `[adminpaid:${appointmentId}]`,
  })
}

// Cancels an appointment that never received a paid transaction (e.g. the
// client closed the PayMongo popup, the gateway returned failed, or polling
// timed out). Frees the slot back to availability so it can be rebooked.
export async function cancelPendingUnpaidBooking({ appointmentId }) {
  if (!appointmentId) return

  const { data: paidTx, error: txError } = await supabase
    .from('transactions')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('payment_status', 'paid')
    .limit(1)

  if (txError) {
    console.warn('[booking] cancel cleanup tx check failed', txError)
    return
  }
  if (paidTx && paidTx.length > 0) return // already paid, do not cancel

  const { data: appt, error: apptError } = await supabase
    .from('appointments')
    .select('id, attorney_id, client_id, title, scheduled_at, slot_id, slot_date, slot_time, status')
    .eq('id', appointmentId)
    .maybeSingle()

  if (apptError) {
    console.warn('[booking] cancel cleanup appt lookup failed', apptError)
    return
  }
  if (!appt) return

  const currentStatus = String(appt.status || '').toLowerCase()
  if (currentStatus === 'cancelled' || currentStatus === 'completed') return

  const nowIso = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', updated_at: nowIso })
    .eq('id', appointmentId)

  if (updateError) {
    console.warn('[booking] cancel cleanup status update failed', updateError)
  }

  // Flip the attorney's pending notification to a "Cancelled" message so the
  // popup updates live instead of disappearing without context.
  try {
    const dedupeMarker = `[appt:${appointmentId}]`
    const clientName = await resolveClientDisplayName(appt.client_id)
    const whenLabel = appt.scheduled_at
      ? new Date(appt.scheduled_at).toLocaleString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'the scheduled time'

    const existingIds = await findAttorneyAppointmentNotifications({
      attorneyId: appt.attorney_id,
      appointmentId,
    })

    const cancelTitle = 'Booking Cancelled'
    const cancelBody = `${clientName} cancelled their booking for ${appt.title || 'a consultation'} on ${whenLabel}. ${dedupeMarker}`

    if (existingIds.length > 0) {
      const { error: notifUpdateError } = await supabase
        .from('notifications')
        .update({
          title: cancelTitle,
          body: cancelBody,
          is_read: false,
          updated_at: nowIso,
        })
        .in('id', existingIds)
      if (notifUpdateError) {
        console.warn('[booking] failed to update attorney notification to cancelled', notifUpdateError)
      }
    } else if (appt.attorney_id) {
      const { error: notifInsertError } = await supabase.from('notifications').insert({
        user_id: appt.attorney_id,
        title: cancelTitle,
        body: cancelBody,
        type: 'consultation',
        is_read: false,
        created_at: nowIso,
      })
      if (notifInsertError) {
        console.warn('[booking] failed to insert attorney cancellation notification', notifInsertError)
      }
    }
  } catch (notifError) {
    console.warn('[booking] cancel notification flip failed', notifError)
  }

  try {
    await notifyAdminsWithBodyMarker({
      title: 'Consultation booking cancelled',
      body: `A pending consultation booking was cancelled before payment (appointment ${String(appointmentId).slice(0, 8)}…).`,
      type: 'admin_general',
      marker: `[admincxl:${appointmentId}]`,
    })
  } catch (e) {
    console.warn('[booking] admin cancel notify failed', e)
  }

  // Free the underlying availability slot so the time can be rebooked. We try
  // multiple matching strategies because the `availability_slots.time` column
  // may be stored as either a full ISO time ("09:00:00"), a 24-hour label
  // ("09:00"), or an AM/PM label ("09:00 AM") depending on how the slot was
  // seeded. We normalize both sides before comparing.
  let slotIdToFree = appt.slot_id || null

  if (!slotIdToFree && appt.attorney_id && appt.slot_date && appt.slot_time) {
    const { data: candidateSlots, error: candidateError } = await supabase
      .from('availability_slots')
      .select('id, time')
      .eq('attorney_id', appt.attorney_id)
      .eq('date', appt.slot_date)

    if (candidateError) {
      console.warn('[booking] cancel cleanup candidate slot fetch failed', candidateError)
    } else if (Array.isArray(candidateSlots) && candidateSlots.length) {
      const targetParsed = parseSlotDateTime(appt.slot_date, appt.slot_time)
      const targetMs = targetParsed?.getTime() || 0
      const matchedSlot = candidateSlots.find((slot) => {
        const slotParsed = parseSlotDateTime(appt.slot_date, slot?.time)
        return slotParsed && slotParsed.getTime() === targetMs
      })
      slotIdToFree = matchedSlot?.id || null
    }
  }

  if (slotIdToFree) {
    const { error: slotByIdError } = await supabase
      .from('availability_slots')
      .update({ is_booked: false, updated_at: nowIso })
      .eq('id', slotIdToFree)
    if (slotByIdError) {
      console.warn('[booking] cancel cleanup slot free (by id) failed', slotByIdError)
    }
  } else if (appt.attorney_id && appt.slot_date && appt.slot_time) {
    // Fallback: best-effort raw match if normalization could not find the row.
    const { error: slotByMatchError } = await supabase
      .from('availability_slots')
      .update({ is_booked: false, updated_at: nowIso })
      .eq('attorney_id', appt.attorney_id)
      .eq('date', appt.slot_date)
      .eq('time', appt.slot_time)
    if (slotByMatchError) {
      console.warn('[booking] cancel cleanup slot free (raw match) failed', slotByMatchError)
    }
  }

  invalidateAvailabilityCache(appt.attorney_id, appt.slot_date)
  invalidateAttorneyAppointmentsCache(appt.attorney_id)
}

const RESCHEDULE_PENDING_PIPE_RE =
  /\[RESCHEDULE_PENDING\|([^|\]]+)\|([^\]]*)\]/i
const RESCHEDULE_PENDING_LEGACY_RE = /\[RESCHEDULE_PENDING:[^\]]+\]/i
const RESCHEDULE_PENDING_ISO_TAIL_RE =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z):?(.*)$/i

const decodeRescheduleReason = (raw) => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  try {
    return decodeURIComponent(trimmed)
  } catch {
    return trimmed
  }
}

const isGarbageRescheduleReason = (reason) => {
  const text = String(reason || '').trim()
  if (!text) return true
  if (/^\d{2}:\d{2}/.test(text)) return true
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return true
  if (/^00:00\.000Z:?$/i.test(text)) return true
  return false
}

export function parseReschedulePendingFromNotes(notes) {
  const text = String(notes || '')

  const pipeMatch = text.match(RESCHEDULE_PENDING_PIPE_RE)
  if (pipeMatch) {
    const requestedScheduledAt = String(pipeMatch[1] || '').trim()
    if (!requestedScheduledAt) return null
    const reason = decodeRescheduleReason(pipeMatch[2])
    return {
      requestedScheduledAt,
      reason: isGarbageRescheduleReason(reason) ? '' : reason,
    }
  }

  const legacyMatch = text.match(RESCHEDULE_PENDING_LEGACY_RE)
  if (!legacyMatch) return null

  const inner = legacyMatch[0]
    .replace(/^\[RESCHEDULE_PENDING:/i, '')
    .replace(/\]$/, '')

  const isoTail = inner.match(RESCHEDULE_PENDING_ISO_TAIL_RE)
  if (isoTail) {
    const requestedScheduledAt = String(isoTail[1] || '').trim()
    const reason = decodeRescheduleReason(isoTail[2])
    return {
      requestedScheduledAt,
      reason: isGarbageRescheduleReason(reason) ? '' : reason,
    }
  }

  return null
}

export function stripReschedulePendingMarker(notes) {
  return String(notes || '')
    .replace(RESCHEDULE_PENDING_PIPE_RE, '')
    .replace(RESCHEDULE_PENDING_LEGACY_RE, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function buildReschedulePendingNotes(existingNotes, { scheduledAt, reason }) {
  const base = stripReschedulePendingMarker(existingNotes)
  const encodedReason = encodeURIComponent(String(reason || '').slice(0, 500))
  const marker = `[RESCHEDULE_PENDING|${scheduledAt}|${encodedReason}]`
  return base ? `${base}\n${marker}` : marker
}

const formatScheduleLabelFromIso = (iso) => {
  const parsed = iso ? new Date(iso) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return 'a new schedule'
  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const phDateKeyFromIso = (iso) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))

const phTimeLabelFromIso = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

export async function findAttorneyAvailabilitySlotId(attorneyId, scheduledAtIso) {
  if (!attorneyId || !scheduledAtIso) return null
  const dateKey = phDateKeyFromIso(scheduledAtIso)
  const targetLabel = phTimeLabelFromIso(scheduledAtIso)
  const targetMs = new Date(scheduledAtIso).getTime()

  const { data, error } = await supabase
    .from('availability_slots')
    .select('id, date, time, is_booked')
    .eq('attorney_id', attorneyId)
    .eq('date', dateKey)
    .eq('is_booked', false)

  if (error) throw error

  const rows = data || []
  const byLabel = rows.find((row) => String(row.time || '').trim() === targetLabel)
  if (byLabel?.id) return byLabel.id

  const byParse = rows.find((row) => {
    const parsed = parseSlotDateTime(row.date, row.time)
    return parsed && parsed.getTime() === targetMs
  })
  return byParse?.id || null
}

// Client-initiated reschedule request (pending admin approval).
export async function rescheduleClientAppointment({ appointmentId, scheduledAt, note }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated.')

  const { data: appt, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, client_id, attorney_id, title, scheduled_at, status, amount, notes')
    .eq('id', appointmentId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!appt) throw new Error('Appointment not found.')
  if (String(appt.client_id) !== String(user.id)) {
    throw new Error('You can only reschedule your own appointments.')
  }

  const rawStatus = String(appt.status || '').toLowerCase()
  if (rawStatus === 'completed' || rawStatus === 'cancelled' || rawStatus === 'rejected') {
    throw new Error('This appointment can no longer be rescheduled.')
  }
  if (rawStatus === 'rescheduled') {
    throw new Error('This appointment was already rescheduled once. Contact admin for further changes.')
  }

  if (parseReschedulePendingFromNotes(appt.notes)) {
    throw new Error('You already have a reschedule request waiting for admin approval.')
  }

  const schedDate = appt.scheduled_at ? new Date(appt.scheduled_at) : null
  if (!schedDate || Number.isNaN(schedDate.getTime())) throw new Error('Invalid appointment schedule.')
  if (schedDate.getTime() - Date.now() <= 0) {
    throw new Error('This consultation date has already passed.')
  }

  // "At least 1 day before" rule: reschedule must be made on a calendar day
  // STRICTLY EARLIER than the consultation day (Asia/Manila). Same-day
  // reschedules are not allowed.
  const phDateKey = (date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  const todayKey = phDateKey(new Date())
  const consultationKey = phDateKey(schedDate)
  if (consultationKey <= todayKey) {
    throw new Error(
      'Reschedule must be done at least 1 day before the consultation date — not on the same day.',
    )
  }

  const amount = Number(appt.amount || 0)
  if (amount > 0) {
    const { data: txs, error: txErr } = await supabase
      .from('transactions')
      .select('payment_status')
      .eq('appointment_id', appointmentId)
    if (txErr) throw txErr
    const paid = (txs || []).some((t) => String(t.payment_status || '').toLowerCase() === 'paid')
    if (!paid) {
      throw new Error('Pay your consultation fee first before rescheduling.')
    }
  }

  const slotId = await findAttorneyAvailabilitySlotId(appt.attorney_id, scheduledAt)
  if (!slotId) {
    throw new Error('That time slot is no longer available. Please pick another date or time.')
  }

  const nowIso = new Date().toISOString()
  const nextNotes = buildReschedulePendingNotes(appt.notes, {
    scheduledAt,
    reason: note,
  })

  const { error: updateErr } = await supabase
    .from('appointments')
    .update({ notes: nextNotes, updated_at: nowIso })
    .eq('id', appointmentId)

  if (updateErr) throw updateErr

  invalidateAvailabilityCache(appt.attorney_id, phDateKeyFromIso(scheduledAt))

  try {
    const clientName = await resolveClientDisplayName(appt.client_id)
    const whenLabel = formatScheduleLabelFromIso(scheduledAt)
    const currentLabel = formatScheduleLabelFromIso(appt.scheduled_at)

    await notifyAdminsWithBodyMarker({
      title: 'Reschedule approval needed',
      body: `${clientName} requested to move ${appt.title || 'a consultation'} from ${currentLabel} to ${whenLabel}. Review and accept in Admin Dashboard.`,
      type: 'reschedule_request',
      marker: `[reschedreq:${appointmentId}:${String(scheduledAt || '').slice(0, 24)}]`,
    })

    if (appt.client_id) {
      await supabase.from('notifications').insert({
        user_id: appt.client_id,
        title: 'Reschedule request submitted',
        body: `Your request to move this consultation to ${whenLabel} was sent to BatasMo Admin for approval.`,
        type: 'reschedule',
        is_read: false,
        created_at: nowIso,
      })
    }
  } catch (notifyError) {
    console.warn('[reschedule] notify step failed', notifyError)
  }
}

export async function fetchPendingRescheduleRequestsForAdmin() {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, title, notes, scheduled_at, status, updated_at, client_id, attorney_id, client:client_id(full_name), attorney:attorney_id(full_name)',
    )
    .order('updated_at', { ascending: false })
    .limit(250)

  if (error) throw error

  return (data || [])
    .map((row) => {
      const pending = parseReschedulePendingFromNotes(row.notes)
      if (!pending) return null
      return {
        id: row.id,
        title: row.title || 'Consultation',
        currentScheduledAt: row.scheduled_at,
        requestedScheduledAt: pending.requestedScheduledAt,
        reason: pending.reason,
        status: row.status,
        updatedAt: row.updated_at,
        clientId: row.client_id,
        clientName: row.client?.full_name || 'Client',
        attorneyId: row.attorney_id,
        attorneyName: row.attorney?.full_name || 'Attorney',
      }
    })
    .filter(Boolean)
}

export async function acceptClientRescheduleRequest({ appointmentId }) {
  if (!appointmentId) throw new Error('appointmentId is required.')

  const { data: appt, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, notes, attorney_id, client_id, title, scheduled_at')
    .eq('id', appointmentId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!appt) throw new Error('Appointment not found.')

  const pending = parseReschedulePendingFromNotes(appt.notes)
  if (!pending?.requestedScheduledAt) {
    throw new Error('No pending reschedule request found for this appointment.')
  }

  const newSlotId = await findAttorneyAvailabilitySlotId(appt.attorney_id, pending.requestedScheduledAt)
  if (!newSlotId) {
    throw new Error('The requested time slot is no longer available. Ask the client to pick another slot.')
  }

  await adminRescheduleAppointment({ appointmentId, newSlotId })

  const cleanedNotes = stripReschedulePendingMarker(appt.notes)
  const reasonLine = pending.reason ? `Client reason: ${pending.reason}` : ''
  const finalNotes = [cleanedNotes, reasonLine].filter(Boolean).join('\n').trim()

  await supabase
    .from('appointments')
    .update({
      notes: finalNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)

  return { requestedScheduledAt: pending.requestedScheduledAt, newSlotId }
}

export async function rejectClientRescheduleRequest({ appointmentId, adminNote }) {
  if (!appointmentId) throw new Error('appointmentId is required.')

  const { data: appt, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, notes, client_id, title, scheduled_at')
    .eq('id', appointmentId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!appt) throw new Error('Appointment not found.')

  const pending = parseReschedulePendingFromNotes(appt.notes)
  if (!pending) throw new Error('No pending reschedule request found for this appointment.')

  const cleanedNotes = stripReschedulePendingMarker(appt.notes)
  const nowIso = new Date().toISOString()

  await supabase
    .from('appointments')
    .update({ notes: cleanedNotes || null, updated_at: nowIso })
    .eq('id', appointmentId)

  if (appt.client_id) {
    const whenLabel = formatScheduleLabelFromIso(pending.requestedScheduledAt)
    const body = adminNote?.trim()
      ? `Your reschedule request for ${whenLabel} was declined. ${adminNote.trim()}`
      : `Your reschedule request for ${whenLabel} was declined. Your original schedule stays in place.`

    await supabase.from('notifications').insert({
      user_id: appt.client_id,
      title: 'Reschedule request declined',
      body,
      type: 'reschedule',
      is_read: false,
      created_at: nowIso,
    })
  }

  return { ok: true }
}

// Throws when prevent_double_booking is ON and the client already has an
// active (non-finalized) appointment, so the UI can ask for explicit
// confirmation before continuing into checkout.
export async function assertNoActiveAppointmentForClient(clientId) {
  if (!clientId) return

  const flag = await getAppConfig('prevent_double_booking', true)
  const enforce =
    flag === true ||
    flag === 'true' ||
    flag === 1 ||
    (typeof flag === 'string' && flag.trim().toLowerCase() === 'true')

  if (!enforce) return

  // We deliberately fetch *all* of the client's appointments and filter
  // active ones in JavaScript. Sending an unknown value to Postgres'
  // appointment_status enum throws "invalid input value for enum",
  // and different deployments of this DB have shipped with slightly
  // different enum members over time (e.g. some have 'started', some don't).
  const { data, error } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('client_id', clientId)

  if (error) throw error

  const FINALIZED_STATUSES = new Set(['completed', 'cancelled', 'rejected'])
  const activeRows = (data || []).filter(
    (row) => !FINALIZED_STATUSES.has(String(row?.status || '').toLowerCase()),
  )

  const activeCount = activeRows.length
  if (activeCount === 0) return

  if (activeCount >= 2) {
    throw new Error(
      'You already have two active appointments. Please finish or cancel one before booking again.',
    )
  }

  const confirmError = new Error(
    'You already have an active consultation. Are you sure you want to book another one?',
  )
  confirmError.code = 'DOUBLE_BOOKING_NEEDS_CONFIRMATION'
  throw confirmError
}

const normalizeNotarialStatus = (status) => {
  const value = (status || '').toLowerCase()
  if (value === 'approved') return 'APPROVED'
  if (value === 'completed') return 'COMPLETED'
  if (value === 'rejected' || value === 'cancelled') return 'REJECTED'
  return 'PENDING'
}

export async function fetchClientNotarialRequests(userId) {
  const [requestsRes, transactionsRes] = await Promise.all([
    supabase
      .from('notarial_requests')
      .select('id, service_type, document_url, notes, status, created_at, amount, attorney_id, attorney:attorney_id(full_name)')
      .eq('client_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('transactions')
      .select('notarial_request_id, payment_status')
      .eq('client_id', userId),
  ])

  if (requestsRes.error) throw requestsRes.error
  if (transactionsRes.error) throw transactionsRes.error

  const paymentByRequest = new Map(
    (transactionsRes.data || []).map((tx) => [tx.notarial_request_id, tx.payment_status]),
  )

  return (requestsRes.data || []).map((item) => {
    const status = normalizeNotarialStatus(item.status)
    const datetime = formatDateTime(item.created_at)
    const paymentStatus = (paymentByRequest.get(item.id) || 'unpaid').toLowerCase()
    return {
      id: item.id,
      service: item.service_type || 'Notarial Service',
      description: item.service_type || 'Notarial request',
      date: datetime.date,
      file: item.document_url || 'N/A',
      notes: item.notes || '',
      status,
      payment: paymentStatus === 'paid' ? 'PAID' : 'UNPAID',
      fee: `PHP ${Number(item.amount || 0).toFixed(2)}`,
      amount: Number(item.amount || 0),
      message: status === 'COMPLETED' ? 'Notarization Completed' : status === 'APPROVED' ? 'Ready for Payment' : 'Waiting for Review',
      detail: item.notes || 'Request submitted for review.',
      assignedTo: item.attorney?.full_name || null,
      attorneyId: item.attorney_id || null,
    }
  })
}

export async function payForNotarialRequest({ requestId, clientId, attorneyId, amount, method }) {
  const paymentMethod = normalizeDigitalPaymentMethod(method)
  const now = new Date().toISOString()
  const { error: txError } = await supabase.from('transactions').insert({
    notarial_request_id: requestId,
    client_id: clientId,
    attorney_id: attorneyId,
    amount: Number(amount || 0),
    payment_status: 'paid',
    payment_method: paymentMethod,
    created_at: now,
    updated_at: now,
  })

  if (txError) throw txError

  const { error: reqError } = await supabase
    .from('notarial_requests')
    .update({ status: 'approved', updated_at: now })
    .eq('id', requestId)

  if (reqError) throw reqError

  try {
    const { data: row } = await supabase
      .from('notarial_requests')
      .select('id, service_type, attorney_id')
      .eq('id', requestId)
      .maybeSingle()
    const clientName = await resolveClientDisplayName(clientId)
    const amt = Number(amount || 0)
    const amtLabel = amt > 0 ? `PHP ${amt.toLocaleString()}` : 'the agreed fee'
    const svc = row?.service_type || 'notarial request'
    const aid = row?.attorney_id || attorneyId
    if (aid) {
      const { error: nErr } = await supabase.from('notifications').insert({
        user_id: aid,
        title: 'Notarial payment received',
        body: `${clientName} paid ${amtLabel} for ${svc}. [notarialpaid:${requestId}]`,
        type: 'payment',
        is_read: false,
        created_at: now,
      })
      if (nErr) console.warn('[notarial] attorney payment notify failed', nErr)
    }
    await notifyAdminsWithBodyMarker({
      title: 'Notarial payment received',
      body: `${clientName} paid ${amtLabel} for ${svc} (request ${String(requestId).slice(0, 8)}…).`,
      type: 'admin_general',
      marker: `[adminnotpaid:${requestId}]`,
    })
  } catch (e) {
    console.warn('[notarial] payment notify failed', e)
  }
}

export async function cancelNotarialRequest(requestId) {
  const { error } = await supabase
    .from('notarial_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) throw error
}

/** Realtime updates when admin changes notary status (same account on web or mobile). */
export function subscribeToClientNotarialRequests(clientId, onChange) {
  if (!clientId) {
    return () => {}
  }

  const { schedule, dispose } = createDebouncedRealtimeHandler(() => {
    onChange?.()
  })

  const channel = supabase
    .channel(`client-notary:${clientId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notarial_requests',
        filter: `client_id=eq.${clientId}`,
      },
      () => schedule(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `client_id=eq.${clientId}`,
      },
      () => schedule(),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[realtime] client-notary channel error — using poll/focus refresh')
      }
    })

  return () => {
    dispose()
    supabase.removeChannel(channel)
  }
}

export async function fetchClientTransactions(userId) {
  const loadTransactionRows = async (queryBuilder) => {
    const response = await queryBuilder(
      supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false }),
    )

    if (response.error) throw response.error
    return response.data || []
  }

  const byClientId = await loadTransactionRows((query) => query.eq('client_id', userId))

  const [{ data: appointmentRows, error: appointmentError }, { data: notarialRows, error: notarialError }] = await Promise.all([
    supabase.from('appointments').select('id').eq('client_id', userId),
    supabase.from('notarial_requests').select('id').eq('client_id', userId),
  ])

  if (appointmentError) throw appointmentError
  if (notarialError) throw notarialError

  const appointmentIds = (appointmentRows || []).map((row) => row.id).filter(Boolean)
  const notarialIds = (notarialRows || []).map((row) => row.id).filter(Boolean)

  const [byAppointmentLink, byNotarialLink] = await Promise.all([
    appointmentIds.length
      ? loadTransactionRows((query) => query.in('appointment_id', appointmentIds))
      : Promise.resolve([]),
    notarialIds.length
      ? loadTransactionRows((query) => query.in('notarial_request_id', notarialIds))
      : Promise.resolve([]),
  ])

  const mergedById = new Map()
  ;[...byClientId, ...byAppointmentLink, ...byNotarialLink].forEach((tx) => {
    mergedById.set(tx.id, tx)
  })

  const mergedRows = Array.from(mergedById.values())

  const mergedAppointmentIds = Array.from(
    new Set(mergedRows.map((tx) => tx.appointment_id).filter(Boolean)),
  )
  const mergedNotarialIds = Array.from(
    new Set(mergedRows.map((tx) => tx.notarial_request_id).filter(Boolean)),
  )
  const mergedAttorneyIds = Array.from(
    new Set(mergedRows.map((tx) => tx.attorney_id).filter(Boolean)),
  )

  const [appointmentsRes, notarialRes, attorneyRes] = await Promise.all([
    mergedAppointmentIds.length
      ? supabase.from('appointments').select('id, title').in('id', mergedAppointmentIds)
      : Promise.resolve({ data: [], error: null }),
    mergedNotarialIds.length
      ? supabase.from('notarial_requests').select('id, service_type').in('id', mergedNotarialIds)
      : Promise.resolve({ data: [], error: null }),
    mergedAttorneyIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', mergedAttorneyIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (appointmentsRes.error) throw appointmentsRes.error
  if (notarialRes.error && !isMissingRelationError(notarialRes.error)) throw notarialRes.error

  const appointmentById = new Map((appointmentsRes.data || []).map((row) => [row.id, row]))
  const notarialById = new Map((notarialRes.data || []).map((row) => [row.id, row]))
  const attorneyById = new Map((attorneyRes.data || []).map((row) => [row.id, row]))

  return mergedRows
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .map((tx) => {
    const datetime = formatDateTime(tx.created_at)
    const isConsultation = Boolean(tx.appointment_id)
    const rawMethod = String(tx.payment_method || '').toLowerCase()
    const paymentMethod = rawMethod === 'gcash' ? 'GCash' : rawMethod === 'maya' ? 'Maya' : 'GCash'
      const appointment = tx.appointment_id ? appointmentById.get(tx.appointment_id) : null
      const notarial = tx.notarial_request_id ? notarialById.get(tx.notarial_request_id) : null
      const attorney = tx.attorney_id ? attorneyById.get(tx.attorney_id) : null
      const normalizedAmount = Number(tx.amount || 0)

    return {
      id: tx.id,
      type: isConsultation ? 'consultation' : 'notarial',
      description: isConsultation
          ? `Legal Consultation - ${appointment?.title || 'General'}`
          : `Notarial Service - ${notarial?.service_type || 'General'}`,
      detail: isConsultation
          ? `Consultation with ${attorney?.full_name || 'Attorney'}`
          : `Notarization with ${attorney?.full_name || 'Attorney'}`,
      amount: `PHP ${normalizedAmount.toFixed(2)}`,
      amountValue: normalizedAmount,
      date: datetime.date,
      time: datetime.time,
      method: paymentMethod,
      status: (tx.payment_status || 'pending').toLowerCase(),
      refNo: tx.reference_no || tx.provider_reference || tx.id,
    }
  })
}

export async function fetchAttorneyConsultationRequests(userId, options = {}) {
  const [appointments, notificationsRes, paidTransactionsRes] = await Promise.all([
    fetchAttorneyAppointments(userId, options),
    supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('transactions')
      .select('id, amount, created_at, appointment_id, client_id, payment_status')
      .eq('attorney_id', userId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (notificationsRes.error) throw notificationsRes.error
  if (paidTransactionsRes.error) throw paidTransactionsRes.error

  const requests = appointments
    .filter((item) => {
      const status = String(item.status || '').toLowerCase()
      if (
        status === 'pending' ||
        status === 'confirmed' ||
        status === 'rescheduled' ||
        status === 'started' ||
        status === 'in_progress' ||
        status === 'in-progress' ||
        status === 'active'
      ) {
        return true
      }
      return isRecentlyCancelledAppointment(item)
    })
    .sort((a, b) => {
      const aTime = a.parsed_scheduled_at?.getTime() || 0
      const bTime = b.parsed_scheduled_at?.getTime() || 0
      return aTime - bTime
    })
    .map((item) => ({
      id: item.id,
      clientId: item.client_id,
      name: item.client_name || 'Client',
      initials: (item.client_name || 'CL')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      area: item.title || 'Consultation',
      date: item.date_label,
      time: item.time_label,
      payment: Number(item.amount || 0) > 0 ? 'Paid' : 'Unpaid',
      status: 'Approved',
      concern: item.notes || 'No additional notes provided.',
      attachmentUrl: item.attachment_url || '',
      attachmentName: item.attachment_name || '',
    }))

  const storedNotifications = (notificationsRes.data || []).map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    type: item.type || 'general',
    text: `${item.title}: ${item.body}`,
    time: formatNotificationTimestamp(item.created_at),
    createdAt: item.created_at,
    unread: !item.is_read,
  }))

  const derivedNotifications = buildDerivedAttorneyNotifications({
    appointments,
    paidTransactions: paidTransactionsRes.data || [],
  })

  const notifications = [...storedNotifications, ...derivedNotifications]
    .reduce((acc, item) => {
      if (!acc.some((existing) => existing.id === item.id)) {
        acc.push(item)
      }
      return acc
    }, [])
    .slice(0, 10)

  return { requests, notifications }
}

export async function updateAttorneyConsultationRequestStatus({ appointmentId, status, scheduledAt, note }) {
  const normalizedStatus = String(status || '')
    .trim()
    .toLowerCase()
    .replace('approved', 'confirmed')
    .replace('rejected', 'cancelled')

  const payload = {
    status: normalizedStatus || 'pending',
    updated_at: new Date().toISOString(),
  }
  if (scheduledAt) payload.scheduled_at = scheduledAt

  if (note) {
    if ((normalizedStatus || '').toLowerCase() === 'rescheduled') {
      const { data: existingAppt } = await supabase
        .from('appointments')
        .select('notes')
        .eq('id', appointmentId)
        .maybeSingle()

      payload.notes = existingAppt?.notes
        ? `${existingAppt.notes}\n\nReschedule reason: ${note}`
        : `Reschedule reason: ${note}`
    } else {
      payload.notes = note
    }
  }

  const { error } = await supabase.from('appointments').update(payload).eq('id', appointmentId)
  if (error) throw error

  invalidateAttorneyAppointmentsCache()
}

export async function fetchBookableAttorneys({ concern, onlyVerified = true } = {}) {
  let profilesQuery = supabase
    .from('attorney_profiles')
    .select('user_id, years_experience, specialties, consultation_fee, bio, is_verified, prc_id, profile:user_id(full_name, email)')
    .order('updated_at', { ascending: false })

  if (onlyVerified) {
    profilesQuery = profilesQuery.eq('is_verified', true)
  }

  const { data, error } = await profilesQuery

  if (error) throw error

  let attorneys = data || []

  // Fallback: if verified-only query is empty, retry without verification filter
  if (onlyVerified && attorneys.length === 0) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('attorney_profiles')
      .select('user_id, years_experience, specialties, consultation_fee, bio, is_verified, prc_id, profile:user_id(full_name, email)')
      .order('updated_at', { ascending: false })

    if (!fallbackError) {
      attorneys = fallbackData || []
    }
  }
  const attorneyIds = attorneys.map((item) => item.user_id).filter(Boolean)

  let cmsByAttorney = new Map()
  if (attorneyIds.length > 0) {
    const { data: cmsRows, error: cmsError } = await supabase
      .from('cms_attorney_directory')
      .select('user_id, display_name, profile_image_url, expertise_fields, practice_areas, biography, is_published')
      .in('user_id', attorneyIds)

    if (!cmsError) {
      cmsByAttorney = new Map((cmsRows || []).map((row) => [row.user_id, row]))
    } else if (!isMissingRelationError(cmsError)) {
      throw cmsError
    }
  }

  let availabilityByAttorney = new Map()
  if (attorneyIds.length > 0) {
    const todayDate = new Date().toISOString().slice(0, 10)
    let slots = []
    let slotsError = null

    const dateTimeSlotsRes = await supabase
      .from('availability_slots')
      .select('id, attorney_id, date, time, is_booked')
      .in('attorney_id', attorneyIds)
      .eq('is_booked', false)
      .gte('date', todayDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    slots = dateTimeSlotsRes.data || []
    slotsError = dateTimeSlotsRes.error || null

    if (slotsError && (isMissingColumnError(slotsError, 'date') || isMissingColumnError(slotsError, 'time'))) {
      const fallbackSlotsRes = await supabase
        .from('availability_slots')
        .select('id, attorney_id, start_time, end_time, is_booked')
        .in('attorney_id', attorneyIds)
        .eq('is_booked', false)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })

      if (fallbackSlotsRes.error) throw fallbackSlotsRes.error

      availabilityByAttorney = (fallbackSlotsRes.data || []).reduce((map, slot) => {
        const list = map.get(slot.attorney_id) || []
        const start = slot.start_time ? new Date(slot.start_time) : null
        const end = slot.end_time ? new Date(slot.end_time) : null

        if (!start || Number.isNaN(start.getTime()) || start <= new Date()) {
          map.set(slot.attorney_id, list)
          return map
        }

        const safeEnd = end && !Number.isNaN(end.getTime()) ? end : new Date(start.getTime() + 60 * 60 * 1000)
        list.push({
          id: slot.id,
          startTime: start.toISOString(),
          endTime: safeEnd.toISOString(),
          rawDate: start.toISOString().slice(0, 10),
          rawTime: `${toTwoDigits(((start.getHours() + 11) % 12) + 1)}:${toTwoDigits(start.getMinutes())} ${start.getHours() >= 12 ? 'PM' : 'AM'}`,
          dateLabel: start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
          timeLabel: `${start.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} - ${safeEnd.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`,
        })
        map.set(slot.attorney_id, list)
        return map
      }, new Map())
    } else {
      if (slotsError) throw slotsError

      availabilityByAttorney = (slots || []).reduce((map, slot) => {
      const list = map.get(slot.attorney_id) || []
      const start = parseSlotDateTime(slot.date, slot.time)
      if (!start || start <= new Date()) {
        map.set(slot.attorney_id, list)
        return map
      }

      const end = new Date(start.getTime() + 60 * 60 * 1000)
      list.push({
        id: slot.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        rawDate: slot.date,
        rawTime: slot.time,
        dateLabel: Number.isNaN(start.getTime())
          ? 'TBD'
          : start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        timeLabel: Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
          ? 'TBD'
          : `${start.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`,
      })
      map.set(slot.attorney_id, list)
      return map
      }, new Map())
    }
  }

  return attorneys
    .filter((item) => {
      const cms = cmsByAttorney.get(item.user_id)
      if (cms && cms.is_published === false) return false
      const concernPool = [
        ...normalizeStringArray(item.specialties),
        ...normalizeStringArray(cms?.expertise_fields),
        ...normalizeStringArray(cms?.practice_areas),
      ]
      return matchConcernToSpecialties(concernPool, concern)
    })
    .map((item) => {
    const cms = cmsByAttorney.get(item.user_id)
    const fullName = item.profile?.full_name || 'Attorney'
    const primarySpecialty = Array.isArray(item.specialties) && item.specialties.length
      ? item.specialties[0]
      : 'General Practice'
    const availableSlots = availabilityByAttorney.get(item.user_id) || []
    return {
      id: item.user_id,
      name: cms?.display_name || fullName,
      specialty: normalizeStringArray(cms?.expertise_fields)[0] || primarySpecialty,
      specialties: normalizeStringArray(cms?.expertise_fields || item.specialties),
      practiceAreas: normalizeStringArray(cms?.practice_areas || item.specialties),
      exp: '3 years experience',
      rating: 5,
      price: `PHP ${Number(item.consultation_fee || 2000).toFixed(2)}`,
      amount: Number(item.consultation_fee || 2000),
      bio: cms?.biography || item.bio || 'No biography available yet.',
      details: cms?.biography || item.bio || 'No additional profile details provided.',
      prcId: item.prc_id || '',
      verified: Boolean(item.is_verified),
      availableSlots,
      img:
        resolveAttorneyImage(cms?.display_name || fullName, cms?.profile_image_url),
    }
  })
}

export async function fetchPublicLandingData() {
  let content = { ...LANDING_CONTENT_DEFAULTS }

  const { data: siteRows, error: siteError } = await supabase
    .from('cms_site_content')
    .select('content_key, content_value')

  if (!siteError) {
    content = (siteRows || []).reduce(
      (acc, row) => {
        acc[row.content_key] = row.content_value
        return acc
      },
      { ...LANDING_CONTENT_DEFAULTS },
    )
  } else if (!isMissingRelationError(siteError)) {
    throw siteError
  }

  const { data: attorneys, error: attorneyError } = await supabase
    .from('attorney_profiles')
    .select('user_id, consultation_fee, specialties, bio, is_verified, prc_id, profiles:user_id(full_name)')
    .eq('is_verified', true)
    .order('updated_at', { ascending: false })

  if (attorneyError) throw attorneyError

  let cmsByAttorney = new Map()
  const { data: cmsRows, error: cmsError } = await supabase
    .from('cms_attorney_directory')
    .select('user_id, display_name, profile_image_url, expertise_fields, practice_areas, biography, is_published')
    .eq('is_published', true)

  if (!cmsError) {
    cmsByAttorney = new Map((cmsRows || []).map((row) => [row.user_id, row]))
  } else if (!isMissingRelationError(cmsError)) {
    throw cmsError
  }

  const shouldRestrictToCms = cmsByAttorney.size > 0

  const gallery = (attorneys || [])
    .filter((row) => (!shouldRestrictToCms ? true : cmsByAttorney.has(row.user_id)))
    .map((row) => {
      const cms = cmsByAttorney.get(row.user_id)
      const fullName = row.profiles?.full_name || 'Attorney'
      return {
        id: row.user_id,
        name: cms?.display_name || fullName,
        image: resolveAttorneyImage(cms?.display_name || fullName, cms?.profile_image_url),
        expertiseFields: normalizeStringArray(cms?.expertise_fields || row.specialties),
        practiceAreas: normalizeStringArray(cms?.practice_areas || row.specialties),
        biography: cms?.biography || row.bio || 'No biography available yet.',
        consultationFee: Number(row.consultation_fee || 0),
        prcId: row.prc_id || '',
      }
    })

  return { content, attorneys: gallery }
}

/**
 * Uploads an optional client-provided file that should accompany a new
 * consultation booking. Uses the public `appointment-attachments` bucket and
 * returns `{ url, name }` so the caller can persist it onto the appointment.
 */
export async function uploadAppointmentAttachment({ clientId, file }) {
  if (!(file instanceof File)) return null
  if (!clientId) throw new Error('clientId is required to upload an attachment.')
  const safeName = String(file.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${clientId}/${Date.now()}_${safeName}`
  const ext = safeName.split('.').pop() || 'bin'

  const { error: uploadError } = await supabase.storage
    .from('appointment-attachments')
    .upload(filePath, file, {
      contentType: file.type || `application/${ext}`,
      upsert: false,
    })

  if (uploadError) {
    const rlsHint =
      /row-level security|violates row-level security/i.test(String(uploadError.message || ''))
        ? ' In Supabase, run database/20260514_appointment_attachments_storage_rls.sql (SQL Editor).'
        : ''

    // Fall back to the existing notarial-documents bucket so the feature
    // still works if the team has not provisioned the new bucket yet.
    const { error: fallbackUploadError } = await supabase.storage
      .from('notarial-documents')
      .upload(filePath, file, {
        contentType: file.type || `application/${ext}`,
        upsert: false,
      })
    if (fallbackUploadError) {
      throw new Error(
        `${uploadError.message || 'Could not upload attachment.'}${rlsHint}`.trim(),
      )
    }

    const { data: fallbackUrlData } = supabase.storage
      .from('notarial-documents')
      .getPublicUrl(filePath)
    return {
      url: fallbackUrlData?.publicUrl || filePath,
      name: file.name || safeName,
    }
  }

  const { data: urlData } = supabase.storage
    .from('appointment-attachments')
    .getPublicUrl(filePath)

  return {
    url: urlData?.publicUrl || filePath,
    name: file.name || safeName,
  }
}

export async function createAppointmentBooking({
  clientId,
  attorneyId,
  slotId,
  title,
  notes,
  amount,
  paymentMethod,
  paymentCode,
  attachmentUrl,
  attachmentName,
  payload,
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    throw new Error('Not authenticated')
  }

  const resolvedClientId = user.id
  if (clientId && clientId !== resolvedClientId) {
    console.warn('[booking] client payload id mismatch, using authenticated id', {
      providedClientId: clientId,
      authClientId: resolvedClientId,
    })
  }

  const nowIso = new Date().toISOString()

  const normalizedPayload = {
    attorney_id: payload?.attorney_id || attorneyId,
    title: payload?.title || title || 'Legal Consultation',
    notes: payload?.notes ?? notes ?? null,
    scheduled_at: payload?.scheduled_at || null,
    slot_date: payload?.slot_date || null,
    slot_time: payload?.slot_time || null,
    amount: Number(payload?.amount ?? amount ?? 0),
    duration_minutes: Number(payload?.duration_minutes || 60),
    attachment_url: payload?.attachment_url ?? attachmentUrl ?? null,
    attachment_name: payload?.attachment_name ?? attachmentName ?? null,
  }

  let resolvedSlotId = slotId || payload?.slot_id || null
  if (resolvedSlotId && (!normalizedPayload.slot_date || !normalizedPayload.slot_time || !normalizedPayload.scheduled_at)) {
    const { data: selectedSlot, error: selectedSlotError } = await supabase
      .from('availability_slots')
      .select('id, attorney_id, date, time, is_booked')
      .eq('id', resolvedSlotId)
      .maybeSingle()

    if (selectedSlotError) throw selectedSlotError
    if (!selectedSlot) throw new Error('Selected slot is no longer available.')
    if (selectedSlot.is_booked) throw new Error('Selected slot has already been booked.')
    if (selectedSlot.attorney_id !== normalizedPayload.attorney_id) {
      throw new Error('Selected slot does not belong to this attorney.')
    }

    const slotDateTime = parseSlotDateTime(selectedSlot.date, selectedSlot.time)
    normalizedPayload.slot_date = normalizedPayload.slot_date || selectedSlot.date
    normalizedPayload.slot_time = normalizedPayload.slot_time || selectedSlot.time
    normalizedPayload.scheduled_at = normalizedPayload.scheduled_at || (slotDateTime ? slotDateTime.toISOString() : null)
  }

  const scheduledIso = toIso(normalizedPayload.scheduled_at)
  if (!resolvedClientId || !normalizedPayload.attorney_id || !scheduledIso) {
    throw new Error('Missing appointment payload details.')
  }

  // Respect the admin "Prevent Multiple Active Bookings" toggle. When OFF,
  // skip the per-attorney 2-booking cap entirely so the team can stress-test
  // the booking flow without juggling test data.
  const doubleBookingFlag = await getAppConfig('prevent_double_booking', true)
  if (coerceFlag(doubleBookingFlag, true)) {
    const activeBookingCount = await fetchClientAttorneyActiveBookingCount({
      clientId: resolvedClientId,
      attorneyId: normalizedPayload.attorney_id,
    })

    if (activeBookingCount >= 2) {
      throw new Error('Booking limit reached. You can only keep up to 2 active bookings with the same attorney.')
    }
  }

  normalizedPayload.scheduled_at = scheduledIso

  let appointmentId = null

  const rpcExtended = await supabase.rpc('book_appointment', {
    client_uuid: resolvedClientId,
    attorney_uuid: normalizedPayload.attorney_id,
    scheduled_time: normalizedPayload.scheduled_at,
    title_text: normalizedPayload.title,
    notes_text: normalizedPayload.notes,
    slot_date: normalizedPayload.slot_date,
    slot_time: normalizedPayload.slot_time,
    amount_value: normalizedPayload.amount,
    duration_minutes_value: normalizedPayload.duration_minutes,
  })

  let rpcSucceeded = false

  if (!rpcExtended.error) {
    rpcSucceeded = true
    appointmentId = rpcExtended.data || null
  }

  if (rpcExtended.error) {
    const rpcLegacy = await supabase.rpc('book_appointment', {
      client_uuid: resolvedClientId,
      attorney_uuid: normalizedPayload.attorney_id,
      scheduled_time: normalizedPayload.scheduled_at,
      title_text: normalizedPayload.title,
    })

    if (!rpcLegacy.error) {
      rpcSucceeded = true
      appointmentId = rpcLegacy.data || null
    }
  }

  if (!appointmentId && !rpcSucceeded) {
    const insertPayload = {
      client_id: resolvedClientId,
      attorney_id: normalizedPayload.attorney_id,
      slot_id: resolvedSlotId,
      title: normalizedPayload.title,
      notes: normalizedPayload.notes,
      scheduled_at: normalizedPayload.scheduled_at,
      duration_minutes: normalizedPayload.duration_minutes,
      amount: normalizedPayload.amount,
      // 'pending' until PayMongo flips it to 'confirmed' via notifyAttorneyOfPaidBooking().
      status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    }
    if (normalizedPayload.attachment_url) insertPayload.attachment_url = normalizedPayload.attachment_url
    if (normalizedPayload.attachment_name) insertPayload.attachment_name = normalizedPayload.attachment_name

    let insertResult = await supabase
      .from('appointments')
      .insert(insertPayload)
      .select('id')
      .single()

    // Schema may not have attachment columns yet on older deployments; retry without them.
    if (insertResult.error && (isMissingColumnError(insertResult.error, 'attachment_url') || isMissingColumnError(insertResult.error, 'attachment_name'))) {
      const { attachment_url, attachment_name, ...rest } = insertPayload
      insertResult = await supabase
        .from('appointments')
        .insert(rest)
        .select('id')
        .single()
    }

    if (insertResult.error) throw insertResult.error
    appointmentId = insertResult.data?.id || null
  }

  // RPC paths don't carry attachment metadata yet; patch it in if needed.
  if (appointmentId && (normalizedPayload.attachment_url || normalizedPayload.attachment_name)) {
    const attachmentPatch = {}
    if (normalizedPayload.attachment_url) attachmentPatch.attachment_url = normalizedPayload.attachment_url
    if (normalizedPayload.attachment_name) attachmentPatch.attachment_name = normalizedPayload.attachment_name
    const { error: attachUpdateError } = await supabase
      .from('appointments')
      .update(attachmentPatch)
      .eq('id', appointmentId)
    if (attachUpdateError && !isMissingColumnError(attachUpdateError, 'attachment_url') && !isMissingColumnError(attachUpdateError, 'attachment_name')) {
      console.warn('[booking] persist attachment metadata failed', attachUpdateError)
    }
  }

  if (normalizedPayload.slot_date && normalizedPayload.slot_time) {
    const rpcSlotBook = await supabase.rpc('mark_slot_booked', {
      p_attorney_id: normalizedPayload.attorney_id,
      p_date: normalizedPayload.slot_date,
      p_time: normalizedPayload.slot_time,
    })

    if (rpcSlotBook.error) {
      console.warn('[booking] mark_slot_booked RPC failed', rpcSlotBook.error)
    }
  }

  if (resolvedSlotId && !normalizedPayload.slot_date && !normalizedPayload.slot_time) {
    const { error: updateSlotError } = await supabase
      .from('availability_slots')
      .update({ is_booked: true, updated_at: nowIso })
      .eq('id', resolvedSlotId)
      .eq('is_booked', false)

    if (updateSlotError) {
      console.warn('[booking] fallback slot update failed', updateSlotError)
    }
  }

  if (!appointmentId) {
    const { data: latestAppointment, error: latestError } = await supabase
      .from('appointments')
      .select('id')
      .eq('client_id', resolvedClientId)
      .eq('attorney_id', normalizedPayload.attorney_id)
      .eq('scheduled_at', normalizedPayload.scheduled_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestError) throw latestError
    appointmentId = latestAppointment?.id || null
  }

  if (!appointmentId) {
    const { data: fallbackLatest } = await supabase
      .from('appointments')
      .select('id')
      .eq('client_id', resolvedClientId)
      .eq('attorney_id', normalizedPayload.attorney_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    appointmentId = fallbackLatest?.id || null
  }

  if (appointmentId) {
    const { error: finalizeError } = await supabase
      .from('appointments')
      .update({
        notes: normalizedPayload.notes,
        duration_minutes: normalizedPayload.duration_minutes,
        amount: normalizedPayload.amount,
        // Always start as 'pending'. notifyAttorneyOfPaidBooking() will flip
        // this to 'confirmed' once the PayMongo transaction is marked paid.
        status: 'pending',
        slot_id: resolvedSlotId,
        updated_at: nowIso,
      })
      .eq('id', appointmentId)

    if (finalizeError) throw finalizeError

    // Ensure room exists even if DB trigger was not present earlier.
    const { error: roomInsertError } = await supabase
      .from('consultation_rooms')
      .insert({ appointment_id: appointmentId })

    const roomInsertMsg = String(roomInsertError?.message || '').toLowerCase()
    const isDuplicateRoom =
      roomInsertMsg.includes('duplicate') ||
      roomInsertMsg.includes('already exists') ||
      roomInsertMsg.includes('unique')

    if (roomInsertError && !isDuplicateRoom) {
      console.warn('[booking] consultation room ensure failed', roomInsertError)
    }
  }

  if (paymentMethod && appointmentId) {
    const normalizedPaymentMethod = normalizeDigitalPaymentMethod(paymentMethod)

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('client_id', resolvedClientId)
      .eq('payment_status', 'paid')
      .limit(1)
      .maybeSingle()

    if (!existingTx?.id) {
      const { error: txError } = await supabase.from('transactions').insert({
        appointment_id: appointmentId,
        client_id: resolvedClientId,
        attorney_id: normalizedPayload.attorney_id,
        amount: normalizedPayload.amount,
        payment_status: 'paid',
        payment_method: normalizedPaymentMethod,
        provider_reference: paymentCode || null,
        created_at: nowIso,
        updated_at: nowIso,
      })

      if (txError) throw txError

      try {
        const whenLabel = new Date(normalizedPayload.scheduled_at).toLocaleString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })

        const { error: paymentNotificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: resolvedClientId,
            title: 'Payment Confirmed',
            body: `Your payment for ${normalizedPayload.title || 'your consultation'} on ${whenLabel} has been received.`,
            type: 'payment',
            is_read: false,
            created_at: nowIso,
          })

        if (paymentNotificationError) {
          console.warn('[booking] failed to create client payment notification', paymentNotificationError)
        }
      } catch (paymentNotificationFailure) {
        console.warn('[booking] client payment notification step failed', paymentNotificationFailure)
      }
    }
  }

  if (appointmentId) {
    try {
      const rawClientName =
        String(user.user_metadata?.full_name || '').trim() ||
        String(user.email || '').trim() ||
        'A client'
      const whenLabel = new Date(normalizedPayload.scheduled_at).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })

      // Attorney sees this immediately so they know a booking is in-progress.
      // It later flips to "Booking Confirmed" or "Booking Cancelled" through
      // notifyAttorneyOfPaidBooking() / cancelPendingUnpaidBooking().
      const dedupeMarker = `[appt:${appointmentId}]`
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: normalizedPayload.attorney_id,
          title: 'Pending Consultation Booking',
          body: `${rawClientName} is booking ${normalizedPayload.title || 'a consultation'} on ${whenLabel}. Waiting for payment. ${dedupeMarker}`,
          type: 'consultation',
          is_read: false,
          created_at: nowIso,
        })

      if (notificationError) {
        console.warn('[booking] failed to create attorney pending notification', notificationError)
      }

      const { error: clientBookingNotificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: resolvedClientId,
          title: 'Booking Submitted',
          body: `Your booking for ${normalizedPayload.title || 'a consultation'} on ${whenLabel} was submitted successfully.`,
          type: 'consultation',
          is_read: false,
          created_at: nowIso,
        })

      if (clientBookingNotificationError) {
        console.warn('[booking] failed to create client booking notification', clientBookingNotificationError)
      }
    } catch (notificationFailure) {
      console.warn('[booking] notification step failed', notificationFailure)
    }
  }

  invalidateAttorneyAppointmentsCache()

  return { success: true, appointmentId, payload: normalizedPayload }
}

export async function fetchClientAttorneyActiveBookingCount({ clientId, attorneyId }) {
  if (!clientId || !attorneyId) return 0

  const ACTIVE_LIMIT_STATUSES = new Set([
    'pending',
    'confirmed',
    'rescheduled',
    'started',
    'in_progress',
    'in-progress',
    'active',
    'approved',
  ])

  const { data, error } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('attorney_id', attorneyId)

  if (error) throw error

  return (data || []).filter((item) => ACTIVE_LIMIT_STATUSES.has(String(item?.status || '').toLowerCase())).length
}

async function getOrCreateConsultationRoom(appointmentId) {
  const devBypass = process.env.REACT_APP_BYPASS_CHAT_WINDOW === 'true'

  // Older deployments of the appointments table do not have the optional
  // slot_date / slot_time columns. Try the rich query first and fall back
  // to a minimal one if Postgres reports a missing column.
  const richFields = 'status, scheduled_at, slot_date, slot_time'
  const minimalFields = 'status, scheduled_at'

  let appointment = null
  let appointmentError = null

  if (!devBypass) {
    const richRes = await supabase
      .from('appointments')
      .select(richFields)
      .eq('id', appointmentId)
      .maybeSingle()

    if (richRes.error && isMissingColumnError(richRes.error, 'slot_date')) {
      const minRes = await supabase
        .from('appointments')
        .select(minimalFields)
        .eq('id', appointmentId)
        .maybeSingle()
      appointment = minRes.data || null
      appointmentError = minRes.error || null
    } else {
      appointment = richRes.data || null
      appointmentError = richRes.error || null
    }
  } else {
    const res = await supabase
      .from('appointments')
      .select('status')
      .eq('id', appointmentId)
      .maybeSingle()
    appointment = res.data || null
    appointmentError = res.error || null
  }

  if (appointmentError) throw appointmentError

  const status = String(appointment?.status || '').toLowerCase()

  if (!devBypass && !isConsultationChatActiveStatus(status)) {
    throw new Error(CHAT_ACCESS_BLOCKED_MESSAGE)
  }

  if (
    !devBypass &&
    !isConsultationChatWindowOpen({
      status,
      scheduledAt: appointment?.scheduled_at,
      slotDate: appointment?.slot_date,
      slotTime: appointment?.slot_time,
    })
  ) {
    throw new Error(
      buildChatScheduleBlockedMessage({
        scheduledAt: appointment?.scheduled_at,
        slotDate: appointment?.slot_date,
        slotTime: appointment?.slot_time,
      }),
    )
  }

  const { data: room, error: roomError } = await supabase
    .from('consultation_rooms')
    .select('id, is_closed')
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (room?.id) return room

  const { data: createdRoom, error: createRoomError } = await supabase
    .from('consultation_rooms')
    .insert({ appointment_id: appointmentId })
    .select('id, is_closed')
    .single()

  if (createRoomError) throw new Error(roomError?.message || createRoomError.message)
  return createdRoom
}

const formatChatTimeLabel = (value) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Now'
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const mapRoomMessage = (row, roomId, isClosed, currentUserId) => ({
  id: row.id,
  senderId: row.sender_id,
  senderName: Array.isArray(row.sender) ? row.sender[0]?.full_name : row.sender?.full_name,
  text: row.message || '',
  messageType: row.message_type || 'text',
  fileBucket: row.file_bucket || null,
  filePath: row.file_path || null,
  fileName: row.file_name || null,
  mimeType: row.mime_type || null,
  fileSizeBytes: row.file_size_bytes || null,
  createdAt: row.created_at,
  time: formatChatTimeLabel(row.created_at),
  isMine: row.sender_id === currentUserId,
  roomId,
  isClosed,
})

export async function fetchAppointmentMessages(appointmentId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('consultation_rooms')
    .select(
      `
      id,
      is_closed,
      video_meeting_id,
      messages (
        id,
        sender_id,
        message,
        message_type,
        file_bucket,
        file_path,
        file_name,
        mime_type,
        file_size_bytes,
        created_at,
        sender:sender_id(full_name)
      )
    `,
    )
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (error || !data) {
    await getOrCreateConsultationRoom(appointmentId)
    return { messages: [], isClosed: false }
  }

  const sorted = (data.messages || [])
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))

  const mapped = sorted.map((row) => mapRoomMessage(row, data.id, Boolean(data.is_closed), user.id))

  return {
    messages: mapped,
    isClosed: Boolean(data.is_closed),
    roomId: data.id,
    videoMeetingId: data.video_meeting_id || null,
  }
}

export async function sendAppointmentMessage(appointmentId, messageText) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const room = await getOrCreateConsultationRoom(appointmentId)
  if (room.is_closed) throw new Error('This consultation is closed.')
  const body = String(messageText || '').trim()
  if (!body) throw new Error('Message cannot be empty.')

  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: room.id,
      sender_id: user.id,
      message: body,
      message_type: 'text',
    })
    .select('id, sender_id, message, message_type, file_bucket, file_path, file_name, mime_type, file_size_bytes, created_at, sender:sender_id(full_name)')
    .single()

  if (error) throw error

  void notifyConsultationChatOutsideActiveCall({
    appointmentId,
    senderId: user.id,
    preview: body,
  }).catch(() => {})

  return mapRoomMessage(data, room.id, Boolean(room.is_closed), user.id)
}

export async function sendAppointmentAttachment(appointmentId, file, caption = '') {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!file) throw new Error('No file selected.')

  const room = await getOrCreateConsultationRoom(appointmentId)
  if (room.is_closed) throw new Error('This consultation is closed.')

  const mime = inferMimeFromFile(file)
  const preValidation = validateChatAttachment(file.size || 0, mime)
  if (!preValidation.ok) {
    throw new Error(preValidation.error)
  }

  const messageType = mime.startsWith('image/') ? 'image' : 'file'
  const bucket = bucketForMessageType(mime)
  const extension = String(file.name || '')
    .split('.')
    .pop()
    ?.toLowerCase()
  const safeExt = extension || (messageType === 'image' ? 'jpg' : 'bin')
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`
  const path = `${appointmentId}/${user.id}/${safeName}`

  const fileBuffer = await file.arrayBuffer()
  const actualSize = fileBuffer.byteLength
  const postValidation = validateChatAttachment(actualSize, mime)
  if (!postValidation.ok) {
    throw new Error(postValidation.error)
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, fileBuffer, {
      contentType: mime,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const normalizedCaption = String(caption || '').trim()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: room.id,
      sender_id: user.id,
      message: normalizedCaption || (messageType === 'image' ? 'Photo' : 'Attachment'),
      message_type: messageType,
      file_bucket: bucket,
      file_path: path,
      file_name: file.name || safeName,
      mime_type: mime,
      file_size_bytes: actualSize,
    })
    .select('id, sender_id, message, message_type, file_bucket, file_path, file_name, mime_type, file_size_bytes, created_at, sender:sender_id(full_name)')
    .single()

  if (error) throw new Error(error.message)

  void notifyConsultationChatOutsideActiveCall({
    appointmentId,
    senderId: user.id,
    preview: normalizedCaption || file?.name || (messageType === 'image' ? 'Photo' : 'File attachment'),
  }).catch(() => {})

  return mapRoomMessage(data, room.id, Boolean(room.is_closed), user.id)
}

export async function deleteAppointmentMessage({ appointmentId, messageId }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!appointmentId || !messageId) throw new Error('Missing message details.')

  const { data: messageRow, error: messageError } = await supabase
    .from('messages')
    .select('id, sender_id, room_id, file_bucket, file_path')
    .eq('id', messageId)
    .maybeSingle()

  if (messageError) throw new Error(messageError.message)
  if (!messageRow) throw new Error('Message not found.')
  if (String(messageRow.sender_id) !== String(user.id)) {
    throw new Error('You can only delete your own messages.')
  }

  const { data: roomRow, error: roomError } = await supabase
    .from('consultation_rooms')
    .select('appointment_id')
    .eq('id', messageRow.room_id)
    .maybeSingle()

  if (roomError) throw new Error(roomError.message)
  if (!roomRow || String(roomRow.appointment_id) !== String(appointmentId)) {
    throw new Error('Message does not belong to this consultation.')
  }

  if (messageRow.file_bucket && messageRow.file_path) {
    const { error: removeStorageError } = await supabase.storage
      .from(messageRow.file_bucket)
      .remove([messageRow.file_path])

    if (removeStorageError) {
      console.warn('[chat] failed to remove attachment from storage', removeStorageError)
    }
  }

  const { error: deleteError } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', user.id)

  if (deleteError) throw new Error(deleteError.message)
  return true
}

export async function endConsultationSession(appointmentId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!appointmentId) throw new Error('Appointment is required.')

  const nowIso = new Date().toISOString()

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, attorney_id, status')
    .eq('id', appointmentId)
    .maybeSingle()

  if (appointmentError) throw new Error(appointmentError.message)
  if (!appointment) throw new Error('Appointment not found.')
  if (String(appointment.attorney_id) !== String(user.id)) {
    throw new Error('Only the assigned attorney can end this consultation.')
  }

  const { data: existingRoom, error: roomSelectError } = await supabase
    .from('consultation_rooms')
    .select('id')
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (roomSelectError) throw new Error(roomSelectError.message)

  if (existingRoom?.id) {
    const { error: closeError } = await supabase
      .from('consultation_rooms')
      .update({ is_closed: true, video_meeting_id: null })
      .eq('id', existingRoom.id)

    if (closeError) throw new Error(closeError.message)
  } else {
    const { error: createClosedRoomError } = await supabase
      .from('consultation_rooms')
      .insert({ appointment_id: appointmentId, is_closed: true })

    if (createClosedRoomError) throw new Error(createClosedRoomError.message)
  }

  const { error: appointmentUpdateError } = await supabase
    .from('appointments')
    .update({ status: 'completed', updated_at: nowIso })
    .eq('id', appointmentId)

  if (appointmentUpdateError) throw new Error(appointmentUpdateError.message)
  invalidateAttorneyAppointmentsCache(appointment.attorney_id)
  return true
}

export async function notifyClientConsultationTimeWarning(appointmentId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!appointmentId) throw new Error('Appointment is required.')

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, attorney_id, client_id, title')
    .eq('id', appointmentId)
    .maybeSingle()

  if (appointmentError) throw new Error(appointmentError.message)
  if (!appointment) throw new Error('Appointment not found.')
  if (String(appointment.attorney_id) !== String(user.id)) {
    throw new Error('Only the assigned attorney can send this reminder.')
  }

  const nowIso = new Date().toISOString()
  const consultationLabel = appointment.title || 'your consultation'

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: appointment.client_id,
      title: 'Consultation Reminder',
      body: `Only 10 minutes left in ${consultationLabel}. Please prepare your final questions. Ref #${appointment.id}`,
      type: 'consultation_time_warning',
      is_read: false,
      created_at: nowIso,
    })

  if (notificationError) throw new Error(notificationError.message)
  return true
}

export async function fetchConsultationFeedback(appointmentId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !appointmentId) {
    return { submitted: false, rating: 0, comment: '' }
  }

  const { data: row, error } = await supabase
    .from('consultation_feedback')
    .select('rating, comment')
    .eq('appointment_id', appointmentId)
    .eq('client_id', user.id)
    .maybeSingle()

  if (!error && row) {
    return {
      submitted: true,
      rating: Number(row.rating || 0),
      comment: String(row.comment || ''),
    }
  }

  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message)
  }

  const { data: appointment, error: apptError } = await supabase
    .from('appointments')
    .select('notes')
    .eq('id', appointmentId)
    .eq('client_id', user.id)
    .maybeSingle()

  if (apptError) throw new Error(apptError.message)

  const notes = String(appointment?.notes || '')
  const ratingMatch = notes.match(/\[CLIENT_FEEDBACK:(\d)\]/)
  const commentMatch = notes.match(/\[CLIENT_FEEDBACK_COMMENT\]([\s\S]*?)\[\/CLIENT_FEEDBACK_COMMENT\]/)

  if (!ratingMatch) return { submitted: false, rating: 0, comment: '' }

  return {
    submitted: true,
    rating: Number(ratingMatch[1] || 0),
    comment: String(commentMatch?.[1] || '').trim(),
  }
}

export async function submitConsultationFeedback({ appointmentId, rating, comment = '' }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!appointmentId) throw new Error('Appointment is required.')

  const normalizedRating = Number(rating)
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error('Rating must be between 1 and 5.')
  }

  const nowIso = new Date().toISOString()
  const normalizedComment = String(comment || '').trim()

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, client_id, attorney_id, notes')
    .eq('id', appointmentId)
    .maybeSingle()

  if (appointmentError) throw new Error(appointmentError.message)
  if (!appointment) throw new Error('Appointment not found.')
  if (String(appointment.client_id) !== String(user.id)) {
    throw new Error('Only the client can submit feedback for this consultation.')
  }

  const payload = {
    appointment_id: appointmentId,
    client_id: appointment.client_id,
    attorney_id: appointment.attorney_id,
    rating: normalizedRating,
    comment: normalizedComment || null,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const writeFeedbackToAppointmentNotes = async () => {
    const existingNotes = String(appointment.notes || '')
      .replace(/\[CLIENT_FEEDBACK:\d\]/g, '')
      .replace(/\[CLIENT_FEEDBACK_COMMENT\][\s\S]*?\[\/CLIENT_FEEDBACK_COMMENT\]/g, '')
      .trim()
    const feedbackBlock = `\n[CLIENT_FEEDBACK:${normalizedRating}]\n[CLIENT_FEEDBACK_COMMENT]${normalizedComment}[/CLIENT_FEEDBACK_COMMENT]`
    const mergedNotes = `${existingNotes}${feedbackBlock}`.trim()

    const { error: fallbackUpdateError } = await supabase
      .from('appointments')
      .update({ notes: mergedNotes, updated_at: nowIso })
      .eq('id', appointmentId)
      .eq('client_id', appointment.client_id)

    if (fallbackUpdateError) throw new Error(fallbackUpdateError.message)
  }

  const finalizeAppointmentAsCompleted = async () => {
    const { error: appointmentFinalizeError } = await supabase
      .from('appointments')
      .update({ status: 'completed', updated_at: nowIso })
      .eq('id', appointmentId)
      .eq('client_id', appointment.client_id)

    if (appointmentFinalizeError) {
      console.warn('[feedback] unable to finalize appointment as completed', appointmentFinalizeError)
    }
  }

  const { error: insertFeedbackError } = await supabase.from('consultation_feedback').insert(payload)
  if (!insertFeedbackError) {
    await finalizeAppointmentAsCompleted()
    await notifyAttorneyOfClientFeedback({
      attorneyId: appointment.attorney_id,
      clientId: appointment.client_id,
      appointmentId,
      rating: normalizedRating,
      comment: normalizedComment,
    })
    return true
  }

  const insertFeedbackMsg = String(insertFeedbackError?.message || '').toLowerCase()
  const isDuplicateFeedback =
    insertFeedbackMsg.includes('duplicate') ||
    insertFeedbackMsg.includes('already exists') ||
    insertFeedbackMsg.includes('unique')

  if (isDuplicateFeedback) {
    const { error: updateFeedbackError } = await supabase
      .from('consultation_feedback')
      .update({
        rating: normalizedRating,
        comment: normalizedComment || null,
        updated_at: nowIso,
      })
      .eq('appointment_id', appointmentId)
      .eq('client_id', appointment.client_id)

    if (!updateFeedbackError) {
      await finalizeAppointmentAsCompleted()
      await notifyAttorneyOfClientFeedback({
        attorneyId: appointment.attorney_id,
        clientId: appointment.client_id,
        appointmentId,
        rating: normalizedRating,
        comment: normalizedComment,
      })
      return true
    }
    console.warn('[feedback] consultation_feedback update failed, falling back to notes', updateFeedbackError)
    await writeFeedbackToAppointmentNotes()
    await finalizeAppointmentAsCompleted()
    await notifyAttorneyOfClientFeedback({
      attorneyId: appointment.attorney_id,
      clientId: appointment.client_id,
      appointmentId,
      rating: normalizedRating,
      comment: normalizedComment,
    })
    return true
  }

  if (!isMissingRelationError(insertFeedbackError)) {
    console.warn('[feedback] consultation_feedback insert failed, falling back to notes', insertFeedbackError)
  }

  await writeFeedbackToAppointmentNotes()
  await finalizeAppointmentAsCompleted()
  await notifyAttorneyOfClientFeedback({
    attorneyId: appointment.attorney_id,
    clientId: appointment.client_id,
    appointmentId,
    rating: normalizedRating,
    comment: normalizedComment,
  })
  return true
}

export async function getSignedUrlForAppointmentMessage({ fileBucket, filePath }) {
  if (!fileBucket || !filePath) return null

  const { data, error } = await supabase.storage
    .from(fileBucket)
    .createSignedUrl(filePath, 3600)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function subscribeToAppointmentMessages(appointmentId, onInsert) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const room = await getOrCreateConsultationRoom(appointmentId)

  const channel = supabase
    .channel(`chat-room:${room.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${room.id}`,
      },
      async (payload) => {
        try {
          const row = payload.new
          if (!row?.id) return

          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', row.sender_id)
            .maybeSingle()

          const mapped = mapRoomMessage(
            {
              ...row,
              sender: profileData ? { full_name: profileData.full_name } : null,
            },
            room.id,
            Boolean(room.is_closed),
            user.id,
          )

          if (typeof onInsert === 'function') {
            onInsert(mapped)
          }
        } catch (error) {
          console.error('[chat] realtime insert handler failed', error)
        }
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[chat] realtime channel error', { appointmentId, roomId: room.id })
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToConsultationRoomStatus(appointmentId, onStatusChange) {
  if (!appointmentId) {
    return () => {}
  }

  const channel = supabase
    .channel(`consultation-room-status:${appointmentId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'consultation_rooms',
        filter: `appointment_id=eq.${appointmentId}`,
      },
      (payload) => {
        if (typeof onStatusChange === 'function') {
          onStatusChange({
            isClosed: Boolean(payload?.new?.is_closed),
            videoMeetingId: payload?.new?.video_meeting_id ?? null,
            consultationRoomId: payload?.new?.id ?? null,
          })
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToAppointmentStatus(appointmentId, onStatusChange) {
  if (!appointmentId) {
    return () => {}
  }

  const channel = supabase
    .channel(`appointment-status:${appointmentId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'appointments',
        filter: `id=eq.${appointmentId}`,
      },
      (payload) => {
        if (typeof onStatusChange === 'function') {
          onStatusChange(String(payload?.new?.status || '').toLowerCase())
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

function createDebouncedRealtimeHandler(onChange, delayMs = REALTIME_REFRESH_DEBOUNCE_MS) {
  let debounceId = null
  const pendingTimeouts = new Set()

  const fire = () => {
    if (typeof onChange !== 'function') return
    try {
      onChange()
    } catch (callbackError) {
      console.warn('[realtime] subscription callback error', callbackError)
    }
  }

  const schedule = (waitMs = delayMs) => {
    if (typeof window === 'undefined') {
      fire()
      return
    }
    if (debounceId) {
      window.clearTimeout(debounceId)
    }
    debounceId = window.setTimeout(() => {
      debounceId = null
      fire()
    }, waitMs)
  }

  const scheduleLater = (waitMs) => {
    if (typeof window === 'undefined') return
    const timeoutId = window.setTimeout(() => {
      pendingTimeouts.delete(timeoutId)
      fire()
    }, waitMs)
    pendingTimeouts.add(timeoutId)
  }

  const dispose = () => {
    if (debounceId && typeof window !== 'undefined') {
      window.clearTimeout(debounceId)
      debounceId = null
    }
    pendingTimeouts.forEach((id) => {
      if (typeof window !== 'undefined') {
        window.clearTimeout(id)
      }
    })
    pendingTimeouts.clear()
  }

  return { schedule, scheduleLater, dispose }
}

export function subscribeToAttorneyAppointments(attorneyId, onChange) {
  if (!attorneyId) {
    return () => {}
  }

  const { schedule, scheduleLater, dispose } = createDebouncedRealtimeHandler(() => {
    invalidateAttorneyAppointmentsCache(attorneyId)
    onChange?.()
  })

  const handleAppointmentChange = (payload) => {
    schedule()
    const newStatus = String(payload?.new?.status || '').toLowerCase()
    if (newStatus === 'cancelled') {
      scheduleLater(RECENTLY_CANCELLED_WINDOW_MS + 500)
    }
  }

  const channel = supabase
    .channel(`attorney-appointments:${attorneyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `attorney_id=eq.${attorneyId}`,
      },
      handleAppointmentChange,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `attorney_id=eq.${attorneyId}`,
      },
      () => schedule(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${attorneyId}`,
      },
      () => schedule(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'availability_slots',
        filter: `attorney_id=eq.${attorneyId}`,
      },
      () => schedule(),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[realtime] attorney-appointments channel error — using poll/focus refresh')
      }
    })

  return () => {
    dispose()
    supabase.removeChannel(channel)
  }
}

export function subscribeToClientAppointments(clientId, onChange) {
  if (!clientId) {
    return () => {}
  }

  const { schedule, dispose } = createDebouncedRealtimeHandler(() => {
    onChange?.()
  })

  const channel = supabase
    .channel(`client-appointments:${clientId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `client_id=eq.${clientId}`,
      },
      () => schedule(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: `client_id=eq.${clientId}`,
      },
      () => schedule(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${clientId}`,
      },
      () => schedule(),
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[realtime] client-appointments channel error — using poll/focus refresh')
      }
    })

  return () => {
    dispose()
    supabase.removeChannel(channel)
  }
}

export function subscribeToAvailabilitySlots(onChange) {
  const channel = supabase
    .channel('availability-slots:realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'availability_slots',
      },
      (payload) => {
        if (typeof onChange === 'function') {
          onChange(payload)
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function createNotarialRequest({ clientId, serviceType, preferredDate, notes, file, documentName }) {
  let documentUrl = documentName || null

  if (file instanceof File) {
    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `${clientId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadError } = await supabase.storage
      .from('notarial-documents')
      .upload(filePath, file, { contentType: file.type || `application/${ext}`, upsert: false })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('notarial-documents')
      .getPublicUrl(filePath)

    documentUrl = urlData?.publicUrl || filePath
  }

  const { error } = await supabase.from('notarial_requests').insert({
    client_id: clientId,
    service_type: serviceType,
    preferred_date: preferredDate,
    notes,
    document_url: documentUrl,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (error) throw error

  // Notify all verified attorneys so a new notarial request is visible in
  // every attorney's bell as soon as the client submits it.
  try {
    const [clientName, attorneyIds] = await Promise.all([
      resolveClientDisplayName(clientId),
      fetchVerifiedAttorneyUserIds(),
    ])
    const preferredLabel = preferredDate
      ? new Date(preferredDate).toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'an unspecified date'

    await insertNotificationForAttorneys({
      attorneyIds,
      title: 'New Notarial Request',
      body: `${clientName} submitted a ${serviceType || 'notarial'} request for ${preferredLabel}.`,
      type: 'notarial_update',
    })

    await notifyAdminsWithBodyMarker({
      title: 'New notarial request',
      body: `${clientName} submitted a ${serviceType || 'notarial'} request for ${preferredLabel}.`,
      type: 'admin_general',
      marker: `[adminnewnot:${clientId}:${Date.now()}]`,
    })
  } catch (notifyError) {
    console.warn('[notarial] attorney notify failed', notifyError)
  }
}

/**
 * Client uploads a replacement document on an existing notarial request.
 */
export async function replaceClientNotarialRequestDocument({ requestId, file, documentName }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  if (!requestId) throw new Error('requestId is required.')

  const { data: existing, error: exErr } = await supabase
    .from('notarial_requests')
    .select('id, client_id, attorney_id, service_type')
    .eq('id', requestId)
    .maybeSingle()
  if (exErr) throw exErr
  if (!existing) throw new Error('Request not found.')
  if (String(existing.client_id) !== String(user.id)) {
    throw new Error('You can only update your own requests.')
  }

  let documentUrl = documentName || null
  if (file instanceof File) {
    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadError } = await supabase.storage
      .from('notarial-documents')
      .upload(filePath, file, { contentType: file.type || `application/${ext}`, upsert: false })
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('notarial-documents').getPublicUrl(filePath)
    documentUrl = urlData?.publicUrl || filePath
  }
  if (!documentUrl) throw new Error('No document provided.')

  const { error: upErr } = await supabase
    .from('notarial_requests')
    .update({ document_url: documentUrl, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('client_id', user.id)
  if (upErr) throw upErr

  try {
    const clientName = await resolveClientDisplayName(user.id)
    const svc = existing.service_type || 'notarial request'
    const marker = `[notdoc:${requestId}:${Date.now()}]`
    if (existing.attorney_id) {
      const { error: nErr } = await supabase.from('notifications').insert({
        user_id: existing.attorney_id,
        title: 'Notarial document updated',
        body: `${clientName} uploaded a new or revised document for ${svc}. ${marker}`,
        type: 'notarial_update',
        is_read: false,
        created_at: new Date().toISOString(),
      })
      if (nErr) console.warn('[notarial] attorney doc-update notify failed', nErr)
    }
    await notifyAdminsWithBodyMarker({
      title: 'Notarial document updated',
      body: `${clientName} replaced the document for ${svc} (request ${String(requestId).slice(0, 8)}…).`,
      type: 'admin_general',
      marker,
    })
  } catch (e) {
    console.warn('[notarial] document replace notify failed', e)
  }
}

export async function fetchAttorneyUpcomingAppointments(userId, options = {}) {
  const appointments = await fetchAttorneyAppointments(userId, options)

  return appointments
    .filter((item) => {
      const status = String(item.status || '').toLowerCase()
      if (status === 'pending' || status === 'confirmed' || status === 'rescheduled') {
        return true
      }
      return isRecentlyCancelledAppointment(item)
    })
    .sort((a, b) => {
      const aTime = a.parsed_scheduled_at?.getTime() || 0
      const bTime = b.parsed_scheduled_at?.getTime() || 0
      return aTime - bTime
    })
    .map((item) => {
      const dt = item.parsed_scheduled_at
      const valid = dt && !Number.isNaN(dt.getTime())
      const dateLabel = valid
        ? dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
        : 'TBD'
      const timeLabel = valid
        ? dt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
        : 'TBD'

      return {
        id: item.id,
        name: item.client_name || 'Client',
        initials: (item.client_name || 'CL')
          .split(' ')
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        area: (item.title || 'Consultation').toUpperCase(),
        date: dateLabel,
        time: timeLabel,
        scheduledAt: item.scheduled_value,
        slotDate: item.slot_date || null,
        slotTime: item.slot_time || null,
        status: item.status,
        color: '#6366f1',
        concern: item.notes || '',
        attachmentUrl: item.attachment_url || '',
        attachmentName: item.attachment_name || '',
      }
    })
}

export async function fetchAttorneyConsultationLogs(userId, options = {}) {
  const appointments = await fetchAttorneyAppointments(userId, options)

  return appointments
    .filter((item) => String(item.status || '').toLowerCase() === 'completed')
    .sort((a, b) => {
      const aTime = a.parsed_scheduled_at?.getTime() || new Date(a.updated_at || 0).getTime() || 0
      const bTime = b.parsed_scheduled_at?.getTime() || new Date(b.updated_at || 0).getTime() || 0
      return bTime - aTime
    })
    .map((item) => ({
      id: item.id,
      clientName: item.client_name || 'Client',
      title: item.title || 'Consultation',
      scheduledAt: item.scheduled_value,
      dateLabel: item.date_label || 'TBD',
      timeLabel: item.time_label || 'TBD',
      status: String(item.status || '').toLowerCase(),
    }))
}

export async function fetchConsultationTranscriptForAppointment(appointmentId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!appointmentId) throw new Error('Appointment is required.')

  // Pull the attorney_consultation_summary column too so the client-side
  // "View summary" can actually show the attorney's note. Older deployments
  // without the column fall back gracefully.
  let appointment = null
  let appointmentError = null
  const richAppointmentRes = await supabase
    .from('appointments')
    .select('id, attorney_id, client_id, attorney_consultation_summary')
    .eq('id', appointmentId)
    .maybeSingle()

  if (richAppointmentRes.error && isMissingColumnError(richAppointmentRes.error, 'attorney_consultation_summary')) {
    const minAppointmentRes = await supabase
      .from('appointments')
      .select('id, attorney_id, client_id')
      .eq('id', appointmentId)
      .maybeSingle()
    appointment = minAppointmentRes.data || null
    appointmentError = minAppointmentRes.error || null
  } else {
    appointment = richAppointmentRes.data || null
    appointmentError = richAppointmentRes.error || null
  }

  if (appointmentError) throw new Error(appointmentError.message)
  if (!appointment) throw new Error('Appointment not found.')

  const canView =
    String(user.id) === String(appointment.attorney_id) ||
    String(user.id) === String(appointment.client_id)

  if (!canView) {
    throw new Error('You do not have access to this transcript.')
  }

  const { data, error } = await supabase
    .from('consultation_rooms')
    .select(
      `
      id,
      is_closed,
      messages (
        id,
        sender_id,
        message,
        message_type,
        file_bucket,
        file_path,
        file_name,
        mime_type,
        file_size_bytes,
        created_at,
        sender:sender_id(full_name)
      )
    `,
    )
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.id) {
    return {
      messages: [],
      isClosed: true,
      roomId: null,
      attorneyConsultationSummary: String(appointment.attorney_consultation_summary || ''),
    }
  }

  const sorted = (data.messages || [])
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))

  return {
    messages: sorted.map((row) => mapRoomMessage(row, data.id, Boolean(data.is_closed), user.id)),
    isClosed: Boolean(data.is_closed),
    roomId: data.id,
    attorneyConsultationSummary: String(appointment.attorney_consultation_summary || ''),
  }
}

export async function rescheduleAttorneyAppointment({ appointmentId, scheduledAt, note }) {
  if (!appointmentId) throw new Error('Appointment is required.')
  if (!scheduledAt) throw new Error('Scheduled date/time is required.')

  const { data: existingAppointment, error: existingError } = await supabase
    .from('appointments')
    .select('id, title, notes, scheduled_at, attorney_id, client_id')
    .eq('id', appointmentId)
    .maybeSingle()

  if (existingError) throw existingError
  if (!existingAppointment) throw new Error('Appointment not found.')

  let mergedNote = note || null
  if (note) {
    mergedNote = existingAppointment?.notes
      ? `${existingAppointment.notes}\n\nReschedule reason: ${note}`
      : `Reschedule reason: ${note}`
  }

  const toSlotParts = (value) => {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return {
      date: parsed.toISOString().slice(0, 10),
      time: formatSlotTime(parsed),
    }
  }

  const previousSlot = toSlotParts(existingAppointment.scheduled_at)
  const nextSlot = toSlotParts(scheduledAt)

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'rescheduled',
      scheduled_at: scheduledAt,
      notes: mergedNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)

  if (error) throw error

  try {
    if (
      existingAppointment.attorney_id &&
      previousSlot &&
      (!nextSlot || previousSlot.date !== nextSlot.date || previousSlot.time !== nextSlot.time)
    ) {
      const { error: releaseError } = await supabase
        .from('availability_slots')
        .update({ is_booked: false, updated_at: new Date().toISOString() })
        .eq('attorney_id', existingAppointment.attorney_id)
        .eq('date', previousSlot.date)
        .eq('time', previousSlot.time)

      if (releaseError) {
        console.warn('[reschedule] failed to release previous availability slot', releaseError)
      }
    }

    if (existingAppointment.attorney_id && nextSlot) {
      const { error: reserveError } = await supabase
        .from('availability_slots')
        .update({ is_booked: true, updated_at: new Date().toISOString() })
        .eq('attorney_id', existingAppointment.attorney_id)
        .eq('date', nextSlot.date)
        .eq('time', nextSlot.time)
        .eq('is_booked', false)

      if (reserveError) {
        console.warn('[reschedule] failed to reserve selected availability slot', reserveError)
      }
    }
  } catch (slotSyncError) {
    console.warn('[reschedule] availability sync failed', slotSyncError)
  }

  try {
    if (existingAppointment.client_id) {
      const scheduleLabel = nextSlot
        ? new Date(scheduledAt).toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'the updated schedule'

      const detail = note
        ? ` Your attorney added a note: ${note}`
        : ''

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: existingAppointment.client_id,
          title: 'Appointment Rescheduled',
          body: `Your ${existingAppointment.title || 'consultation'} has been moved to ${scheduleLabel}.${detail}`,
          type: 'reschedule',
          is_read: false,
          created_at: new Date().toISOString(),
        })

      if (notificationError) {
        console.warn('[reschedule] failed to notify client', notificationError)
      }
    }
  } catch (notificationFailure) {
    console.warn('[reschedule] notification step failed', notificationFailure)
  }

  invalidateAttorneyAppointmentsCache(existingAppointment.attorney_id || undefined)
  if (existingAppointment.attorney_id && previousSlot?.date) {
    invalidateAvailabilityCache(existingAppointment.attorney_id, previousSlot.date)
  }
  if (existingAppointment.attorney_id && nextSlot?.date) {
    invalidateAvailabilityCache(existingAppointment.attorney_id, nextSlot.date)
  }
}

// ============================================================================
// BOOKING FLOW - Step 1: Get Available Slots for a Specific Date (with caching)
// ============================================================================

const availabilitySlotsCache = new Map(); // Format: "attorneyId:date" -> { data: [...], timestamp: Date }
const AVAILABILITY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getAvailability(attorneyId, date, options = {}) {
  if (!attorneyId) {
    throw new Error('Attorney ID is required');
  }

  const force = Boolean(options?.force);

  const cacheKey = `${attorneyId}:${date || 'all'}`;
  const cached = availabilitySlotsCache.get(cacheKey);

  // Return cached data if still fresh
  if (!force && cached && Date.now() - cached.timestamp < AVAILABILITY_CACHE_TTL_MS) {
    return cached.data;
  }

  let query = supabase
    .from('availability_slots')
    .select('date, time')
    .eq('attorney_id', attorneyId)
    .eq('is_booked', false)
    .order('time', { ascending: true })

  if (date) {
    query = query.eq('date', date)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  
  const result = data || []
  
  // Cache the result
  availabilitySlotsCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
  })

  return result
}

// ============================================================================
// BOOKING FLOW - Helper: Clear Availability Cache (call after booking)
// ============================================================================

export function invalidateAvailabilityCache(attorneyId, date) {
  if (attorneyId && date) {
    availabilitySlotsCache.delete(`${attorneyId}:${date}`);
  } else if (attorneyId) {
    // Clear all dates for this attorney
    for (const key of availabilitySlotsCache.keys()) {
      if (key.startsWith(`${attorneyId}:`)) {
        availabilitySlotsCache.delete(key);
      }
    }
  } else {
    // Clear entire cache
    availabilitySlotsCache.clear();
  }
}

// ============================================================================
// BOOKING FLOW - Helper: Normalize Slot Time Label (for mark_slot_booked RPC)
// ============================================================================

export const normalizeSlotTimeLabel = (timeStr) => {
  const trimmed = String(timeStr || '').trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return trimmed

  let hour = Number(match[1])
  const minute = String(match[2])
  const meridiem = match[3].toUpperCase()

  if (meridiem === 'PM' && hour < 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0

  return `${toTwoDigits(hour)}:${minute}`
}

// ============================================================================
// BOOKING FLOW - Helper: Check if Slot is in the Future
// ============================================================================

export const isConsultationSlotInTheFuture = (selectedDate, timeStr, nowDate = new Date()) => {
  const slotDateTime = parseSlotDateTime(
    selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : String(selectedDate),
    timeStr,
  )
  if (!slotDateTime) return false
  return slotDateTime > nowDate
}

export async function fetchAttorneyNotarialRequests(userId) {
  const { data, error } = await supabase
    .from('notarial_requests')
    .select('id, service_type, status, document_url, preferred_date, created_at, notes, client:client_id(full_name)')
    .eq('attorney_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((item) => {
    const dt = new Date(item.created_at)
    const valid = !Number.isNaN(dt.getTime())
    return {
      id: item.id,
      docType: item.service_type || 'Notarial Request',
      status:
        (item.status || '').toLowerCase() === 'approved'
          ? 'Approved'
          : (item.status || '').toLowerCase() === 'rejected' || (item.status || '').toLowerCase() === 'cancelled'
            ? 'Rejected'
            : 'Pending',
      submittedBy: item.client?.full_name || 'Client',
      fileName: item.document_url || 'N/A',
      date: valid ? dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD',
      time: valid ? dt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : 'TBD',
      detailNote: item.notes || '',
      preferredDate: item.preferred_date || '',
    }
  })
}

export async function updateAttorneyNotarialRequestStatus({ requestId, status, note }) {
  const payload = { status, updated_at: new Date().toISOString() }
  if (note) payload.notes = note
  const { error } = await supabase.from('notarial_requests').update(payload).eq('id', requestId)
  if (error) throw error
}

export async function fetchAttorneyAnnouncementsData(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, created_at, data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  return (data || []).map((item) => {
    const dt = new Date(item.created_at)
    const valid = !Number.isNaN(dt.getTime())
    const type = item.type || 'general'
    return {
      id: item.id,
      title: item.title || 'Announcement',
      body: item.body || '',
      imageUrl: parseNotificationImageUrl(item.data),
      date: valid ? dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
      time: valid ? dt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : 'Now',
      author: 'BatasMo Admin',
      pinned: type.includes('important') || type.includes('admin'),
      tag: type.includes('maintenance') ? 'Maintenance' : type.includes('important') ? 'Important' : 'General',
    }
  })
}

// ─── VideoSDK helpers ────────────────────────────────────────────────────────

const VIDEOSDK_BACKEND_URL = resolvePaymentApiBaseUrl()

let cachedVideoSdkToken = null

export async function getVideoSdkToken() {
  if (cachedVideoSdkToken) return cachedVideoSdkToken
  const res = await fetch(`${VIDEOSDK_BACKEND_URL}/videosdk-token`)
  if (!res.ok) throw new Error('Failed to fetch VideoSDK token from server.')
  const { token } = await res.json()
  cachedVideoSdkToken = token
  // Clear cache after 110 minutes so it refreshes before 120m expiry
  setTimeout(() => { cachedVideoSdkToken = null }, 110 * 60 * 1000)
  return token
}

/**
 * Returns the shared VideoSDK meeting for this appointment. Server creates at most
 * one room per appointment (deterministic customRoomId + in-process lock) so client
 * and attorney always receive the same meetingId.
 */
export async function getOrCreateVideoMeeting(appointmentId) {
  if (!appointmentId) throw new Error('appointmentId is required')

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch(`${VIDEOSDK_BACKEND_URL}/videosdk-meeting-for-appointment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ appointmentId }),
  })

  const body = await res.text()
  let payload = null
  try {
    payload = body ? JSON.parse(body) : null
  } catch {
    payload = null
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Video meeting setup failed (${res.status})`)
  }

  const { meetingId, roomId, token } = payload || {}
  if (!meetingId || !roomId || !token) {
    throw new Error('Video meeting response was incomplete.')
  }

  return { meetingId, roomId, token }
}

/**
 * Clears the video_meeting_id from the consultation_rooms row after the call ends.
 */
export async function clearVideoMeetingId(consultationRoomId) {
  if (!consultationRoomId) return
  const { error } = await supabase
    .from('consultation_rooms')
    .update({ video_meeting_id: null })
    .eq('id', consultationRoomId)
  if (error) console.error('[video] clearVideoMeetingId error', error)
}

// Admin-controlled feature flags backed by public.app_config (Supabase).
// We keep an in-memory cache so reads are instant after the first warmup,
// and a single realtime subscription keeps the cache in sync when an admin
// toggles a value in the Settings page.

const APP_CONFIG_KNOWN_KEYS = ['prevent_double_booking', 'enforce_schedule_window']
const appConfigCache = new Map()
let appConfigLoadPromise = null
let appConfigChannel = null

// Coerces typical Postgres jsonb representations (true/false, "true"/"false",
// 1/0) into a strict boolean. Used by the admin toggles.
const coerceFlag = (value, fallback = true) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return fallback
}

// Synchronous, cache-only read of an admin feature flag. Used in render-loop
// helpers that cannot await the network. ensureAppConfigLoaded() should have
// been awaited by App.js on bootstrap; until then we fall back to the default.
export const isAppConfigFlagOn = (key, fallback = true) => {
  if (!appConfigCache.has(key)) return fallback
  return coerceFlag(appConfigCache.get(key), fallback)
}

const fetchAppConfigValue = async (key) => {
  const { data, error } = await supabase.rpc('get_app_config', { p_key: key })
  if (!error) return data ?? null

  const isMissingFunction =
    error?.code === '42883' ||
    String(error?.message || '').toLowerCase().includes('does not exist')
  if (!isMissingFunction) throw error

  const { data: row, error: tableError } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (tableError) throw tableError
  return row?.value ?? null
}

// Pre-fetches the known feature flags into the cache. Safe to call many times;
// returns the same in-flight promise until it settles.
export function ensureAppConfigLoaded() {
  if (appConfigLoadPromise) return appConfigLoadPromise

  appConfigLoadPromise = (async () => {
    await Promise.all(
      APP_CONFIG_KNOWN_KEYS.map(async (key) => {
        try {
          const value = await fetchAppConfigValue(key)
          appConfigCache.set(key, value)
        } catch (err) {
          console.warn(`[app_config] failed to warm "${key}":`, err?.message || err)
        }
      }),
    )
  })()

  appConfigLoadPromise.finally(() => {
    // Allow the next caller to re-warm if needed (e.g. after sign-out).
    appConfigLoadPromise = null
  })

  return appConfigLoadPromise
}

// Subscribes once to changes on public.app_config so the cache stays current
// without requiring callers to refetch. Idempotent.
export function subscribeToAppConfigChanges() {
  if (appConfigChannel) return appConfigChannel

  try {
    appConfigChannel = supabase
      .channel('app_config_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config' },
        (payload) => {
          const row = payload?.new || payload?.old
          if (!row?.key) return
          if (payload?.eventType === 'DELETE') {
            appConfigCache.delete(row.key)
          } else {
            appConfigCache.set(row.key, row.value ?? null)
          }
        },
      )
      .subscribe()
  } catch (err) {
    console.warn('[app_config] realtime subscribe failed:', err?.message || err)
    appConfigChannel = null
  }

  return appConfigChannel
}

// Reads a single key from public.app_config. Uses the in-memory cache when
// available, otherwise falls back to the get_app_config RPC, then to a direct
// table read for older databases, and finally to fallbackValue.
export async function getAppConfig(key, fallbackValue = null) {
  if (!key) return fallbackValue

  if (appConfigCache.has(key)) {
    const cached = appConfigCache.get(key)
    return cached === null || cached === undefined ? fallbackValue : cached
  }

  try {
    const value = await fetchAppConfigValue(key)
    appConfigCache.set(key, value)
    return value === null || value === undefined ? fallbackValue : value
  } catch (err) {
    console.warn(`[app_config] getAppConfig("${key}") failed:`, err?.message || err)
    return fallbackValue
  }
}

// Writes a single key in public.app_config via the set_app_config RPC.
// Only Admin profiles are allowed by RLS; non-admin callers will get an error.
export async function setAppConfig(key, value) {
  if (!key) throw new Error('setAppConfig requires a key')

  const { data, error } = await supabase.rpc('set_app_config', {
    p_key: key,
    p_value: value,
  })
  if (error) throw error

  appConfigCache.set(key, data ?? value)
  return data
}

// Saves an attorney-written consultation summary onto the appointment row via
// the set_attorney_consultation_summary RPC (only the assigned attorney can
// save, and only when the appointment is COMPLETED).
export async function saveAttorneyConsultationSummary({ appointmentId, summary }) {
  if (!appointmentId) throw new Error('appointmentId is required.')

  const { error } = await supabase.rpc('set_attorney_consultation_summary', {
    p_appointment_id: appointmentId,
    p_summary: summary || '',
  })

  if (error) throw error
}

/** Attorney tags a completed consultation with the practice branch (updates appointment title). */
export async function saveAttorneyConsultationBranch({ appointmentId, branch }) {
  if (!appointmentId) throw new Error('appointmentId is required.')
  const trimmed = String(branch || '').trim()
  if (!trimmed) throw new Error('Please select a consultation branch.')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  const { data: appt, error: fetchError } = await supabase
    .from('appointments')
    .select('id, attorney_id')
    .eq('id', appointmentId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!appt) throw new Error('Appointment not found.')
  if (String(appt.attorney_id) !== String(user.id)) {
    throw new Error('You can only update your own consultations.')
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      title: `Consultation - ${trimmed}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .eq('attorney_id', user.id)

  if (error) throw error
}

export async function fetchAdminHomeNotifications(adminUserId) {
  if (!adminUserId) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, is_read, created_at')
    .eq('user_id', adminUserId)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) throw error

  return (data || []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type || 'general',
    text: `${n.title}: ${n.body}`,
    time: formatNotificationTimestamp(n.created_at),
    createdAt: n.created_at,
    unread: !n.is_read,
  }))
}

export async function markAdminNotificationsAsRead(adminUserId) {
  if (!adminUserId) return

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', adminUserId)
    .eq('is_read', false)

  if (error) throw error
}

export function subscribeToAdminNotifications(adminUserId, onChange) {
  if (!adminUserId) return () => {}

  const channel = supabase
    .channel(`admin_notifications_${adminUserId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${adminUserId}`,
      },
      () => {
        try {
          onChange?.()
        } catch (err) {
          console.warn('[admin-notifications] subscriber callback error', err)
        }
      },
    )
    .subscribe()

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      // ignore
    }
  }
}

// Marks every notification belonging to the given attorney as read.
export async function markAttorneyNotificationsAsRead(attorneyId) {
  if (!attorneyId) return

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', attorneyId)
    .eq('is_read', false)

  if (error) throw error
}

// Subscribes to realtime INSERT/UPDATE events on the notifications table for
// the given attorney. Returns an unsubscribe function the caller can invoke
// on cleanup.
export function subscribeToAttorneyNotifications(attorneyId, onChange) {
  if (!attorneyId) return () => {}

  const channel = supabase
    .channel(`attorney_notifications_${attorneyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${attorneyId}`,
      },
      () => {
        try {
          onChange?.()
        } catch (err) {
          console.warn('[notifications] subscriber callback error', err)
        }
      },
    )
    .subscribe()

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      // Channel may already be gone; ignore.
    }
  }
}

// Returns how many full LOCAL calendar days separate today (00:00 local) from
// the supplied date. Negative when the date is in the past, 0 when it falls
// on today. Accepts ISO strings, "YYYY-MM-DD", or Date instances.
export function calendarDaysFromTodayLocal(value) {
  if (!value) return null

  let target
  if (value instanceof Date) {
    target = new Date(value)
  } else {
    const str = String(value).trim()
    const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (ymd) {
      target = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    } else {
      target = new Date(str)
    }
  }

  if (!target || Number.isNaN(target.getTime())) return null

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()

  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((startOfTarget - startOfToday) / msPerDay)
}

// Returns the list of paid consultations whose schedule has lapsed after a
// reschedule, marking their transactions as "forfeited" (handled inside the
// mark_client_forfeited_rescheduled_payments RPC). Each alert can be displayed
// once and acknowledged via localStorage on the client.
export async function fetchClientForfeitedRescheduleAlerts(clientId) {
  if (!clientId) return []

  try {
    const { data, error } = await supabase.rpc('mark_client_forfeited_rescheduled_payments')
    if (error) {
      console.warn('[forfeit-alert] rpc failed:', error.message || error)
      return []
    }

    return (data || []).map((row) => {
      const scheduledIso = row.scheduled_at || row.scheduledAt || null
      const scheduled = normalizeDateTimeForUi(scheduledIso)
      return {
        id: row.appointment_id || row.id,
        title: row.title || 'Consultation',
        attorneyName: row.attorney_name || row.attorneyName || 'your attorney',
        scheduledAt: scheduledIso,
        scheduleLabel: scheduledIso ? `${scheduled.date} at ${scheduled.time}` : 'TBD',
      }
    })
  } catch (err) {
    console.warn('[forfeit-alert] unable to load alerts', err?.message || err)
    return []
  }
}
