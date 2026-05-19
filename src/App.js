import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import {
  ensureAppConfigLoaded,
  getCurrentSessionProfile,
  normalizeRole,
  pageFromRole,
  resolveSessionRole,
  resetUserApiRuntimeState,
  signOutUser,
  subscribeToAppConfigChanges,
} from './lib/userApi';
import { isSignupVerificationComplete, signOutIfSignupIncomplete } from './lib/signupVerification';

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
import ConsultationWaitingHost from './components/ConsultationWaitingHost';
import {
  ADMIN_PAGES,
  SECRETARY_PAGES,
  SECRETARY_DENIED_PAGES,
  isAdminRole,
  isSecretaryRole,
} from './lib/staffAccess';

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
const ClientNotaryTracking = lazy(() => import('./ClientDashboard/ClientNotaryTracking'));
const SupportMessages = lazy(() => import('./ClientDashboard/SupportMessages'));

const AttorneyHome = lazy(() => import('./AttorneyDashboard/AttorneyHome'));
const ConsultationRequests = lazy(() => import('./AttorneyDashboard/ConsultationRequests'));
const UpcomingAppointments = lazy(() => import('./AttorneyDashboard/UpcomingAppointments'));
const AttorneyAvailability = lazy(() => import('./AttorneyDashboard/AttorneyAvailability'));
const NotarialRequestsAtty = lazy(() => import('./AttorneyDashboard/NotarialRequestsAtty'));
const AttorneyAnalytics = lazy(() => import('./AttorneyDashboard/AttorneyAnalytics'));
const AttorneyMessages = lazy(() => import('./AttorneyDashboard/AttorneyMessages'));
const AttorneyLogs = lazy(() => import('./AttorneyDashboard/AttorneyLogs'));
const AttorneyAnnouncements = lazy(() => import('./AttorneyDashboard/AttorneyAnnouncements'));
const AttorneyProfile = lazy(() => import('./AttorneyDashboard/AttorneyProfile'));

const AdminDashboard = lazy(() => import('./AdminDashboard/AdminDashboard'));
const AdminClients = lazy(() => import('./AdminDashboard/AdminClients'));
const AdminAttorneys = lazy(() => import('./AdminDashboard/AdminAttorneys'));
const AdminRequests = lazy(() => import('./AdminDashboard/AdminRequests'));
const AdminConsultations = lazy(() => import('./AdminDashboard/AdminConsultations'));
const AdminReports = lazy(() => import('./AdminDashboard/AdminReports'));
const AdminSettingsPage = lazy(() => import('./AdminDashboard/AdminSettingsPage'));
const AdminMessages = lazy(() => import('./AdminDashboard/AdminMessages'));

const SecretaryConsole = lazy(() => import('./SecretaryDashboard/SecretaryConsole'));

const SECRETARY_INITIAL_PAGE = {
  'secretary-home': 'Dashboard',
  'secretary-consultations': 'Consultations',
  'secretary-requests': 'Notarial Requests',
  'secretary-clients': 'Registered Clients',
  'secretary-messages': 'Messages',
  'secretary-attorneys': 'Appointment Calendar',
};

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
  'client-notary-tracking',
  'support-messages',
]

const ATTORNEY_PAGES = [
  'attorney-home',
  'consultation-requests',
  'upcoming-appointments',
  'attorney-availability',
  'notarial-requests-atty',
  'attorney-analytics',
  'attorney-messages',
  'attorney-logs',
  'attorney-announcements',
  'attorney-profile',
]

const canAccessPage = (role, targetPage) => {
  if (!targetPage) return true
  if (CLIENT_PAGES.includes(targetPage)) return role === 'Client'
  if (ATTORNEY_PAGES.includes(targetPage)) return role === 'Attorney'
  if (ADMIN_PAGES.includes(targetPage)) {
    if (isAdminRole(role)) return true
    if (isSecretaryRole(role)) return !SECRETARY_DENIED_PAGES.includes(targetPage)
    return false
  }
  if (SECRETARY_PAGES.includes(targetPage)) return isSecretaryRole(role)
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
const CURRENT_PAGE_KEY = 'batasmo_current_page'
/** Bump when nav/auth storage shape changes — clears stale session page on deploy. */
const APP_STORAGE_VERSION = '20260520'
const APP_STORAGE_VERSION_KEY = 'batasmo_storage_version'
const IS_DEV = process.env.NODE_ENV !== 'production'

const syncAppStorageVersion = () => {
  if (typeof window === 'undefined') return
  const stored = sessionStorage.getItem(APP_STORAGE_VERSION_KEY)
  if (stored === APP_STORAGE_VERSION) return
  sessionStorage.removeItem(CURRENT_PAGE_KEY)
  sessionStorage.setItem(APP_STORAGE_VERSION_KEY, APP_STORAGE_VERSION)
}

const readPaymongoReturnFromLocation = () => {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search || '')
  const payment = String(params.get('payment') || '').toLowerCase()
  if (payment !== 'success' && payment !== 'cancelled') return null
  return {
    payment,
    tx: String(params.get('tx') || '').trim(),
    appointmentId: String(params.get('appointmentId') || '').trim(),
  }
}

