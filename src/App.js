import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import {
  getCurrentSessionProfile,
  normalizeRole,
  pageFromRole,
  resetUserApiRuntimeState,
  signOutUser,
} from './lib/userApi';

/* ── LandingPage ── */
import LandingPage from './LandingPage/LandingPage';

/* ── SignupOtp ── */
import SignUp from './SignupOtp/SignUp';
import OtpVerification from './SignupOtp/OtpVerification';
import VerificationSuccess from './SignupOtp/VerificationSuccess';

/* ── LoginAuth ── */
import Login from './LoginAuth/Login';
import ForgotPassword from './LoginAuth/ForgotPassword';
import ResetPassword from './LoginAuth/ResetPassword';
import ClientShell from './ClientDashboard/ClientShell';

/* ── Dashboard Pages (lazy-loaded to reduce initial bundle size) ── */
const HomePage = lazy(() => import('./ClientDashboard/HomePage'));
const BookAppointment = lazy(() => import('./ClientDashboard/BookAppointment'));
const NotarialRequest = lazy(() => import('./ClientDashboard/NotarialRequest'));
const MyAppointments = lazy(() => import('./ClientDashboard/MyAppointments'));
const ProfilePage = lazy(() => import('./ClientDashboard/ProfilePage'));
const ChatRoom = lazy(() => import('./ClientDashboard/ChatRoom'));
const MyNotarialRequests = lazy(() => import('./ClientDashboard/MyNotarialRequests'));
const Announcements = lazy(() => import('./ClientDashboard/Announcements'));
const TransactionHistory = lazy(() => import('./ClientDashboard/TransactionHistory'));
const ClientLogs = lazy(() => import('./ClientDashboard/ClientLogs'));

const AttorneyHome = lazy(() => import('./AttorneyDashboard/AttorneyHome'));
const ConsultationRequests = lazy(() => import('./AttorneyDashboard/ConsultationRequests'));
const UpcomingAppointments = lazy(() => import('./AttorneyDashboard/UpcomingAppointments'));
const NotarialRequestsAtty = lazy(() => import('./AttorneyDashboard/NotarialRequestsAtty'));
const AttorneyAnalytics = lazy(() => import('./AttorneyDashboard/AttorneyAnalytics'));
const AttorneyMessages = lazy(() => import('./AttorneyDashboard/AttorneyMessages'));
const AttorneyLogs = lazy(() => import('./AttorneyDashboard/AttorneyLogs'));
const AttorneyAnnouncements = lazy(() => import('./AttorneyDashboard/AttorneyAnnouncements'));
const AttorneyProfile = lazy(() => import('./AttorneyDashboard/AttorneyProfile'));
const ManageAvailability = lazy(() => import('./AttorneyDashboard/ManageAvailability'));

const AdminDashboard = lazy(() => import('./AdminDashboard/AdminDashboard'));
const AdminClients = lazy(() => import('./AdminDashboard/AdminClients'));
const AdminAttorneys = lazy(() => import('./AdminDashboard/AdminAttorneys'));
const AdminRequests = lazy(() => import('./AdminDashboard/AdminRequests'));
const AdminConsultations = lazy(() => import('./AdminDashboard/AdminConsultations'));
const AdminConsultationStats = lazy(() => import('./AdminDashboard/AdminConsultationStats'));
const AdminUsers = lazy(() => import('./AdminDashboard/AdminUsers'));
const AdminAddUser = lazy(() => import('./AdminDashboard/AdminAddUser'));
const AdminUserLogs = lazy(() => import('./AdminDashboard/AdminUserLogs'));
const AdminNotarialRequests = lazy(() => import('./AdminDashboard/AdminNotarialRequests'));
const AdminReports = lazy(() => import('./AdminDashboard/AdminReports'));
const AdminProfile = lazy(() => import('./AdminDashboard/AdminProfile'));
const AdminCMS = lazy(() => import('./AdminDashboard/AdminCMS'));

const CLIENT_PAGES = [
  'home-logged',
  'book-appointment',
  'notarial-request',
  'my-appointments',
  'profile',
  'chat-room',
  'my-notarial-requests',
  'announcements',
  'transaction-history',
  'client-logs',
]

