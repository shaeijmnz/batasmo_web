import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, Users, Scale, FileText, MessageSquare, 
  BarChart3, Settings, LogOut, Menu, Star, Bell,
  X, Send, Trash2, Eye, AlertCircle, CheckCircle, Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './AdminDashboard.css';
import './AdminTheme.css';

const formatDateTimeForUi = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { date: 'TBD', time: 'TBD' };
  }

  return {
    date: parsed.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    time: parsed.toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  };
};

const normalizeNotaryWorkflowStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'approved' || value === 'accepted' || value === 'in_process' || value === 'in-progress') {
    return 'in_process';
  }
  if (value === 'completed') {
    return 'completed';
  }
  if (value === 'rejected' || value === 'cancelled') {
    return 'closed';
  }
  return 'pending';
};

const notaryStatusLabel = (status) => {
  if (status === 'in_process') return 'In Process';
  if (status === 'completed') return 'Ready for Pick Up';
  if (status === 'closed') return 'Closed';
  return 'Pending';
};

const CLAIMED_MARKER = '[CLIENT_CLAIMED]';

const hasClaimedMarker = (notes) => String(notes || '').includes(CLAIMED_MARKER);

const appendClaimedMarker = (notes) => {
  const existing = String(notes || '').trim();
  if (existing.includes(CLAIMED_MARKER)) {
    return existing;
  }
  const stamp = new Date().toISOString();
  return `${existing}\n${CLAIMED_MARKER}:${stamp}`.trim();
};

const isImageFile = (value) => /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(String(value || ''));

const getLastSixMonthKeys = () => {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-PH', { month: 'short' });
    result.push({ key, label });
  }
  return result;
};

const getWeekWindow = () => {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
};

const dayToMondayFirstIndex = (day) => (day === 0 ? 6 : day - 1);

const normalizeRequestStatusForUi = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'started' || value === 'in_progress' || value === 'in-progress' || value === 'active') {
    return 'In Progress';
  }
  if (value === 'completed') {
    return 'Completed';
  }
  if (value === 'confirmed' || value === 'rescheduled') {
    return 'Scheduled';
  }
  return 'Pending';
};

const formatScheduleLabel = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return 'Schedule TBD';
  }
  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const mapAdminPathToPage = (path) => {
  if (path === '/clients') return 'admin-clients';
  if (path === '/attorneys') return 'admin-attorneys';
  if (path === '/requests') return 'admin-requests';
  if (path === '/consultations') return 'admin-consultations';
  if (path === '/reports') return 'admin-reports';
  if (path === '/settings') return 'admin-profile';
  return 'admin-home';
};

