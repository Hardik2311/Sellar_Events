import React from 'react';
import ErrorScreen from './ErrorScreen';

// Vite content-hashes chunk filenames, so a hash a visitor's browser is still
// holding (an open tab spanning a deploy, or a stale cached index.html) can
// point at a JS file that no longer exists after the next deploy. That 404s
// the dynamic import(), and with nothing to catch the rejection React would
// otherwise unmount straight to a blank white screen. This boundary catches
// that specific failure and self-heals with a single automatic reload before
// falling back to a manual "please refresh" screen.
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Loading CSS chunk/i;

const RELOAD_GUARD_KEY = 'errorBoundary:reloadedForChunkError';

interface State {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled error in app tree:', error);

    if (CHUNK_ERROR_PATTERN.test(error.message)) {
      const alreadyTriedReload = sessionStorage.getItem(RELOAD_GUARD_KEY) === '1';
      if (!alreadyTriedReload) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
