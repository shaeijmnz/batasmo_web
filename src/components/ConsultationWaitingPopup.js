import React from 'react'
import './ConsultationWaitingPopup.css'

export default function ConsultationWaitingPopup({
  title,
  body,
  onClose,
  onGoToChatroom,
  goToChatroomLabel = 'Go to chatroom',
}) {
  if (!title && !body) return null

  const handleGoToChatroom = () => {
    if (typeof onGoToChatroom === 'function') {
      onGoToChatroom()
      return
    }
    onClose?.()
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
          <button type="button" className="consult-wait-btn consult-wait-btn--ghost" onClick={onClose}>
            Not now
          </button>
          <button type="button" className="consult-wait-btn consult-wait-btn--primary" onClick={handleGoToChatroom}>
            {goToChatroomLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
