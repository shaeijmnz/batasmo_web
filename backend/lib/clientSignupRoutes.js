/**
 * Client self-signup: create unconfirmed auth user + send Supabase signup OTP email.
 * Proxied through Render so the browser avoids direct auth edge cases.
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
}) => {
  const authHeaders = () => ({
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  })

  const resendSignupOtpEmail = async (email) => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type: 'signup', email }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const msg =
        payload?.msg ||
        payload?.message ||
        payload?.error_description ||
        payload?.error ||
        'Failed to send verification email.'
      throw new Error(String(msg))
    }
  }

  const verifySignupOtp = async ({ email, token }) => {
    const normalizedToken = String(token || '').replace(/\D/g, '')
    let lastError = 'Invalid or expired verification code.'
    for (const type of ['signup', 'email']) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email, token: normalizedToken, type }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.ok) {
        return payload
      }
      lastError =
        payload?.msg ||
        payload?.message ||
        payload?.error_description ||
        payload?.error ||
        lastError
    }
    throw new Error(String(lastError))
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
      headers: authHeaders(),
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
      headers: authHeaders(),
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
      throw new Error(
        payload?.msg ||
          payload?.message ||
          payload?.error_description ||
          'Could not finalize account verification.',
      )
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
    const address = String(body?.address || '').trim()
    const parsedAge = Number(body?.age)
    const guardianName = String(body?.guardianName || '').trim()
    const guardianContact = String(body?.guardianContact || '').trim()
    const preferredOtpChannel = body?.preferredOtpChannel === 'sms' ? 'sms' : 'email'
    const normalizedSex = String(body?.sex || '').trim().toLowerCase()
    const sex =
      normalizedSex === 'male' || normalizedSex === 'female' || normalizedSex === 'others'
        ? normalizedSex
        : null

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
    if (!address) {
      throw new Error('Address is required.')
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 1) {
      throw new Error('Please enter a valid age.')
    }
    if (parsedAge < 18) {
      if (!guardianName) {
        throw new Error('Guardian name is required for minors.')
      }
      if (!isPhilippineMobile(guardianContact)) {
        throw new Error('Please enter a valid 11-digit guardian mobile number (09XXXXXXXXX).')
      }
    }

    return {
      email,
      password,
      fullName,
      phone,
      address,
      parsedAge,
      guardianName: parsedAge < 18 ? guardianName : null,
      guardianContact: parsedAge < 18 ? guardianContact : null,
      preferredOtpChannel,
      sex,
    }
  }

  const createUnconfirmedClientUser = async (parsed) => {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        email: parsed.email,
        password: parsed.password,
        email_confirm: false,
        user_metadata: {
          full_name: parsed.fullName,
          role: 'Client',
          signup_otp_completed: false,
        },
      }),
    })

    const authPayload = await authResponse.json().catch(() => null)
    if (!authResponse.ok) {
      const msg = String(
        authPayload?.msg ||
          authPayload?.message ||
          authPayload?.error_description ||
          authPayload?.error ||
          `Failed to create account (${authResponse.status}).`,
      )
      const lower = msg.toLowerCase()
      if (
        lower.includes('already') ||
        lower.includes('registered') ||
        lower.includes('duplicate')
      ) {
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
          await resendSignupOtpEmail(parsed.email)
          return existingId
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

    return userId
  }

  app.post('/auth/signup-start', async (req, res) => {
    try {
      requireSupabaseServiceConfig()
      const parsed = parseSignupBody(req.body || {})
      const userId = await createUnconfirmedClientUser(parsed)
      await resendSignupOtpEmail(parsed.email)
      return res.status(201).json({
        pendingId: userId,
        email: parsed.email,
        preferredOtpChannel: parsed.preferredOtpChannel,
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
      const email = String(req.body?.email || '').trim().toLowerCase()
      if (!isGmailAddress(email)) {
        return res.status(400).json({ error: 'A valid Gmail address is required.' })
      }
      await resendSignupOtpEmail(email)
      return res.status(200).json({ success: true })
    } catch (error) {
      return res.status(400).json({ error: error?.message || 'Failed to resend verification email.' })
    }
  })

  app.post('/auth/signup-complete', async (req, res) => {
    try {
      requireSupabaseServiceConfig()
      const email = String(req.body?.email || '').trim().toLowerCase()
      const otp = String(req.body?.otp || '').replace(/\D/g, '')
      const pendingId = String(req.body?.pendingId || '').trim()

      if (!isGmailAddress(email)) {
        return res.status(400).json({ error: 'A valid Gmail address is required.' })
      }
      if (otp.length !== 6) {
        return res.status(400).json({ error: 'Please enter the 6-digit verification code.' })
      }

      await verifySignupOtp({ email, token: otp })

      const userId = pendingId || (await findProfileIdByEmail(email))
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
