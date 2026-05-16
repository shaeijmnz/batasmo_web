import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchClientNotarialRequests } from '../lib/userApi';
import './ClientNotaryTracking.css';

const CLAIMED_MARKER = '[CLIENT_CLAIMED]';

const FILTERS = ['All', 'Active', 'Ready for Pickup', 'Completed'];

const WORKFLOW_STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'payment', label: 'Payment' },
  { key: 'processing', label: 'In Process' },
  { key: 'pickup', label: 'Ready for Pickup' },
  { key: 'done', label: 'Completed' },
];

function buildWorkflow(req) {
  const paid = req.payment === 'PAID';
  const pickedUp = String(req.notes || '').includes(CLAIMED_MARKER);
  const status = req.status;

  if (status === 'REJECTED') {
    return {
      phase: 'rejected',
      label: 'Declined',
      tone: 'danger',
      summary: 'This request was declined or cancelled. Contact support if you need help.',
      stepIndex: 0,
    };
  }

  if (!paid) {
    return {
      phase: 'mobile',
      label: 'Continue on mobile',
      tone: 'warn',
      summary: 'Finish payment, ID upload, and face verification in the BatasMo mobile app.',
      stepIndex: 0,
    };
  }

  if (status === 'COMPLETED' && pickedUp) {
    return {
      phase: 'done',
      label: 'Completed',
      tone: 'success',
      summary: 'You have picked up your notarized document. Thank you for using BatasMo.',
      stepIndex: 4,
    };
  }

  if (status === 'COMPLETED') {
    return {
      phase: 'pickup',
      label: 'Ready for Pickup',
      tone: 'success',
      summary: 'Your document is ready. Visit the office to collect your notarized papers.',
      stepIndex: 3,
    };
  }

  if (status === 'APPROVED') {
    return {
      phase: 'processing',
      label: 'In Process',
      tone: 'info',
      summary: 'Our team is preparing your notarized document.',
      stepIndex: 2,
    };
  }

  return {
    phase: 'queued',
    label: 'Payment received',
    tone: 'info',
    summary: 'Payment confirmed. Your request is in the admin queue and will be processed soon.',
    stepIndex: 1,
  };
}

function matchesFilter(req, filter) {
  const flow = buildWorkflow(req);
  if (filter === 'All') return true;
  if (filter === 'Active') {
    return !['done', 'rejected'].includes(flow.phase);
  }
  if (filter === 'Ready for Pickup') return flow.phase === 'pickup';
  if (filter === 'Completed') return flow.phase === 'done';
  return true;
}

