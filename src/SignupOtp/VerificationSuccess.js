import './VerificationSuccess.css';

const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M5 21h14" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" />
    <path d="M21 6l3 9h-6l3-9z" />
  </svg>
);

function VerificationSuccess({ onNavigate }) {
  return (
    <div className="vs-page">
      {/* Navbar */}
      <nav className="vs-nav">
        <div className="vs-nav__inner">
          <div className="vs-nav__logo" onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>
            <ScalesIcon size={28} color="#f5a623" />
            <span>BatasMo</span>
          </div>
          <ul className="vs-nav__links">
            <li><a href="#home" onClick={() => onNavigate('home')}>Home</a></li>
            <li><a href="#attorneys">Attorneys</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#about">About</a></li>
          </ul>
        </div>
      </nav>

      {/* Main */}
      <main className="vs-main">
        <div className="vs-card">
          <div className="vs-card__icon-wrap">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2 className="vs-card__title">Verification Successful!</h2>
          <p className="vs-card__sub">
            Your account has been successfully verified. You can<br />
            now access all our legal services.
          </p>

          <button className="vs-btn vs-btn--primary" onClick={() => onNavigate('home-logged')}>
            Go to Dashboard
          </button>

          <button className="vs-link" onClick={() => onNavigate('home')}>
            Return to Homepage
          </button>
        </div>
      </main>
    </div>
  );
}

export default VerificationSuccess;
