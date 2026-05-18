import React from 'react'
import './ConsultationWaitingPopup.css'

export default function ConsultationWaitingPopup({ title, body, onClose }) {
  if (!title && !body) return null

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
          <button type="button" className="consult-wait-btn" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
