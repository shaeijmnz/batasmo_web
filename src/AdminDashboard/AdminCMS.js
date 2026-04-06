import { useEffect, useMemo, useState } from 'react'
import './AdminDetail.css'
import {
  CMS_SITE_DEFAULTS,
  fetchCmsAttorneyDirectory,
  fetchCmsSiteContent,
  saveCmsSiteContent,
  upsertCmsAttorneyDirectoryEntry,
} from '../lib/adminApi'

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
)

function AdminCMS({ onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')
  const [siteContent, setSiteContent] = useState({ ...CMS_SITE_DEFAULTS })
  const [attorneys, setAttorneys] = useState([])

  const [selectedUserId, setSelectedUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [expertiseFields, setExpertiseFields] = useState('')
  const [practiceAreas, setPracticeAreas] = useState('')
  const [biography, setBiography] = useState('')
  const [isPublished, setIsPublished] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadCms = async () => {
      try {
        const [contentRows, attorneyRows] = await Promise.all([
          fetchCmsSiteContent(),
          fetchCmsAttorneyDirectory(),
        ])

        if (!isMounted) return

        setSiteContent(contentRows)
        setAttorneys(attorneyRows)

        if (attorneyRows.length > 0) {
          const first = attorneyRows[0]
          setSelectedUserId(first.userId)
          setDisplayName(first.name || '')
          setProfileImageUrl(first.profileImageUrl || '')
          setExpertiseFields((first.expertiseFields || []).join(', '))
          setPracticeAreas((first.practiceAreas || []).join(', '))
          setBiography(first.biography || '')
          setIsPublished(first.isPublished !== false)
        }
      } catch (error) {
        if (isMounted) {
          setErrorText(error.message || 'Failed to load CMS records.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadCms()

    return () => {
      isMounted = false
    }
  }, [])

  const attorneyOptions = useMemo(
    () => attorneys.map((row) => ({ value: row.userId, label: `${row.name} (${row.email || 'no email'})` })),
    [attorneys],
  )

  const handleAttorneySelect = (userId) => {
    setSelectedUserId(userId)
    const selected = attorneys.find((row) => row.userId === userId)
    if (!selected) return

    setDisplayName(selected.name || '')
    setProfileImageUrl(selected.profileImageUrl || '')
    setExpertiseFields((selected.expertiseFields || []).join(', '))
    setPracticeAreas((selected.practiceAreas || []).join(', '))
    setBiography(selected.biography || '')
    setIsPublished(selected.isPublished !== false)
  }

  const handleSaveContent = async () => {
    setSaving(true)
    setErrorText('')
    setSuccessText('')

    try {
      await saveCmsSiteContent(siteContent)
      setSuccessText('Public website content saved successfully.')
    } catch (error) {
      setErrorText(error.message || 'Unable to save website content.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAttorney = async () => {
    if (!selectedUserId) {
      setErrorText('Please select an attorney record first.')
      setSuccessText('')
      return
    }

    setSaving(true)
    setErrorText('')
    setSuccessText('')

    try {
      await upsertCmsAttorneyDirectoryEntry({
        userId: selectedUserId,
        displayName: displayName.trim(),
        profileImageUrl: profileImageUrl.trim(),
        expertiseFields,
        practiceAreas,
        biography: biography.trim(),
        isPublished,
      })

      const refreshed = await fetchCmsAttorneyDirectory()
      setAttorneys(refreshed)
      setSuccessText('Attorney gallery entry saved successfully.')
    } catch (error) {
      setErrorText(error.message || 'Unable to save attorney gallery entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="adm-detail-page">
      <header className="adm-detail-header">
        <div className="adm-detail-header__left">
          <button className="adm-detail-back-btn" onClick={() => onNavigate('admin-home')} title="Go back">
            <BackIcon />
          </button>
          <h1 className="adm-detail-title">Content Management System</h1>
          <span className="adm-detail-count">Public Site Data</span>
        </div>
      </header>

      <main className="adm-detail-main">
        {loading ? <p>Loading CMS data...</p> : null}
        {errorText ? <p>{errorText}</p> : null}
        {successText ? <p>{successText}</p> : null}

        <div className="adm-detail-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Public Website Copy</h3>
          <div className="adm-detail-modal__row">
            <label>Hero Title</label>
            <input
              className="adm-detail-input"
              value={siteContent.hero_title || ''}
              onChange={(event) => setSiteContent((prev) => ({ ...prev, hero_title: event.target.value }))}
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>Hero Subtitle</label>
            <textarea
              className="adm-detail-input"
              value={siteContent.hero_subtitle || ''}
              onChange={(event) => setSiteContent((prev) => ({ ...prev, hero_subtitle: event.target.value }))}
              rows="3"
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>Services Section Title</label>
            <input
              className="adm-detail-input"
              value={siteContent.services_title || ''}
              onChange={(event) => setSiteContent((prev) => ({ ...prev, services_title: event.target.value }))}
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>Services Section Subtitle</label>
            <input
              className="adm-detail-input"
              value={siteContent.services_subtitle || ''}
              onChange={(event) => setSiteContent((prev) => ({ ...prev, services_subtitle: event.target.value }))}
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>Attorney Gallery Title</label>
            <input
              className="adm-detail-input"
              value={siteContent.attorneys_title || ''}
              onChange={(event) => setSiteContent((prev) => ({ ...prev, attorneys_title: event.target.value }))}
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>Attorney Gallery Subtitle</label>
            <input
              className="adm-detail-input"
              value={siteContent.attorneys_subtitle || ''}
              onChange={(event) => setSiteContent((prev) => ({ ...prev, attorneys_subtitle: event.target.value }))}
            />
          </div>
          <button className="adm-detail-btn" type="button" disabled={saving} onClick={handleSaveContent}>
            {saving ? 'Saving...' : 'Save Website Content'}
          </button>
        </div>

        <div className="adm-detail-card">
          <h3 style={{ marginBottom: 12 }}>Attorney Gallery Entries</h3>
          <div className="adm-detail-modal__row">
            <label>Select Attorney Account</label>
            <select
              className="adm-detail-input"
              value={selectedUserId}
              onChange={(event) => handleAttorneySelect(event.target.value)}
            >
              <option value="">Select attorney</option>
              {attorneyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="adm-detail-modal__row">
            <label>Display Name</label>
            <input className="adm-detail-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="adm-detail-modal__row">
            <label>Profile Image URL</label>
            <input
              className="adm-detail-input"
              value={profileImageUrl}
              onChange={(event) => setProfileImageUrl(event.target.value)}
              placeholder="/assets/attorneys/jeanne-luz-castillo-anarna.jpg"
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>Fields of Expertise (comma-separated)</label>
            <input
              className="adm-detail-input"
              value={expertiseFields}
              onChange={(event) => setExpertiseFields(event.target.value)}
              placeholder="Family Law, Corporate and Business Law"
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>Practice Areas (comma-separated)</label>
            <input
              className="adm-detail-input"
              value={practiceAreas}
              onChange={(event) => setPracticeAreas(event.target.value)}
              placeholder="General Litigation, Contracts, Land Registration"
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>Biography</label>
            <textarea
              className="adm-detail-input"
              value={biography}
              onChange={(event) => setBiography(event.target.value)}
              rows="5"
            />
          </div>
          <div className="adm-detail-modal__row">
            <label>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) => setIsPublished(event.target.checked)}
                style={{ marginRight: 8 }}
              />
              Publish in public gallery
            </label>
          </div>
          <button className="adm-detail-btn" type="button" disabled={saving} onClick={handleSaveAttorney}>
            {saving ? 'Saving...' : 'Save Attorney Gallery Entry'}
          </button>
        </div>
      </main>
    </div>
  )
}

export default AdminCMS
