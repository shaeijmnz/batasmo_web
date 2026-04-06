import { useEffect, useState } from 'react';
import './BookAppointment.css';
import { createAppointmentBooking, fetchBookableAttorneys, upsertClientProfiling } from '../lib/userApi';
import { isValidPhoneNumber, sanitizePhoneInput } from '../lib/validators';

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const BaDashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const BaCalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const BaMyApptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
  </svg>
);
const BaNotarialIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const BaAnnouncementIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const BaTransactionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const BaProfileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
// eslint-disable-next-line no-unused-vars
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ScaleSmIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" /><path d="M5 21h14" /><path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" /><path d="M21 6l3 9h-6l3-9z" />
  </svg>
);
const VerifiedIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#f5a623" stroke="none">
    <path d="M12 2l2.4 4.8 5.6.8-4 3.9.9 5.5L12 14.4l-4.9 2.6.9-5.5-4-3.9 5.6-.8z"/>
  </svg>
);

function BookAppointment({ onNavigate, profile }) {
  const LEGAL_CONCERNS = ['Family Relations', 'Property Ownership', 'Criminal Law', 'Contracts', 'Labor Law', 'Civil Law'];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attorneys, setAttorneys] = useState([]);
  const [selectedConcern, setSelectedConcern] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [selectedAttorney, setSelectedAttorney] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingAttorney, setBookingAttorney] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedAttorney, setConfirmedAttorney] = useState(null);
  const [bookingData, setBookingData] = useState({
    concern: '',
    slotId: '',
    paymentMethod: '',
    paymentCode: '',
    age: profile?.age ? String(profile.age) : '',
    address: profile?.address || '',
    guardianName: profile?.guardian_name || '',
    guardianContact: profile?.guardian_contact || '',
    guardianDetails: profile?.guardian_details || '',
    reason: '',
    file: null
  });
  const [confirmedSlot, setConfirmedSlot] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadAttorneys = async () => {
      try {
        const rows = await fetchBookableAttorneys({ concern: selectedConcern });
        if (!isMounted) return;
        setAttorneys(rows);
        setLoadError('');
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error.message || 'Unable to load attorneys.');
        setAttorneys([]);
      }
    };

    loadAttorneys();

    return () => {
      isMounted = false;
    };
  }, [selectedConcern]);

  const handleViewProfile = (attorney) => {
    setSelectedAttorney(attorney);
    setShowProfile(true);
  };

  const closeProfile = () => {
    setShowProfile(false);
    setTimeout(() => setSelectedAttorney(null), 300);
  };

  const handleBookNow = (attorney) => {
    setBookingAttorney(attorney);
    setBookingData((prev) => ({
      ...prev,
      concern: selectedConcern || attorney.specialty,
      slotId: '',
      paymentMethod: '',
      paymentCode: '',
      age: profile?.age ? String(profile.age) : '',
      address: profile?.address || '',
      guardianName: profile?.guardian_name || '',
      guardianContact: profile?.guardian_contact || '',
      guardianDetails: profile?.guardian_details || '',
      reason: '',
      file: null,
    }));
    setShowBooking(true);
  };

  const closeBooking = () => {
    setShowBooking(false);
    setTimeout(() => {
      setBookingAttorney(null);
      setBookingData({ concern: '', slotId: '', paymentMethod: '', paymentCode: '', age: '', address: '', guardianName: '', guardianContact: '', guardianDetails: '', reason: '', file: null });
    }, 300);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBookingData({ ...bookingData, file });
    }
  };

  const handleSubmitBooking = async () => {
    if (!profile?.id || !bookingAttorney?.id || !bookingData.slotId || !bookingData.paymentMethod) {
      setSubmitError('Please complete concern, slot, and payment details before submitting.');
      return;
    }

    if (!bookingData.paymentCode || bookingData.paymentCode.length < 4) {
      setSubmitError('Please provide a valid payment reference.');
      return;
    }

    const parsedAge = Number(bookingData.age);
    if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
      setSubmitError('Please provide your valid age before booking.');
      return;
    }
    if (!bookingData.address.trim()) {
      setSubmitError('Please provide your address before booking.');
      return;
    }
    if (parsedAge < 18) {
      if (!bookingData.guardianName.trim()) {
        setSubmitError('Guardian name is required for minors.');
        return;
      }
      if (!isValidPhoneNumber(bookingData.guardianContact)) {
        setSubmitError('Please provide a valid guardian contact number.');
        return;
      }
    }

    const selectedSlot = bookingAttorney.availableSlots.find((slot) => slot.id === bookingData.slotId);
    if (!selectedSlot) {
      setSubmitError('Selected slot is unavailable. Please choose another schedule.');
      return;
    }

    const slotStart = selectedSlot.startTime ? new Date(selectedSlot.startTime) : null;
    const slotDate = selectedSlot.rawDate || (!Number.isNaN(slotStart?.getTime()) ? slotStart.toISOString().slice(0, 10) : '');
    const slotTime =
      selectedSlot.rawTime ||
      (!Number.isNaN(slotStart?.getTime())
        ? `${String(((slotStart.getHours() + 11) % 12) + 1).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')} ${slotStart.getHours() >= 12 ? 'PM' : 'AM'}`
        : '');

    try {
      await upsertClientProfiling(profile.id, {
        age: parsedAge,
        address: bookingData.address.trim(),
        guardianName: bookingData.guardianName.trim(),
        guardianContact: bookingData.guardianContact.trim(),
        guardianDetails: bookingData.guardianDetails.trim(),
      });

      await createAppointmentBooking({
        clientId: profile.id,
        attorneyId: bookingAttorney.id,
        slotId: bookingData.slotId,
        title: bookingData.concern || bookingAttorney.specialty,
        notes: bookingData.reason,
        amount: bookingAttorney.amount,
        paymentMethod: bookingData.paymentMethod,
        paymentCode: bookingData.paymentCode,
        payload: {
          attorney_id: bookingAttorney.id,
          title: bookingData.concern || bookingAttorney.specialty,
          notes: bookingData.reason,
          scheduled_at: selectedSlot.startTime,
          slot_date: slotDate,
          slot_time: slotTime,
          amount: bookingAttorney.amount,
          duration_minutes: 60,
        },
      });

      setSubmitError('');
      setConfirmedAttorney(bookingAttorney);
      setConfirmedSlot(selectedSlot);
      setShowBooking(false);
      setShowConfirmation(true);
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit booking request.');
    }
  };

  const closeConfirmation = () => {
    setShowConfirmation(false);
    setTimeout(() => {
      setConfirmedAttorney(null);
      setConfirmedSlot(null);
      setBookingData({ concern: '', slotId: '', paymentMethod: '', paymentCode: '', age: '', address: '', guardianName: '', guardianContact: '', guardianDetails: '', reason: '', file: null });
    }, 300);
  };
  return (
    <div className="ba-page">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="ba-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`ba-sidebar ${sidebarOpen ? 'ba-sidebar--open' : ''}`}>
        <div className="ba-sidebar__logo">
          <ScalesIcon size={26} color="#f5a623" />
          <span>BatasMo</span>
        </div>
        <nav className="ba-sidebar__nav">
          {[
            { label: 'Dashboard',           icon: <BaDashboardIcon />,     nav: 'home-logged' },
            { label: 'Book Appointment',    icon: <BaCalendarIcon />,      nav: 'book-appointment' },
            { label: 'My Appointments',     icon: <BaMyApptIcon />,        nav: 'my-appointments' },
            { label: 'Notarial Requests',   icon: <BaNotarialIcon />,      nav: 'my-notarial-requests' },
            { label: 'Announcements',       icon: <BaAnnouncementIcon />,  nav: 'announcements' },
            { label: 'Transaction History', icon: <BaTransactionIcon />,   nav: 'transaction-history' },
            { label: 'Profile',             icon: <BaProfileIcon />,       nav: 'profile' },
          ].map(item => (
            <button
              key={item.label}
              className={`ba-sidebar__item ${item.label === 'Book Appointment' ? 'ba-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); if (item.nav) onNavigate(item.nav); }}
            >
              <span className="ba-sidebar__item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Topbar */}
      <header className="ba-topbar">
        <div className="ba-topbar__left">
          <button className="ba-icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><MenuIcon /></button>
          <div className="ba-breadcrumb">
            <span className="ba-breadcrumb__current">Book Appointment</span>
          </div>
        </div>
        <div className="ba-topbar__right">
          <button className="ba-icon-btn ba-bell">
            <BellIcon />
            <span className="ba-bell__dot" />
          </button>
          <div className="ba-profile">
            <div className="ba-profile__info">
              <span className="ba-profile__name">{profile?.full_name || 'Client'}</span>
            </div>
            <div className="ba-avatar">{(profile?.full_name || 'CL').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="ba-main">
        {loadError ? <p>{loadError}</p> : null}
        <div className="ba-header">
          <h1>Book an Appointment</h1>
          <p>Choose your legal concern first, then book from attorney slots that match and are currently available.</p>
        </div>

        <div className="ba-form-group" style={{ maxWidth: 420, marginBottom: 16 }}>
          <label className="ba-form-label">⚖ Legal Concern</label>
          <select
            className="ba-form-input"
            value={selectedConcern}
            onChange={(e) => setSelectedConcern(e.target.value)}
          >
            <option value="">All concerns</option>
            {LEGAL_CONCERNS.map((concern) => (
              <option key={concern} value={concern}>{concern}</option>
            ))}
          </select>
        </div>

        <div className="ba-grid">
          {attorneys.map((a, i) => (
            <div key={i} className="ba-card">
              <img src={a.img} alt={a.name} className="ba-card__photo" />
              <div className="ba-card__name">
                {a.name} <VerifiedIcon />
              </div>
              <div className="ba-card__specialty">
                <ScaleSmIcon /> {a.specialty}
              </div>
              <div className="ba-card__exp">PRC: {a.prcId || 'Not provided'}</div>
              <div className="ba-card__exp">{a.exp}</div>
              <div className="ba-card__rating">
                ★ {a.rating.toFixed(1)} · {a.availableSlots.length} slots open
              </div>
              <div className="ba-card__price">{a.price}</div>
              <button className="ba-btn ba-btn--dark" onClick={() => handleBookNow(a)}>Book Now</button>
              <button className="ba-btn ba-btn--ghost" onClick={() => handleViewProfile(a)}>View Profile</button>
            </div>
          ))}
        </div>
      </main>

      {/* Profile Modal */}
      {showProfile && selectedAttorney && (
        <div className="ba-modal-overlay" onClick={closeProfile}>
          <div className="ba-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ba-modal__header">
              <h2>Attorney Profile</h2>
              <button className="ba-modal__close" onClick={closeProfile}>✕</button>
            </div>
            
            <div className="ba-modal__content">
              <div className="ba-profile-header">
                <img src={selectedAttorney.img} alt={selectedAttorney.name} className="ba-profile-photo" />
                <div className="ba-profile-info">
                  <h3 className="ba-profile-name">
                    {selectedAttorney.name} <VerifiedIcon />
                  </h3>
                  <p className="ba-profile-specialty">
                    <ScaleSmIcon /> {selectedAttorney.specialty}
                  </p>
                  <p className="ba-profile-exp">⏱ {selectedAttorney.exp}</p>
                  <p className="ba-profile-rating">
                    ★ {selectedAttorney.rating.toFixed(1)}/5.0 Rating
                  </p>
                </div>
              </div>

              <div className="ba-profile-section">
                <h4 className="ba-profile-section-title">📄 Professional Biography</h4>
                <p className="ba-profile-bio">{selectedAttorney.bio}</p>
                <p className="ba-profile-details">{selectedAttorney.details}</p>
              </div>

              <div className="ba-profile-fee">
                <div className="ba-profile-fee-label">
                  💰 CONSULTATION FEE
                  <span className="ba-profile-fee-desc">Initial Legal Assessment (1 Hour)</span>
                </div>
                <div className="ba-profile-fee-amount">{selectedAttorney.price}</div>
              </div>

              <div className="ba-profile-actions">
                <button className="ba-btn ba-btn--dark ba-profile-btn" onClick={() => { closeProfile(); handleBookNow(selectedAttorney); }}>📅 Book Appointment</button>
                <button className="ba-btn ba-btn--ghost ba-profile-btn-secondary" onClick={closeProfile}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBooking && bookingAttorney && (
        <div className="ba-booking-overlay" onClick={closeBooking}>
          <div className="ba-booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ba-booking-header">
              <h2>Complete Your Booking</h2>
            </div>
            
            <div className="ba-booking-content">
              <div className="ba-booking-attorney-info">
                <div className="ba-booking-info-item">
                  <span className="ba-booking-label">Attorney:</span>
                  <span className="ba-booking-value">{bookingAttorney.name}</span>
                </div>
                <div className="ba-booking-info-item">
                  <span className="ba-booking-label">Specialty:</span>
                  <span className="ba-booking-value">{bookingAttorney.specialty}</span>
                </div>
                <div className="ba-booking-info-item">
                  <span className="ba-booking-label">Fee:</span>
                  <span className="ba-booking-value ba-booking-price">{bookingAttorney.price}</span>
                </div>
              </div>

              <div className="ba-booking-form">
                {submitError ? <p>{submitError}</p> : null}
                <div className="ba-form-group">
                  <label className="ba-form-label">⚖ Legal Concern</label>
                  <select
                    className="ba-form-input"
                    value={bookingData.concern}
                    onChange={(e) => setBookingData({ ...bookingData, concern: e.target.value })}
                  >
                    <option value="">Select concern</option>
                    {LEGAL_CONCERNS.map((concern) => (
                      <option key={concern} value={concern}>{concern}</option>
                    ))}
                  </select>
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">⏰ Select Available Slot</label>
                  <select
                    className="ba-form-input"
                    value={bookingData.slotId}
                    onChange={(e) => setBookingData({ ...bookingData, slotId: e.target.value })}
                  >
                    <option value="">Select slot</option>
                    {bookingAttorney.availableSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>{slot.dateLabel} · {slot.timeLabel}</option>
                    ))}
                  </select>
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">💳 Payment Method</label>
                  <select
                    className="ba-form-input"
                    value={bookingData.paymentMethod}
                    onChange={(e) => setBookingData({ ...bookingData, paymentMethod: e.target.value })}
                  >
                    <option value="">Select payment method</option>
                    <option value="GCash">GCash</option>
                    <option value="Maya">Maya</option>
                  </select>
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">👤 Age</label>
                  <input
                    type="number"
                    className="ba-form-input"
                    min="1"
                    value={bookingData.age}
                    onChange={(e) => setBookingData({ ...bookingData, age: e.target.value.replace(/\D/g, '') })}
                    placeholder="Enter your age"
                  />
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">📍 Address</label>
                  <input
                    type="text"
                    className="ba-form-input"
                    value={bookingData.address}
                    onChange={(e) => setBookingData({ ...bookingData, address: e.target.value })}
                    placeholder="Enter your full address"
                  />
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">🧑‍⚖ Guardian Name (if minor)</label>
                  <input
                    type="text"
                    className="ba-form-input"
                    value={bookingData.guardianName}
                    onChange={(e) => setBookingData({ ...bookingData, guardianName: e.target.value })}
                    placeholder="Required only if below 18"
                  />
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">📞 Guardian Contact (if minor)</label>
                  <input
                    type="text"
                    className="ba-form-input"
                    value={bookingData.guardianContact}
                    onChange={(e) => setBookingData({ ...bookingData, guardianContact: sanitizePhoneInput(e.target.value) })}
                    placeholder="11-digit contact number"
                  />
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">📝 Guardian Details (if minor)</label>
                  <textarea
                    className="ba-form-textarea"
                    value={bookingData.guardianDetails}
                    onChange={(e) => setBookingData({ ...bookingData, guardianDetails: e.target.value })}
                    rows="2"
                    placeholder="Optional relationship/details"
                  />
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">🧾 Payment Reference</label>
                  <input
                    type="text"
                    className="ba-form-input"
                    value={bookingData.paymentCode}
                    onChange={(e) => setBookingData({ ...bookingData, paymentCode: e.target.value })}
                    placeholder="Enter payment reference"
                  />
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">Reason for Consultation</label>
                  <textarea
                    className="ba-form-textarea"
                    placeholder="Please briefly describe your legal matter..."
                    value={bookingData.reason}
                    onChange={(e) => setBookingData({ ...bookingData, reason: e.target.value })}
                    rows="4"
                  />
                </div>

                <div className="ba-form-group">
                  <label className="ba-form-label">📎 Upload Supporting Documents (Optional)</label>
                  <div className="ba-file-upload">
                    <input
                      type="file"
                      id="file-input"
                      className="ba-file-input"
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.txt,.jpg,.png"
                    />
                    <label htmlFor="file-input" className="ba-file-upload-label">
                      <span className="ba-upload-icon">📤</span>
                      <span className="ba-upload-text">
                        {bookingData.file ? (
                          <>
                            ✓ <strong>{bookingData.file.name}</strong>
                          </>
                        ) : (
                          <>Click to upload or drag & drop<br /><span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>PDF, DOC, DOCX, TXT, JPG, PNG</span></>
                        )}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="ba-payment-note">
                  <span className="ba-note-icon">ℹ️</span>
                  <span className="ba-note-text">Payment is processed first. Your consultation is confirmed instantly and the selected slot is blocked right after successful payment.</span>
                </div>

                <div className="ba-booking-actions">
                  <button className="ba-booking-btn ba-booking-btn--submit" onClick={handleSubmitBooking}>Confirm & Pay</button>
                  <button className="ba-booking-btn ba-booking-btn--cancel" onClick={closeBooking}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && confirmedAttorney && (
        <div className="ba-confirmation-overlay" onClick={closeConfirmation}>
          <div className="ba-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ba-confirmation-content">
              <div className="ba-confirmation-icon-wrapper">
                <div className="ba-confirmation-icon">✓</div>
              </div>
              
              <h2 className="ba-confirmation-title">Booking Confirmed!</h2>
              
              <div className="ba-confirmation-message">
                <p>Your consultation with <strong>{confirmedAttorney.name}</strong> has been confirmed and paid successfully.</p>
              </div>

              <div className="ba-confirmation-what-next">
                <h4 className="ba-what-next-title">What Happens Next?</h4>
                <ul className="ba-what-next-list">
                  <li>Your appointment status is now <strong>Approved</strong></li>
                  <li>The selected schedule slot is automatically blocked from further bookings</li>
                  <li>You can review this consultation under My Appointments</li>
                  <li>You will still receive reminders and announcements in your dashboard</li>
                </ul>
              </div>

              <div className="ba-booking-details-section">
                <h4 className="ba-details-title">Booking Details:</h4>
                <div className="ba-details-list">
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Attorney:</span>
                    <span className="ba-detail-value">{confirmedAttorney.name}</span>
                  </div>
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Specialty:</span>
                    <span className="ba-detail-value">{confirmedAttorney.specialty}</span>
                  </div>
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Date:</span>
                    <span className="ba-detail-value">{confirmedSlot?.dateLabel || 'Not selected'}</span>
                  </div>
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Time:</span>
                    <span className="ba-detail-value">{confirmedSlot?.timeLabel || 'Not selected'}</span>
                  </div>
                  <div className="ba-detail-item">
                    <span className="ba-detail-label">Fee:</span>
                    <span className="ba-detail-value ba-detail-fee">{confirmedAttorney.price}</span>
                  </div>
                </div>
              </div>

              <button className="ba-confirmation-btn" onClick={() => onNavigate('my-appointments')}>Go to My Appointments</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat FAB */}
      <button className="ba-chat-fab" title="AI Assistant">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z"/>
          <circle cx="9" cy="13" r="1" fill="#fff" stroke="none"/>
          <circle cx="15" cy="13" r="1" fill="#fff" stroke="none"/>
          <path d="M9 17s1 1 3 1 3-1 3-1"/>
        </svg>
      </button>
    </div>
  );
}

export default BookAppointment;
