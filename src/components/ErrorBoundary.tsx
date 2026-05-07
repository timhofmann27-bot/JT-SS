import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; componentStack: string | null; }

export class AppErrorBoundary extends React.Component<Props, State> {
  override state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main style={{
          minHeight: '100svh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '2rem',
          background: '#121212', color: '#fff', fontFamily: 'system-ui, sans-serif',
          textAlign: 'center', gap: '1rem',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#E91429', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold',
          }}>!</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Etwas ist schiefgegangen</h1>
          <p style={{ color: '#a0a0a0', fontSize: '0.875rem', maxWidth: '320px' }}>
            Die App konnte nicht geladen werden. Bitte versuche die Seite neu zu laden.
          </p>
          {this.state.error && (
            <pre style={{
              marginTop: '1rem', padding: '1rem', background: '#282828',
              borderRadius: 8, fontSize: '0.75rem', color: '#E91429',
              maxWidth: '90vw', overflow: 'auto', textAlign: 'left',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {this.state.error.message}
              {this.state.error.stack && (
                <>{'\n\n'}{this.state.error.stack}</>
              )}
              {this.state.componentStack && (
                <>{'\n\nComponent Stack:'}{this.state.componentStack}</>
              )}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem', padding: '0.75rem 2rem', borderRadius: 999,
              background: '#FF6B35', color: '#000', fontWeight: 700, fontSize: '0.9rem',
              border: 'none', cursor: 'pointer',
            }}
          >
            Neu laden
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
