/**
 * Staff portal access: Secretary mirrors most Admin pages with a smaller surface.
 * Adjust SECRETARY_PAGES / SECRETARY_DENIED when secretary UI is finalized.
 */

export const ADMIN_PAGES = [
  'admin-home',
  'admin-clients',
  'admin-attorneys',
  'admin-requests',
  'admin-consultations',
  'admin-reports',
  'admin-settings',
  'admin-messages',
]

/** Secretary routes (parallel naming — wire to secretary UI components). */
export const SECRETARY_PAGES = [
  'secretary-home',
  'secretary-clients',
  'secretary-attorneys',
  'secretary-requests',
  'secretary-consultations',
  'secretary-messages',
]

/** Admin-only capabilities (not exposed in secretary nav / API). */
export const SECRETARY_DENIED_PAGES = ['admin-reports', 'admin-settings']

export const isAdminRole = (role) => String(role || '').toLowerCase() === 'admin'

export const isSecretaryRole = (role) => String(role || '').toLowerCase() === 'secretary'

export const isStaffRole = (role) => isAdminRole(role) || isSecretaryRole(role)

export const canAccessStaffPage = (role, targetPage) => {
  if (!targetPage) return true
  const normalized = String(role || '')
  if (isAdminRole(normalized)) return ADMIN_PAGES.includes(targetPage)
  if (isSecretaryRole(normalized)) {
    if (SECRETARY_DENIED_PAGES.includes(targetPage)) return false
    return (
      SECRETARY_PAGES.includes(targetPage) ||
      ADMIN_PAGES.filter((p) => !SECRETARY_DENIED_PAGES.includes(p)).includes(targetPage)
    )
  }
  return false
}

/** Map secretary sidebar paths to App.js page ids. */
export const secretaryPageFromPath = (path) => {
  const map = {
    '/': 'secretary-home',
    '/clients': 'secretary-clients',
    '/attorneys': 'secretary-attorneys',
    '/requests': 'secretary-requests',
    '/consultations': 'secretary-consultations',
    '/messages': 'secretary-messages',
  }
  return map[path] || 'secretary-home'
}
