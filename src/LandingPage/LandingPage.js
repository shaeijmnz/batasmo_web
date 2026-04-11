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
    <div className="lp-page">
      <nav className="lp-nav">
        <div className="lp-shell lp-nav-shell">
          <div className="lp-brand-wrap">
            <img src="/logo/logo.jpg" alt="BatasMo" className="lp-brand-logo" />
            <h2 className="lp-brand">BatasMo</h2>
          </div>

          <div className="lp-nav-links">
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#attorneys">Attorneys</a>
          </div>

          <div className="lp-nav-buttons">
            <button className="lp-btn lp-btn-ghost" onClick={() => onNavigate('login')}>Login</button>
            <button className="lp-btn lp-btn-gold" onClick={() => onNavigate('signup')}>Sign Up</button>
          </div>
        </div>
      </nav>

      <header className="lp-hero" id="home">
        <div className="lp-overlay" />
        <div className="lp-shell lp-hero-content">
          <p className="lp-eyebrow">LEGAL HELP ON DEMAND</p>
          <h1>{landingContent.hero_title}</h1>
          <p>{landingContent.hero_subtitle}</p>
          <div className="lp-hero-buttons">
            <button className="lp-btn lp-btn-gold" onClick={() => onNavigate('login')}>Book Consultation</button>
            <button className="lp-btn lp-btn-outline">
              <DownloadIcon size={16} color="#ffffff" />
              Download Our App
            </button>
          </div>
        </div>
      </header>

      <section className="lp-values">
        <div className="lp-shell lp-value-grid">
          <article className="lp-value-card">
            <p className="lp-value-icon"><ShieldIcon size={16} color="#f5d074" /></p>
            <h3>Reliable</h3>
            <p>Consistent legal outcomes and timely updates from every engagement.</p>
          </article>
          <article className="lp-value-card">
            <p className="lp-value-icon"><ScalesIcon size={16} color="#f5d074" /></p>
            <h3>Trustworthy</h3>
            <p>Verified professionals, transparent fees, and clear legal guidance.</p>
          </article>
          <article className="lp-value-card">
            <p className="lp-value-icon"><CheckCircleIcon size={16} color="#f5d074" /></p>
            <h3>Committed</h3>
            <p>Focused support for consultations, documentation, and notarization.</p>
          </article>
        </div>
      </section>

      <section className="lp-legacy" id="about">
        <div className="lp-shell lp-legacy-grid">
          <div className="lp-legacy-panel">
            <p className="lp-eyebrow">ABOUT BATASMO</p>
            <h2>Accessible legal support for every Filipino.</h2>
            <p>
              We connect you with verified attorneys and trusted notarial services through one secure platform.
              Whether you need legal consultation or document notarization, BatasMo makes each step clear,
              convenient, and mobile-first.
            </p>
            <a href="#services">Explore services</a>
          </div>
          <blockquote className="lp-legacy-quote">
            "Your legal needs deserve speed, clarity, and confidence."
          </blockquote>
        </div>
      </section>

      <section className="lp-services" id="services">
        <div className="lp-shell">
          <p className="lp-eyebrow">AREAS OF EXPERTISE</p>
          <h2>{landingContent.services_title}</h2>
          <p className="lp-services-subtitle">{landingContent.services_subtitle}</p>

          <div className="lp-services-grid">
            <article className="lp-featured-service">
              <span className="lp-tag">PREMIER SERVICE</span>
              <h3>Notarial Services</h3>
              <p>Submit documents digitally and coordinate with verified legal professionals for fast processing.</p>
              <a href="#attorneys">Meet our attorneys</a>
            </article>

            <div className="lp-service-cards">
              <article className="lp-service-card">
                <h3>Legal Consultation</h3>
                <p>Expert legal advice across business, labor, family, and civil concerns.</p>
              </article>
              <article className="lp-service-card">
                <h3>Case Strategy</h3>
                <p>Get structured recommendations and practical action plans.</p>
              </article>
              <article className="lp-service-card">
                <h3>Document Review</h3>
                <p>Identify risks and improve legal documents before signing.</p>
              </article>
              <article className="lp-service-card">
                <h3>Legal Referrals</h3>
                <p>Find the right specialist based on your legal situation.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-attorneys" id="attorneys">
        <div className="lp-shell">
          <h2>{landingContent.attorneys_title}</h2>
          <p className="lp-attorneys-subtitle">{landingContent.attorneys_subtitle}</p>
          <div className="lp-partners-divider" />

          <div className="lp-partners-grid">
            {attorneyGallery.length === 0 ? (
              <p className="lp-empty-attorneys">No approved attorneys to display yet.</p>
            ) : (
              attorneyGallery.map((attorney) => (
                <article className="lp-partner-card" key={attorney.id}>
                  <div className="lp-partner-image-wrap">
                    <img
                      src={attorney.image}
                      alt={attorney.name}
                      className="lp-partner-image"
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.onerror = null
                        event.currentTarget.src = '/partners/allen.svg'
                      }}
                    />
                  </div>

                  <div className="lp-partner-content">
                    <h3>{attorney.name}</h3>

                    {(attorney.expertiseFields || []).length > 0 ? (
                      <ul>
                        {(attorney.expertiseFields || []).slice(0, 4).map((field) => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                    ) : null}

                    <p>{attorney.biography}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="lp-cta" id="download">
        <div className="lp-shell">
          <blockquote>
            Legal counsel should be as personal as it is professional.
          </blockquote>
          <p className="lp-cta-name">BatasMo Legal Network</p>
          <p className="lp-cta-role">TRUSTED DIGITAL LEGAL PLATFORM</p>

          <div className="lp-cta-panel">
            <h2>Need legal help? Schedule a consultation today.</h2>
            <p>
              Start with a secure profile, connect with licensed attorneys, and access legal support wherever you are.
            </p>
            <div className="lp-cta-buttons">
              <button className="lp-btn lp-btn-gold" onClick={() => onNavigate('signup')}>Create Account</button>
              <button className="lp-btn lp-btn-outline-dark" onClick={() => onNavigate('login')}>Log In</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer" id="contact">
        <div className="lp-shell lp-footer-grid">
          <div>
            <h2 className="lp-brand">BatasMo</h2>
          </div>
          <div>
            <h4>PRACTICE AREAS</h4>
            <a href="#services">Notarial Services</a>
            <a href="#services">Civil Law</a>
            <a href="#services">Corporate Law</a>
            <a href="#services">Labor Law</a>
          </div>
          <div>
            <h4>CONTACT INFO</h4>
            <p>327 Aguinaldo Highway Lalaan 1st Silang Cavite 4118</p>
            <p>(046) 413 23 93</p>
            <p>info@batasmo.com</p>
          </div>
          <div>
            <h4>QUICK LINKS</h4>
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#attorneys">Attorneys</a>
            <a href="#download">Get Started</a>
          </div>
        </div>
        <div className="lp-shell lp-footer-bottom">
          <p>Copyright 2026 BatasMo. All rights reserved.</p>
          <p>Reliable | Trustworthy | Committed</p>
        </div>
      </footer>

      <button className="lp-floating-cta" onClick={() => onNavigate('login')}>Book Consultation</button>
    </div>
  );
}

export default LandingPage;
