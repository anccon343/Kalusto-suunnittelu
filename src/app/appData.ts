/** The shared app data context and its hooks (provider in AppData.tsx). */
import { createContext, use } from 'react'
import type { Firestore } from 'firebase/firestore'
import type { Availability } from '../core/availability'
import type { Ms } from '../core/time'
import type { AllowedUser, Gig, Item, Location, Package, Stored } from '../core/types'
import type { DataState } from '../data/store'
import type { IsOwnStudio } from '../data/writes'

export interface AppData {
  data: DataState
  /** Current time, refreshed every minute. */
  now: Ms
  availability: Availability
  itemsById: ReadonlyMap<string, Stored<Item>>
  gigsById: ReadonlyMap<string, Stored<Gig>>
  locationsById: ReadonlyMap<string, Stored<Location>>
  packagesById: ReadonlyMap<string, Stored<Package>>
  usersByEmail: ReadonlyMap<string, Stored<AllowedUser>>
  isOwnStudio: IsOwnStudio
  /** The first own-studio location, if one exists (default home for new equipment). */
  ownStudio: Stored<Location> | undefined
  /** Signed-in user's email in lower case; the author of every write. */
  author: string
  authorName: string
  db: Firestore
  usingEmulators: boolean
  signOut: () => Promise<void>
}

export const AppDataContext = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const v = use(AppDataContext)
  if (!v) throw new Error('useAppData must be used inside <AppDataProvider>')
  return v
}

/** Display name for an email, falling back to the email itself. */
export function userName(app: AppData, email: string | undefined): string {
  if (!email) return ''
  return app.usersByEmail.get(email)?.name ?? email
}