const ATTORNEY_PAGES = [
  'attorney-home',
  'consultation-requests',
  'upcoming-appointments',
  'notarial-requests-atty',
  'attorney-analytics',
  'attorney-messages',
  'attorney-logs',
  'attorney-announcements',
  'attorney-profile',
  'manage-availability',
]

const ADMIN_PAGES = [
  'admin-home',
  'admin-users',
  'admin-clients',
  'admin-attorneys',
  'admin-add-user',
  'admin-user-logs',
  'admin-requests',
  'admin-consultations',
  'admin-consultation-stats',
  'admin-notarial',
  'admin-reports',
  'admin-cms',
  'admin-profile',
]

const canAccessPage = (role, targetPage) => {
  if (!targetPage) return true
  if (CLIENT_PAGES.includes(targetPage)) return role === 'Client'
  if (ATTORNEY_PAGES.includes(targetPage)) return role === 'Attorney'
  if (ADMIN_PAGES.includes(targetPage)) return role === 'Admin'
  return true
}

const NOTARY_WARNING_MESSAGE =
  'To proceed with your notarial request, face verification is required. Please open the BatasMo mobile app to continue.'

const CLIENT_NOTARY_BLOCKED_PAGES = new Set([
  'notarial-request',
])

const PUBLIC_PAGES = new Set([
  'home',
  'signup',
  'otp',
  'verified',
  'login',
  'forgot-password',
  'reset-password',
])

const PENDING_OTP_EMAIL_KEY = 'batasmo_pending_otp_email'
const PENDING_OTP_ROLE_KEY = 'batasmo_pending_otp_role'
const RECOVERY_ACTIVE_KEY = 'batasmo_recovery_active'
const RECOVERY_EMAIL_KEY = 'batasmo_recovery_email'
const RECOVERY_VERIFIED_KEY = 'batasmo_recovery_verified'
const FORCE_LOGIN_REDIRECT_KEY = 'batasmo_force_login_redirect'

const resolveInitialPage = () => {
  const forcedLogin = sessionStorage.getItem(FORCE_LOGIN_REDIRECT_KEY) === '1'
  if (forcedLogin) {
    sessionStorage.removeItem(FORCE_LOGIN_REDIRECT_KEY)
    return 'login'
  }

  const pathname = String(window.location?.pathname || '').toLowerCase()
  if (pathname === '/login') return 'login'
  if (pathname === '/signup') return 'signup'
  if (pathname === '/forgot-password') return 'forgot-password'
  if (pathname === '/reset-password') return 'reset-password'

  return 'home'
}

const clearAuthRelatedStorage = () => {
  const removablePrefixes = ['sb-', 'supabase', 'batasmo_']
  const removableExactKeys = [
    PENDING_OTP_EMAIL_KEY,
    PENDING_OTP_ROLE_KEY,
    RECOVERY_ACTIVE_KEY,
    RECOVERY_EMAIL_KEY,
    RECOVERY_VERIFIED_KEY,
  ]

  const clearStore = (store) => {
    if (!store) return
    const keys = []
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index)
      if (key) keys.push(key)
    }

    keys.forEach((key) => {
      const normalized = String(key || '').toLowerCase()
      if (
        removableExactKeys.includes(key) ||
        removablePrefixes.some((prefix) => normalized.startsWith(prefix))
      ) {
        store.removeItem(key)
      }
    })
  }

  clearStore(window.localStorage)
  clearStore(window.sessionStorage)
}

const clearTransientAuthState = ({ includeRecovery = false } = {}) => {
  localStorage.removeItem(PENDING_OTP_EMAIL_KEY)
  localStorage.removeItem(PENDING_OTP_ROLE_KEY)

  if (includeRecovery) {
    localStorage.removeItem(RECOVERY_ACTIVE_KEY)
    localStorage.removeItem(RECOVERY_EMAIL_KEY)
    localStorage.removeItem(RECOVERY_VERIFIED_KEY)
  }
}

function PageLifecycleTrace({ page, profile, children }) {
  const userId = profile?.id || null
  const role = normalizeRole(profile?.role || '')

  useEffect(() => {
    console.log('[lifecycle] page mounted', { page, userId, role })
    return () => {
      console.log('[lifecycle] page unmounted', { page, userId, role })
    }
  }, [page, role, userId])

  return children
}

