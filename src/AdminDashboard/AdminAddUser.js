import { useState } from 'react';
import './AdminDetail.css';
import { supabase } from '../lib/supabaseClient';
import { isValidEmail, VALID_EMAIL_MESSAGE } from '../lib/validators';
import { upsertCmsAttorneyDirectoryEntry } from '../lib/adminApi';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

function AdminAddUser({ onNavigate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [prcId, setPrcId] = useState('');
  const [expertiseFields, setExpertiseFields] = useState('');
  const [practiceAreas, setPracticeAreas] = useState('');
  const [yearsExperience, setYearsExperience] = useState('0');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [biography, setBiography] = useState('');
  const [consultationFee, setConsultationFee] = useState('0');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !prcId.trim()) {
      setErrorMessage('Please complete all required fields.');
      setStatusMessage('');
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMessage(VALID_EMAIL_MESSAGE);
      setStatusMessage('');
      return;
    }

    const parsedFee = Number(consultationFee || 0);
    const parsedYears = Number(yearsExperience || 0);
    const expertiseArray = expertiseFields
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const practiceAreaArray = practiceAreas
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const specialtyArray = [...new Set([...expertiseArray, ...practiceAreaArray])];

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        role: 'Attorney',
        updated_at: new Date().toISOString(),
      })
      .eq('email', email.trim().toLowerCase())
      .select('id')
      .single();

    if (error) {
      setErrorMessage(error.message || 'Failed to update user profile.');
      setStatusMessage('');
      return;
    }

    if (!data?.id) {
      setErrorMessage('No existing auth user found for this email. Ask the user to sign up first.');
      setStatusMessage('');
      return;
    }

    const { error: attorneyError } = await supabase
      .from('attorney_profiles')
      .upsert(
        {
          user_id: data.id,
          prc_id: prcId.trim(),
          specialties: specialtyArray,
          years_experience: Number.isFinite(parsedYears) ? parsedYears : 0,
          bio: biography.trim() || null,
          consultation_fee: Number.isFinite(parsedFee) ? parsedFee : 0,
          is_verified: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (attorneyError) {
      setErrorMessage(attorneyError.message || 'Failed to prepare attorney profile.');
      setStatusMessage('');
      return;
    }

    await upsertCmsAttorneyDirectoryEntry({
      userId: data.id,
      displayName: name.trim(),
      profileImageUrl: profileImageUrl.trim(),
      expertiseFields: expertiseArray,
      practiceAreas: practiceAreaArray,
      biography: biography.trim(),
      isPublished: true,
    });

    setStatusMessage('Attorney account details saved successfully.');
    setErrorMessage('');
    setName('');
    setEmail('');
    setPrcId('');
    setExpertiseFields('');
    setPracticeAreas('');
    setYearsExperience('0');
    setProfileImageUrl('');
    setBiography('');
    setConsultationFee('0');
  };

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-users')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Add Attorney Account</h1>
        </div>
      </header>

      <main className="adm-detail-main">
        <div className="adm-detail-card">
          <p style={{ marginBottom: 12 }}>
            Use this admin-only form to promote an existing user profile to Attorney and publish complete front-end gallery details.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="adm-detail-modal__row">
              <label>Full Name</label>
              <input className="adm-detail-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full name" />
            </div>
            <div className="adm-detail-modal__row">
              <label>Email</label>
              <input className="adm-detail-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email" type="email" />
            </div>
            <div className="adm-detail-modal__row">
              <label>PRC / License ID</label>
              <input className="adm-detail-input" value={prcId} onChange={(e) => setPrcId(e.target.value)} placeholder="Enter PRC or license ID" />
            </div>
            <div className="adm-detail-modal__row">
              <label>Fields of Expertise</label>
              <input className="adm-detail-input" value={expertiseFields} onChange={(e) => setExpertiseFields(e.target.value)} placeholder="Family Law, Corporate and Business Law" />
            </div>
            <div className="adm-detail-modal__row">
              <label>Practice Areas</label>
              <input className="adm-detail-input" value={practiceAreas} onChange={(e) => setPracticeAreas(e.target.value)} placeholder="General Litigation, Labor Law, Taxation" />
            </div>
            <div className="adm-detail-modal__row">
              <label>Years of Experience</label>
              <input className="adm-detail-input" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value.replace(/[^0-9]/g, ''))} placeholder="5" />
            </div>
            <div className="adm-detail-modal__row">
              <label>Consultation Fee (PHP)</label>
              <input className="adm-detail-input" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="1500" />
            </div>
            <div className="adm-detail-modal__row">
              <label>Profile Image URL</label>
              <input className="adm-detail-input" value={profileImageUrl} onChange={(e) => setProfileImageUrl(e.target.value)} placeholder="/assets/attorneys/jeanne-luz-castillo-anarna.jpg" />
            </div>
            <div className="adm-detail-modal__row">
              <label>Biography</label>
              <textarea className="adm-detail-input" value={biography} onChange={(e) => setBiography(e.target.value)} rows="5" placeholder="Enter professional biography and background" />
            </div>
            {statusMessage ? <p>{statusMessage}</p> : null}
            {errorMessage ? <p>{errorMessage}</p> : null}
            <button className="adm-detail-btn" type="submit">Save Attorney Account</button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default AdminAddUser;
