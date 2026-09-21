import React from 'react';
import ErrorScreen from './ErrorScreen';
import { logDebug } from '../lib/debugLog';

// Vite content-hashes chunk filenames, so a hash a visitor's browser is still
// holding (an open tab spanning a deploy, or a stale cached index.html) can
// point at a JS file that no longer exists after the next deploy. That 404s
// the dynamic import(), and with nothing to catch the rejection React would
// otherwise unmount straight to a blank white screen. This boundary catches
// that specific failure and self-heals with a bounded number of automatic
// reloads before falling back to a manual "please refresh" screen.
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Loading CSS chunk/i;

// localStorage (not sessionStorage) — a per-tab flag is only as reliable as
// the tab's session actually surviving, and on iOS Safari that's exactly
// what's in question. A durable, time-windowed counter caps total reload
// attempts regardless of *why* a single-flag guard might not be holding, so
// the failure mode is "stop and show the manual screen" rather than "reload
// forever." The window (not a flat count) still lets a later, unrelated
// chunk error self-heal normally after the app has been open a while.
const RELOAD_GUARD_KEY = 'errorBoundary:chunkErrorReloads';
const RELOAD_WINDOW_MS = 60_000;
const MAX_RELOAD_ATTEMPTS = 2;

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

    const isChunkError = CHUNK_ERROR_PATTERN.test(error.message);
    if (!isChunkError) {
      logDebug('errorboundary:catch', { message: error.message, isChunkError });
      return;
    }

    let record: { count: number; firstTs: number } | null = null;
    try {
      const raw = localStorage.getItem(RELOAD_GUARD_KEY);
      record = raw ? JSON.parse(raw) : null;
    } catch {
      record = null;
    }

    const now = Date.now();
    if (!record || now - record.firstTs > RELOAD_WINDOW_MS) {
      record = { count: 0, firstTs: now };
    }

    const willReload = record.count < MAX_RELOAD_ATTEMPTS;
    logDebug('errorboundary:catch', {
      message: error.message,
      isChunkError,
      attemptsSoFar: record.count,
      willReload,
    });

    if (!willReload) return; // give up — render the manual ErrorScreen instead

    record.count += 1;
    try {
      localStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify(record));
    } catch {
      // can't persist the guard — reloading now would be unbounded, so skip it
      return;
    }
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
