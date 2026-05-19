import { Component } from 'react';

/**
 * Catches render errors so the whole app does not white-screen.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    const { error } = this.state;
    const { children } = this.props;

    if (!error) return children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          background: '#f5f1eb',
          color: '#0b0f19',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: 28,
            borderRadius: 16,
            background: '#fff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
          }}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 16px', color: '#4b5563', lineHeight: 1.5 }}>
            The page hit an unexpected error. Reload to continue testing.
          </p>
          {process.env.NODE_ENV !== 'production' && error?.message ? (
            <pre
              style={{
                fontSize: '0.75rem',
                overflow: 'auto',
                padding: 12,
                background: '#f8fafc',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              {error.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#152238',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload BatasMo
          </button>
        </div>
      </div>
    );
  }
}
