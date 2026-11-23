/**
 * Google sign-in and the allowlist check (plan 6.2).
 *
 * A user is let in only if their Google account's email (lower case) has a document
 * in `allowedUsers`. The security rules enforce the same; this check exists so the
 * app can show a clear message instead of failing on every read.
 */
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { doc, getDoc, type Firestore } from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'not-allowed'; email: string }
  | { status: 'allowed'; email: string; name: string; uid: string }
  | { status: 'error'; message: string }

export type SignInResult =
  { ok: true } | { ok: false; reason: 'cancelled' | 'popup-blocked' | 'failed' }

export async function signInWithGoogle(auth: Auth): Promise<SignInResult> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    await signInWithPopup(auth, provider)
    return { ok: true }
  } catch (e) {
    const code = e instanceof FirebaseError ? e.code : ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { ok: false, reason: 'cancelled' }
    }
    if (code === 'auth/popup-blocked') return { ok: false, reason: 'popup-blocked' }
    return { ok: false, reason: 'failed' }
  }
}

export function signOut(auth: Auth): Promise<void> {
  return firebaseSignOut(auth)
}

/** Lower-cased email used as the allowlist key and as `updatedBy`. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function checkAllowed(db: Firestore, user: User): Promise<AuthState> {
  const email = user.email ? normalizeEmail(user.email) : ''
  if (!email) return { status: 'not-allowed', email: '' }
  try {
    const snap = await getDoc(doc(db, 'allowedUsers', email))
    if (!snap.exists()) return { status: 'not-allowed', email }
    const data: unknown = snap.data()
    const name =
      typeof data === 'object' && data !== null && 'name' in data && typeof data.name === 'string'
        ? data.name
        : (user.displayName ?? email)
    return { status: 'allowed', email, name, uid: user.uid }
  } catch (e) {
    // The rules deny reading the allowlist to anyone not on it.
    if (e instanceof FirebaseError && e.code === 'permission-denied') {
      return { status: 'not-allowed', email }
    }
    return { status: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}

/** Watches sign-in state and resolves the allowlist status. Returns an unsubscribe. */
export function watchAuth(auth: Auth, db: Firestore, onChange: (s: AuthState) => void) {
  let latest = 0
  return onAuthStateChanged(auth, (user) => {
    const run = ++latest
    if (!user) {
      onChange({ status: 'signed-out' })
      return
    }
    onChange({ status: 'loading' })
    void checkAllowed(db, user).then((s) => {
      // Ignore results of an older sign-in that finished after a newer one.
      if (run === latest) onChange(s)
    })
  })
}
