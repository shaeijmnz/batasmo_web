import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, Scale, FileText, MessageSquare,
  BarChart3, Settings, LogOut, Menu,
  X, Send, Trash2, Eye, AlertCircle, CheckCircle, Calendar, Bell, Video,
} from 'lucide-react';
import {
  getQueueRequestDisplayStatus,
  isOngoingVideoCallRoom,
} from '../lib/consultationStatus';
import { supabase } from '../lib/supabaseClient';
import AttorneyNotificationDropdown from '../AttorneyDashboard/AttorneyNotificationDropdown';
import './AdminNotificationDropdown.css';
import AdminSupportDrawer from './AdminSupportDrawer';
import AdminRescheduleRequests from './AdminRescheduleRequests';
import {
  fetchAdminHomeNotifications,
  fetchAdminOngoingVideoCallCount,
  markAdminNotificationsAsRead,
  subscribeToAdminNotifications,
  signOutUser,
} from '../lib/userApi';
import { fetchPaidNotarialRequests, notifyClientNotarialStatusUpdate } from '../lib/adminApi';
import { attachLiveDataRefresh } from '../lib/liveDataRefresh';
import { patchAdminPageCache, readAdminPageCache } from '../lib/adminPageCache';
import './AdminTheme.css';
import './dashboard.css';

const DASHBOARD_CACHE_KEY = 'dashboard-v2';

const persistDashboardCache = (patch) => {
  patchAdminPageCache(DASHBOARD_CACHE_KEY, patch);
};

const ACTIVE_QUEUE_STATUSES = ['pending', 'confirmed', 'rescheduled', 'started'];

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

const MANILA_TZ = 'Asia/Manila';

const getManilaDateKey = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const addDaysToManilaDateKey = (ymd, deltaDays) => {
  const anchor = new Date(`${ymd}T12:00:00+08:00`);
  if (Number.isNaN(anchor.getTime())) return ymd;
  anchor.setDate(anchor.getDate() + deltaDays);
  return getManilaDateKey(anchor);
};

const getWeekWindow = () => {
  const todayKey = getManilaDateKey(new Date());
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    weekday: 'short',
  }).format(new Date());
  const daysFromMonday = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[weekday] ?? 0;

  const mondayKey = addDaysToManilaDateKey(todayKey, -daysFromMonday);
  const endKey = addDaysToManilaDateKey(mondayKey, 7);
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDaysToManilaDateKey(mondayKey, i));

  return {
    start: new Date(`${mondayKey}T00:00:00+08:00`),
    end: new Date(`${endKey}T00:00:00+08:00`),
    mondayKey,
    dayKeys,
  };
};

const dayIndexFromManilaDateKey = (dayKeys, dateKey) => dayKeys.indexOf(dateKey);

const formatNotifBadgeCount = (count) => {
  const safeCount = Number(count || 0);
  if (safeCount <= 0) return '';
  if (safeCount > 99) return '99+';
  return String(safeCount);
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

const formatAttorneySpecialty = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || 'Legal Practice';
  }
  const text = String(value || '').trim();
  return text || 'Legal Practice';
};

const CANCELLED_APPOINTMENT_STATUSES = new Set(['cancelled', 'rejected']);

const isCountableConsultationStatus = (status) => {
  const value = String(status || '').toLowerCase();
  return Boolean(value) && !CANCELLED_APPOINTMENT_STATUSES.has(value);
};

/** Matches Admin Consultations: completed status, closed room, or started session (not live video). */
const isFinishedConsultation = (status, closedRoomAppointmentIds, appointmentId, roomByAppointment) => {
  const room = roomByAppointment?.get?.(appointmentId);
  if (isOngoingVideoCallRoom(room)) return false;
  const value = String(status || '').toLowerCase();
  if (value === 'completed') return true;
  if (appointmentId && closedRoomAppointmentIds?.has(appointmentId)) return true;
  if (value === 'started') return true;
  return false;
};

