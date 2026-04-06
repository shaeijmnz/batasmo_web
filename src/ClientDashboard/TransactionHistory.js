import { useEffect, useState } from 'react';
import './TransactionHistory.css';
import { fetchClientTransactions } from '../lib/userApi';

/* ── Icons ── */
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ReceiptIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="12" y2="16" />
  </svg>
);

/* Helpers */
const getTypeIcon = (type) => {
  if (type === 'consultation') {
    return (
      <div className="th-txn__icon th-txn__icon--consultation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="th-txn__icon th-txn__icon--notarial">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
    </div>
  );
};

const getStatusStyle = (status) => {
  switch (status) {
    case 'completed': return { bg: '#d1fae5', color: '#065f46', label: 'Completed' };
    case 'refunded': return { bg: '#fef3c7', color: '#92400e', label: 'Refunded' };
    case 'failed': return { bg: '#fef2f2', color: '#dc2626', label: 'Failed' };
    default: return { bg: '#f3f4f6', color: '#6b7280', label: status };
  }
};

const getMethodIcon = (method) => {
  if (method === 'GCash') {
    return <span className="th-method-badge th-method-badge--gcash">G</span>;
  }
  return <span className="th-method-badge th-method-badge--maya">M</span>;
};

function TransactionHistory({ onNavigate, profile }) {
  const [allTransactions, setAllTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadTransactions = async () => {
      if (!profile?.id) {
        if (isMounted) setAllTransactions([]);
        return;
      }

      try {
        const rows = await fetchClientTransactions(profile.id);
        if (!isMounted) return;
        setAllTransactions(rows);
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setAllTransactions([]);
        setLoadError(error.message || 'Unable to load transaction history right now.');
      }
    };

    loadTransactions();

    return () => {
      isMounted = false;
    };
  }, [profile]);

  const filters = ['All', 'Consultation', 'Notarial'];

  const filtered = allTransactions.filter(txn => {
    const matchesFilter = activeFilter === 'All' || txn.type === activeFilter.toLowerCase();
    const matchesSearch = !searchQuery ||
      txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.detail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.refNo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Summary stats
  const totalSpent = allTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + parseFloat(t.amount.replace(/[₱,]/g, '')), 0);
  const consultationCount = allTransactions.filter(t => t.type === 'consultation').length;
  const notarialCount = allTransactions.filter(t => t.type === 'notarial').length;

  return (
    <div className="th-page">
      {/* Topbar */}
      <header className="th-topbar">
        <div className="th-topbar__left">
          <div className="th-breadcrumb">
            <span onClick={() => onNavigate('home-logged')}>Dashboard</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            <span className="th-breadcrumb__current">Transaction History</span>
          </div>
        </div>
        <div className="th-topbar__right">
          <button className="th-icon-btn th-bell">
            <BellIcon />
            <span className="th-bell__dot" />
          </button>
          <div className="th-profile">
            <div className="th-profile__info">
              <span className="th-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
            <div className="th-avatar">{(profile?.full_name || 'CL').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="th-main">
        <div className="th-container">
          {loadError ? <p>{loadError}</p> : null}
          {/* Header */}
          <div className="th-header">
            <div className="th-header__text">
              <div className="th-header__title-row">
                <ReceiptIcon />
                <h1>Transaction History</h1>
              </div>
              <p>View all your payment records and receipts</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="th-summary">
            <div className="th-summary-card">
              <span className="th-summary-card__label">Total Spent</span>
              <span className="th-summary-card__value th-summary-card__value--total">₱{totalSpent.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              <span className="th-summary-card__sub">{allTransactions.length} transactions</span>
            </div>
            <div className="th-summary-card">
              <span className="th-summary-card__label">Consultations</span>
              <span className="th-summary-card__value th-summary-card__value--consul">{consultationCount}</span>
              <span className="th-summary-card__sub">Legal consultations paid</span>
            </div>
            <div className="th-summary-card">
              <span className="th-summary-card__label">Notarial Services</span>
              <span className="th-summary-card__value th-summary-card__value--notar">{notarialCount}</span>
              <span className="th-summary-card__sub">Notarial fees paid</span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="th-toolbar">
            <div className="th-filters">
              {filters.map(f => (
                <button
                  key={f}
                  className={`th-filter-btn ${activeFilter === f ? 'th-filter-btn--active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                  {f !== 'All' && (
                    <span className="th-filter-count">
                      {allTransactions.filter(t => t.type === f.toLowerCase()).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="th-search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Transaction List */}
          <div className="th-list">
            {/* Table Header */}
            <div className="th-list__header">
              <span className="th-list__col th-list__col--type">Type</span>
              <span className="th-list__col th-list__col--desc">Description</span>
              <span className="th-list__col th-list__col--date">Date</span>
              <span className="th-list__col th-list__col--method">Method</span>
              <span className="th-list__col th-list__col--amount">Amount</span>
              <span className="th-list__col th-list__col--status">Status</span>
            </div>

            {filtered.length === 0 ? (
              <div className="th-empty">
                <ReceiptIcon />
                <p>No transactions found</p>
              </div>
            ) : (
              filtered.map(txn => {
                const statusStyle = getStatusStyle(txn.status);
                const isExpanded = expandedId === txn.id;
                return (
                  <div key={txn.id} className={`th-txn ${isExpanded ? 'th-txn--expanded' : ''}`}>
                    <div className="th-txn__row" onClick={() => setExpandedId(isExpanded ? null : txn.id)}>
                      <span className="th-list__col th-list__col--type">
                        {getTypeIcon(txn.type)}
                      </span>
                      <span className="th-list__col th-list__col--desc">
                        <span className="th-txn__desc">{txn.description}</span>
                        <span className="th-txn__detail">{txn.detail}</span>
                      </span>
                      <span className="th-list__col th-list__col--date">
                        <span className="th-txn__date">{txn.date}</span>
                        <span className="th-txn__time">{txn.time}</span>
                      </span>
                      <span className="th-list__col th-list__col--method">
                        {getMethodIcon(txn.method)}
                        <span className="th-txn__method-name">{txn.method}</span>
                      </span>
                      <span className="th-list__col th-list__col--amount">
                        <span className={`th-txn__amount ${txn.status === 'refunded' ? 'th-txn__amount--refund' : ''}`}>
                          {txn.status === 'refunded' ? '+' : '-'}{txn.amount}
                        </span>
                      </span>
                      <span className="th-list__col th-list__col--status">
                        <span className="th-txn__status" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                          {statusStyle.label}
                        </span>
                      </span>
                      <span className="th-txn__chevron">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </div>

                    {/* Expanded Receipt */}
                    {isExpanded && (
                      <div className="th-txn__receipt">
                        <div className="th-receipt">
                          <div className="th-receipt__header">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z"/>
                            </svg>
                            <span>Payment Receipt</span>
                          </div>
                          <div className="th-receipt__body">
                            <div className="th-receipt__row">
                              <span>Transaction ID</span>
                              <span className="th-receipt__value th-receipt__value--mono">{txn.id}</span>
                            </div>
                            <div className="th-receipt__row">
                              <span>Reference No.</span>
                              <span className="th-receipt__value th-receipt__value--mono">{txn.refNo}</span>
                            </div>
                            <div className="th-receipt__row">
                              <span>Service</span>
                              <span className="th-receipt__value">{txn.description}</span>
                            </div>
                            <div className="th-receipt__row">
                              <span>Attorney / Provider</span>
                              <span className="th-receipt__value">{txn.detail.replace('Consultation with ', '').replace('Notarization by ', '')}</span>
                            </div>
                            <div className="th-receipt__row">
                              <span>Date & Time</span>
                              <span className="th-receipt__value">{txn.date} at {txn.time}</span>
                            </div>
                            <div className="th-receipt__row">
                              <span>Payment Method</span>
                              <span className="th-receipt__value">{txn.method}</span>
                            </div>
                            <div className="th-receipt__divider" />
                            <div className="th-receipt__row th-receipt__row--total">
                              <span>Amount {txn.status === 'refunded' ? 'Refunded' : 'Paid'}</span>
                              <span className="th-receipt__value">{txn.amount}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default TransactionHistory;
