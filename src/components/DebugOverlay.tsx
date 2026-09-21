import { useState, useEffect, type CSSProperties } from 'react';
import { readDebugLog, clearDebugLog, isDebugEnabled, setDebugEnabled, type DebugLogEntry } from '../lib/debugLog';

const panelButtonStyle: CSSProperties = {
  padding: '10px 14px',
  minHeight: 44,
  touchAction: 'manipulation',
  background: 'rgba(255,255,255,0.08)',
  color: '#0f0',
  border: '1px solid #333',
  borderRadius: 6,
};

// Temporary diagnostic UI for the iOS Safari blank-content investigation.
// Tap the badge to see every boot/auth/reload event recorded on this device
// across reloads, without needing a Mac + Web Inspector. Rendered as a
// sibling of <App/> (not inside it) so it keeps working even if the app
// tree itself is the thing that's stuck or crashed. Remove once the bug is
// root-caused and fixed.
//
// Hidden by default (including on public/shared pages) — visit any page
// once with ?debug=1 to turn it on for this browser, ?debug=0 to turn it
// back off. The choice persists in localStorage so it survives reloads
// without needing the query param kept in the URL.
const DebugOverlay = () => {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);

  useEffect(() => {
    const param = new URLSearchParams(location.search).get('debug');
    if (param === '1') setDebugEnabled(true);
    else if (param === '0') setDebugEnabled(false);
    setEnabled(isDebugEnabled());
  }, []);

  useEffect(() => {
    if (open) setEntries(readDebugLog());
  }, [open]);

  if (!enabled) return null;

  const formatEntry = (e: DebugLogEntry) => {
    const d = new Date(e.ts);
    const time =
      d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      '.' + String(e.ts % 1000).padStart(3, '0');
    const dataStr = e.data ? ' ' + JSON.stringify(e.data) : '';
    return `${time}  ${e.event}${dataStr}`;
  };

  const handleCopy = async () => {
    const text = entries.map(formatEntry).join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API unavailable — user can still read/screenshot the panel
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open debug log"
        style={{
          position: 'fixed',
          // Vertically centered on the right edge — top/bottom corners can
          // sit under iOS Safari's own toolbar (which the user can pin to
          // either edge), swallowing taps before they ever reach the page.
          top: '50%',
          right: 8,
          transform: 'translateY(-50%)',
          zIndex: 2147483647,
          // 44x44 is Apple's documented minimum hit target (HIG) — the
          // previous 28px badge was both mispositioned and too small.
          width: 44,
          height: 44,
          borderRadius: 22,
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          fontSize: 18,
          border: 'none',
          lineHeight: '44px',
          textAlign: 'center',
          padding: 0,
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'rgba(255,255,255,0.3)',
          pointerEvents: 'auto',
        }}
      >
        🐞
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483647,
            background: 'rgba(0,0,0,0.92)',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: 11,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #333' }}>
            <button onClick={() => setEntries(readDebugLog())} style={panelButtonStyle}>Refresh</button>
            <button onClick={handleCopy} style={panelButtonStyle}>Copy</button>
            <button onClick={() => { clearDebugLog(); setEntries([]); }} style={panelButtonStyle}>Clear</button>
            <button onClick={() => setOpen(false)} style={{ ...panelButtonStyle, marginLeft: 'auto' }}>Close</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {entries.length === 0
              ? '(no entries yet)'
              : entries.slice().reverse().map((e, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>{formatEntry(e)}</div>
                ))}
          </div>
        </div>
      )}
    </>
  );
};

export default DebugOverlay;
