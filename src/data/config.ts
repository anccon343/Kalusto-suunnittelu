/**
 * Firebase web app configuration for the Roudari project.
 *
 * These values are not secrets: they identify the project and are delivered to
 * every browser that opens the app. Access is protected by the Firestore security
 * rules (firestore.rules) and the allowlist of Google accounts.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAFqRpcJjE_vtnB2v4NcGFj-ZPK804n5_0',
  authDomain: 'roudari-97f09.firebaseapp.com',
  projectId: 'roudari-97f09',
  storageBucket: 'roudari-97f09.firebasestorage.app',
  messagingSenderId: '976934355295',
  appId: '1:976934355295:web:19e7a8c002df606a3436ea',
} as const

/** Project id used with the local emulators, so development never touches real data. */
export const EMULATOR_PROJECT_ID = 'demo-roudari'

export const EMULATOR_HOSTS = {
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8080 },
} as const