const resolveAttorneyImage = (name) => {
  const normalized = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^atty\s+/, '')
    .trim();

  if (normalized.includes('jeanne') && normalized.includes('anarna')) {
    return '/assets/attorneys/jeanne-luz-castillo-anarna.jpg';
  }
  if (normalized.includes('alston') && normalized.includes('anarna')) {
    return '/assets/attorneys/alston-kevin-anarna.jpg';
  }
  if (normalized.includes('allen') && normalized.includes('anarna')) {
    return '/assets/attorneys/allen-kristopher-anarna.png';
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Attorney')}&background=152238&color=ffffff`;
};

const Dashboard = ({ onNavigate }) => {
  const dashboardBoot = useMemo(() => readAdminPageCache(DASHBOARD_CACHE_KEY), []);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(!dashboardBoot);
  const navigate = (path) => {
    const pageMap = {
      '/': 'admin-home',
      '/clients': 'admin-clients',
      '/attorneys': 'admin-attorneys',
      '/requests': 'admin-requests',
      '/consultations': 'admin-consultations',
      '/reports': 'admin-reports',
      '/settings': 'admin-settings',
    };
    onNavigate?.(pageMap[path] || 'admin-home');
  };

  const [clients, setClients] = useState(() => dashboardBoot?.clients || []);
  const [totalClients, setTotalClients] = useState(() => dashboardBoot?.totalClients ?? 0);
  const [attorneys, setAttorneys] = useState(() => dashboardBoot?.attorneys || []);
  const [totalAttorneys, setTotalAttorneys] = useState(() => dashboardBoot?.totalAttorneys ?? 0);
  const [pendingNotaryRequests, setPendingNotaryRequests] = useState(
    () => dashboardBoot?.pendingNotaryRequests || [],
  );
  const [isUpdatingNotary, setIsUpdatingNotary] = useState(false);
  const [completedConsultations, setCompletedConsultations] = useState(
    () => dashboardBoot?.completedConsultations || [],
  );
  const [completedNotaryRequests, setCompletedNotaryRequests] = useState(
    () => dashboardBoot?.completedNotaryRequests || [],
  );
  const [toast, setToast] = useState(null);
  const [documentPreview, setDocumentPreview] = useState({ open: false, url: '', title: '' });
  const [revenueData, setRevenueData] = useState(
    () => dashboardBoot?.revenueData || [0, 0, 0, 0, 0, 0],
  );
  const [monthLabels, setMonthLabels] = useState(
    () => dashboardBoot?.monthLabels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  );
  const [weekData, setWeekData] = useState(
    () => dashboardBoot?.weekData || [0, 0, 0, 0, 0, 0, 0],
  );
  const [recentRequests, setRecentRequests] = useState(() => dashboardBoot?.recentRequests || []);
  const [topAttorneys, setTopAttorneys] = useState(() => dashboardBoot?.topAttorneys || []);
  const [ongoingVideoCallCount, setOngoingVideoCallCount] = useState(0);

  const [adminUserId, setAdminUserId] = useState('');
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [adminNotifOpen, setAdminNotifOpen] = useState(false);
  const [adminMarkAllReadCutoffIso, setAdminMarkAllReadCutoffIso] = useState('');
  const [isMarkingAdminNotificationsRead, setIsMarkingAdminNotificationsRead] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const adminMarkAllReadStorageKey = `admin-notifications-read-cutoff:${adminUserId || 'unknown'}`;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3000);
  };

  const fetchPendingNotaryRequests = async () => {
    /** Only true "new" paid requests — exclude `accepted` / in-process (those belong in Admin Requests tabs). */
    const data = await fetchPaidNotarialRequests({
      select:
        'id, client_id, service_type, document_url, status, preferred_date, created_at, updated_at, notes, client:client_id(full_name)',
      extraQuery: (query) => query.eq('status', 'pending'),
    });

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
    persistDashboardCache({ pendingNotaryRequests: mapped });
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
            .order('created_at', { ascending: false })
            .limit(40),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'Client'),
          supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'Attorney')
            .order('created_at', { ascending: false })
            .limit(40),
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
          email: attorney.email || 'No email',
        }));

        if (!isMounted) {
          return;
        }

        const nextTotalClients = clientCount ?? normalizedClients.length ?? 0;
        const nextTotalAttorneys = attorneyCount ?? normalizedAttorneys.length ?? 0;

        setClients(normalizedClients);
        setAttorneys(normalizedAttorneys);
        setTotalClients(nextTotalClients);
        setTotalAttorneys(nextTotalAttorneys);
        persistDashboardCache({
          clients: normalizedClients,
          attorneys: normalizedAttorneys,
          totalClients: nextTotalClients,
          totalAttorneys: nextTotalAttorneys,
        });
      } catch (error) {
        console.error('[admin-dashboard] clients load failed', error);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
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
      if (!isMounted) return;

      const [profilesRes, attorneyProfilesRes, queueAppointmentsRes, statsAppointmentsRes, roomsRes] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'Attorney')
            .order('created_at', { ascending: false }),
          supabase.from('attorney_profiles').select('user_id, specialties'),
          supabase
            .from('appointments')
            .select('id, title, status, scheduled_at, created_at, client_id, attorney_id')
            .in('status', ACTIVE_QUEUE_STATUSES)
            .order('created_at', { ascending: true })
            .limit(8),
          supabase
            .from('appointments')
            .select('id, attorney_id, status')
            .neq('status', 'cancelled'),
          supabase
            .from('consultation_rooms')
            .select('appointment_id, is_closed, video_meeting_id'),
        ]);

      if (profilesRes.error) {
        console.error('[admin-dashboard] attorney profiles load failed', profilesRes.error);
        return;
      }

      if (attorneyProfilesRes.error) {
        console.warn('[admin-dashboard] attorney_profiles load failed', attorneyProfilesRes.error);
      }
      if (queueAppointmentsRes.error) {
        console.warn('[admin-dashboard] queue appointments load failed', queueAppointmentsRes.error);
      }
      if (statsAppointmentsRes.error) {
        console.warn('[admin-dashboard] appointment stats load failed', statsAppointmentsRes.error);
      }
      if (roomsRes.error) {
        console.warn('[admin-dashboard] consultation rooms load failed', roomsRes.error);
      }

      const rooms = roomsRes.data || [];
      const roomByAppointment = new Map();
      rooms.forEach((row) => {
        if (row.appointment_id) roomByAppointment.set(row.appointment_id, row);
      });

      const nextOngoingVideoCallCount = await fetchAdminOngoingVideoCallCount();
      setOngoingVideoCallCount(nextOngoingVideoCallCount);

      const closedRoomAppointmentIds = new Set(
        rooms
          .filter((row) => row.is_closed && row.appointment_id)
          .map((row) => row.appointment_id),
      );

      const attorneyNameById = new Map(
        (profilesRes.data || []).map((row) => [row.id, row.full_name || 'Attorney']),
      );

      const specialtyByAttorney = new Map(
        (attorneyProfilesRes.data || []).map((row) => [row.user_id, row.specialties]),
      );

      const queueRows = queueAppointmentsRes.data || [];
      const appointmentRows = statsAppointmentsRes.data || [];

      const queueClientIds = [
        ...new Set(queueRows.map((row) => row.client_id).filter(Boolean)),
      ];

      let clientNameById = new Map();
      if (queueClientIds.length) {
        const { data: clientProfiles, error: clientProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', queueClientIds);

        if (clientProfilesError) {
          console.warn('[admin-dashboard] queue client names failed', clientProfilesError);
        } else {
          clientNameById = new Map(
            (clientProfiles || []).map((row) => [row.id, row.full_name || 'Client']),
          );
        }
      }

      let nextRecentRequests = [];
      if (!queueAppointmentsRes.error) {
        nextRecentRequests = queueRows.map((item, index) => ({
          id: item.id,
          queuePosition: index + 1,
          name: clientNameById.get(item.client_id) || 'Client',
          atty: attorneyNameById.get(item.attorney_id) || 'Attorney',
          law: item.title || 'Consultation',
          status: getQueueRequestDisplayStatus(
            item.status,
            roomByAppointment.get(item.id),
          ),
          bookedLabel: `Booked ${formatScheduleLabel(item.created_at)}`,
          age: `Scheduled ${formatScheduleLabel(item.scheduled_at)}`,
        }));
        setRecentRequests(nextRecentRequests);
      }

      const totalConsultationsByAttorney = new Map();
      const finishedConsultationsByAttorney = new Map();
      const activeQueueCountByAttorney = new Map();
      appointmentRows.forEach((row) => {
        if (!row.attorney_id) return;
        const status = String(row.status || '').toLowerCase();
        if (!isCountableConsultationStatus(status)) return;

        totalConsultationsByAttorney.set(
          row.attorney_id,
          Number(totalConsultationsByAttorney.get(row.attorney_id) || 0) + 1,
        );

        if (isFinishedConsultation(status, closedRoomAppointmentIds, row.id, roomByAppointment)) {
          finishedConsultationsByAttorney.set(
            row.attorney_id,
            Number(finishedConsultationsByAttorney.get(row.attorney_id) || 0) + 1,
          );
        }

        if (ACTIVE_QUEUE_STATUSES.includes(status)) {
          activeQueueCountByAttorney.set(
            row.attorney_id,
            Number(activeQueueCountByAttorney.get(row.attorney_id) || 0) + 1,
          );
        }
      });

      const nextTopAttorneys = (profilesRes.data || [])
        .map((profile) => {
          const totalConsultations = Number(totalConsultationsByAttorney.get(profile.id) || 0);
          const finishedConsultations = Number(finishedConsultationsByAttorney.get(profile.id) || 0);
          const inQueue = Number(activeQueueCountByAttorney.get(profile.id) || 0);
          const displayName = profile.full_name || 'Attorney';
          return {
            id: profile.id,
            name: displayName,
            imageUrl: resolveAttorneyImage(displayName),
            law: formatAttorneySpecialty(specialtyByAttorney.get(profile.id)),
            consultations: totalConsultations,
            finished: finishedConsultations,
            inQueue,
          };
        })
        .sort((a, b) => {
          if (b.finished !== a.finished) return b.finished - a.finished;
          if (b.consultations !== a.consultations) return b.consultations - a.consultations;
          return b.inQueue - a.inQueue;
        })
        .slice(0, 4)
        .map((item, index) => ({ ...item, rank: index + 1 }));

      setTopAttorneys(nextTopAttorneys);
      persistDashboardCache({
        recentRequests: nextRecentRequests,
        topAttorneys: nextTopAttorneys,
        ongoingVideoCallCount: nextOngoingVideoCallCount,
      });
    };

    const detachLiveRefresh = attachLiveDataRefresh({
      reload: async (options = {}) => {
        await loadQueueAndTopAttorneys();
        if (!options.silent) {
          setIsSyncing(false);
        }
      },
      pollMs: 30000,
      subscribe: (onChange) => {
        const appointmentsChannel = supabase
          .channel('admin-dashboard-queue-appointments')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'appointments' },
            () => onChange(),
          )
          .subscribe();

        const roomsChannel = supabase
          .channel('admin-dashboard-consultation-rooms')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'consultation_rooms' },
            () => onChange(),
          )
          .subscribe();

        return () => {
          supabase.removeChannel(appointmentsChannel);
          supabase.removeChannel(roomsChannel);
        };
      },
    });

    return () => {
      isMounted = false;
      detachLiveRefresh();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadChartData = async () => {
      try {
        const months = getLastSixMonthKeys();
        const monthMap = new Map(months.map((item) => [item.key, 0]));
        const weekCounts = [0, 0, 0, 0, 0, 0, 0];
        const { start, end, dayKeys } = getWeekWindow();

        const [transactionsRes, appointmentsRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount, payment_status, created_at')
            .eq('payment_status', 'paid')
            .gte('created_at', `${months[0].key}-01T00:00:00.000Z`)
            .order('created_at', { ascending: true }),
          supabase
            .from('appointments')
            .select('status, scheduled_at, created_at')
            .gte('scheduled_at', start.toISOString())
            .lt('scheduled_at', end.toISOString()),
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
          if (status === 'cancelled' || status === 'rejected') {
            return;
          }

          const whenIso = row.scheduled_at || row.created_at;
          const when = whenIso ? new Date(whenIso) : null;
          if (!when || Number.isNaN(when.getTime())) {
            return;
          }

          const index = dayIndexFromManilaDateKey(dayKeys, getManilaDateKey(when));
          if (index < 0 || index > 6) {
            return;
          }
          weekCounts[index] += 1;
        });

        if (!isMounted) {
          return;
        }

        const nextMonthLabels = months.map((item) => item.label);
        const nextRevenueData = months.map((item) => Number(monthMap.get(item.key) || 0));

        setMonthLabels(nextMonthLabels);
        setRevenueData(nextRevenueData);
        setWeekData(weekCounts);
        persistDashboardCache({
          monthLabels: nextMonthLabels,
          revenueData: nextRevenueData,
          weekData: weekCounts,
        });
      } catch (error) {
        console.error('[admin-dashboard] chart load failed', error);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
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
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', request.id);

      if (error) {
        throw error;
      }

      await notifyClientNotarialStatusUpdate({
        clientId: request.clientId,
        requestId: request.id,
        status: 'in_process',
        serviceLabel: request.document,
      });

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

      await notifyClientNotarialStatusUpdate({
        clientId: request.clientId,
        requestId: request.id,
        status: 'ready_for_pickup',
        serviceLabel: request.document,
      });

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

      await notifyClientNotarialStatusUpdate({
        clientId: request.clientId,
        requestId: request.id,
        status: 'picked_up',
        serviceLabel: request.document,
      });

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
        const [appointmentsRes, paidCompletedNotary] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, title, notes, scheduled_at, updated_at, client:client_id(full_name), attorney:attorney_id(full_name)')
            .eq('status', 'completed')
            .order('updated_at', { ascending: false })
            .limit(30),
          fetchPaidNotarialRequests({
            select:
              'id, client_id, service_type, document_url, status, created_at, updated_at, notes, client:client_id(full_name)',
            extraQuery: (query) => query.eq('status', 'completed'),
          }),
        ]);

        if (appointmentsRes.error) throw appointmentsRes.error;

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

        const nextCompletedNotaryRequests = (paidCompletedNotary || []).map((item) => {
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
        persistDashboardCache({
          completedConsultations: nextCompletedConsultations,
          completedNotaryRequests: nextCompletedNotaryRequests,
        });
      } catch (error) {
        console.error('[admin-dashboard] completed requests load failed', error);
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

    window.addEventListener('focus', fetchCompletedRequests);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', fetchCompletedRequests);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(notaryChannel);
      supabase.removeChannel(consultationRoomChannel);
    };
  }, []);

  useEffect(() => {
    if (!adminUserId) {
      setAdminMarkAllReadCutoffIso('');
      return;
    }
    try {
      setAdminMarkAllReadCutoffIso(window.localStorage.getItem(adminMarkAllReadStorageKey) || '');
    } catch {
      setAdminMarkAllReadCutoffIso('');
    }
  }, [adminMarkAllReadStorageKey, adminUserId]);

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (mounted && user?.id) setAdminUserId(user.id);
    };
    loadSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!adminUserId) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchAdminHomeNotifications(adminUserId);
        if (!cancelled) setAdminNotifications(rows);
      } catch {
        if (!cancelled) setAdminNotifications([]);
      }
    };
    load();
    const unsub = subscribeToAdminNotifications(adminUserId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [adminUserId]);

  const cutoffTime = adminMarkAllReadCutoffIso ? new Date(adminMarkAllReadCutoffIso).getTime() : 0;
  const displayAdminNotifications = adminNotifications.map((n) => {
    const notificationTime = new Date(n.createdAt || 0).getTime() || 0;
    const unread = Boolean(n.unread) && notificationTime > cutoffTime;
    return { ...n, unread };
  });
  const adminUnreadCount = displayAdminNotifications.filter((n) => n.unread).length;

  const handleMarkAllAdminNotificationsRead = async () => {
    if (!adminUserId || isMarkingAdminNotificationsRead) return;
    setIsMarkingAdminNotificationsRead(true);
    const nowIso = new Date().toISOString();
    setAdminMarkAllReadCutoffIso(nowIso);
    try {
      window.localStorage.setItem(adminMarkAllReadStorageKey, nowIso);
    } catch {
      // ignore
    }
    setAdminNotifications((prev) => prev.map((item) => (item.unread ? { ...item, unread: false } : item)));
    try {
      await markAdminNotificationsAsRead(adminUserId);
    } catch {
      setAdminMarkAllReadCutoffIso('');
      try {
        window.localStorage.removeItem(adminMarkAllReadStorageKey);
      } catch {
        // ignore
      }
      setAdminNotifications((prev) => prev.map((item) => ({ ...item, unread: true })));
    } finally {
      setIsMarkingAdminNotificationsRead(false);
    }
  };

  const navItems = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
    { label: 'Clients', icon: <Users size={20} />, path: '/clients' },
    { label: 'Attorneys', icon: <Scale size={20} />, path: '/attorneys' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/reports' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const pendingNotaryCount = pendingNotaryRequests.length;
  const stats = [
    { label: 'Total Clients', value: totalClients, color: '#1e3a8a', icon: <Users size={20}/>, page: '/clients' },
    { label: 'Total Attorneys', value: totalAttorneys, color: '#eab308', icon: <Scale size={20}/>, page: '/attorneys' },
    {
      label: 'In Progress',
      value: ongoingVideoCallCount > 0 ? ongoingVideoCallCount : '—',
      color: '#3b82f6',
      icon: <Video size={20} />,
      page: '/consultations',
      alert: ongoingVideoCallCount > 0,
      alertText: `${ongoingVideoCallCount} ongoing video ${
        ongoingVideoCallCount === 1 ? 'call' : 'calls'
      }`,
    },
    {
      label: 'Pending Notary',
      value: pendingNotaryCount > 0 ? pendingNotaryCount : '—',
      color: '#ef4444',
      icon: <FileText size={20}/>,
      page: '/requests',
      alert: pendingNotaryCount > 0,
      alertText: `${pendingNotaryCount} new ${pendingNotaryCount === 1 ? 'request' : 'requests'}`,
    },
  ];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="app-container">
      {/* Sidebar Section */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-logo">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!isSidebarOpen)}>
            <Menu size={24} />
          </button>
          {isSidebarOpen && <img src="/logo/logo.jpg" alt="BatasMo logo" className="brand-logo" />}
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
                <p className="user-name">Admin User</p>
                <p className="user-email">admin@batasmo.com</p>
              </div>
            )}
          </div>
          <button
            className="logout-action"
            onClick={async () => {
              try {
                await signOutUser();
              } catch (error) {
                console.warn('[admin] sign out failed', error);
              } finally {
                onNavigate?.('login');
              }
            }}
          >
            <LogOut size={18} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Section */}
      <main className="main-content">
        <div className="content-wrapper">
          {/* Welcome Section */}
          <section className="welcome-section">
            <div className="welcome-section__row">
              <div className="header-container">
                <div className="header-content">
                  <h1>Welcome Back, Admin</h1>
                  {isSyncing ? (
                    <span className="adm-dashboard-sync" role="status">
                      Updating data…
                    </span>
                  ) : null}
                  <p>Here's what's happening with your legal matters today.</p>
                </div>
                <div className="header-overlay"></div>
              </div>
              <div className="adm-notif-wrap">
                <button
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => onNavigate?.('admin-messages')}
                  aria-label="Client messages"
                  title="Client messages"
                >
                  <MessageSquare size={20} />
                  {supportUnreadCount > 0 ? (
                    <span className="adm-notif-badge">{formatNotifBadgeCount(supportUnreadCount)}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="adm-icon-btn"
                  onClick={() => setAdminNotifOpen((v) => !v)}
                  aria-expanded={adminNotifOpen}
                  aria-haspopup="dialog"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {adminUnreadCount > 0 ? (
                    <span className="adm-notif-badge">{formatNotifBadgeCount(adminUnreadCount)}</span>
                  ) : null}
                </button>
                <AttorneyNotificationDropdown
                  variant="admin"
                  open={adminNotifOpen}
                  onClose={() => setAdminNotifOpen(false)}
                  notifications={displayAdminNotifications}
                  onMarkAllRead={handleMarkAllAdminNotificationsRead}
                  isMarkingAllRead={isMarkingAdminNotificationsRead}
                />
              </div>
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

          <AdminRescheduleRequests adminUserId={adminUserId} />

          {/* Stat Cards Grid */}
          <section className="stats-row">
            {stats.map((stat, i) => (
              <div
                key={i}
                className={`stat-card clickable-card ${stat.alert ? 'stat-card--alert' : ''}`}
                onClick={() => (stat.page ? navigate(stat.page) : setActiveModal(stat.modal))}
              >
                {stat.alert ? <span className="stat-card__pulse" aria-hidden="true" /> : null}
                <div className="stat-label">
                  <span>{stat.label}</span>
                  <span style={{ color: stat.alert ? '#ef4444' : '#94a3b8' }}>{stat.icon}</span>
                </div>
                <h3 className="stat-number" style={stat.alert ? { color: '#ef4444' } : undefined}>
                  {stat.value}
                </h3>
                {stat.alert ? <span className="stat-card__alert-text">{stat.alertText}</span> : null}
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
                <button type="button" className="view-all" onClick={() => navigate('/consultations')}>View All</button>
              </div>
              <div className="list-stack">
                {recentRequests.length === 0 ? (
                  <p className="item-subtitle">No clients in the consultation queue yet. New bookings appear here in order (#1 = earliest booked).</p>
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
                <button type="button" className="view-all" onClick={() => navigate('/attorneys')}>View All</button>
              </div>
              <div className="list-stack">
                {topAttorneys.length === 0 ? (
                  <p className="item-subtitle">No attorneys registered yet.</p>
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

      <AdminSupportDrawer
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        onUnreadChange={setSupportUnreadCount}
      />

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
                <p>{(attorney.consultations ?? 0)} consultations</p>
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
                        <p><strong>Status:</strong> {notary.pickedUp ? 'âœ“ Claimed by Client' : 'âš  Awaiting Client Pickup'}</p>
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

const RequestItem = ({ queuePosition, name, atty, law, status, bookedLabel, age }) => (
  <div className="item-row">
    <div className="queue-pos-badge">#{queuePosition}</div>
    <div>
      <p className="item-title">{name}</p>
      <p className="item-subtitle">{atty}</p>
      <p className="item-subtitle">{law}</p>
    </div>
    <div className="item-meta-right">
      <div className={`status-tag ${status.toLowerCase().replace(' ', '')}`}>
        {status}
      </div>
      <p className="item-subtitle">{bookedLabel}</p>
      <p className="item-subtitle">{age}</p>
    </div>
  </div>
);

const AttorneyItem = ({ rank, name, imageUrl, law, consultations, finished = 0, inQueue = 0 }) => (
  <div className="item-row">
    <div className="attorney-rank-avatar">
      <img src={imageUrl} alt="" />
      <span className="attorney-rank-avatar__badge">#{rank}</span>
    </div>
    <div style={{ flex: 1 }}>
      <p className="item-title">{name}</p>
      <p className="item-subtitle">{law}</p>
    </div>
    <div className="item-meta-right">
      <p className="item-title">
        {consultations} consultation{consultations === 1 ? '' : 's'}
      </p>
      {finished > 0 ? (
        <p className="item-subtitle">{finished} finished</p>
      ) : consultations > 0 ? (
        <p className="item-subtitle">Scheduled / in progress</p>
      ) : null}
      {inQueue > 0 ? <p className="item-subtitle">{inQueue} in queue now</p> : null}
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
          <span className="bar-value" aria-hidden={value <= 0}>
            {value > 0 ? value : ''}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                height: `${value > 0 ? Math.max((value / safeMax) * 100, 8) : 0}%`,
              }}
            />
          </div>
          <span className="chart-axis-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;

