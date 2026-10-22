import React from 'react';
import ErrorScreen from './ErrorScreen';
import { handleAppError } from '../lib/appError';

// Catches errors outside the router (providers, Suspense, router setup).
// Errors thrown inside a route are caught by React Router first and shown
// via RouteError instead; both share handleAppError's chunk-reload logic.
interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    handleAppError(error);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen kind="crash" />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
