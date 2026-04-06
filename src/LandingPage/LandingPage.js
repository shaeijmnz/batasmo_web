import { useEffect, useState } from 'react'
import './LandingPage.css';
import { fetchPublicLandingData } from '../lib/userApi';

/* ── SVG Icons ── */
const ScalesIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M5 21h14" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l3 9H0L3 6z" />
    <path d="M21 6l3 9h-6l3-9z" />
  </svg>
);

const DocumentIcon = ({ size = 24, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const PersonIcon = ({ size = 28, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ShieldIcon = ({ size = 28, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckCircleIcon = ({ size = 28, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const CheckIcon = ({ size = 16, color = '#f5a623' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = ({ size = 16, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const FALLBACK_ATTORNEYS = []

function LandingPage({ onNavigate }) {
  const [landingContent, setLandingContent] = useState({
    hero_title: 'Legal & Notarial Services Now in Your Pocket',
    hero_subtitle:
      'Experience the convenience of managing all your legal matters on the go. Expert advice and certified notarial services are now just a tap away.',
    services_title: 'Our Services',
    services_subtitle: 'Comprehensive legal solutions tailored for your business and personal needs.',
    attorneys_title: 'Meet Our Attorneys',
    attorneys_subtitle: 'Browse verified legal experts and choose the attorney that best matches your concern.',
  })
  const [attorneyGallery, setAttorneyGallery] = useState(FALLBACK_ATTORNEYS)

  useEffect(() => {
    let isMounted = true

    const loadLandingCms = async () => {
      try {
        const { content, attorneys } = await fetchPublicLandingData()
        if (!isMounted) return
        setLandingContent(content)
        if (Array.isArray(attorneys) && attorneys.length > 0) {
          setAttorneyGallery(attorneys)
        } else {
          setAttorneyGallery(FALLBACK_ATTORNEYS)
        }
      } catch {
        if (!isMounted) return
        setAttorneyGallery(FALLBACK_ATTORNEYS)
      }
    }

    loadLandingCms()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="bm-page">

      {/* ── NAVBAR ── */}
      <nav className="bm-nav">
        <div className="bm-nav__inner">
          <div className="bm-nav__logo">
            <ScalesIcon size={28} color="#f5a623" />
            <span>BatasMo</span>
          </div>
          <ul className="bm-nav__links">
            <li><a href="#home">Home</a></li>
            <li><a href="#attorneys">Attorneys</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#why">Why Choose Us</a></li>
            <li><a href="#download">Download</a></li>
          </ul>
          <div className="bm-nav__actions">
            <button className="bm-btn bm-btn--outline" onClick={() => onNavigate('login')}>Login</button>
            <button className="bm-btn bm-btn--gold" onClick={() => onNavigate('signup')}>Sign Up</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="bm-hero" id="home">
        <div className="bm-hero__content">
          <h1 className="bm-hero__title">{landingContent.hero_title}</h1>
          <p className="bm-hero__sub">
            {landingContent.hero_subtitle}
          </p>
          <button className="bm-btn bm-btn--dark bm-btn--lg">
            <DownloadIcon size={16} color="#fff" />
            Download Our Mobile App
          </button>
          <div className="bm-hero__badges"></div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="bm-services" id="services">
        <div className="bm-section-header">
          <h2>{landingContent.services_title}</h2>
          <p>{landingContent.services_subtitle}</p>
        </div>
        <div className="bm-services__grid">

          {/* Legal Consultation */}
          <div className="bm-card bm-card--white">
            <div className="bm-card__icon bm-card__icon--blue">
              <ScalesIcon size={22} color="#fff" />
            </div>
            <h3>Legal Consultation</h3>
            <p>Get professional legal advice from our experienced attorneys specialized in various areas of law including corporate, family, criminal, and civil matters.</p>
            <ul className="bm-checklist">
              <li><CheckIcon /><span>Expert legal counsel</span></li>
              <li><CheckIcon /><span>Flexible appointment scheduling</span></li>
              <li><CheckIcon /><span>Confidential consultations</span></li>
            </ul>
          </div>

          {/* Notarial Services */}
          <div className="bm-card bm-card--cream">
            <div className="bm-card__icon bm-card__icon--gold">
              <DocumentIcon size={22} color="#fff" />
            </div>
            <h3>Notarial Services</h3>
            <p>Fast and reliable notarization of your important documents. Upload your documents online and schedule a convenient time for notarization.</p>
            <ul className="bm-checklist">
              <li><CheckIcon /><span>Quick document processing</span></li>
              <li><CheckIcon /><span>Online document submission</span></li>
              <li><CheckIcon /><span>Secure and certified</span></li>
            </ul>
          </div>

        </div>
      </section>

      {/* ── ATTORNEY GALLERY ── */}
      <section className="bm-attorneys" id="attorneys">
        <div className="bm-section-header">
          <h2>{landingContent.attorneys_title}</h2>
          <p>{landingContent.attorneys_subtitle}</p>
        </div>
        <div className="bm-attorneys__grid">
          {attorneyGallery.length === 0 ? (
            <p>No approved attorneys to display yet.</p>
          ) : (
            attorneyGallery.map((attorney) => (
              <article className="bm-attorney-card" key={attorney.id}>
                <img src={attorney.image} alt={attorney.name} className="bm-attorney-card__photo" />
                <div className="bm-attorney-card__body">
                  <h3>{attorney.name}</h3>
                  <p className="bm-attorney-card__fee">Consultation: PHP {Number(attorney.consultationFee || 0).toLocaleString()}</p>
                  <p className="bm-attorney-card__meta">PRC/License: {attorney.prcId || 'Available on request'}</p>
                  <p className="bm-attorney-card__bio">{attorney.biography}</p>
                  <div className="bm-attorney-card__chips">
                    {(attorney.expertiseFields || []).slice(0, 4).map((field) => (
                      <span key={field}>{field}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* ── WHY CHOOSE US ── */}
      <section className="bm-why" id="why">
        <div className="bm-section-header">
          <h2>Why Choose Us</h2>
          <p>Trusted by thousands of clients nationwide for professional excellence.</p>
        </div>
        <div className="bm-why__grid">
          <div className="bm-why__item">
            <div className="bm-why__icon bm-why__icon--blue">
              <PersonIcon size={26} color="#fff" />
            </div>
            <h4>Expert Attorneys</h4>
            <p>Highly qualified and experienced legal professionals across all domains.</p>
          </div>
          <div className="bm-why__item">
            <div className="bm-why__icon bm-why__icon--gold">
              <ShieldIcon size={26} color="#fff" />
            </div>
            <h4>Secure &amp; Confidential</h4>
            <p>Your information is protected with the highest security standards and data encryption.</p>
          </div>
          <div className="bm-why__item">
            <div className="bm-why__icon bm-why__icon--blue">
              <CheckCircleIcon size={26} color="#fff" />
            </div>
            <h4>Fast Service</h4>
            <p>Quick response times and efficient document processing to save your valuable time.</p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bm-cta" id="download">
        <div className="bm-cta__phone">
          <div className="bm-cta__mockup">
            <ScalesIcon size={40} color="#f5a623" />
            <span className="bm-cta__app-name">BatasMo</span>
            <div className="bm-cta__app-divider" />
            <span className="bm-cta__app-tagline">Professional Legal &amp;<br />Notarial Services</span>
          </div>
        </div>
        <div className="bm-cta__body">
          <h2>Ready to Get Started?</h2>
          <p>Join hundreds of satisfied clients who trust us with their legal and notarial needs. Download the app today for free.</p>
          <button className="bm-btn bm-btn--gold bm-btn--lg">Download for Free</button>
          <div className="bm-hero__badges bm-cta__store-badges">
            <div className="bm-badge bm-badge--ios" title="iOS" />
            <div className="bm-badge bm-badge--play" title="Google Play" />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bm-footer">
        <div className="bm-footer__top">

          <div className="bm-footer__brand">
            <div className="bm-nav__logo">
              <ScalesIcon size={24} color="#f5a623" />
              <span>BatasMo</span>
            </div>
            <p>Professional legal consultation and notarial services at your fingertips. We are dedicated to providing accessible legal support for everyone.</p>
          </div>

          <div className="bm-footer__col">
            <h5>Quick Links</h5>
            <ul>
              <li><a href="#home">Home</a></li>
              <li><a href="#services">Services</a></li>
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#terms">Terms of Service</a></li>
            </ul>
          </div>

          <div className="bm-footer__col">
            <h5>Support</h5>
            <ul>
              <li><a href="#help">Help Center</a></li>
              <li><a href="#contact">Contact Us</a></li>
              <li><a href="#app-support">App Support</a></li>
              <li><a href="#faq">FAQs</a></li>
            </ul>
          </div>

          <div className="bm-footer__col bm-footer__contact">
            <h5>Contact</h5>
            <ul>
              <li>
                <span className="bm-footer__contact-icon">✉</span>
                info@batasmo.com
              </li>
              <li>
                <span className="bm-footer__contact-icon">📞</span>
                (555) 123-4567
              </li>
              <li>
                <span className="bm-footer__contact-icon">📍</span>
                123 Legal Street, Law City,<br />Metro Area 40001
              </li>
            </ul>
          </div>

        </div>

        <div className="bm-footer__bottom">
          <span>© 2024 BatasMo. All rights reserved.</span>
          <div className="bm-footer__socials">
            <a href="#linkedin">LinkedIn</a>
            <a href="#twitter">Twitter</a>
            <a href="#facebook">Facebook</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;
