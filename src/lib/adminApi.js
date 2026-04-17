import { supabase } from './supabaseClient'

const isMissingRelationError = (error) =>
  error?.code === '42P01' || String(error?.message || '').toLowerCase().includes('does not exist')

const QUERY_TIMEOUT_MS = 10000

const withTimeout = async (promise, label) => {
  let timeoutHandle
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out. Please retry.`)), QUERY_TIMEOUT_MS)
    })
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutHandle)
  }
}

const normalizeStringArray = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item || '').trim())
    .filter(Boolean)

export const CMS_SITE_DEFAULTS = {
  hero_title: 'Legal & Notarial Services Now in Your Pocket',
  hero_subtitle:
    'Experience the convenience of managing all your legal matters on the go. Expert advice and certified notarial services are now just a tap away.',
  services_title: 'Our Services',
  services_subtitle: 'Comprehensive legal solutions tailored for your business and personal needs.',
  attorneys_title: 'Meet Our Attorneys',
  attorneys_subtitle: 'Browse verified legal experts and choose the attorney that best matches your concern.',
}

export async function fetchCountByRole(role) {
  const { count, error } = await withTimeout(
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', role),
    `Fetch ${role} count`,
  )

  if (error) throw error
  return count ?? 0
}

export async function fetchAdminStats() {
  const settled = await Promise.allSettled([
    fetchCountByRole('Client'),
    fetchCountByRole('Attorney'),
    withTimeout(
      (async () => {
        const { count, error } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'rescheduled'])
        if (error) throw error
        return count ?? 0
      })(),
      'Fetch pending request count',
    ),
    withTimeout(
      (async () => {
        const { count, error } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
        if (error) throw error
        return count ?? 0
      })(),
      'Fetch completed consultation count',
    ),
  ])

  const getSettledValue = (index) => (settled[index].status === 'fulfilled' ? settled[index].value : 0)

  return {
    clientCount: getSettledValue(0),
    attorneyCount: getSettledValue(1),
    pendingRequestCount: getSettledValue(2),
    completedConsultationCount: getSettledValue(3),
  }
}

export async function fetchClients() {
  const { data, error } = await withTimeout(
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, created_at')
      .eq('role', 'Client')
      .order('created_at', { ascending: false }),
    'Fetch clients',
  )

  if (error) throw error
  return data ?? []
}

export async function fetchAttorneyUsers() {
  const { data, error } = await withTimeout(
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'Attorney')
      .order('created_at', { ascending: false }),
    'Fetch attorney users',
  )

  if (error) throw error
  return data ?? []
}

export async function fetchClientNotificationRecipients(limit = 300) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'Client')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function fetchAttorneyNotificationRecipients(limit = 300) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'Attorney')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function fetchAttorneys() {
  const { data, error } = await withTimeout(
    supabase
      .from('attorney_profiles')
      .select('id, user_id, firm_name, years_experience, specialties, consultation_fee, is_verified, profiles:user_id(full_name, email)')
      .order('created_at', { ascending: false }),
    'Fetch attorneys',
  )

  if (error) throw error
  return data ?? []
}

export async function setAttorneyVerification(userId, isVerified) {
  const { error } = await supabase
    .from('attorney_profiles')
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) throw error
}

export async function fetchCompletedConsultations() {
  const { data, error } = await withTimeout(
    supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes, amount, notes, client:client_id(full_name), attorney:attorney_id(full_name)')
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false }),
    'Fetch completed consultations',
  )

  if (error) throw error
  return data ?? []
}

export async function fetchPendingConsultations(limit = 8) {
  const { data, error } = await withTimeout(
    supabase
      .from('appointments')
      .select('id, status, scheduled_at, client:client_id(full_name), attorney:attorney_id(full_name)')
      .in('status', ['pending', 'rescheduled'])
      .order('scheduled_at', { ascending: true })
      .limit(limit),
    'Fetch pending consultations',
  )

  if (error) throw error
  return data ?? []
}

export async function fetchAppointmentRequests(limit = 100) {
  const { data, error } = await withTimeout(
    supabase
      .from('appointments')
      .select('id, title, notes, scheduled_at, status, client:client_id(full_name), attorney:attorney_id(full_name)')
      .in('status', ['pending', 'rescheduled', 'confirmed'])
      .order('scheduled_at', { ascending: true })
      .limit(limit),
    'Fetch appointment requests',
  )

  if (error) throw error
  return data ?? []
}

export async function updateAppointmentStatus(id, status) {
  const { error } = await supabase
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function clearTestBookings() {
  const { data, error } = await withTimeout(
    supabase.rpc('admin_clear_test_bookings'),
    'Clear test bookings',
  )

  if (error) {
    const message = String(error.message || '')
    if (message.toLowerCase().includes('does not exist')) {
      throw new Error(
        'Missing database function "admin_clear_test_bookings". Run database/20260417_admin_clear_test_bookings_rpc.sql first.',
      )
    }
    throw error
  }

  return data || { ok: true }
}

export async function fetchNotarialRequests(limit = 12) {
  const { data, error } = await withTimeout(
    supabase
      .from('notarial_requests')
      .select('id, client_id, service_type, status, created_at, client:client_id(full_name), attorney:attorney_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    'Fetch notarial requests',
  )

  if (error) throw error
  return data ?? []
}

export async function updateNotarialStatus(id, status) {
  const { error } = await supabase
    .from('notarial_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function fetchTransactions(limit = 12) {
  const { data, error } = await withTimeout(
    supabase
      .from('transactions')
      .select('id, amount, currency, payment_status, created_at, client:client_id(full_name), attorney:attorney_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    'Fetch transactions',
  )

  if (error) throw error
  return data ?? []
}

export async function fetchPayoutRequests(limit = 12) {
  const { data, error } = await withTimeout(
    supabase
      .from('payout_requests')
      .select('id, amount, status, requested_at, processed_at, attorney:attorney_id(full_name)')
      .order('requested_at', { ascending: false })
      .limit(limit),
    'Fetch payout requests',
  )

  if (error) throw error
  return data ?? []
}

export async function fetchNotifications(limit = 6) {
  const { data, error } = await withTimeout(
    supabase
      .from('notifications')
      .select('id, user_id, title, body, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    'Fetch notifications',
  )

  if (error) throw error
  return data ?? []
}

export async function createNotification({ userId, title, body, type = 'admin_announcement' }) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type,
    is_read: false,
  })

  if (error) throw error
}

export async function fetchRecentProfileActivity(limit = 20) {
  const { data, error } = await withTimeout(
    supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit),
    'Fetch profile activity',
  )

  if (error) throw error
  return data ?? []
}

export async function fetchCmsSiteContent() {
  const { data, error } = await withTimeout(
    supabase
      .from('cms_site_content')
      .select('content_key, content_value'),
    'Fetch CMS site content',
  )

  if (error) {
    if (isMissingRelationError(error)) return { ...CMS_SITE_DEFAULTS }
    throw error
  }

  return (data || []).reduce(
    (acc, item) => {
      acc[item.content_key] = item.content_value
      return acc
    },
    { ...CMS_SITE_DEFAULTS },
  )
}

export async function saveCmsSiteContent(values) {
  const payload = Object.entries(values || {}).map(([key, value]) => ({
    content_key: key,
    content_value: String(value || ''),
    updated_at: new Date().toISOString(),
  }))

  if (payload.length === 0) return

  const { error } = await supabase
    .from('cms_site_content')
    .upsert(payload, { onConflict: 'content_key' })

  if (error) throw error
}

export async function fetchCmsAttorneyDirectory() {
  const { data: attorneys, error: attorneyError } = await withTimeout(
    supabase
      .from('attorney_profiles')
      .select('user_id, prc_id, consultation_fee, specialties, bio, is_verified, years_experience, profiles:user_id(full_name, email)')
      .order('updated_at', { ascending: false }),
    'Fetch attorney directory records',
  )

  if (attorneyError) throw attorneyError

  const { data: cmsRows, error: cmsError } = await withTimeout(
    supabase
      .from('cms_attorney_directory')
      .select('user_id, display_name, profile_image_url, expertise_fields, practice_areas, biography, is_published'),
    'Fetch CMS attorney metadata',
  )

  if (cmsError && !isMissingRelationError(cmsError)) throw cmsError

  const cmsMap = new Map((cmsRows || []).map((row) => [row.user_id, row]))

  return (attorneys || []).map((item) => {
    const cms = cmsMap.get(item.user_id)
    return {
      userId: item.user_id,
      name: cms?.display_name || item.profiles?.full_name || 'Attorney',
      email: item.profiles?.email || '',
      prcId: item.prc_id || '',
      consultationFee: Number(item.consultation_fee || 2000),
      yearsExperience: Number(item.years_experience || 0),
      specialties: normalizeStringArray(item.specialties),
      expertiseFields: normalizeStringArray(cms?.expertise_fields || item.specialties),
      practiceAreas: normalizeStringArray(cms?.practice_areas || item.specialties),
      biography: cms?.biography || item.bio || '',
      profileImageUrl: cms?.profile_image_url || '',
      isPublished: typeof cms?.is_published === 'boolean' ? cms.is_published : true,
      isVerified: Boolean(item.is_verified),
    }
  })
}

export async function upsertCmsAttorneyDirectoryEntry({
  userId,
  displayName,
  profileImageUrl,
  expertiseFields,
  practiceAreas,
  biography,
  isPublished,
}) {
  const { error } = await supabase
    .from('cms_attorney_directory')
    .upsert(
      {
        user_id: userId,
        display_name: displayName,
        profile_image_url: profileImageUrl || null,
        expertise_fields: normalizeStringArray(expertiseFields),
        practice_areas: normalizeStringArray(practiceAreas),
        biography: biography || null,
        is_published: isPublished !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) throw error
}
