import { Component } from 'react';

/**
 * Keeps consultation chat usable when a child (e.g. VideoCallModal) throws.
 */
export default class ConsultationChatErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ConsultationChatErrorBoundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    const { children, onReset } = this.props;

    if (!error) return children;

    return (
      <div className="am-chat-fallback" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Chat ran into a problem</p>
        <p style={{ margin: '0 0 16px', color: '#6b7280', lineHeight: 1.5 }}>
          {error?.message || 'Something failed while loading the consultation room.'}
        </p>
        <button
          type="button"
          className="am-video-call-btn"
          onClick={() => {
            this.setState({ error: null });
            if (typeof onReset === 'function') onReset();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
