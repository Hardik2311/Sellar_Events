// Temporary on-device diagnostic log for the iOS Safari blank-content
// investigation. Persists to localStorage (survives a full page
// reload/navigation, unlike sessionStorage or in-memory state) and is
// readable directly on the phone via DebugOverlay — no Mac/cable/Web
// Inspector needed. Remove once the bug is root-caused and fixed.
const STORAGE_KEY = 'debug:eventLog';
const MAX_ENTRIES = 300;

export interface DebugLogEntry {
  ts: number;
  event: string;
  data?: Record<string, unknown>;
}

export const logDebug = (event: string, data?: Record<string, unknown>) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries: DebugLogEntry[] = raw ? JSON.parse(raw) : [];
    entries.push({ ts: Date.now(), event, data });
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable/full — diagnostics are best-effort, never fatal
  }
};

export const readDebugLog = (): DebugLogEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearDebugLog = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

// Overlay UI visibility — separate from logging, which always runs so
// history isn't lost. Off by default; toggled via ?debug=1 / ?debug=0 and
// persisted so it survives reloads without needing the param kept in the URL.
const ENABLED_KEY = 'debug:enabled';

export const isDebugEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
};

export const setDebugEnabled = (enabled: boolean) => {
  try {
    if (enabled) localStorage.setItem(ENABLED_KEY, '1');
    else localStorage.removeItem(ENABLED_KEY);
  } catch {
    // ignore
  }
};
