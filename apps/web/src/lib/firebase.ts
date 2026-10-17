import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Firebase CLIENT SDK initialization
//
// These are PUBLIC configuration values safe to include in the browser bundle.
// They identify your Firebase project but do NOT grant any admin access.
//
// NEVER put Firebase ADMIN credentials or service-account keys here.
// Admin credentials must only ever live in server-side environment variables.
//
// Values come from VITE_ prefixed environment variables (browser-safe).
// ─────────────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: import.meta.env['VITE_FIREBASE_API_KEY'] as string,
  authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string,
  projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string,
  storageBucket: import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'] as string,
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string,
  appId: import.meta.env['VITE_FIREBASE_APP_ID'] as string,
};

if (!firebaseConfig.projectId) {
  throw new Error(
    'VITE_FIREBASE_PROJECT_ID is not set. ' +
      'Copy .env.example to .env and fill in your Firebase project configuration.',
  );
}

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
