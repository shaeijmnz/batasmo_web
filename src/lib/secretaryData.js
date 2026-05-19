import { supabase } from './supabaseClient'
import { fetchAdminStats, fetchPaidNotarialRequests, updateNotarialStatus } from './adminApi'
import { fetchAdminSupportThreads } from './userApi'

const formatSchedule = (scheduledAt) => {
  const parsed = scheduledAt ? new Date(scheduledAt) : null
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { date: 'TBD', time: 'TBD', iso: '' }
  }
  return {
    date: parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: parsed.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }),
    iso: parsed.toISOString(),
  }
}

export const mapConsultationRow = (row) => {
  const schedule = formatSchedule(row.scheduled_at)
  const clientName = row.client?.full_name || 'Client'
  const attorneyName = row.attorney?.full_name || 'Unassigned'
  return {
    id: row.id,
    clientName,
    attorneyName,
    area: row.title || 'Consultation',
    date: schedule.date,
    time: schedule.time,
    scheduledAt: row.scheduled_at,
    status: String(row.status || 'pending').toLowerCase(),
  }
}

export async function loadSecretaryOverview() {
  const [stats, consultations, notarialRows, supportThreads] = await Promise.all([
    fetchAdminStats().catch(() => ({
      clientCount: 0,
      attorneyCount: 0,
      pendingRequestCount: 0,
      completedConsultationCount: 0,
    })),
    loadSecretaryConsultations(),
    fetchPaidNotarialRequests().catch(() => []),
    fetchAdminSupportThreads({ limit: 50 }).catch(() => []),
  ])

  const pendingNotarial = (notarialRows || []).filter((row) => {
    const status = String(row.status || '').toLowerCase()
    return status === 'pending' || status === 'approved' || status === 'in_process' || status === 'in-progress'
  })

  const unreadSupport = (supportThreads || []).reduce(
    (sum, thread) => sum + Number(thread.unreadFromClient || 0),
    0,
  )

  return {
    stats,
    consultations,
    pendingNotarialCount: pendingNotarial.length,
    unreadSupport,
  }
}

export async function loadSecretaryConsultations() {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, title, status, scheduled_at, attorney_id, client:client_id(full_name), attorney:attorney_id(full_name)',
    )
    .order('scheduled_at', { ascending: true })
    .limit(300)

  if (error) throw error

  return (data || [])
    .filter((row) => {
      const status = String(row.status || '').toLowerCase()
      return !['cancelled', 'rejected', 'completed'].includes(status)
    })
    .map(mapConsultationRow)
}

export async function loadSecretaryCalendarAppointments() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 14)

  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, title, status, scheduled_at, client:client_id(full_name), attorney:attorney_id(full_name)',
    )
    .gte('scheduled_at', start.toISOString())
    .lte('scheduled_at', end.toISOString())
    .order('scheduled_at', { ascending: true })

  if (error) throw error
  return (data || []).map(mapConsultationRow)
}

export async function loadSecretaryNotarialRequests() {
  const rows = await fetchPaidNotarialRequests()
  return (rows || []).map((row) => ({
    id: row.id,
    clientName: row.client?.full_name || row.full_name || 'Client',
    documentType: row.document_type || row.service_type || 'Notarial request',
    status: String(row.status || 'pending').toLowerCase(),
    submitted: formatSchedule(row.created_at).date,
    notes: row.notes || '',
    raw: row,
  }))
}

export async function loadSecretaryClients() {
  const [profilesRes, appointmentsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, created_at')
      .eq('role', 'Client')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('appointments').select('client_id, status'),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (appointmentsRes.error) throw appointmentsRes.error

  const consultationsByClient = new Map()
  ;(appointmentsRes.data || []).forEach((row) => {
    if (!row.client_id) return
    const status = String(row.status || '').toLowerCase()
    if (status === 'cancelled') return
    consultationsByClient.set(
      row.client_id,
      Number(consultationsByClient.get(row.client_id) || 0) + 1,
    )
  })

  return (profilesRes.data || []).map((row) => ({
    id: row.id,
    name: row.full_name || 'Client',
    email: row.email || '',
    phone: row.phone || 'No phone',
    joined: formatSchedule(row.created_at).date,
    consultations: Number(consultationsByClient.get(row.id) || 0),
    avatar: String(row.full_name || 'CL')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'CL',
  }))
}

export async function updateSecretaryConsultationStatus(appointmentId, status) {
  const { error } = await supabase
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (error) throw error
}

export async function assignConsultationAttorney(appointmentId, attorneyId) {
  const { error } = await supabase
    .from('appointments')
    .update({ attorney_id: attorneyId, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (error) throw error
}

export { updateNotarialStatus, fetchAdminSupportThreads }