function ClientNotaryTracking({ profile }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const loadRequests = useCallback(async () => {
    if (!profile?.id) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      const rows = await fetchClientNotarialRequests(profile.id);
      setRequests(rows);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load notary requests.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    let cancelled = false;

    const safeLoad = async () => {
      if (cancelled) return;
      setLoading(true);
      await loadRequests();
    };

    safeLoad();

    if (!profile?.id) {
      return () => {
        cancelled = true;
      };
    }

    const channel = supabase
      .channel(`client-notary-tracking:${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notarial_requests', filter: `client_id=eq.${profile.id}` },
        () => {
          if (!cancelled) loadRequests();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `client_id=eq.${profile.id}` },
        () => {
          if (!cancelled) loadRequests();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadRequests]);

  const stats = useMemo(() => {
    let active = 0;
    let pickup = 0;
    let done = 0;
    requests.forEach((req) => {
      const flow = buildWorkflow(req);
      if (flow.phase === 'pickup') pickup += 1;
      else if (flow.phase === 'done') done += 1;
      else if (flow.phase !== 'rejected') active += 1;
    });
    return { active, pickup, done, total: requests.length };
  }, [requests]);

  const visible = useMemo(
    () => requests.filter((req) => matchesFilter(req, activeFilter)),
    [requests, activeFilter],
  );

  return (
    <div className="cnt-page">
      <section className="cnt-hero">
        <div className="cnt-hero__copy">
          <p className="cnt-hero__eyebrow">Notary services</p>
          <h2>Track your notary requests</h2>
          <p>
            Requests started on the <strong>BatasMo mobile app</strong> appear here after you complete
            payment. Watch each step from processing to pickup.
          </p>
        </div>
        <div className="cnt-hero__mobile-card">
          <span className="cnt-hero__mobile-badge">New request?</span>
          <p>Use the mobile app to book notary, upload documents, verify your ID, and pay securely.</p>
        </div>
      </section>

      <section className="cnt-stats">
        {[
          { label: 'Active', value: stats.active, color: '#3b82f6' },
          { label: 'Ready for Pickup', value: stats.pickup, color: '#22c55e' },
          { label: 'Completed', value: stats.done, color: '#6366f1' },
          { label: 'Total', value: stats.total, color: '#1e3a8a' },
        ].map((item) => (
          <div key={item.label} className="cnt-stat">
            <span className="cnt-stat__value" style={{ color: item.color }}>{item.value}</span>
            <span className="cnt-stat__label">{item.label}</span>
          </div>
        ))}
      </section>

      <div className="cnt-filters">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`cnt-filter${activeFilter === filter ? ' cnt-filter--active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {loadError ? <p className="cnt-error">{loadError}</p> : null}

      {loading ? (
        <p className="cnt-loading">Loading your notary requests…</p>
      ) : visible.length === 0 ? (
        <div className="cnt-empty">
          <div className="cnt-empty__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <h3>No notary requests yet</h3>
          <p>
            When you submit a notary request on mobile and payment is completed, it will show up here
            with live status updates.
          </p>
        </div>
      ) : (
        <div className="cnt-list">
          {visible.map((req) => {
            const flow = buildWorkflow(req);
            const expanded = expandedId === req.id;
            const stepIndex = flow.stepIndex;

            return (
              <article key={req.id} className={`cnt-card cnt-card--${flow.tone}`}>
                <button
                  type="button"
                  className="cnt-card__header"
                  onClick={() => setExpandedId(expanded ? null : req.id)}
                >
                  <div className="cnt-card__title-wrap">
                    <h3>{req.service}</h3>
                    <p>Submitted {req.date}</p>
                  </div>
                  <span className={`cnt-card__badge cnt-card__badge--${flow.tone}`}>{flow.label}</span>
                </button>

                <p className="cnt-card__summary">{flow.summary}</p>

                <div className="cnt-stepper" aria-label="Request progress">
                  {WORKFLOW_STEPS.map((step, index) => {
                    const done = index <= stepIndex && flow.phase !== 'rejected';
                    const current = index === stepIndex;
                    return (
                      <div
                        key={step.key}
                        className={`cnt-step${done ? ' cnt-step--done' : ''}${current ? ' cnt-step--current' : ''}`}
                      >
                        <span className="cnt-step__dot">{done ? '✓' : index + 1}</span>
                        <span className="cnt-step__label">{step.label}</span>
                      </div>
                    );
                  })}
                </div>

                {expanded ? (
                  <div className="cnt-card__details">
                    <div className="cnt-detail-row">
                      <span>Payment</span>
                      <strong>{req.payment === 'PAID' ? 'Paid' : 'Pending (complete on mobile)'}</strong>
                    </div>
                    {req.fee ? (
                      <div className="cnt-detail-row">
                        <span>Fee</span>
                        <strong>{req.fee}</strong>
                      </div>
                    ) : null}
                    {req.file && req.file !== 'N/A' ? (
                      <div className="cnt-detail-row">
                        <span>Document</span>
                        <strong>{req.file.split('/').pop() || 'Attached'}</strong>
                      </div>
                    ) : null}
                    {flow.phase === 'mobile' ? (
                      <p className="cnt-card__mobile-hint">
                        Open the BatasMo app to upload your ID, complete face verification, and pay.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClientNotaryTracking;
