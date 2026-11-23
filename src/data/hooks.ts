/**
 * React bindings for the data layer: sign-in state and the shared live data store.
 */
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { watchAuth, type AuthState } from './auth'
import { firebase } from './firebase'
import { DataStore, type DataState } from './store'

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  useEffect(() => {
    const { auth, db } = firebase()
    return watchAuth(auth, db, setState)
  }, [])
  return state
}

/** The signed-in, allowed user's email (lower case); used as the author of writes. */
export const AuthorContext = createContext<string | null>(null)

export function useAuthor(): string {
  const author = useContext(AuthorContext)
  if (!author) throw new Error('useAuthor must be used inside a signed-in view')
  return author
}

/** Starts the listeners while mounted and returns the current data. */
export function useLiveData(): DataState {
  const [store] = useState(() => new DataStore(firebase().db))
  useEffect(() => {
    store.start()
    return () => store.stop()
  }, [store])
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
