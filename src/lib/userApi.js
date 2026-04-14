import { supabase } from './supabaseClient'

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

const ATTORNEY_APPOINTMENTS_CACHE_TTL_MS = 15000
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

  const mapped = (data || []).map(mapAppointmentRow)
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
  if (role === 'attorney') return 'Attorney'
  return 'Client'
}

export function pageFromRole(roleText) {
  const role = normalizeRole(roleText)
  if (role === 'Admin') return 'admin-home'
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
  const [notificationsRes, appointmentsRes] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Number.isFinite(limit) ? limit : 20),
    supabase
      .from('appointments')
      .select('id, title, scheduled_at, status, updated_at, attorney:attorney_id(full_name)')
      .eq('client_id', userId)
      .eq('status', 'rescheduled')
      .order('updated_at', { ascending: false })
      .limit(Number.isFinite(limit) ? limit : 20),
  ])

  if (notificationsRes.error) throw notificationsRes.error
  if (appointmentsRes.error) throw appointmentsRes.error

  const storedNotifications = (notificationsRes.data || []).map((item) => ({
    id: item.id,
    type: item.type || 'general',
    title: item.title || 'Notification',
    desc: item.body || '',
    time: formatNotificationTimestamp(item.created_at),
    read: Boolean(item.is_read),
    createdAt: item.created_at || null,
  }))

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

