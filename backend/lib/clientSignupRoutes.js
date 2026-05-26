/**
 * Client self-signup via Supabase public Auth API (anon key).
 * Confirmation emails with 6-digit OTP are sent by Supabase Auth.
 */

const isPhilippineMobile = (value) => /^09\d{9}$/.test(String(value || '').trim())

const buildClientSignupRoutes = ({
  app,
  requireSupabaseServiceConfig,
  supabaseRestHeaders,
  supabaseSelectSingle,
  isGmailAddress,
  isStrongAccountPassword,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
}) => {
  const serviceAuthHeaders = () => ({
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  })

  const requireAnonKey = () => {
    if (!SUPABASE_ANON_KEY) {
      throw new Error(
        'SUPABASE_ANON_KEY is not configured on Render. Add the Supabase legacy anon key (eyJ…) as SUPABASE_ANON_KEY and redeploy.',
      )
    }
  }

  const anonAuthHeaders = () => {
    requireAnonKey()
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    }
  }

  const readAuthError = (payload, fallback) =>
    String(
      payload?.msg || payload?.message || payload?.error_description || payload?.error || fallback,
    )

  const sendEmailOtp = async (email) => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: anonAuthHeaders(),
      body: JSON.stringify({ email, create_user: false }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(readAuthError(payload, 'OTP email request failed.'))
    }
  }

  const resendSignupType = async (email, type) => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
      method: 'POST',
      headers: anonAuthHeaders(),
      body: JSON.stringify({ type, email }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(readAuthError(payload, `Resend (${type}) failed.`))
    }
  }

  const sendSignupVerificationEmail = async (email) => {
    const failures = []
    const trySend = async (label, fn) => {
      try {
        await fn()
        console.log(`[signup] Supabase verification email sent via ${label} → ${email}`)
        return true
      } catch (error) {
        failures.push(`${label}: ${error?.message || error}`)
        console.warn(`[signup] ${label} failed for ${email}`, error?.message || error)
        return false
      }
    }

    if (await trySend('otp', () => sendEmailOtp(email))) return
    if (await trySend('resend-signup', () => resendSignupType(email, 'signup'))) return

    throw new Error(
      failures.join(' | ') || 'Could not send verification email. Check Supabase Auth email settings.',
    )
  }

  const verifySignupOtp = async ({ email, token }) => {
    const normalizedToken = String(token || '').replace(/\D/g, '')
    let lastError = 'Invalid or expired verification code.'
    for (const type of ['email', 'signup']) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: anonAuthHeaders(),
        body: JSON.stringify({ email, token: normalizedToken, type }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.ok) {
        return payload
      }
      lastError = readAuthError(payload, lastError)
    }
    throw new Error(lastError)
  }

  const findProfileIdByEmail = async (email) => {
    const row = await supabaseSelectSingle({
      table: 'profiles',
      query: new URLSearchParams({ email: `eq.${email}` }).toString(),
    })
    return row?.id || null
  }

  const getAdminUser = async (userId) => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'GET',
      headers: serviceAuthHeaders(),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return null
    }
    return payload
  }

  const markSignupVerified = async (userId) => {
    const existing = await getAdminUser(userId)
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: serviceAuthHeaders(),
      body: JSON.stringify({
        email_confirm: true,
        user_metadata: {
          ...(existing?.user_metadata || existing?.raw_user_meta_data || {}),
          signup_otp_completed: true,
        },
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(readAuthError(payload, 'Could not finalize account verification.'))
    }
  }

  const upsertClientProfile = async ({
    userId,
    email,
    fullName,
    sex,
    phone,
    age,
    address,
    guardianName,
    guardianContact,
    preferredOtpChannel,
  }) => {
    const nowIso = new Date().toISOString()
    const body = {
      id: userId,
      email,
      full_name: fullName,
      role: 'Client',
      sex: sex || null,
      phone: phone || null,
      age: age ?? null,
      address: address || null,
      guardian_name: guardianName || null,
      guardian_contact: guardianContact || null,
      preferred_otp_channel: preferredOtpChannel || 'email',
      updated_at: nowIso,
    }

    const existing = await supabaseSelectSingle({
      table: 'profiles',
      query: new URLSearchParams({ id: `eq.${userId}` }).toString(),
    })
    if (!existing?.created_at) {
      body.created_at = nowIso
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...supabaseRestHeaders(),
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      console.warn('[signup] profile upsert warning', payload?.message || payload?.error || response.status)
    }
  }

  const parseSignupBody = (body) => {
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const fullName = String(body?.fullName || '').trim()
    const phone = String(body?.phone || '').trim()
    const preferredOtpChannel = body?.preferredOtpChannel === 'sms' ? 'sms' : 'email'

    if (!isGmailAddress(email)) {
      throw new Error('A valid Gmail address ending with @gmail.com is required.')
    }
    if (!isStrongAccountPassword(password)) {
      throw new Error(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.',
      )
    }
    if (!fullName) {
      throw new Error('Full name is required.')
    }
    if (!isPhilippineMobile(phone)) {
      throw new Error('Please enter a valid 11-digit mobile number (09XXXXXXXXX).')
    }

    return {
      email,
      password,
      fullName,
      phone,
      preferredOtpChannel,
      sex: null,
      parsedAge: null,
      address: null,
      guardianName: null,
      guardianContact: null,
    }
  }

  const isDuplicateSignupError = (msg) => {
    const lower = String(msg || '').toLowerCase()
    return (
      lower.includes('already') ||
      lower.includes('registered') ||
      lower.includes('duplicate') ||
      lower.includes('user already')
    )
  }

  const registerClientViaPublicSignup = async (parsed) => {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: anonAuthHeaders(),
      body: JSON.stringify({
        email: parsed.email,
        password: parsed.password,
        data: {
          full_name: parsed.fullName,
          role: 'Client',
          signup_otp_completed: false,
        },
      }),
    })

    const authPayload = await authResponse.json().catch(() => null)

    if (!authResponse.ok) {
      const msg = readAuthError(authPayload, `Failed to create account (${authResponse.status}).`)

      if (isDuplicateSignupError(msg)) {
        const existingId = await findProfileIdByEmail(parsed.email)
        if (existingId) {
          const existingUser = await getAdminUser(existingId)
          if (
            existingUser?.email_confirmed_at &&
            existingUser?.user_metadata?.signup_otp_completed === true
          ) {
            throw new Error('This Gmail is already registered. Please log in instead.')
          }
          await upsertClientProfile({
            userId: existingId,
            email: parsed.email,
            fullName: parsed.fullName,
            sex: parsed.sex,
            phone: parsed.phone,
            age: parsed.parsedAge,
            address: parsed.address,
            guardianName: parsed.guardianName,
            guardianContact: parsed.guardianContact,
            preferredOtpChannel: parsed.preferredOtpChannel,
          })
          await sendSignupVerificationEmail(parsed.email)
          return { userId: existingId, emailSent: true }
        }
        throw new Error('This Gmail is already registered. Please log in instead.')
      }

      throw new Error(msg)
    }

    const userId = authPayload?.id || authPayload?.user?.id
    if (!userId) {
      throw new Error('Account was created but no user id was returned.')
    }

    await upsertClientProfile({
      userId,
      email: parsed.email,
      fullName: parsed.fullName,
      sex: parsed.sex,
      phone: parsed.phone,
      age: parsed.parsedAge,
      address: parsed.address,
      guardianName: parsed.guardianName,
      guardianContact: parsed.guardianContact,
      preferredOtpChannel: parsed.preferredOtpChannel,
    })

    return { userId, emailSent: Boolean(authPayload) }
  }

  app.post('/auth/signup-start', async (req, res) => {
    try {
      requireSupabaseServiceConfig()
      requireAnonKey()
      const parsed = parseSignupBody(req.body || {})
      const { userId, emailSent } = await registerClientViaPublicSignup(parsed)

      if (!emailSent) {
        await sendSignupVerificationEmail(parsed.email)
      }

      return res.status(201).json({
        pendingId: userId,
        email: parsed.email,
        preferredOtpChannel: parsed.preferredOtpChannel,
        emailSent: true,
        channel: 'supabase',
      })
    } catch (error) {
      const msg = error?.message || 'Unable to start signup.'
      const lower = msg.toLowerCase()
      const status = lower.includes('already registered') ? 409 : 400
      return res.status(status).json({ error: msg })
    }
  })

  app.post('/auth/signup-resend-otp', async (req, res) => {
    try {
      requireSupabaseServiceConfig()
      requireAnonKey()
      const email = String(req.body?.email || '').trim().toLowerCase()
      if (!isGmailAddress(email)) {
        return res.status(400).json({ error: 'A valid Gmail address is required.' })
      }
      await sendSignupVerificationEmail(email)
      return res.status(200).json({ success: true, channel: 'supabase' })
    } catch (error) {
      return res.status(400).json({ error: error?.message || 'Failed to resend verification email.' })
    }
  })

  app.post('/auth/signup-mark-verified', async (req, res) => {
    try {
      requireSupabaseServiceConfig()
      const email = String(req.body?.email || '').trim().toLowerCase()
      const pendingId = String(req.body?.pendingId || '').trim()

      if (!isGmailAddress(email)) {
        return res.status(400).json({ error: 'A valid Gmail address is required.' })
      }

      const userId = pendingId || (await findProfileIdByEmail(email))
      if (!userId) {
        return res.status(404).json({ error: 'Account not found.' })
      }

      await markSignupVerified(userId)
      return res.status(200).json({ success: true, userId })
    } catch (error) {
      return res.status(400).json({ error: error?.message || 'Could not mark account verified.' })
    }
  })

  app.post('/auth/signup-complete', async (req, res) => {
    try {
      requireSupabaseServiceConfig()
      requireAnonKey()
      const email = String(req.body?.email || '').trim().toLowerCase()
      const otp = String(req.body?.otp || '').replace(/\D/g, '')
      const pendingId = String(req.body?.pendingId || '').trim()

      if (!isGmailAddress(email)) {
        return res.status(400).json({ error: 'A valid Gmail address is required.' })
      }
      if (otp.length !== 6) {
        return res.status(400).json({ error: 'Please enter the 6-digit verification code.' })
      }

      const verifyPayload = await verifySignupOtp({ email, token: otp })
      const userId =
        pendingId ||
        verifyPayload?.user?.id ||
        verifyPayload?.id ||
        (await findProfileIdByEmail(email))

      if (!userId) {
        throw new Error('Account was verified but user id was not found.')
      }

      await markSignupVerified(userId)

      return res.status(200).json({ success: true, userId })
    } catch (error) {
      return res.status(400).json({ error: error?.message || 'Verification failed.' })
    }
  })
}

export default buildClientSignupRoutes