function App() {
  const [page, setPage] = useState(() => resolveInitialPage());
  const [pageParams, setPageParams] = useState({});
  const [showNotaryModal, setShowNotaryModal] = useState(false);
  const [signupContext, setSignupContext] = useState({ email: '', role: 'Client' });
  const [currentProfile, setCurrentProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authScopeVersion, setAuthScopeVersion] = useState(0);
  const activeAuthUserIdRef = useRef(null);
  const previousRoleRef = useRef('');

  const forceResetToLogin = useCallback((reason) => {
    console.error('[auth] forcing login reset', { reason })
    resetUserApiRuntimeState()
    clearTransientAuthState({ includeRecovery: true })
    clearAuthRelatedStorage()
    previousRoleRef.current = ''
    activeAuthUserIdRef.current = null
    setCurrentProfile(null)
    setSignupContext({ email: '', role: 'Client' })
    setAuthScopeVersion((prev) => prev + 1)
    setPage('login')

    sessionStorage.setItem(FORCE_LOGIN_REDIRECT_KEY, '1')
    window.location.href = '/'
  }, [])

  const resetRuntimeForAuthBoundary = useCallback((reason, details = {}) => {
    resetUserApiRuntimeState()
    setAuthScopeVersion((prev) => prev + 1)
    console.log('[auth] runtime scope reset', { reason, ...details })
  }, [])

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { session, profile } = await getCurrentSessionProfile();
        const sessionUserId = session?.user?.id || null;
        const previousUserId = activeAuthUserIdRef.current;
        if (previousUserId !== sessionUserId) {
          resetRuntimeForAuthBoundary('session bootstrap user switch', {
            previousUserId,
            nextUserId: sessionUserId,
          })
        }
        activeAuthUserIdRef.current = sessionUserId;
        console.log('[auth] bootstrap session resolved', {
          userId: sessionUserId,
          role: normalizeRole(profile?.role || session?.user?.user_metadata?.role || ''),
        })

        if (isMounted) {
          if (!sessionUserId) {
            clearTransientAuthState({ includeRecovery: true });
            setCurrentProfile(null);
          } else {
            clearTransientAuthState();
            setCurrentProfile(profile);
          }
        }
      } catch (error) {
        console.error('[auth] failed to bootstrap session', error)
        if (isMounted) {
          setCurrentProfile(null)
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      try {
        const sessionUserId = session?.user?.id || null;
        const previousUserId = activeAuthUserIdRef.current;
        if (previousUserId !== sessionUserId) {
          resetRuntimeForAuthBoundary('auth listener user switch', {
            event,
            previousUserId,
            nextUserId: sessionUserId,
          })
        }
        activeAuthUserIdRef.current = sessionUserId;
        console.log('[auth] onAuthStateChange', { event, userId: sessionUserId })

        if (event === 'TOKEN_REFRESH_FAILED') {
          forceResetToLogin('token refresh failed')
          return
        }

        if (!session?.user) {
          clearTransientAuthState({ includeRecovery: true });
          setCurrentProfile(null);
          return;
        }

        // Fast path: update profile from session metadata immediately.
        clearTransientAuthState();
        setCurrentProfile((prev) => ({
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name || prev?.full_name || '',
          email: session.user.email || prev?.email || '',
          role: normalizeRole(session.user.user_metadata?.role || prev?.role || 'Client'),
          phone: prev?.phone || '',
          address: prev?.address || '',
          age: prev?.age ?? null,
          guardian_name: prev?.guardian_name || '',
          guardian_contact: prev?.guardian_contact || '',
          guardian_details: prev?.guardian_details || '',
        }));

        // Background hydration: fetch full profile without blocking UI.
        getCurrentSessionProfile()
          .then(({ profile }) => {
            if (activeAuthUserIdRef.current !== sessionUserId) return;
            if (!profile) return;
            setCurrentProfile(profile);
          })
          .catch((profileError) => {
            console.error('[auth] non-blocking profile hydration failed', profileError)
          });
      } catch (listenerError) {
        console.error('[auth] onAuthStateChange listener failed', listenerError)
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe?.();
      console.log('[auth] auth listener unsubscribed')
    };
  }, [forceResetToLogin, resetRuntimeForAuthBoundary]);

  useEffect(() => {
    if (!currentProfile?.id) return undefined

    let disposed = false
    const intervalId = setInterval(async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (disposed) return
        if (error) {
          console.error('[auth] periodic session check failed', error)
          forceResetToLogin('periodic session check failed')
          return
        }

        if (!session?.user) {
          forceResetToLogin('periodic session missing user')
        }
      } catch (error) {
        if (disposed) return
        console.error('[auth] periodic session check crashed', error)
        forceResetToLogin('periodic session check crashed')
      }
    }, 60000)

    return () => {
      disposed = true
      clearInterval(intervalId)
    }
  }, [currentProfile?.id, forceResetToLogin])

  useEffect(() => {
    const onUnhandledRejection = (event) => {
      console.error('[runtime] unhandled promise rejection', event?.reason || event)
    }

    const onUnhandledError = (event) => {
      console.error('[runtime] uncaught error', event?.error || event)
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('error', onUnhandledError)

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onUnhandledError)
    }
  }, [])

  useEffect(() => {
    const profileRole = currentProfile?.id ? normalizeRole(currentProfile?.role || '') : ''
    const previousRole = previousRoleRef.current

    if (currentProfile?.id && previousRole && previousRole !== profileRole) {
      resetRuntimeForAuthBoundary('role changed for active profile', {
        userId: currentProfile.id,
        previousRole,
        nextRole: profileRole,
      })
    }

    previousRoleRef.current = profileRole
  }, [currentProfile?.id, currentProfile?.role, resetRuntimeForAuthBoundary])

  useEffect(() => {
    console.log('[nav] page changed', {
      page,
      userId: currentProfile?.id || null,
      role: normalizeRole(currentProfile?.role || ''),
    })
  }, [page, currentProfile?.id, currentProfile?.role])

  const handleAuthSuccess = useCallback((profile) => {
    clearTransientAuthState({ includeRecovery: true });
    setSignupContext({ email: '', role: 'Client' });
    setCurrentProfile(profile);
    setPage(pageFromRole(profile?.role));
  }, []);

  const handleNavigate = useCallback((nextPage, params = {}) => {
    const role = normalizeRole(currentProfile?.role || '')
    if ((role === 'Client' || !role) && CLIENT_NOTARY_BLOCKED_PAGES.has(nextPage)) {
      setShowNotaryModal(true)
      return
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    setPageParams(params || {})
    setPage(nextPage)
  }, [currentProfile?.role])

  const handleSignOut = useCallback(async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('[auth] sign out failed, forcing local cleanup', error)
    } finally {
      forceResetToLogin('manual sign out')
      console.log('[auth] sign out flow completed')
    }
  }, [forceResetToLogin]);

  const isPublicPage = PUBLIC_PAGES.has(page);

  const profileScopeKey = currentProfile?.id
    ? `${currentProfile.id}:${normalizeRole(currentProfile?.role || '')}`
    : 'anonymous'

  const renderLazy = (node) => (
    <Suspense fallback={null}>
      <PageLifecycleTrace
        key={`${page}:${profileScopeKey}:v${authScopeVersion}`}
        page={page}
        profile={currentProfile}
      >
        {node}
      </PageLifecycleTrace>
    </Suspense>
  )

  const renderClientShell = (node) =>
    renderLazy(
      <ClientShell
        currentPage={page}
        profile={currentProfile}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        showNotaryModal={showNotaryModal}
        notaryWarningMessage={NOTARY_WARNING_MESSAGE}
        onCloseNotaryModal={() => setShowNotaryModal(false)}
      >
        {node}
      </ClientShell>,
    )

  useEffect(() => {
    if (!currentProfile?.role) return
    const role = normalizeRole(currentProfile.role)
    const roleHomePage = pageFromRole(role)
    const isRecoveryFlowPage = page === 'forgot-password' || page === 'reset-password'
    const hasRecoveryFlow = localStorage.getItem(RECOVERY_ACTIVE_KEY) === 'true'

    if (isPublicPage) {
      if (isRecoveryFlowPage && hasRecoveryFlow) {
        return
      }

      if (page !== roleHomePage) {
        setPage(roleHomePage)
      }
      return
    }

    if (!canAccessPage(role, page) && page !== roleHomePage) {
      setPage(roleHomePage)
    }
  }, [currentProfile, page, isPublicPage])

  if (!authLoading && !isPublicPage && !currentProfile) {
    return <Login onNavigate={handleNavigate} onAuthSuccess={handleAuthSuccess} />;
  }

  if (page === 'signup') return <SignUp onNavigate={handleNavigate} onEmailChange={setSignupContext} />;
  if (page === 'otp') return <OtpVerification onNavigate={handleNavigate} email={signupContext.email} role={signupContext.role} />;
  if (page === 'verified') return <VerificationSuccess onNavigate={handleNavigate} />;
  if (page === 'login') return <Login onNavigate={handleNavigate} onAuthSuccess={handleAuthSuccess} />;
  if (page === 'forgot-password') return <ForgotPassword onNavigate={handleNavigate} />;
  if (page === 'reset-password') return <ResetPassword onNavigate={handleNavigate} />;
  if (page === 'home-logged') return renderClientShell(<HomePage onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} />);
  if (page === 'book-appointment') return renderClientShell(<BookAppointment onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'notarial-request') return renderClientShell(<NotarialRequest onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'my-appointments') return renderClientShell(<MyAppointments onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'profile') return renderClientShell(<ProfilePage onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} onProfileUpdated={setCurrentProfile} />);
  if (page === 'chat-room') return renderClientShell(<ChatRoom onNavigate={handleNavigate} profile={currentProfile} initialAppointmentId={pageParams?.appointmentId || ''} />);
  if (page === 'my-notarial-requests') return renderClientShell(<MyNotarialRequests onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'announcements') return renderClientShell(<Announcements onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'transaction-history') return renderClientShell(<TransactionHistory onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'client-logs') return renderClientShell(<ClientLogs onNavigate={handleNavigate} profile={currentProfile} initialAppointmentId={pageParams?.appointmentId || ''} />);
  if (page === 'attorney-home') return renderLazy(<AttorneyHome onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} />);
  if (page === 'consultation-requests') return renderLazy(<ConsultationRequests onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'upcoming-appointments') return renderLazy(<UpcomingAppointments onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'notarial-requests-atty') return renderLazy(<NotarialRequestsAtty onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-analytics') return renderLazy(<AttorneyAnalytics onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-messages') return renderLazy(<AttorneyMessages onNavigate={handleNavigate} profile={currentProfile} initialAppointmentId={pageParams?.appointmentId || ''} />);
  if (page === 'attorney-logs') return renderLazy(<AttorneyLogs onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-announcements') return renderLazy(<AttorneyAnnouncements onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-profile') return renderLazy(<AttorneyProfile onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} onProfileUpdated={setCurrentProfile} />);
  if (page === 'manage-availability') return renderLazy(<ManageAvailability onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'admin-home') return renderLazy(<AdminDashboard onNavigate={handleNavigate} />);
  if (page === 'admin-users') return renderLazy(<AdminUsers onNavigate={handleNavigate} />);
  if (page === 'admin-clients') return renderLazy(<AdminClients onNavigate={handleNavigate} />);
  if (page === 'admin-attorneys') return renderLazy(<AdminAttorneys onNavigate={handleNavigate} />);
  if (page === 'admin-add-user') return renderLazy(<AdminAddUser onNavigate={handleNavigate} />);
  if (page === 'admin-user-logs') return renderLazy(<AdminUserLogs onNavigate={handleNavigate} />);
  if (page === 'admin-requests') return renderLazy(<AdminRequests onNavigate={handleNavigate} />);
  if (page === 'admin-consultations') return renderLazy(<AdminConsultations onNavigate={handleNavigate} />);
  if (page === 'admin-consultation-stats') return renderLazy(<AdminConsultationStats onNavigate={handleNavigate} />);
  if (page === 'admin-notarial') return renderLazy(<AdminNotarialRequests onNavigate={handleNavigate} />);
  if (page === 'admin-reports') return renderLazy(<AdminReports onNavigate={handleNavigate} />);
  if (page === 'admin-cms') return renderLazy(<AdminCMS onNavigate={handleNavigate} />);
  if (page === 'admin-profile') return renderLazy(<AdminProfile onNavigate={handleNavigate} onSignOut={handleSignOut} />);

  return <LandingPage onNavigate={handleNavigate} />;
}

export default App;
