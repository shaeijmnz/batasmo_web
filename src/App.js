import { useEffect, useState } from 'react';
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

/* ── ClientDashboard ── */
import HomePage from './ClientDashboard/HomePage';
import BookAppointment from './ClientDashboard/BookAppointment';
import NotarialRequest from './ClientDashboard/NotarialRequest';
import MyAppointments from './ClientDashboard/MyAppointments';
import ProfilePage from './ClientDashboard/ProfilePage';
import ChatRoom from './ClientDashboard/ChatRoom';
import MyNotarialRequests from './ClientDashboard/MyNotarialRequests';
import Announcements from './ClientDashboard/Announcements';
import TransactionHistory from './ClientDashboard/TransactionHistory';
import AttorneyHome from './AttorneyDashboard/AttorneyHome';
import ConsultationRequests from './AttorneyDashboard/ConsultationRequests';
import UpcomingAppointments from './AttorneyDashboard/UpcomingAppointments';
import NotarialRequestsAtty from './AttorneyDashboard/NotarialRequestsAtty';
import AttorneyEarnings from './AttorneyDashboard/AttorneyEarnings';
import AttorneyMessages from './AttorneyDashboard/AttorneyMessages';
import AttorneyAnnouncements from './AttorneyDashboard/AttorneyAnnouncements';
import AttorneyProfile from './AttorneyDashboard/AttorneyProfile';
import ManageAvailability from './AttorneyDashboard/ManageAvailability';

/* ── AdminDashboard ── */
import AdminDashboard from './AdminDashboard/AdminDashboard';
import AdminClients from './AdminDashboard/AdminClients';
import AdminAttorneys from './AdminDashboard/AdminAttorneys';
import AdminRequests from './AdminDashboard/AdminRequests';
import AdminConsultations from './AdminDashboard/AdminConsultations';
import AdminConsultationStats from './AdminDashboard/AdminConsultationStats';
import AdminUsers from './AdminDashboard/AdminUsers';
import AdminAddUser from './AdminDashboard/AdminAddUser';
import AdminUserLogs from './AdminDashboard/AdminUserLogs';
import AdminNotarialRequests from './AdminDashboard/AdminNotarialRequests';
import AdminReports from './AdminDashboard/AdminReports';
import AdminProfile from './AdminDashboard/AdminProfile';
import AdminCMS from './AdminDashboard/AdminCMS';

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

  const handleAuthSuccess = (profile) => {
    setCurrentProfile(profile);
    setPage(pageFromRole(profile?.role));
  };

  const handleNavigate = (nextPage) => {
    const role = normalizeRole(currentProfile?.role || '')
    if ((role === 'Client' || !role) && CLIENT_NOTARY_BLOCKED_PAGES.has(nextPage)) {
      window.alert(NOTARY_WARNING_MESSAGE)
      return
    }
    setPage(nextPage)
  }

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentProfile(null);
    setPage('home');
  };

  const isPublicPage = ['home', 'signup', 'otp', 'verified', 'login', 'forgot-password', 'reset-password'].includes(page);

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
  if (page === 'home-logged') return <HomePage onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} />;
  if (page === 'book-appointment') return <BookAppointment onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'notarial-request') return <NotarialRequest onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'my-appointments') return <MyAppointments onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'profile') return <ProfilePage onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} onProfileUpdated={setCurrentProfile} />;
  if (page === 'chat-room') return <ChatRoom onNavigate={handleNavigate} />;
  if (page === 'my-notarial-requests') return <MyNotarialRequests onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'announcements') return <Announcements onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'transaction-history') return <TransactionHistory onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'attorney-home') return <AttorneyHome onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} />;
  if (page === 'consultation-requests') return <ConsultationRequests onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'upcoming-appointments') return <UpcomingAppointments onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'notarial-requests-atty') return <NotarialRequestsAtty onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'attorney-earnings') return <AttorneyEarnings onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'attorney-messages') return <AttorneyMessages onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'attorney-announcements') return <AttorneyAnnouncements onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'attorney-profile') return <AttorneyProfile onNavigate={handleNavigate} profile={currentProfile} onSignOut={handleSignOut} onProfileUpdated={setCurrentProfile} />;
  if (page === 'manage-availability') return <ManageAvailability onNavigate={handleNavigate} profile={currentProfile} />;
  if (page === 'admin-home') return <AdminDashboard onNavigate={handleNavigate} />;
  if (page === 'admin-users') return <AdminUsers onNavigate={handleNavigate} />;
  if (page === 'admin-clients') return <AdminClients onNavigate={handleNavigate} />;
  if (page === 'admin-attorneys') return <AdminAttorneys onNavigate={handleNavigate} />;
  if (page === 'admin-add-user') return <AdminAddUser onNavigate={handleNavigate} />;
  if (page === 'admin-user-logs') return <AdminUserLogs onNavigate={handleNavigate} />;
  if (page === 'admin-requests') return <AdminRequests onNavigate={handleNavigate} />;
  if (page === 'admin-consultations') return <AdminConsultations onNavigate={handleNavigate} />;
  if (page === 'admin-consultation-stats') return <AdminConsultationStats onNavigate={handleNavigate} />;
  if (page === 'admin-notarial') return <AdminNotarialRequests onNavigate={handleNavigate} />;
  if (page === 'admin-reports') return <AdminReports onNavigate={handleNavigate} />;
  if (page === 'admin-cms') return <AdminCMS onNavigate={handleNavigate} />;
  if (page === 'admin-profile') return <AdminProfile onNavigate={handleNavigate} />;

  return <LandingPage onNavigate={handleNavigate} />;
}

export default App;
