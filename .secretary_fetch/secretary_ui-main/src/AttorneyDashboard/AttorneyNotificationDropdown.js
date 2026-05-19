function AttorneyNotificationDropdown({ open, notifications = [] }) {
  if (!open) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '52px',
      right: '0',
      width: '320px',
      background: '#f2e6d4',
      border: '1px solid #d4bfa3',
      borderRadius: '12px',
      boxShadow: '0 12px 30px rgba(30, 22, 12, 0.2)',
      padding: '12px',
      zIndex: 500
    }}>
      <h4 style={{ margin: 0, marginBottom: '8px', color: '#1a1a1a' }}>Notifications</h4>
      {notifications.length === 0 ? (
        <p style={{ margin: 0, color: '#5c5c5c' }}>No notifications</p>
      ) : (
        notifications.map((item, idx) => (
          <p key={item.id || idx} style={{ margin: '0 0 8px', color: '#353535' }}>
            {item.message || 'Notification'}
          </p>
        ))
      )}
    </div>
  );
}

export default AttorneyNotificationDropdown;
