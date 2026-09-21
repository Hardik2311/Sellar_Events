// src/firebase.ts
import { initializeApp } from "firebase/app";
import {
    initializeAuth,
    indexedDBLocalPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    inMemoryPersistence,
} from "firebase/auth";
import { initializeFirestore, enableNetwork, disableNetwork } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { logDebug } from "./debugLog";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID,
    measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export service instances
// Embedded in-app browsers (Instagram, Facebook, etc.) often run in a
// restricted storage context where IndexedDB access throws — plain getAuth()
// doesn't reliably fall back from that and can take the whole app down with
// it. initializeAuth with an explicit persistence chain degrades gracefully
// down to in-memory persistence instead.
//
// browserLocalPersistence (localStorage) is tried FIRST, not indexedDB —
// iOS Safari's IndexedDB has a well-documented history of getting stuck in
// a broken/closing state (WebKit bug 197050, multiple firebase-js-sdk
// issues), especially around backgrounding a tab. localStorage doesn't
// share that failure mode and is well-supported everywhere this app
// actually needs to run, so indexedDB is kept only as a later fallback.
export const auth = initializeAuth(app, {
    persistence: [
        browserLocalPersistence,
        indexedDBLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
    ],
});
// Forcing long-polling here was an earlier attempt at fixing the iOS Safari
// stuck-loading issue, based on a transport-layer theory that turned out to
// be wrong — the actual cause was an unrelated reload-loop bug (see
// main.tsx / index.html history). Forcing long-polling adds latency and
// never measurably helped, so left at Firestore's default (which prefers a
// streamed connection, falling back automatically as needed) — matching a
// known-working reference project's plain, unconfigured setup.
export const db = initializeFirestore(app, {});
// iOS Safari suspends a backgrounded tab's network activity without giving
// the held-open Firestore stream a clean close/error — confirmed on device:
// the channel works fine, then after locking the phone / switching away and
// back, it's left waiting forever on a connection the OS already silently
// killed (no error, no data, just stuck). The SDK's own reconnect logic
// doesn't reliably notice this, so explicitly tear the connection down on
// hide and rebuild it on return instead of trusting it to self-heal.
if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            logDebug('visibility:hidden');
            disableNetwork(db).catch((e) => logDebug('visibility:disableNetwork:error', { message: String(e) }));
        } else {
            logDebug('visibility:visible');
            enableNetwork(db).catch((e) => logDebug('visibility:enableNetwork:error', { message: String(e) }));
        }
    });
}

export const storage = getStorage(app);

// Cloud Functions and Analytics are only needed by a handful of specific
// flows (team-member management, signup, usage tracking) — dynamically
// importing their SDK modules instead of pulling them in at the top level
// keeps them out of the eager main bundle every page has to download and
// parse before it can render.
let functionsPromise: Promise<import('firebase/functions').Functions> | null = null;
export const getFunctionsInstance = async () => {
    if (!functionsPromise) {
        functionsPromise = import('firebase/functions').then(({ getFunctions }) => getFunctions(app));
    }
    return functionsPromise;
};

export let analytics: any = null;
import('firebase/analytics').then(({ getAnalytics, isSupported }) =>
    isSupported().then((supported) => {
        if (supported) analytics = getAnalytics(app);
    })
).catch(console.error);