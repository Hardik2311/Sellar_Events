// src/firebase.ts
import { initializeApp } from "firebase/app";
import {
    initializeAuth,
    indexedDBLocalPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    inMemoryPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getSubdomain } from "./subdomain";

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
// Storefront pages (a merchant subdomain, or a /public/... link) skip
// IndexedDB. On iOS (Safari, and in-app browsers like Instagram's — all
// WebKit) indexedDB.open() can stall without ever succeeding or failing.
// Auth awaits every persistence's availability check before it finishes
// initializing, and Firestore waits for Auth's first token before sending any
// request — so one stalled open left customer pages on their loading skeleton
// forever. Nobody signs in on a storefront, so nothing is lost there.
//
// The organizer app keeps IndexedDB first: switching it to localStorage made
// sign-in hang on iPhone Safari (seen 2026-10-08, even with site data
// cleared), and this chain is the one that works there.
const isStorefrontPage =
    getSubdomain() !== null || window.location.pathname.startsWith("/public/");

export const auth = initializeAuth(app, {
    persistence: isStorefrontPage
        ? [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
        : [
            indexedDBLocalPersistence,
            browserLocalPersistence,
            browserSessionPersistence,
            inMemoryPersistence,
        ],
});
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Initialize Analytics if supported in the environment (e.g. browser)
export let analytics: any = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(console.error);