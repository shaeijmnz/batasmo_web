import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { getCurrentSessionProfile, normalizeRole, pageFromRole, signOutUser } from './lib/userApi';

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

const AttorneyHome = lazy(() => import('./AttorneyDashboard/AttorneyHome'));
const ConsultationRequests = lazy(() => import('./AttorneyDashboard/ConsultationRequests'));
const UpcomingAppointments = lazy(() => import('./AttorneyDashboard/UpcomingAppointments'));
const NotarialRequestsAtty = lazy(() => import('./AttorneyDashboard/NotarialRequestsAtty'));
const AttorneyEarnings = lazy(() => import('./AttorneyDashboard/AttorneyEarnings'));
const AttorneyMessages = lazy(() => import('./AttorneyDashboard/AttorneyMessages'));
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
]

const ATTORNEY_PAGES = [
  'attorney-home',
  'consultation-requests',
  'upcoming-appointments',
  'notarial-requests-atty',
  'attorney-earnings',
  'attorney-messages',
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
  'my-notarial-requests',
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

function App() {
  const [page, setPage] = useState('home');
  const [signupContext, setSignupContext] = useState({ email: '', role: 'Client' });
  const [currentProfile, setCurrentProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { profile } = await getCurrentSessionProfile();
        if (isMounted) {
          setCurrentProfile(profile);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (!session?.user) {
        setCurrentProfile(null);
        return;
      }

      try {
        const { profile } = await getCurrentSessionProfile();
        setCurrentProfile(profile);
      } catch {
        // Keep auth flow responsive even if profile query is temporarily unavailable.
        setCurrentProfile({
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name || '',
          email: session.user.email || '',
          role: normalizeRole(session.user.user_metadata?.role || 'Client'),
        });
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleAuthSuccess = useCallback((profile) => {
    setCurrentProfile(profile);
    setPage(pageFromRole(profile?.role));
  }, []);

  const handleNavigate = useCallback((nextPage) => {
    const role = normalizeRole(currentProfile?.role || '')
    if ((role === 'Client' || !role) && CLIENT_NOTARY_BLOCKED_PAGES.has(nextPage)) {
      window.alert(NOTARY_WARNING_MESSAGE)
      return
    }
    setPage(nextPage)
  }, [currentProfile?.role])

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    setCurrentProfile(null);
    setPage('home');
  }, []);

  const isPublicPage = PUBLIC_PAGES.has(page);

  const renderLazy = (node) => <Suspense fallback={null}>{node}</Suspense>

  useEffect(() => {
    if (!currentProfile?.role) return
    const role = normalizeRole(currentProfile.role)
    const roleHomePage = pageFromRole(role)

    if (isPublicPage) {
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
  if (page === 'home-logged') return renderLazy(<HomePage onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} />);
  if (page === 'book-appointment') return renderLazy(<BookAppointment onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'notarial-request') return renderLazy(<NotarialRequest onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'my-appointments') return renderLazy(<MyAppointments onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'profile') return renderLazy(<ProfilePage onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} onProfileUpdated={setCurrentProfile} />);
  if (page === 'chat-room') return renderLazy(<ChatRoom onNavigate={handleNavigate} />);
  if (page === 'my-notarial-requests') return renderLazy(<MyNotarialRequests onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'announcements') return renderLazy(<Announcements onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'transaction-history') return renderLazy(<TransactionHistory onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-home') return renderLazy(<AttorneyHome onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} />);
  if (page === 'consultation-requests') return renderLazy(<ConsultationRequests onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'upcoming-appointments') return renderLazy(<UpcomingAppointments onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'notarial-requests-atty') return renderLazy(<NotarialRequestsAtty onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-earnings') return renderLazy(<AttorneyEarnings onNavigate={handleNavigate} profile={currentProfile} />);
  if (page === 'attorney-messages') return renderLazy(<AttorneyMessages onNavigate={handleNavigate} profile={currentProfile} />);
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
  if (page === 'admin-profile') return renderLazy(<AdminProfile onNavigate={handleNavigate} />);

  return <LandingPage onNavigate={handleNavigate} />;
}

export default App;
