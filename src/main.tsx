import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// We got this far, so the entry script loaded fine — clear the guard from
// index.html's inline script so a genuinely new failure on some future
// deploy still gets its own one-shot auto-reload instead of being silently
// skipped because of a stale sessionStorage flag from an earlier tab session.
// Matches the guard key set by the inline script at the top of index.html's <head>.
try {
  sessionStorage.removeItem('app:reloadedForEntryLoadError');
} catch {
  /* sessionStorage unavailable (e.g. private mode edge cases) — not fatal */
}