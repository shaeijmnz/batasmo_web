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

export async function getCurrentSessionProfile() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) throw sessionError
  if (!session?.user) return { session: null, profile: null }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, address, role, age, guardian_name, guardian_contact, guardian_details')
    .eq('id', session.user.id)
    .maybeSingle()

  if (profileError) throw profileError

  return {
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
}

export async function upsertProfile(profile) {
  const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' })
  if (error) throw error
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
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

  const appointments = (appointmentsRes.data || []).map((item) => ({
    id: item.id,
    name: item.attorney?.full_name || 'Attorney',
    area: item.title || 'Consultation',
    date: item.scheduled_at,
    time: item.scheduled_at,
    status: item.status || 'pending',
    payment: paymentByAppointment.get(item.id) === 'paid' ? 'Paid' : 'Unpaid',
  }))

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

export async function fetchAttorneyHomeData(userId) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [appointmentsRes, notificationsRes, notarialRes, transactionsRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, title, scheduled_at, status, client:client_id(full_name)')
      .eq('attorney_id', userId)
      .order('scheduled_at', { ascending: true }),
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
      .select('amount, payment_status, created_at')
      .eq('attorney_id', userId)
      .eq('payment_status', 'paid')
      .gte('created_at', monthStart),
  ])

  if (appointmentsRes.error) throw appointmentsRes.error
  if (notificationsRes.error) throw notificationsRes.error
  if (notarialRes.error) throw notarialRes.error
  if (transactionsRes.error) throw transactionsRes.error

  const appointments = appointmentsRes.data || []
  const pendingCount = appointments.filter((a) => a.status === 'pending' || a.status === 'rescheduled').length
  const myAppointmentCount = appointments.filter((a) => new Date(a.scheduled_at) >= new Date()).length

  const consultations = appointments.map((a) => ({
    id: a.id,
    name: a.client?.full_name || 'Client',
    area: a.title || 'Consultation',
    date: a.scheduled_at,
    time: a.scheduled_at,
    status: a.status || 'pending',
  }))

  const notifications = (notificationsRes.data || []).map((n) => ({
    id: n.id,
    text: `${n.title}: ${n.body}`,
    time: n.created_at ? new Date(n.created_at).toLocaleString() : 'Now',
    unread: !n.is_read,
  }))

  const monthlyEarnings = (transactionsRes.data || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

  return {
    consultations,
    notifications,
    stats: {
      pendingCount,
      myAppointmentCount,
      notarialCount: (notarialRes.data || []).length,
      monthlyEarnings,
    },
  }
}

