/**
 * Everything a signed-in view needs, shared through one context: the live data, the
 * availability model (rebuilt when data changes and once a minute, so late returns
 * turn red without a reload), lookups, the signed-in author and the database.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Availability } from '../core/availability'
import { MINUTE, type Ms } from '../core/time'
import { signOut } from '../data/auth'
import { firebase } from '../data/firebase'
import { useLiveData } from '../data/hooks'
import { AppDataContext, type AppData } from './appData'

function useNow(stepMs: Ms = MINUTE): Ms {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs)
    return () => window.clearInterval(id)
  }, [stepMs])
  return now
}

const byId = <T extends { id: string }>(xs: readonly T[]) => new Map(xs.map((x) => [x.id, x]))

export function AppDataProvider({
  author,
  authorName,
  children,
}: {
  author: string
  authorName: string
  children: ReactNode
}) {
  const data = useLiveData()
  const now = useNow()
  const { db, auth, usingEmulators } = firebase()

  const value = useMemo<AppData>(() => {
    const locationsById = byId(data.locations)
    const ownStudioIds = data.locations.filter((l) => l.isOwnStudio).map((l) => l.id)
    const ownSet = new Set(ownStudioIds)
    return {
      data,
      now,
      availability: new Availability({
        items: data.items,
        gigs: data.gigs,
        ownStudioLocationIds: ownStudioIds,
        now,
      }),
      itemsById: byId(data.items),
      gigsById: byId(data.gigs),
      locationsById,
      packagesById: byId(data.packages),
      usersByEmail: new Map(data.users.map((u) => [u.email, u])),
      isOwnStudio: (locationId) => ownSet.has(locationId),
      ownStudio: data.locations.find((l) => l.isOwnStudio && !l.archived),
      author,
      authorName,
      db,
      usingEmulators,
      signOut: () => signOut(auth),
    }
  }, [data, now, author, authorName, db, auth, usingEmulators])

  return <AppDataContext value={value}>{children}</AppDataContext>
}