const resolveInitialPage = () => {
  syncAppStorageVersion()

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

  const savedPage = sessionStorage.getItem(CURRENT_PAGE_KEY)
  if (savedPage && !PUBLIC_PAGES.has(savedPage)) {
    return savedPage
  }

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
    if (!IS_DEV) return undefined
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

  useEffect(() => {
    const isAttorneyShell = ATTORNEY_PAGES.includes(page);
    document.documentElement.classList.toggle('attorney-ui-active', isAttorneyShell);
    document.body.classList.toggle('attorney-ui-active', isAttorneyShell);
    return () => {
      document.documentElement.classList.remove('attorney-ui-active');
      document.body.classList.remove('attorney-ui-active');
    };
  }, [page]);
  const [showNotaryModal, setShowNotaryModal] = useState(false);
  const [signupContext, setSignupContext] = useState({ email: '', role: 'Client', otpChannel: 'email' });
  const [currentProfile, setCurrentProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authScopeVersion, setAuthScopeVersion] = useState(0);
  const activeAuthUserIdRef = useRef(null);
  const previousRoleRef = useRef('');
  const paymongoReturnHandledRef = useRef(false);

  const forceResetToLogin = useCallback((reason) => {
    console.error('[auth] forcing login reset', { reason })
    resetUserApiRuntimeState()
    clearTransientAuthState({ includeRecovery: true })
    clearAuthRelatedStorage()
    previousRoleRef.current = ''
    activeAuthUserIdRef.current = null
    setCurrentProfile(null)
    setSignupContext({ email: '', role: 'Client', otpChannel: 'email' })
    setAuthScopeVersion((prev) => prev + 1)
    setPage('login')

    sessionStorage.setItem(FORCE_LOGIN_REDIRECT_KEY, '1')
    window.location.href = '/'
  }, [])

  const resetRuntimeForAuthBoundary = useCallback((reason, details = {}) => {
    resetUserApiRuntimeState()
    setAuthScopeVersion((prev) => prev + 1)
    if (IS_DEV) {
      console.log('[auth] runtime scope reset', { reason, ...details })
    }
  }, [])

  useEffect(() => {
    // Warm the admin-controlled feature flags cache (prevent_double_booking,
    // enforce_schedule_window) and keep it in sync when the admin toggles.
    // The realtime channel is module-scoped so it lives for the whole
    // page lifetime; we do not tear it down on unmount.
    ensureAppConfigLoaded();
    subscribeToAppConfigChanges();
  }, []);

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
        if (IS_DEV) {
          console.log('[auth] bootstrap session resolved', {
            userId: sessionUserId,
            role: normalizeRole(profile?.role || session?.user?.user_metadata?.role || ''),
          })
        }

        if (isMounted) {
          if (!sessionUserId) {
            clearTransientAuthState({ includeRecovery: true });
            setCurrentProfile(null);
          } else {
            clearTransientAuthState();
            const resolvedProfile = profile
              ? { ...profile, role: resolveSessionRole(session, profile) }
              : null
            setCurrentProfile(resolvedProfile);
            if (resolvedProfile?.role) {
              const roleHomePage = pageFromRole(resolvedProfile.role)
              setPage((current) =>
                !canAccessPage(normalizeRole(resolvedProfile.role), current) ? roleHomePage : current,
              )
            }
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
        if (IS_DEV) {
          console.log('[auth] onAuthStateChange', { event, userId: sessionUserId })
        }

        if (event === 'TOKEN_REFRESH_FAILED') {
          forceResetToLogin('token refresh failed')
          return
        }

        if (!session?.user) {
          clearTransientAuthState({ includeRecovery: true });
          setCurrentProfile(null);
          return;
        }

        if (!isSignupVerificationComplete(session.user)) {
          const pendingEmail =
            localStorage.getItem('batasmo_pending_otp_email') || session.user.email || '';
          if (pendingEmail) {
            localStorage.setItem('batasmo_pending_otp_email', pendingEmail);
          }
          await signOutIfSignupIncomplete(session.user);
          setCurrentProfile(null);
          setSignupContext((prev) => ({
            ...prev,
            email: pendingEmail,
            role: normalizeRole(session.user.user_metadata?.role || 'Client'),
          }));
          setPage('otp');
          return;
        }

        // Fast path: update profile from session metadata immediately.
        clearTransientAuthState();
        setCurrentProfile((prev) => {
          const draft = {
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
          }
          return { ...draft, role: resolveSessionRole(session, draft) }
        });

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
      if (IS_DEV) {
        console.log('[auth] auth listener unsubscribed')
      }
    };
  }, [forceResetToLogin, resetRuntimeForAuthBoundary]);

  useEffect(() => {
    if (authLoading || paymongoReturnHandledRef.current) return undefined

    const paymongoReturn = readPaymongoReturnFromLocation()
    if (!paymongoReturn) return undefined

    if (!currentProfile?.id) {
      return undefined
    }

    const role = normalizeRole(currentProfile.role || '')
    if (role !== 'Client') {
      paymongoReturnHandledRef.current = true
      window.history.replaceState({}, document.title, '/')
      return undefined
    }

    paymongoReturnHandledRef.current = true
    setPageParams((prev) => ({
      ...(prev || {}),
      paymongoReturn,
    }))
    setPage(paymongoReturn.payment === 'cancelled' ? 'my-appointments' : 'home-logged')
    window.history.replaceState({}, document.title, '/')

    return undefined
  }, [authLoading, currentProfile?.id, currentProfile?.role])

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
    if (!currentProfile?.id || normalizeRole(currentProfile?.role || '') !== 'Client') return undefined

    const channel = supabase.channel('online-clients', {
      config: {
        presence: {
          key: currentProfile.id,
        },
      },
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      channel.track({
        user_id: currentProfile.id,
        role: 'Client',
        online_at: new Date().toISOString(),
      })
    })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [currentProfile?.id, currentProfile?.role])

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
    if (!IS_DEV) return
    console.log('[nav] page changed', {
      page,
      userId: currentProfile?.id || null,
      role: normalizeRole(currentProfile?.role || ''),
    })
  }, [page, currentProfile?.id, currentProfile?.role])

  const handleAuthSuccess = useCallback((profile, options = {}) => {
    clearTransientAuthState({ includeRecovery: true });
    setSignupContext({ email: '', role: 'Client', otpChannel: 'email' });
    const role = normalizeRole(profile?.role || '');
    const homePage = pageFromRole(role);
    setCurrentProfile(profile);
    sessionStorage.setItem(CURRENT_PAGE_KEY, homePage);
    if (options.mustChangePassword && role === 'Client') {
      setPageParams({ initialProfileTab: 'password', mustChangePassword: true });
      setPage('profile');
      sessionStorage.setItem(CURRENT_PAGE_KEY, 'profile');
    } else {
      setPageParams({});
      setPage(homePage);
    }
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
      if (IS_DEV) {
        console.log('[auth] sign out flow completed')
      }
    }
  }, [forceResetToLogin]);

  useEffect(() => {
    if (PUBLIC_PAGES.has(page) || !currentProfile?.role) return
    const role = normalizeRole(currentProfile.role)
    if (canAccessPage(role, page)) {
      sessionStorage.setItem(CURRENT_PAGE_KEY, page)
    }
  }, [page, currentProfile?.role])

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

  const consultationWaitingHost =
    currentProfile &&
    (normalizeRole(currentProfile.role) === 'Client' ||
      normalizeRole(currentProfile.role) === 'Attorney') ? (
      <ConsultationWaitingHost
        page={page}
        pageParams={pageParams}
        profile={currentProfile}
        onNavigate={handleNavigate}
      />
    ) : null

  const renderClientShell = (node) =>
    renderLazy(
      <>
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
        </ClientShell>
        {consultationWaitingHost}
      </>,
    )

  const renderAttorneyWithWaiting = (node) =>
    renderLazy(
      <>
        {node}
        {consultationWaitingHost}
      </>,
    )

  useEffect(() => {
    if (!currentProfile?.role) return
    const role = normalizeRole(currentProfile.role)
    const roleHomePage = pageFromRole(role)
    const isRecoveryFlowPage = page === 'forgot-password' || page === 'reset-password'
    const hasRecoveryFlow = localStorage.getItem(RECOVERY_ACTIVE_KEY) === 'true'

    if (isPublicPage) {
      if (isRecoveryFlowPage && hasRecoveryFlow) {
        return undefined
      }

      let cancelled = false
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return
        if (!session?.user) return

        const emailConfirmed = Boolean(session.user.email_confirmed_at)
        if (!emailConfirmed && (page === 'otp' || page === 'signup')) {
          return
        }

        if (page !== roleHomePage) {
          setPage(roleHomePage)
        }
      })
      return () => {
        cancelled = true
      }
    }

    if (!canAccessPage(role, page) && page !== roleHomePage) {
      setPage(roleHomePage)
    }
    return undefined
  }, [currentProfile, page, isPublicPage])

  if (!authLoading && !isPublicPage && !currentProfile) {
    return <Login onNavigate={handleNavigate} onAuthSuccess={handleAuthSuccess} />;
  }

  if (page === 'signup') return <SignUp onNavigate={handleNavigate} onEmailChange={setSignupContext} />;
  if (page === 'otp') return (
    <OtpVerification
      onNavigate={handleNavigate}
      email={signupContext.email}
      role={signupContext.role}
      otpChannel={signupContext.otpChannel}
    />
  );
  if (page === 'verified') return <VerificationSuccess onNavigate={handleNavigate} />;
  if (page === 'login') return <Login onNavigate={handleNavigate} onAuthSuccess={handleAuthSuccess} />;
  if (page === 'forgot-password') return <ForgotPassword onNavigate={handleNavigate} />;
  if (page === 'reset-password') return <ResetPassword onNavigate={handleNavigate} />;
  if (page === 'home-logged') return renderClientShell(<HomePage onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} />);
  if (page === 'book-appointment') return renderClientShell(<BookAppointment onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'notarial-request') return renderClientShell(<NotarialRequest onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'my-appointments') return renderClientShell(<MyAppointments onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'profile') {
    return renderClientShell(
      <ProfilePage
        onNavigate={handleNavigate}
        profile={currentProfile}
        onSignOut={handleSignOut}
        onProfileUpdated={setCurrentProfile}
        initialTab={pageParams?.initialProfileTab}
        forcePasswordChange={Boolean(pageParams?.mustChangePassword)}
        onPasswordChangeComplete={() => setPageParams((prev) => ({ ...(prev || {}), mustChangePassword: false }))}
      />,
    );
  }
  if (page === 'chat-room') return renderClientShell(<ChatRoom onNavigate={handleNavigate} profile={currentProfile} initialAppointmentId={pageParams?.appointmentId || ''} />);
  if (page === 'my-notarial-requests') return renderClientShell(<MyNotarialRequests onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'announcements') return renderClientShell(<Announcements onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'transaction-history') return renderClientShell(<TransactionHistory onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'client-logs') return renderClientShell(<ClientLogs onNavigate={handleNavigate} profile={currentProfile} initialAppointmentId={pageParams?.appointmentId || ''} />);
  if (page === 'client-notary-tracking') return renderClientShell(<ClientNotaryTracking profile={currentProfile} />);
  if (page === 'support-messages') return renderClientShell(<SupportMessages onNavigate={handleNavigate} profile={currentProfile} initialDraft={pageParams?.draft || ''} />);
  if (page === 'attorney-home') return renderAttorneyWithWaiting(<AttorneyHome onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} />);
  if (page === 'consultation-requests') return renderAttorneyWithWaiting(<ConsultationRequests onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'upcoming-appointments') return renderAttorneyWithWaiting(<UpcomingAppointments onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-availability')
    return renderAttorneyWithWaiting(<AttorneyAvailability onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'notarial-requests-atty') return renderAttorneyWithWaiting(<NotarialRequestsAtty onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-analytics') return renderAttorneyWithWaiting(<AttorneyAnalytics onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-messages') return renderAttorneyWithWaiting(<AttorneyMessages onNavigate={handleNavigate} profile={currentProfile} initialAppointmentId={pageParams?.appointmentId || ''} />);
  if (page === 'attorney-logs')
    return renderAttorneyWithWaiting(
      <AttorneyLogs onNavigate={handleNavigate} profile={currentProfile} initialAppointmentId={pageParams?.appointmentId || ''} />,
    );
  if (page === 'attorney-announcements') return renderAttorneyWithWaiting(<AttorneyAnnouncements onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-profile') return renderAttorneyWithWaiting(<AttorneyProfile onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} onProfileUpdated={setCurrentProfile} />);
  if (page === 'admin-home') return renderLazy(<AdminDashboard onNavigate={handleNavigate} />);
  if (page === 'admin-clients') return renderLazy(<AdminClients onNavigate={handleNavigate} />);
  if (page === 'admin-attorneys') return renderLazy(<AdminAttorneys onNavigate={handleNavigate} />);
  if (page === 'admin-requests') return renderLazy(<AdminRequests onNavigate={handleNavigate} />);
  if (page === 'admin-consultations') return renderLazy(<AdminConsultations onNavigate={handleNavigate} />);
  if (page === 'admin-reports') return renderLazy(<AdminReports onNavigate={handleNavigate} />);
  if (page === 'admin-settings') return renderLazy(<AdminSettingsPage onNavigate={handleNavigate} />);
  if (page === 'admin-messages') return renderLazy(<AdminMessages onNavigate={handleNavigate} />);

  if (SECRETARY_PAGES.includes(page)) {
    return renderLazy(
      <SecretaryConsole
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        profile={currentProfile}
        initialPage={SECRETARY_INITIAL_PAGE[page] || 'Dashboard'}
      />,
    );
  }

  return <LandingPage onNavigate={handleNavigate} />;
}

export default App;