export async function fetchAttorneyProfile(userId) {
  const [profileRes, attorneyRes, consultationsRes, notarialRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, address, role')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('attorney_profiles')
      .select('firm_name, years_experience, specialties, bio, consultation_fee, prc_id')
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
  await upsertProfile({
    id: userId,
    full_name: values.fullName,
    email: values.email,
    phone: values.phone,
    address: values.location,
    role: 'Attorney',
    updated_at: new Date().toISOString(),
  })

  const { error } = await supabase.from('attorney_profiles').upsert(
    {
      user_id: userId,
      firm_name: values.role,
      bio: values.bio,
      prc_id: values.ibpNumber,
      specialties: values.specializations,
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
  const match = String(timeValue).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null

  let hour = Number(match[1])
  const minute = Number(match[2])
  const meridiem = match[3].toUpperCase()

  if (meridiem === 'PM' && hour < 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0

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

const matchConcernToSpecialties = (specialties, concern) => {
  const normalizedConcern = String(concern || '').trim().toLowerCase()
  if (!normalizedConcern) return true

  const normalized = (Array.isArray(specialties) ? specialties : [])
    .map((item) => String(item || '').toLowerCase())

  return normalized.some((specialty) => specialty.includes(normalizedConcern))
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

  if (error) throw error

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
          ? `${toTwoDigits(((end.getHours() + 11) % 12) + 1)}:${toTwoDigits(end.getMinutes())} ${end.getHours() >= 12 ? 'PM' : 'AM'}`
          : 'TBD',
    }
  })
}

export async function saveAttorneyAvailabilitySlots({ attorneyId, slots }) {
  const nowIso = new Date().toISOString()
  const todayDate = new Date().toISOString().slice(0, 10)

  const normalizedSlots = (Array.isArray(slots) ? slots : [])
    .map((slot) => {
      const startIso = toIso(slot.startTime)
      const endIso = toIso(slot.endTime)
      if (!startIso || !endIso) return null
      if (new Date(endIso) <= new Date(startIso)) return null

      const parsedStart = new Date(startIso)
      return {
        attorney_id: attorneyId,
        date: parsedStart.toISOString().slice(0, 10),
        time: formatSlotTime(parsedStart),
        is_booked: false,
        updated_at: nowIso,
      }
    })
    .filter((slot) => Boolean(slot?.date && slot?.time))

  const { error: clearError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('attorney_id', attorneyId)
    .eq('is_booked', false)
    .gte('date', todayDate)

  if (clearError) throw clearError
  if (normalizedSlots.length === 0) return []

  const { data, error } = await supabase
    .from('availability_slots')
    .insert(normalizedSlots)
    .select('id, date, time, is_booked')

  if (error) throw error
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
  if (value === 'confirmed') return 'APPROVED'
  if (value === 'rescheduled') return 'PENDING'
  if (value === 'completed') return 'COMPLETED'
  if (value === 'rejected' || value === 'cancelled') return 'REJECTED'
  return 'PENDING'
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
  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, payment_method, payment_status, reference_no, created_at, appointment_id, notarial_request_id, attorney:attorney_id(full_name), appointment:appointment_id(title), notarial:notarial_request_id(service_type)')
    .eq('client_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((tx) => {
    const datetime = formatDateTime(tx.created_at)
    const isConsultation = Boolean(tx.appointment_id)
    const rawMethod = String(tx.payment_method || '').toLowerCase()
    const paymentMethod = rawMethod === 'gcash' ? 'GCash' : rawMethod === 'maya' ? 'Maya' : 'GCash'
    return {
      id: tx.id,
      type: isConsultation ? 'consultation' : 'notarial',
      description: isConsultation
        ? `Legal Consultation - ${tx.appointment?.title || 'General'}`
        : `Notarial Service - ${tx.notarial?.service_type || 'General'}`,
      detail: isConsultation
        ? `Consultation with ${tx.attorney?.full_name || 'Attorney'}`
        : `Notarization with ${tx.attorney?.full_name || 'Attorney'}`,
      amount: `PHP ${Number(tx.amount || 0).toFixed(2)}`,
      date: datetime.date,
      time: datetime.time,
      method: paymentMethod,
      status: (tx.payment_status || 'pending').toLowerCase(),
      refNo: tx.reference_no || tx.id,
    }
  })
}

export async function fetchAttorneyConsultationRequests(userId) {
  const [requestsRes, notificationsRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, title, scheduled_at, status, notes, client_id, client:client_id(full_name), amount')
      .eq('attorney_id', userId)
      .in('status', ['pending', 'rescheduled', 'confirmed'])
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('notifications')
      .select('id, title, body, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  if (requestsRes.error) throw requestsRes.error
  if (notificationsRes.error) throw notificationsRes.error

  const requests = (requestsRes.data || []).map((item) => {
    const datetime = formatDateTime(item.scheduled_at)
    const status = normalizeAppointmentStatus(item.status)
    return {
      id: item.id,
      clientId: item.client_id,
      name: item.client?.full_name || 'Client',
      initials: (item.client?.full_name || 'CL')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      area: item.title || 'Consultation',
      date: datetime.date,
      time: datetime.time,
      payment: Number(item.amount || 0) > 0 ? 'Paid' : 'Unpaid',
      status: status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending',
      concern: item.notes || 'No additional notes provided.',
    }
  })

  const notifications = (notificationsRes.data || []).map((item) => ({
    id: item.id,
    text: `${item.title}: ${item.body}`,
    time: item.created_at ? new Date(item.created_at).toLocaleString() : 'Now',
    unread: !item.is_read,
  }))

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
  if (note) payload.notes = note

  const { error } = await supabase.from('appointments').update(payload).eq('id', appointmentId)
  if (error) throw error
}

export async function fetchBookableAttorneys({ concern } = {}) {
  const { data, error } = await supabase
    .from('attorney_profiles')
    .select('user_id, years_experience, specialties, consultation_fee, bio, is_verified, prc_id, profile:user_id(full_name, email)')
    .eq('is_verified', true)
    .order('updated_at', { ascending: false })

  if (error) throw error

  const attorneys = data || []
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
    const { data: slots, error: slotsError } = await supabase
      .from('availability_slots')
      .select('id, attorney_id, date, time, is_booked')
      .in('attorney_id', attorneyIds)
      .eq('is_booked', false)
      .gte('date', todayDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

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
    const experienceYears = Number(item.years_experience || 0)
    const availableSlots = availabilityByAttorney.get(item.user_id) || []
    return {
      id: item.user_id,
      name: cms?.display_name || fullName,
      specialty: normalizeStringArray(cms?.expertise_fields)[0] || primarySpecialty,
      specialties: normalizeStringArray(cms?.expertise_fields || item.specialties),
      practiceAreas: normalizeStringArray(cms?.practice_areas || item.specialties),
      exp: `${experienceYears} years experience`,
      rating: 5,
      price: `PHP ${Number(item.consultation_fee || 0).toFixed(2)}`,
      amount: Number(item.consultation_fee || 0),
      bio: cms?.biography || item.bio || 'No biography available yet.',
      details: cms?.biography || item.bio || 'No additional profile details provided.',
      prcId: item.prc_id || '',
      verified: Boolean(item.is_verified),
      availableSlots,
      img:
        resolveAttorneyImage(cms?.display_name || fullName, cms?.profile_image_url),
    }
  })
    .filter((item) => item.availableSlots.length > 0)
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
  if (!clientId || !normalizedPayload.attorney_id || !scheduledIso) {
    throw new Error('Missing appointment payload details.')
  }

  normalizedPayload.scheduled_at = scheduledIso

  const { error: rpcBookError } = await supabase.rpc('book_appointment', {
    client_uuid: clientId,
    attorney_uuid: normalizedPayload.attorney_id,
    scheduled_time: normalizedPayload.scheduled_at,
    title_text: normalizedPayload.title,
  })

  let appointmentId = null

  if (rpcBookError) {
    const { data: insertedAppointment, error: fallbackInsertError } = await supabase
      .from('appointments')
      .insert({
        client_id: clientId,
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
    await supabase.rpc('mark_slot_booked', {
      p_attorney_id: normalizedPayload.attorney_id,
      p_date: normalizedPayload.slot_date,
      p_time: normalizedPayload.slot_time,
    })
  }

  if (resolvedSlotId) {
    await supabase
      .from('availability_slots')
      .update({ is_booked: true, updated_at: nowIso })
      .eq('id', resolvedSlotId)
      .eq('is_booked', false)
  }

  if (!appointmentId) {
    const { data: latestAppointment, error: latestError } = await supabase
      .from('appointments')
      .select('id')
      .eq('client_id', clientId)
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
      .eq('client_id', clientId)
      .eq('attorney_id', normalizedPayload.attorney_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    appointmentId = fallbackLatest?.id || null
  }

  if (appointmentId) {
    await supabase
      .from('appointments')
      .update({
        notes: normalizedPayload.notes,
        duration_minutes: normalizedPayload.duration_minutes,
        amount: normalizedPayload.amount,
        slot_id: resolvedSlotId,
        updated_at: nowIso,
      })
      .eq('id', appointmentId)
  }

  if (paymentMethod && appointmentId) {
    const normalizedPaymentMethod = normalizeDigitalPaymentMethod(paymentMethod)

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('client_id', clientId)
      .eq('payment_status', 'paid')
      .limit(1)
      .maybeSingle()

    if (!existingTx?.id) {
      const { error: txError } = await supabase.from('transactions').insert({
        appointment_id: appointmentId,
        client_id: clientId,
        attorney_id: normalizedPayload.attorney_id,
        amount: normalizedPayload.amount,
        payment_status: 'paid',
        payment_method: normalizedPaymentMethod,
        provider_reference: paymentCode || null,
        created_at: nowIso,
        updated_at: nowIso,
      })

      if (txError) throw txError
    }
  }

  return { success: true, appointmentId, payload: normalizedPayload }
}

async function getOrCreateConsultationRoom(appointmentId) {
  const { data: room, error: roomError } = await supabase
    .from('consultation_rooms')
    .select('id, is_closed')
    .eq('appointment_id', appointmentId)
    .maybeSingle()

  if (room?.id) return room

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('status')
    .eq('id', appointmentId)
    .maybeSingle()

  if (appointmentError) throw appointmentError
  if (String(appointment?.status || '').toLowerCase() !== 'confirmed') {
    throw new Error(roomError?.message || 'No consultation room available for this appointment.')
  }

  const { data: createdRoom, error: createRoomError } = await supabase
    .from('consultation_rooms')
    .insert({ appointment_id: appointmentId })
    .select('id, is_closed')
    .single()

  if (createRoomError) throw createRoomError
  return createdRoom
}

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

  const mapped = (data.messages || []).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    senderName: Array.isArray(row.sender) ? row.sender[0]?.full_name : row.sender?.full_name,
    text: row.message,
    createdAt: row.created_at,
    time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isMine: row.sender_id === user.id,
  }))

  return { messages: mapped, isClosed: Boolean(data.is_closed), roomId: data.id }
}

export async function sendAppointmentMessage(appointmentId, messageText) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const room = await getOrCreateConsultationRoom(appointmentId)
  if (room.is_closed) throw new Error('This consultation is closed.')

  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: room.id,
      sender_id: user.id,
      message: messageText,
    })
    .select('id, sender_id, message, created_at, sender:sender_id(full_name)')
    .single()

  if (error) throw error

  return {
    id: data.id,
    senderId: data.sender_id,
    senderName: Array.isArray(data.sender) ? data.sender[0]?.full_name : data.sender?.full_name,
    text: data.message,
    createdAt: data.created_at,
    time: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isMine: true,
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

export async function fetchAttorneyUpcomingAppointments(userId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, title, scheduled_at, status, notes, client:client_id(full_name)')
    .eq('attorney_id', userId)
    .in('status', ['confirmed', 'rescheduled', 'pending'])
    .order('scheduled_at', { ascending: true })

  if (error) throw error

  return (data || []).map((item) => {
    const dt = new Date(item.scheduled_at)
    const valid = !Number.isNaN(dt.getTime())
    const dateLabel = valid
      ? dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
      : 'TBD'
    const timeLabel = valid
      ? dt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
      : 'TBD'

    return {
      id: item.id,
      name: item.client?.full_name || 'Client',
      initials: (item.client?.full_name || 'CL')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      area: (item.title || 'Consultation').toUpperCase(),
      date: dateLabel,
      time: timeLabel,
      scheduledAt: item.scheduled_at,
      status: item.status,
      color: '#6366f1',
      concern: item.notes || '',
    }
  })
}

export async function rescheduleAttorneyAppointment({ appointmentId, scheduledAt, note }) {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'rescheduled', scheduled_at: scheduledAt, notes: note, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (error) throw error
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

export async function fetchAttorneyEarningsData(userId) {
  const [transactionsRes, payoutRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, payment_status, created_at, client:client_id(full_name), appointment_id, notarial_request_id')
      .eq('attorney_id', userId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false }),
    supabase
      .from('payout_requests')
      .select('id, amount, status, requested_at')
      .eq('attorney_id', userId)
      .order('requested_at', { ascending: false }),
  ])

  if (transactionsRes.error) throw transactionsRes.error
  if (payoutRes.error) throw payoutRes.error

  const rows = (transactionsRes.data || []).map((tx) => {
    const amount = Number(tx.amount || 0)
    const fee = amount * 0.1
    const net = amount - fee
    const dt = new Date(tx.created_at)
    const valid = !Number.isNaN(dt.getTime())
    return {
      id: tx.id,
      client: tx.client?.full_name || 'Client',
      service: tx.appointment_id ? 'Consultation' : 'Notarial',
      date: valid ? dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD',
      amount: `PHP ${amount.toFixed(2)}`,
      fee: `-PHP ${fee.toFixed(2)}`,
      net: `PHP ${net.toFixed(2)}`,
      rawAmount: amount,
      rawNet: net,
      status: 'Released',
    }
  })

  const totalNet = rows.reduce((sum, row) => sum + row.rawNet, 0)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthNet = rows
    .filter((row) => {
      const parsed = new Date(row.date)
      return !Number.isNaN(parsed.getTime()) && parsed >= monthStart
    })
    .reduce((sum, row) => sum + row.rawNet, 0)

  const pendingPayout = (payoutRes.data || [])
    .filter((row) => (row.status || '').toLowerCase() === 'pending')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0)

  return {
    rows,
    totalNet,
    monthNet,
    pendingPayout,
  }
}