export async function fetchAttorneyHomeData(userId) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [appointments, notificationsRes, notarialRes, transactionsRes] = await Promise.all([
    fetchAttorneyAppointments(userId),
    supabase
      .from('notifications')
      .select('id, title, body, is_read, created_at')
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
  }))

  const storedNotifications = (notificationsRes.data || []).map((n) => ({
    id: n.id,
    text: `${n.title}: ${n.body}`,
    time: formatNotificationTimestamp(n.created_at),
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

const normalizeConsultationTypeLabel = (title) => {
  const raw = String(title || '').trim()
  if (!raw) return 'General Consultation'

  return raw
    .replace(/consultation/gi, '')
    .replace(/legal/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[-:]+$/g, '')
    .trim() || 'General Consultation'
}

export async function fetchAttorneyConsultationAnalyticsData(userId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, title, status, scheduled_at')
    .eq('attorney_id', userId)

  if (error) throw error

  const excludedStatuses = new Set(['rejected', 'cancelled'])
  const countsByType = new Map()

  ;(data || []).forEach((row) => {
    const status = String(row?.status || '').toLowerCase()
    if (excludedStatuses.has(status)) return

    const typeLabel = normalizeConsultationTypeLabel(row?.title)
    countsByType.set(typeLabel, Number(countsByType.get(typeLabel) || 0) + 1)
  })

  const rows = Array.from(countsByType.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  const total = rows.reduce((sum, item) => sum + Number(item.count || 0), 0)
  const maxCount = rows.length ? rows[0].count : 0

  return {
    rows,
    total,
    maxCount,
  }
}

export async function fetchAttorneyProfile(userId) {
  const [profileRes, attorneyRes, consultationsRes, notarialRes] = await Promise.all([
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
      .select('id, status')
      .eq('attorney_id', userId),
    supabase
      .from('notarial_requests')
      .select('id')
      .eq('attorney_id', userId),
  ])

  if (profileRes.error) throw profileRes.error
  if (attorneyRes.error) throw attorneyRes.error
  if (consultationsRes.error) throw consultationsRes.error
  if (notarialRes.error) throw notarialRes.error

  return {
    profile: profileRes.data,
    attorney: attorneyRes.data,
    consultationCount: (consultationsRes.data || []).length,
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
  const todayDate = new Date().toISOString().slice(0, 10)
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

      return {
        startIso,
        endIso,
        attorney_id: attorneyId,
        date: parsedStart.toISOString().slice(0, 10),
        time: formatSlotTime(parsedStart),
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
      throw clearByDateError
    }

    const { error: clearByStartError } = await supabase
      .from('availability_slots')
      .delete()
      .eq('attorney_id', attorneyId)
      .eq('is_booked', false)
      .gte('start_time', nowIso)

    if (clearByStartError) throw clearByStartError
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
    throw existingRowsError
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
    invalidateAvailabilityCache(attorneyId)
    return fetchAttorneyAvailabilitySlots(attorneyId)
  }

  if (
    !isMissingColumnError(lastDateError, 'date') &&
    !isMissingColumnError(lastDateError, 'time')
  ) {
    throw lastDateError
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

  if (fallbackClearError) throw fallbackClearError

  const { data, error } = await supabase
    .from('availability_slots')
    .insert(fallbackSlots)
    .select('id, start_time, end_time, is_booked')

  if (error) throw error
  invalidateAvailabilityCache(attorneyId)
  return data || []
}

const normalizeDigitalPaymentMethod = (method) => {
  const value = String(method || '').trim().toLowerCase()
  if (value === 'gcash') return 'GCash'
  if (value === 'maya') return 'Maya'
  throw new Error('Only GCash or Maya payments are supported.')
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

export async function payForAppointment({ appointmentId, clientId, attorneyId, amount, method }) {
  const paymentMethod = normalizeDigitalPaymentMethod(method)
  const now = new Date().toISOString()
  const { error: txError } = await supabase.from('transactions').insert({
    appointment_id: appointmentId,
    client_id: clientId,
    attorney_id: attorneyId,
    amount: Number(amount || 0),
    payment_status: 'paid',
    payment_method: paymentMethod,
    created_at: now,
    updated_at: now,
  })

  if (txError) throw txError

  const { error: appointmentError } = await supabase
    .from('appointments')
    .update({ status: 'confirmed', updated_at: now })
    .eq('id', appointmentId)

  if (appointmentError) throw appointmentError

  try {
    const { data: appointmentMeta } = await supabase
      .from('appointments')
      .select('title, scheduled_at')
      .eq('id', appointmentId)
      .maybeSingle()

    const scheduled = normalizeDateTimeForUi(appointmentMeta?.scheduled_at)
    const amountValue = Number(amount || 0)

    const { error: clientNotificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: clientId,
        title: 'Payment Confirmed',
        body: `Your payment${amountValue > 0 ? ` of PHP ${amountValue.toLocaleString()}` : ''} for ${appointmentMeta?.title || 'your consultation'} has been received${scheduled.date !== 'TBD' ? ` (${scheduled.date} at ${scheduled.time})` : ''}.`,
        type: 'payment',
        is_read: false,
        created_at: now,
      })

    if (clientNotificationError) {
      console.warn('[payment] failed to create client payment notification', clientNotificationError)
    }
  } catch (clientNotificationFailure) {
    console.warn('[payment] client payment notification step failed', clientNotificationFailure)
  }
}

export async function requestAppointmentReschedule({ appointmentId, scheduledAt, note }) {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'rescheduled', scheduled_at: scheduledAt, notes: note, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (error) throw error
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
}

export async function cancelNotarialRequest(requestId) {
  const { error } = await supabase
    .from('notarial_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) throw error
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
      .select('id, title, body, is_read, created_at')
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
      return (
        status === 'confirmed' ||
        status === 'rescheduled' ||
        status === 'started' ||
        status === 'in_progress' ||
        status === 'in-progress' ||
        status === 'active'
      )
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
    }))

  const storedNotifications = (notificationsRes.data || []).map((item) => ({
    id: item.id,
    text: `${item.title}: ${item.body}`,
    time: formatNotificationTimestamp(item.created_at),
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

export async function createAppointmentBooking({
  clientId,
  attorneyId,
  slotId,
  title,
  notes,
  amount,
  paymentMethod,
  paymentCode,
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

  const activeBookingCount = await fetchClientAttorneyActiveBookingCount({
    clientId: resolvedClientId,
    attorneyId: normalizedPayload.attorney_id,
  })

  if (activeBookingCount >= 2) {
    throw new Error('Booking limit reached. You can only keep up to 2 active bookings with the same attorney.')
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
    const { data: insertedAppointment, error: fallbackInsertError } = await supabase
      .from('appointments')
      .insert({
        client_id: resolvedClientId,
        attorney_id: normalizedPayload.attorney_id,
        slot_id: resolvedSlotId,
        title: normalizedPayload.title,
        notes: normalizedPayload.notes,
        scheduled_at: normalizedPayload.scheduled_at,
        duration_minutes: normalizedPayload.duration_minutes,
        amount: normalizedPayload.amount,
        status: 'confirmed',
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .single()

    if (fallbackInsertError) throw fallbackInsertError
    appointmentId = insertedAppointment?.id || null
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
        status: 'confirmed',
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

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: normalizedPayload.attorney_id,
          title: 'New Consultation Booking',
          body: `${rawClientName} booked ${normalizedPayload.title || 'a consultation'} on ${whenLabel}.`,
          type: 'consultation',
          is_read: false,
          created_at: nowIso,
        })

      if (notificationError) {
        console.warn('[booking] failed to create attorney notification', notificationError)
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

  // Only fetch time-related columns when the bypass is off
  const selectFields = devBypass
    ? 'status'
    : 'status, scheduled_at, slot_date, slot_time'

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select(selectFields)
    .eq('id', appointmentId)
    .maybeSingle()

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

  return { messages: mapped, isClosed: Boolean(data.is_closed), roomId: data.id }
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
      .update({ is_closed: true })
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
      return true
    }
    console.warn('[feedback] consultation_feedback update failed, falling back to notes', updateFeedbackError)
    await writeFeedbackToAppointmentNotes()
    await finalizeAppointmentAsCompleted()
    return true
  }

  if (!isMissingRelationError(insertFeedbackError)) {
    console.warn('[feedback] consultation_feedback insert failed, falling back to notes', insertFeedbackError)
  }

  await writeFeedbackToAppointmentNotes()
  await finalizeAppointmentAsCompleted()
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

export function subscribeToAttorneyAppointments(attorneyId, onChange) {
  if (!attorneyId) {
    return () => {}
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

export async function createNotarialRequest({ clientId, serviceType, preferredDate, notes, documentName }) {
  const { error } = await supabase.from('notarial_requests').insert({
    client_id: clientId,
    service_type: serviceType,
    preferred_date: preferredDate,
    notes,
    document_url: documentName,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (error) throw error
}

export async function fetchAttorneyUpcomingAppointments(userId, options = {}) {
  const appointments = await fetchAttorneyAppointments(userId, options)

  return appointments
    .filter((item) => {
      const status = String(item.status || '').toLowerCase()
      return status === 'pending' || status === 'confirmed' || status === 'rescheduled'
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

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, attorney_id, client_id')
    .eq('id', appointmentId)
    .maybeSingle()

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
    return { messages: [], isClosed: true, roomId: null }
  }

  const sorted = (data.messages || [])
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))

  return {
    messages: sorted.map((row) => mapRoomMessage(row, data.id, Boolean(data.is_closed), user.id)),
    isClosed: Boolean(data.is_closed),
    roomId: data.id,
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
    .select('id, title, body, type, created_at')
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
      date: valid ? dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today',
      time: valid ? dt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : 'Now',
      author: 'BatasMo Admin',
      pinned: type.includes('important') || type.includes('admin'),
      tag: type.includes('maintenance') ? 'Maintenance' : type.includes('important') ? 'Important' : 'General',
    }
  })
}

// ─── VideoSDK helpers ────────────────────────────────────────────────────────

const VIDEOSDK_BACKEND_URL = process.env.REACT_APP_CHATBOT_API_URL || 'http://localhost:4000'

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
 * Returns the VideoSDK meeting ID for the consultation room linked to the
 * given appointmentId. If no meeting exists yet, a new VideoSDK room is
 * created via the REST API and the ID is stored on `consultation_rooms`.
 */
export async function getOrCreateVideoMeeting(appointmentId) {
  if (!appointmentId) throw new Error('appointmentId is required')

  const { data: room, error: roomError } = await supabase
    .from('consultation_rooms')
    .select('id, video_meeting_id')
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (roomError) throw roomError
  if (!room) throw new Error('Consultation room not found for this appointment.')

  if (room.video_meeting_id) {
    const videoToken = await getVideoSdkToken()
    return { meetingId: room.video_meeting_id, roomId: room.id, token: videoToken }
  }

  // Create a new VideoSDK room via the backend (server-to-server — avoids CORS/auth issues)
  const createRes = await fetch(`${VIDEOSDK_BACKEND_URL}/videosdk-create-room`, {
    method: 'POST',
  })

  if (!createRes.ok) {
    const body = await createRes.text()
    let message = `VideoSDK room creation failed (${createRes.status})`
    try { message = JSON.parse(body).error || message } catch { /* ignore */ }
    throw new Error(message)
  }

  const { roomId: newMeetingId, token: videoToken } = await createRes.json()

  const { error: updateError } = await supabase
    .from('consultation_rooms')
    .update({ video_meeting_id: newMeetingId })
    .eq('id', room.id)

  if (updateError) throw updateError

  return { meetingId: newMeetingId, roomId: room.id, token: videoToken }
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
