import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Catches render errors so a bug in one screen doesn't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Hook for telemetry (ARCHITECTURE.md §3.6).
    console.error('ViolaHub render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'var(--font-body)' }}>
          <h3 className="m0">Something went wrong.</h3>
          <p className="rsub mt8">{this.state.error.message}</p>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
