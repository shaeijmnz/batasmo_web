import React from 'react'
import './ConsultationWaitingPopup.css'

export default function ConsultationWaitingPopup({
  title,
  body,
  onClose,
  actionLabel,
  onAction,
  closeLabel,
  closeOnBackdrop = true,
}) {
  if (!title && !body) return null

  const hasAction = Boolean(actionLabel) && typeof onAction === 'function'

  return (
    <div
      className="consult-wait-overlay"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
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
          {hasAction ? (
            <button type="button" className="consult-wait-btn consult-wait-btn--primary" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          <button type="button" className="consult-wait-btn" onClick={onClose}>
            {closeLabel || (hasAction ? 'Dismiss' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
