import React from 'react'
import './ConsultationWaitingPopup.css'

export default function ConsultationWaitingPopup({
  title,
  body,
  onClose,
  actionLabel,
  onAction,
}) {
  if (!title && !body) return null

  const handleAction = () => {
    if (typeof onAction === 'function') {
      onAction()
    }
    if (typeof onClose === 'function') {
      onClose()
    }
  }

  return (
    <div className="consult-wait-overlay" onClick={onClose} role="presentation">
      <div
        className="consult-wait-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consult-wait-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="consult-wait-title">{title}</h3>
        <p>{body}</p>
        <div className="consult-wait-actions">
          {actionLabel && typeof onAction === 'function' ? (
            <button type="button" className="consult-wait-btn consult-wait-btn--primary" onClick={handleAction}>
              {actionLabel}
            </button>
          ) : null}
          <button type="button" className="consult-wait-btn" onClick={onClose}>
            {actionLabel ? 'Dismiss' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
