import {
  initializeApp,
  cert,
  applicationDefault,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth as getFirebaseAuth, type Auth } from 'firebase-admin/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin initialization
//
// Fails closed: if required environment is missing, the process will throw
// before any request is handled. This prevents silent misconfigurations.
//
// Supported credential strategies (in order of preference):
//   1. FIREBASE_SERVICE_ACCOUNT_JSON env var — JSON string of service-account key
//   2. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or
//      GCP metadata server) — preferred for production
//
// NEVER put a real service-account JSON file into source control.
// NEVER log credential values.
// ─────────────────────────────────────────────────────────────────────────────

let _app: App | null = null;

export function initFirebaseAdmin(): App {
  if (_app) return _app;

  const projectId = process.env['FIREBASE_PROJECT_ID'];
  if (!projectId) {
    throw new Error(
      '[auth] FIREBASE_PROJECT_ID is not set. ' +
        'Firebase Admin cannot initialize without a project ID. Failing closed.',
    );
  }

  const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];

  if (serviceAccountJson) {
    // Service-account JSON provided as an environment variable string.
    // This is the typical CI/CD and secrets-manager injection pattern.
    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
    } catch {
      throw new Error(
        '[auth] FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. ' +
          'Check that the environment variable contains the complete service-account object.',
      );
    }
    _app = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else {
    // Fall back to Application Default Credentials.
    // Works on GCP (Cloud Run, GKE) and where GOOGLE_APPLICATION_CREDENTIALS is set.
    _app = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  return _app;
}

export function getFirebaseAdmin(): App {
  if (!_app) {
    throw new Error(
      '[auth] Firebase Admin has not been initialized. ' +
        'Call initFirebaseAdmin() at application startup before handling requests.',
    );
  }
  return _app;
}

export function getAuth(): Auth {
  if (!_app && process.env['FIREBASE_PROJECT_ID']) {
    return getFirebaseAuth(initFirebaseAdmin());
  }
  return getFirebaseAuth(getFirebaseAdmin());
}
