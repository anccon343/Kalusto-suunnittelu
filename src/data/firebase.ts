/**
 * Firebase initialisation. Set `VITE_USE_EMULATORS=true` (see `pnpm dev:emu`) to
 * run against the local emulators with a demo project instead of production.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { EMULATOR_HOSTS, EMULATOR_PROJECT_ID, firebaseConfig } from './config'

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  usingEmulators: boolean
}

let services: FirebaseServices | undefined

export function firebase(): FirebaseServices {
  if (services) return services
  const usingEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'
  const app = initializeApp(
    usingEmulators ? { ...firebaseConfig, projectId: EMULATOR_PROJECT_ID } : firebaseConfig,
  )
  const auth = getAuth(app)
  auth.languageCode = 'fi'
  // Online only (plan: no offline mode); the default in-memory cache is used.
  const db = getFirestore(app)
  if (usingEmulators) {
    connectAuthEmulator(auth, EMULATOR_HOSTS.auth, { disableWarnings: true })
    connectFirestoreEmulator(db, EMULATOR_HOSTS.firestore.host, EMULATOR_HOSTS.firestore.port)
  }
  services = { app, auth, db, usingEmulators }
  return services
}
