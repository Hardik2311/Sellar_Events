import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DebugOverlay from './components/DebugOverlay'
import ErrorBoundary from './components/ErrorBoundary'
import { logDebug } from './lib/debugLog'

// Temporary — records how this load started (fresh navigation vs. reload
// vs. back/forward) before React even mounts, so a repeated-reload loop
// shows up in the persisted log regardless of what happens next.
const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
logDebug('app:boot', {
  navType: navEntry?.type ?? 'unknown',
  visibility: document.visibilityState,
  referrer: document.referrer || null,
  path: location.pathname,
});

createRoot(document.getElementById('root')!).render(
  <>
    {/* Outside ErrorBoundary on purpose — stays visible/usable even if the
        boundary below is showing its fallback screen. */}
    <DebugOverlay />
    <ErrorBoundary>
      <StrictMode>
        <App />
      </StrictMode>
    </ErrorBoundary>
  </>,
)