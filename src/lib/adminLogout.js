import { signOutUser } from './userApi'

/**
 * Shared logout for every admin sidebar. Prefers the app-level sign out so
 * cached session state is cleared, and still lands on the login page when
 * Supabase has already dropped the session.
 */
export async function performAdminLogout({ onSignOut, onNavigate } = {}) {
  if (typeof onSignOut === 'function') {
    await onSignOut()
    return
  }

  try {
    await signOutUser()
  } catch (error) {
    console.warn('[admin] sign out failed', error)
  } finally {
    if (typeof onNavigate === 'function') {
      onNavigate('login')
    }
  }
}