const Dashboard = ({ onNavigate, onSignOut, profile }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const navigate = (path) => {
    if (typeof onNavigate === 'function') {
      onNavigate(mapAdminPathToPage(path));
    }
  };
  const handleQuickAction = (message) => window.alert(message);

  const [clients, setClients] = useState([]);
  const [totalClients, setTotalClients] = useState(0);
  const [attorneys, setAttorneys] = useState([]);
  const [totalAttorneys, setTotalAttorneys] = useState(0);
  const [pendingNotaryRequests, setPendingNotaryRequests] = useState([]);
  const [isUpdatingNotary, setIsUpdatingNotary] = useState(false);
  const [completedConsultations, setCompletedConsultations] = useState([]);
  const [completedNotaryRequests, setCompletedNotaryRequests] = useState([]);
  const [toast, setToast] = useState(null);
  const [documentPreview, setDocumentPreview] = useState({ open: false, url: '', title: '' });
  const [revenueData, setRevenueData] = useState([0, 0, 0, 0, 0, 0]);
  const [monthLabels, setMonthLabels] = useState(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
  const [weekData, setWeekData] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [topAttorneys, setTopAttorneys] = useState([]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3000);
  };

  const fetchPendingNotaryRequests = async () => {
    const { data, error } = await supabase
      .from('notarial_requests')
      .select('id, client_id, service_type, document_url, status, preferred_date, created_at, updated_at, notes, client:client_id(full_name)')
      .in('status', ['pending', 'approved', 'accepted', 'in_process'])
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const mapped = (data || []).map((item) => {
      const { date } = formatDateTimeForUi(item.created_at);
      return {
        id: item.id,
        clientId: item.client_id,
        clientName: item.client?.full_name || 'Client',
        document: item.service_type || 'Notarial Request',
        documentUrl: item.document_url || '',
        notes: item.notes || '',
        submissionDate: date,
        status: normalizeNotaryWorkflowStatus(item.status),
      };
    });

    setPendingNotaryRequests(mapped);
  };

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      try {
        const [
          { data: clientList, error: clientError },
          { count: clientCount, error: countError },
          { data: attorneyList, error: attorneyError },
          { count: attorneyCount, error: attorneyCountError },
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, phone')
            .eq('role', 'Client')
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'Client'),
          supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'Attorney')
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'Attorney'),
        ]);

        if (clientError) throw clientError;
        if (countError) throw countError;
        if (attorneyError) throw attorneyError;
        if (attorneyCountError) throw attorneyCountError;

        const normalizedClients = (clientList || []).map((client) => ({
          id: client.id,
          name: client.full_name || 'Unnamed Client',
          email: client.email || 'No email',
          phone: client.phone || 'No phone',
          status: 'Active',
        }));

        const normalizedAttorneys = (attorneyList || []).map((attorney) => ({
          id: attorney.id,
          name: attorney.full_name || 'Unnamed Attorney',
          specialty: 'Not set',
          consultations: 0,
          rating: null,
          email: attorney.email || 'No email',
        }));

        if (!isMounted) {
          return;
        }

        setClients(normalizedClients);
        setAttorneys(normalizedAttorneys);
        setTotalClients(clientCount ?? normalizedClients.length ?? 0);
        setTotalAttorneys(attorneyCount ?? normalizedAttorneys.length ?? 0);
      } catch (error) {
        if (isMounted) {
          setClients([]);
          setTotalClients(0);
          setAttorneys([]);
          setTotalAttorneys(0);
        }
        console.error(error);
      }
    };

    loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadQueueAndTopAttorneys = async () => {
      try {
        const [appointmentsQueueRes, feedbackRes, completedAppointmentsRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, title, status, scheduled_at, client:client_id(full_name), attorney:attorney_id(full_name)')
            .in('status', ['pending', 'confirmed', 'rescheduled', 'started', 'in_progress', 'active'])
            .order('scheduled_at', { ascending: true })
            .limit(8),
          supabase
            .from('consultation_feedback')
            .select('attorney_id, rating, attorney:attorney_id(full_name)')
            .order('created_at', { ascending: false }),
          supabase
            .from('appointments')
            .select('attorney_id, status')
            .eq('status', 'completed'),
        ]);

        if (appointmentsQueueRes.error) throw appointmentsQueueRes.error;
        if (feedbackRes.error) throw feedbackRes.error;
        if (completedAppointmentsRes.error) throw completedAppointmentsRes.error;

        const nextRecentRequests = (appointmentsQueueRes.data || []).map((item) => ({
          id: item.id,
          name: item.client?.full_name || 'Client',
          atty: item.attorney?.full_name || 'Attorney',
          law: item.title || 'Consultation',
          status: normalizeRequestStatusForUi(item.status),
          age: formatScheduleLabel(item.scheduled_at),
        }));

        const completedCountByAttorney = new Map();
        (completedAppointmentsRes.data || []).forEach((row) => {
          if (!row.attorney_id) {
            return;
          }
          completedCountByAttorney.set(
            row.attorney_id,
            Number(completedCountByAttorney.get(row.attorney_id) || 0) + 1,
          );
        });

        const feedbackByAttorney = new Map();
        (feedbackRes.data || []).forEach((row) => {
          const attorneyId = row.attorney_id;
          if (!attorneyId) {
            return;
          }
          const existing = feedbackByAttorney.get(attorneyId) || {
            name: row.attorney?.full_name || 'Attorney',
            totalRating: 0,
            ratingCount: 0,
          };
          existing.totalRating += Number(row.rating || 0);
          existing.ratingCount += 1;
          feedbackByAttorney.set(attorneyId, existing);
        });

        const nextTopAttorneys = Array.from(feedbackByAttorney.entries())
          .map(([attorneyId, item]) => ({
            id: attorneyId,
            name: item.name,
            law: 'Consultation Practice',
            consultations: Number(completedCountByAttorney.get(attorneyId) || 0),
            rating: item.ratingCount > 0 ? Number((item.totalRating / item.ratingCount).toFixed(1)) : 0,
          }))
          .sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return b.consultations - a.consultations;
          })
          .slice(0, 4)
          .map((item, index) => ({ ...item, rank: index + 1 }));

        if (!isMounted) {
          return;
        }

        setRecentRequests(nextRecentRequests);
        setTopAttorneys(nextTopAttorneys);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setRecentRequests([]);
          setTopAttorneys([]);
        }
      }
    };

    loadQueueAndTopAttorneys();

    const appointmentsChannel = supabase
      .channel('admin-dashboard-queue-appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          loadQueueAndTopAttorneys();
        },
      )
      .subscribe();

    const feedbackChannel = supabase
      .channel('admin-dashboard-feedback')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consultation_feedback' },
        () => {
          loadQueueAndTopAttorneys();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(feedbackChannel);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadChartData = async () => {
      try {
        const months = getLastSixMonthKeys();
        const monthMap = new Map(months.map((item) => [item.key, 0]));
        const weekCounts = [0, 0, 0, 0, 0, 0, 0];
        const { start, end } = getWeekWindow();

        const [transactionsRes, appointmentsRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount, payment_status, created_at')
            .eq('payment_status', 'paid')
            .gte('created_at', `${months[0].key}-01T00:00:00.000Z`)
            .order('created_at', { ascending: true }),
          supabase
            .from('appointments')
            .select('status, created_at')
            .gte('created_at', start.toISOString())
            .lt('created_at', end.toISOString()),
        ]);

        if (transactionsRes.error) throw transactionsRes.error;
        if (appointmentsRes.error) throw appointmentsRes.error;

        (transactionsRes.data || []).forEach((row) => {
          const createdAt = new Date(row.created_at);
          if (Number.isNaN(createdAt.getTime())) {
            return;
          }
          const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
          if (!monthMap.has(key)) {
            return;
          }
          monthMap.set(key, Number(monthMap.get(key) || 0) + Number(row.amount || 0));
        });

        (appointmentsRes.data || []).forEach((row) => {
          const status = String(row.status || '').toLowerCase();
          if (status === 'cancelled') {
            return;
          }

          const createdAt = new Date(row.created_at);
          if (Number.isNaN(createdAt.getTime())) {
            return;
          }

          const index = dayToMondayFirstIndex(createdAt.getDay());
          weekCounts[index] += 1;
        });

        if (!isMounted) {
          return;
        }

        setMonthLabels(months.map((item) => item.label));
        setRevenueData(months.map((item) => Number(monthMap.get(item.key) || 0)));
        setWeekData(weekCounts);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setRevenueData([0, 0, 0, 0, 0, 0]);
          setWeekData([0, 0, 0, 0, 0, 0, 0]);
        }
      }
    };

    loadChartData();

    const transactionsChannel = supabase
      .channel('admin-dashboard-transactions-chart')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          loadChartData();
        },
      )
      .subscribe();

    const appointmentsChartChannel = supabase
      .channel('admin-dashboard-appointments-chart')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          loadChartData();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(appointmentsChartChannel);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPendingNotary = async () => {
      try {
        await fetchPendingNotaryRequests();
      } catch (error) {
        if (isMounted) {
          setPendingNotaryRequests([]);
        }
        console.error(error);
      }
    };

    loadPendingNotary();

    const notaryPendingChannel = supabase
      .channel('admin-dashboard-pending-notary')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notarial_requests' },
        () => {
          loadPendingNotary();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(notaryPendingChannel);
    };
  }, []);

  const notifyClient = async (clientId, body) => {
    if (!clientId) {
      return;
    }

    const { error } = await supabase.from('notifications').insert({
      user_id: clientId,
      title: 'Notarial Request Update',
      body,
      type: 'notarial_update',
      is_read: false,
    });

    if (error) {
      throw error;
    }
  };

  const openNotaryDocument = (request) => {
    if (!request.documentUrl) {
      showToast('No document uploaded for this request.', 'error');
      return;
    }
    setDocumentPreview({
      open: true,
      url: request.documentUrl,
      title: `${request.clientName} - ${request.document}`,
    });
  };

  const closeDocumentPreview = () => {
    setDocumentPreview({ open: false, url: '', title: '' });
  };

  const markNotaryInProcess = async (request) => {
    if (isUpdatingNotary) {
      return;
    }

    setIsUpdatingNotary(true);
    try {
      const { error } = await supabase
        .from('notarial_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', request.id);

      if (error) {
        throw error;
      }

      await notifyClient(
        request.clientId,
        `Your notary request for ${request.document} is now in process.`,
      );

      await fetchPendingNotaryRequests();
      showToast('Notary request moved to In Process. Client notified.');
    } catch (error) {
      console.error(error);
      showToast('Failed to mark request as in process.', 'error');
    } finally {
      setIsUpdatingNotary(false);
    }
  };

  const markNotaryReadyForPickup = async (request) => {
    if (isUpdatingNotary) {
      return;
    }

    setIsUpdatingNotary(true);
    try {
      const { error } = await supabase
        .from('notarial_requests')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', request.id);

      if (error) {
        throw error;
      }

      await notifyClient(
        request.clientId,
        `Your notarized document for ${request.document} is ready for pick up.`,
      );

      await fetchPendingNotaryRequests();
      showToast('Notary request marked as ready for pick up. Client notified.');
    } catch (error) {
      console.error(error);
      showToast('Failed to mark request as ready for pick up.', 'error');
    } finally {
      setIsUpdatingNotary(false);
    }
  };

  const markNotaryAsClaimed = async (request) => {
    if (isUpdatingNotary) {
      return;
    }

    setIsUpdatingNotary(true);
    try {
      const { error } = await supabase
        .from('notarial_requests')
        .update({ notes: appendClaimedMarker(request.notes), updated_at: new Date().toISOString() })
        .eq('id', request.id);

      if (error) {
        throw error;
      }

      await notifyClient(
        request.clientId,
        `Your notarized document for ${request.document} was marked as claimed.`,
      );

      setCompletedNotaryRequests((prev) =>
        prev.map((item) => (item.id === request.id ? { ...item, pickedUp: true, notes: appendClaimedMarker(item.notes) } : item)),
      );
      showToast('Marked as claimed. Client notified.');
    } catch (error) {
      console.error(error);
      showToast('Failed to mark request as claimed.', 'error');
    } finally {
      setIsUpdatingNotary(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    const fetchCompletedRequests = async () => {
      if (isFetching) {
        return;
      }

      isFetching = true;
      try {
        const [appointmentsRes, notaryRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, title, notes, scheduled_at, updated_at, client:client_id(full_name), attorney:attorney_id(full_name)')
            .eq('status', 'completed')
            .order('updated_at', { ascending: false }),
          supabase
            .from('notarial_requests')
            .select('id, client_id, service_type, document_url, status, created_at, updated_at, notes, client:client_id(full_name)')
            .eq('status', 'completed')
            .order('updated_at', { ascending: false }),
        ]);

        if (appointmentsRes.error) throw appointmentsRes.error;
        if (notaryRes.error) throw notaryRes.error;

        const nextCompletedConsultations = (appointmentsRes.data || []).map((item) => {
          const { date, time } = formatDateTimeForUi(item.scheduled_at || item.updated_at);
          return {
            id: item.id,
            clientName: item.client?.full_name || 'Client',
            attorneyName: item.attorney?.full_name || 'Attorney',
            date,
            time,
            specialty: item.title || 'Legal Consultation',
            transcript: item.notes || 'No transcript available yet.',
          };
        });

        const nextCompletedNotaryRequests = (notaryRes.data || []).map((item) => {
          const { date } = formatDateTimeForUi(item.updated_at || item.created_at);
          return {
            id: item.id,
            clientId: item.client_id,
            clientName: item.client?.full_name || 'Client',
            document: item.service_type || item.document_url || 'Notarial Request',
            documentUrl: item.document_url || '',
            completionDate: date,
            notes: item.notes || '',
            pickedUp: hasClaimedMarker(item.notes),
          };
        });

        if (!isMounted) {
          return;
        }

        setCompletedConsultations(nextCompletedConsultations);
        setCompletedNotaryRequests(nextCompletedNotaryRequests);
      } catch (error) {
        if (isMounted) {
          setCompletedConsultations([]);
          setCompletedNotaryRequests([]);
        }
        console.error(error);
      } finally {
        isFetching = false;
      }
    };

    const shouldRefreshForCompleted = (payload) => {
      const nextStatus = String(payload?.new?.status || '').toLowerCase();
      const prevStatus = String(payload?.old?.status || '').toLowerCase();
      return nextStatus === 'completed' || prevStatus === 'completed';
    };

    fetchCompletedRequests();

    const appointmentsChannel = supabase
      .channel('admin-dashboard-completed-appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          if (shouldRefreshForCompleted(payload)) {
            fetchCompletedRequests();
          }
        },
      )
      .subscribe();

    const notaryChannel = supabase
      .channel('admin-dashboard-completed-notary')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notarial_requests' },
        (payload) => {
          if (shouldRefreshForCompleted(payload)) {
            fetchCompletedRequests();
          }
        },
      )
      .subscribe();

    const consultationRoomChannel = supabase
      .channel('admin-dashboard-consultation-rooms')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consultation_rooms' },
        (payload) => {
          const isClosedNow = Boolean(payload?.new?.is_closed);
          const wasClosed = Boolean(payload?.old?.is_closed);
          if (isClosedNow || wasClosed) {
            fetchCompletedRequests();
          }
        },
      )
      .subscribe();

    const handleVisibilityRefresh = () => {
      if (!document.hidden) {
        fetchCompletedRequests();
      }
    };

    const pollId = window.setInterval(() => {
      if (!document.hidden) {
        fetchCompletedRequests();
      }
    }, 5000);

    window.addEventListener('focus', fetchCompletedRequests);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      isMounted = false;
      window.clearInterval(pollId);
      window.removeEventListener('focus', fetchCompletedRequests);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(notaryChannel);
      supabase.removeChannel(consultationRoomChannel);
    };
  }, []);

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Requests', icon: <FileText size={20} />, path: '/requests' },
    { label: 'Consultations', icon: <MessageSquare size={20} />, path: '/consultations' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const stats = [
    { label: 'Total Clients', value: totalClients, color: '#1e3a8a', icon: <Users size={20}/>, modal: 'clients' },
    { label: 'Total Attorneys', value: totalAttorneys, color: '#eab308', icon: <Scale size={20}/>, modal: 'attorneys' },
    { label: 'Pending Notary', value: pendingNotaryRequests.length, color: '#ef4444', icon: <FileText size={20}/>, modal: 'pendingRequests' },
    { label: 'Completed Consultations', value: completedConsultations.length + completedNotaryRequests.length, color: '#22c55e', icon: <MessageSquare size={20}/>, modal: 'completedRequests' },
  ];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="dashboard-container">
      {/* Sidebar Section */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-logo">
          <img src="/logo/logo.jpg" alt="BatasMo logo" className="brand-logo" />
          {isSidebarOpen && <span className="logo-text">BatasMo</span>}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              active={item.path === '/'}
              open={isSidebarOpen}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">AD</div>
            {isSidebarOpen && (
              <div className="user-meta">
                <p className="user-name">{profile?.full_name || 'BatasMo Admin'}</p>
                <p className="user-email">{profile?.email || 'admin@batasmo.local'}</p>
              </div>
            )}
          </div>
          <button className="logout-action" onClick={onSignOut || (() => handleQuickAction('Logout clicked'))}>
            <LogOut size={18} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Section */}
      <main className="main-panel">
        <header className="top-bar">
          <div className="bar-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!isSidebarOpen)}>
              <Menu size={24} />
            </button>
            <h2 className="page-title">Dashboard</h2>
          </div>
          <div className="bar-right">
            <div className="notification-icon">
              <div className="red-dot"></div>
              <Bell size={20} />
            </div>
          </div>
        </header>

        <div className="scroll-content">
          {/* Welcome Section */}
          <section className="welcome-section">
            <div className="header-container">
              <div className="header-content">
                <h1>Welcome Back, Admin</h1>
                <p>Here's what's happening with your legal matters today.</p>
              </div>
              <div className="header-overlay"></div>
            </div>
          </section>

          {/* Quick Action Cards */}
          <section className="quick-actions">
            <div className="action-card" onClick={() => navigate('/consultations')}>
              <Calendar size={32} className="action-icon" />
              <h3 className="action-title">View Consultations</h3>
              <p className="action-description">Manage upcoming consultations</p>
            </div>
            <div className="action-card" onClick={() => navigate('/requests')}>
              <FileText size={32} className="action-icon" />
              <h3 className="action-title">Notarial Requests</h3>
              <p className="action-description">Review pending notary requests</p>
            </div>
          </section>

          {/* Stat Cards Grid */}
          <section className="stats-row">
            {stats.map((stat, i) => (
              <div 
                key={i} 
                className="stat-card clickable-card" 
                style={{ borderLeft: `4px solid ${stat.color}` }}
                onClick={() => setActiveModal(stat.modal)}
              >
                <div className="stat-label">
                  <span>{stat.label}</span>
                  <span style={{ color: '#94a3b8' }}>{stat.icon}</span>
                </div>
                <h3 className="stat-number">{stat.value}</h3>
              </div>
            ))}
          </section>

          <section className="grid-split charts-row">
            <section className="info-card chart-card">
              <div className="card-header">
                <h4>₱ Revenue Overview</h4>
              </div>
              <SimpleLineChart values={revenueData} labels={monthLabels} />
            </section>

            <section className="info-card chart-card">
              <div className="card-header">
                <h4>Weekly Consultations</h4>
              </div>
              <SimpleBarChart values={weekData} labels={days} />
            </section>
          </section>

          {/* Lower Sections */}
          <div className="grid-split dashboard-lower">
            <section className="info-card">
              <div className="card-header">
                <h4>Recent Requests</h4>
                <a href="#" className="view-all" onClick={(event) => {
                  event.preventDefault();
                  navigate('/requests');
                }}>View All</a>
              </div>
              <div className="list-stack">
                {recentRequests.length === 0 ? (
                  <p className="item-subtitle">No upcoming scheduled consultations.</p>
                ) : (
                  recentRequests.map((item) => (
                    <RequestItem key={item.id} {...item} />
                  ))
                )}
              </div>
            </section>

            <section className="info-card">
              <div className="card-header">
                <h4>Top Attorneys</h4>
                <a href="#" className="view-all" onClick={(event) => {
                  event.preventDefault();
                  navigate('/attorneys');
                }}>View All</a>
              </div>
              <div className="list-stack">
                {topAttorneys.length === 0 ? (
                  <p className="item-subtitle">No attorney ratings yet.</p>
                ) : (
                  topAttorneys.map((item) => (
                    <AttorneyItem key={item.id} {...item} />
                  ))
                )}
              </div>
            </section>
          </div>

        </div>
      </main>

      {/* Modals */}
      {activeModal === 'clients' && (
        <ClientsModal 
          clients={clients} 
          onClose={() => setActiveModal(null)}
          onMessage={(client) => {
            setMessageInput('');
            window.alert(`Messaging ${client.name}: ${messageInput || 'Hello'}`);
          }}
          onRemove={(client) => window.alert(`Removed ${client.name}`)}
        />
      )}

      {activeModal === 'attorneys' && (
        <AttorneysModal 
          attorneys={attorneys} 
          onClose={() => setActiveModal(null)}
          onMessage={(attorney) => {
            setMessageInput('');
            window.alert(`Messaging ${attorney.name}: ${messageInput || 'Hello'}`);
          }}
        />
      )}

      {activeModal === 'pendingRequests' && (
        <PendingRequestsModal 
          notaryRequests={pendingNotaryRequests}
          onOpenDocument={openNotaryDocument}
          onMarkInProcess={markNotaryInProcess}
          onMarkPickupReady={markNotaryReadyForPickup}
          isUpdating={isUpdatingNotary}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'completedRequests' && (
        <CompletedRequestsModal 
          consultations={completedConsultations}
          notaryRequests={completedNotaryRequests}
          onOpenDocument={openNotaryDocument}
          onMarkClaimed={markNotaryAsClaimed}
          isUpdating={isUpdatingNotary}
          onClose={() => setActiveModal(null)}
        />
      )}

      {documentPreview.open ? (
        <DocumentPreviewModal
          url={documentPreview.url}
          title={documentPreview.title}
          onClose={closeDocumentPreview}
        />
      ) : null}

      {toast ? (
        <div className={`admin-toast ${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
};

// Modal Components
const ClientsModal = ({ clients, onClose, onMessage, onRemove }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>All Clients</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="clients-list">
          {clients.map((client) => (
            <div key={client.id} className="client-item">
              <div className="client-info">
                <h4>{client.name}</h4>
                <p>{client.email}</p>
                <p>{client.phone}</p>
              </div>
              <div className="client-actions">
                <button className="btn-message" onClick={() => onMessage(client)}>
                  <MessageSquare size={16} /> Message
                </button>
                <button className="btn-remove" onClick={() => onRemove(client)}>
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AttorneysModal = ({ attorneys, onClose, onMessage }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>All Attorneys</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="attorneys-list">
          {attorneys.map((attorney) => (
            <div key={attorney.id} className="attorney-item">
              <div className="attorney-info">
                <h4>{attorney.name}</h4>
                <p>{attorney.specialty || 'No specialty yet'}</p>
                <p>
                  {(attorney.consultations ?? 0)} consultations
                  {attorney.rating ? ` • ${attorney.rating}⭐` : ''}
                </p>
              </div>
              <button className="btn-message" onClick={() => onMessage(attorney)}>
                <MessageSquare size={16} /> Message
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const PendingRequestsModal = ({ notaryRequests, onOpenDocument, onMarkInProcess, onMarkPickupReady, isUpdating, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>Notary Requests</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="pending-sections">
          <div className="pending-section">
            <h3>Active Notary Requests ({notaryRequests.length})</h3>
            <div className="notary-list">
              {notaryRequests.length === 0 ? (
                <p className="item-subtitle">No active notary requests right now.</p>
              ) : (
                notaryRequests.map((notary) => (
                  <div key={notary.id} className="notary-item">
                    <div className="notary-info">
                      <h4>{notary.clientName}</h4>
                      <p>Document: {notary.document}</p>
                      <p>Submitted: {notary.submissionDate}</p>
                      {notary.notes ? <p>Notes: {notary.notes}</p> : null}
                    </div>
                    <div className="notary-item-actions">
                      <span className={`status-badge ${notary.status.replace('_', '-')}`}>
                        <AlertCircle size={14} /> {notaryStatusLabel(notary.status)}
                      </span>
                      <div className="notary-action-buttons">
                        <button className="btn-message" onClick={() => onOpenDocument(notary)}>
                          <Eye size={16} /> View Document
                        </button>
                        {notary.status === 'pending' ? (
                          <button className="btn-view-transcript" disabled={isUpdating} onClick={() => onMarkInProcess(notary)}>
                            <Send size={16} /> In Process
                          </button>
                        ) : null}
                        {notary.status === 'in_process' ? (
                          <button className="btn-view-transcript" disabled={isUpdating} onClick={() => onMarkPickupReady(notary)}>
                            <CheckCircle size={16} /> Pick Up
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DocumentPreviewModal = ({ url, title, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content modal-xlarge" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>{title || 'Document Preview'}</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="document-preview-wrap">
          {isImageFile(url) ? (
            <img src={url} alt={title || 'Document preview'} className="document-preview-image" />
          ) : (
            <iframe src={url} title={title || 'Document preview'} className="document-preview-frame" />
          )}
        </div>
      </div>
    </div>
  </div>
);

const CompletedRequestsModal = ({ consultations, notaryRequests, onOpenDocument, onMarkClaimed, isUpdating, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>Completed Consultations & Notary Requests</h2>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
      </div>
      <div className="modal-body">
        <div className="completed-sections">
          <div className="completed-section">
            <h3>Completed Consultations ({consultations.length})</h3>
            <div className="completed-consultations-list">
              {consultations.length === 0 ? (
                <p className="item-subtitle">No completed consultations yet.</p>
              ) : (
                consultations.map((consultation) => (
                  <div key={consultation.id} className="completed-consultation-item">
                    <div className="consultation-overview">
                      <div className="overview-header">
                        <h4>{consultation.clientName}</h4>
                        <CheckCircle size={18} color="#22c55e" />
                      </div>
                      <div className="overview-details">
                        <p><strong>Attorney:</strong> {consultation.attorneyName}</p>
                        <p><strong>Specialty:</strong> {consultation.specialty}</p>
                        <p><strong>Date & Time:</strong> {consultation.date} at {consultation.time}</p>
                      </div>
                    </div>
                    <button className="btn-view-transcript" onClick={() => window.alert(`Transcript: ${consultation.transcript}`)}>
                      <Eye size={16} /> View Transcript
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="completed-section">
            <h3>Completed Notary Requests ({notaryRequests.length})</h3>
            <div className="completed-notary-list">
              {notaryRequests.length === 0 ? (
                <p className="item-subtitle">No completed notary requests yet.</p>
              ) : (
                notaryRequests.map((notary) => (
                  <div key={notary.id} className="completed-notary-item">
                    <div className="notary-overview">
                      <div className="overview-header">
                        <h4>{notary.clientName}</h4>
                        {notary.pickedUp ? (
                          <CheckCircle size={18} color="#22c55e" />
                        ) : (
                          <AlertCircle size={18} color="#ef4444" />
                        )}
                      </div>
                      <div className="overview-details">
                        <p><strong>Document:</strong> {notary.document}</p>
                        <p><strong>Completion Date:</strong> {notary.completionDate}</p>
                        <p><strong>Status:</strong> {notary.pickedUp ? '✓ Claimed by Client' : '⚠ Awaiting Client Pickup'}</p>
                      </div>
                    </div>
                    <div className="notary-action-buttons">
                      <button className="btn-message" onClick={() => onOpenDocument(notary)}>
                        <Eye size={16} /> View Document
                      </button>
                      {!notary.pickedUp ? (
                        <button className="btn-view-transcript" disabled={isUpdating} onClick={() => onMarkClaimed(notary)}>
                          <CheckCircle size={16} /> Mark Claimed
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const RequestItem = ({ name, atty, law, status, age }) => (
  <div className="item-row">
    <div>
      <p className="item-title">{name}</p>
      <p className="item-subtitle">{atty}</p>
      <p className="item-subtitle">{law}</p>
    </div>
    <div className="item-meta-right">
      <div className={`status-tag ${status.toLowerCase().replace(" ", "")}`}>
        {status}
      </div>
      <p className="item-subtitle">{age}</p>
    </div>
  </div>
);

const AttorneyItem = ({ rank, name, law, consultations, rating }) => (
  <div className="item-row">
    <div className="rank-badge">#{rank}</div>
    <div style={{ flex: 1 }}>
      <p className="item-title">{name}</p>
      <p className="item-subtitle">{law}</p>
    </div>
    <div className="item-meta-right">
      <p className="item-title">{consultations}</p>
      <div className="rating-star">
        <Star size={12} fill="#eab308" color="#eab308" /> {rating}
      </div>
    </div>
  </div>
);

const NavItem = ({ icon, label, active, open, onClick }) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    {icon}
    {open && <span>{label}</span>}
  </div>
);

const SimpleLineChart = ({ values, labels }) => {
  const width = 560;
  const height = 240;
  const pad = 34;
  const safeValues = values.length ? values : [0];
  const rawMin = Math.min(...safeValues);
  const rawMax = Math.max(...safeValues);
  const hasSpread = rawMax !== rawMin;
  const min = hasSpread ? rawMin * 0.9 : rawMin - 1;
  const max = hasSpread ? rawMax * 1.1 : rawMax + 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const x = (i) => pad + (i / (values.length - 1)) * innerW;
  const denominator = max - min || 1;
  const y = (v) => pad + ((max - v) / denominator) * innerH;
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mini-chart-svg" preserveAspectRatio="none">
      {[0, 1, 2, 3].map((step) => {
        const yy = pad + (step / 3) * innerH;
        return <line key={step} x1={pad} y1={yy} x2={width - pad} y2={yy} className="chart-grid-line" />;
      })}
      <path d={path} className="chart-line" />
      {values.map((v, i) => <circle key={labels[i]} cx={x(i)} cy={y(v)} r="4" className="chart-dot" />)}
      {labels.map((label, i) => (
        <text key={label} x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis-label">{label}</text>
      ))}
    </svg>
  );
};

const SimpleBarChart = ({ values, labels }) => {
  const max = Math.max(...values, 0);
  const safeMax = max > 0 ? max : 1;

  return (
    <div className="week-bar-chart">
      {values.map((value, i) => (
        <div key={labels[i]} className="bar-col">
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(value / safeMax) * 100}%` }}></div>
          </div>
          <span className="chart-axis-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
