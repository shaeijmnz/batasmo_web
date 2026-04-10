import { supabase } from './supabaseClient'

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'admin') return 'Admin'
  if (value === 'attorney') return 'Attorney'
  return 'Client'
}

export async function checkEmailLockout(email) {
  try {
    const { data } = await supabase.rpc('check_login_lockout', { user_email: email })
    return Number(data) || 0
  } catch {
    return 0
  }
}

export async function signUpWithEmail({
  email,
  password,
  fullName,
  role,
  phone,
  age,
  address,
  guardianName,
  guardianContact,
}) {
  const normalizedRole = normalizeRole(role)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: normalizedRole,
      },
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  if (data?.session && data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: normalizedRole,
      phone: phone || null,
      age: age || null,
      address: address || null,
      guardian_name: guardianName || null,
      guardian_contact: guardianContact || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      console.error('Failed to create profile:', profileError)
    }

    if (normalizedRole === 'Attorney') {
      const { error: attorneyProfileError } = await supabase
        .from('attorney_profiles')
        .upsert(
          {
            user_id: data.user.id,
            is_verified: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )

      if (attorneyProfileError) {
        console.error('Failed to initialize attorney profile:', attorneyProfileError)
      }
    }

    data.user.role = normalizedRole
    data.user.name = fullName
    data.user.phone = phone
    data.user.address = address
  }

  return { token: data?.session?.access_token, user: data?.user }
}

export async function signInWithEmail({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    const normalized = String(error.message || '').toLowerCase()
    
    // Check lockout only on failure
    const lockoutTime = await checkEmailLockout(normalizedEmail)
    if (lockoutTime > 0) {
      throw new Error(`LOCKOUT:${lockoutTime}`)
    }

    // Log failed login in background (don't wait)
    if (normalized.includes('credential') || normalized.includes('invalid')) {
      supabase.rpc('log_failed_login', { user_email: normalizedEmail }).catch(() => {})
    }
    throw new Error(error.message)
  }

  // Clear failed logins in background (don't wait)
  supabase.rpc('clear_failed_logins', { user_email: normalizedEmail }).catch(() => {})

  if (data?.user) {
    const meta = data.user.user_metadata || {}
    const dbRole = normalizeRole(meta.role || 'Client')
    const dbName = meta.full_name || normalizedEmail

    // Update profile in background (don't wait)
    supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: dbName,
        role: dbRole,
      }, { onConflict: 'id' })
      .catch(() => {})

    data.user.role = dbRole
    data.user.name = dbName
  }

  return {
    user: data.user,
    token: data.session?.access_token,
  }
}

export async function verifySignUpOtp({ email, token }) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })

  if (error) {
    throw new Error(error.message)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.id) {
    const role = normalizeRole(user.user_metadata?.role)
    if (role === 'Attorney') {
      await supabase
        .from('attorney_profiles')
        .upsert(
          {
            user_id: user.id,
            is_verified: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
    }
  }

  return { success: true }
}

export async function resendSignUpOtp({ email }) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function startPasswordRecovery({ email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function resendPasswordRecoveryOtp({ email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function verifyRecoveryOtp({ email, token }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedToken = String(token || '').trim()
  const { error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email',
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

export async function updatePasswordForCurrentUser({ newPassword }) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}