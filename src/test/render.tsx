/**
 * Renders a view for a component test with the real providers (Mantine, router) and an
 * in-memory AppData built from domain values. No Firebase is touched; tests that save
 * mock `src/data/writes` with `vi.mock`.
 */
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import { render, type RenderResult } from '@testing-library/react'
import type { Firestore } from 'firebase/firestore'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { AppDataContext, type AppData } from '../app/appData'
import { theme } from '../app/theme'
import { Availability } from '../core/availability'
import type { AllowedUser, Gig, Item, Location, Package, Stored } from '../core/types'
import type { DataState } from '../data/store'

const stamp = { updatedAt: 0, updatedBy: 'anna@example.com' }
const stored = <T,>(x: T): Stored<T> => ({ ...x, ...stamp })

export interface TestData {
  items?: Item[]
  gigs?: Gig[]
  locations?: Location[]
  packages?: Package[]
  users?: AllowedUser[]
  now?: number
  author?: string
}

export function makeAppData(t: TestData = {}): AppData {
  const data: DataState = {
    status: 'ready',
    users: (t.users ?? [{ email: 'anna@example.com', name: 'Anna', initials: 'AN' }]).map(stored),
    settings: {},
    locations: (t.locations ?? []).map(stored),
    items: (t.items ?? []).map(stored),
    packages: (t.packages ?? []).map(stored),
    gigs: (t.gigs ?? []).map(stored),
    issues: [],
  }
  const now = t.now ?? Date.UTC(2026, 10, 30, 8)
  const own = data.locations.filter((l) => l.isOwnStudio).map((l) => l.id)
  const ownSet = new Set(own)
  const byId = <T extends { id: string }>(xs: readonly T[]) => new Map(xs.map((x) => [x.id, x]))
  return {
    data,
    now,
    availability: new Availability({
      items: data.items,
      gigs: data.gigs,
      ownStudioLocationIds: own,
      now,
    }),
    itemsById: byId(data.items),
    gigsById: byId(data.gigs),
    locationsById: byId(data.locations),
    packagesById: byId(data.packages),
    usersByEmail: new Map(data.users.map((u) => [u.email, u])),
    isOwnStudio: (id) => ownSet.has(id),
    ownStudio: data.locations.find((l) => l.isOwnStudio && !l.archived),
    author: t.author ?? 'anna@example.com',
    authorName: 'Anna',
    db: {} as Firestore,
    usingEmulators: false,
    signOut: () => Promise.resolve(),
  }
}

export function Providers({ app, children }: { app: AppData; children: ReactNode }) {
  return (
    <MantineProvider theme={theme}>
      <DatesProvider settings={{ locale: 'fi', firstDayOfWeek: 1 }}>
        <Notifications />
        <AppDataContext value={app}>{children}</AppDataContext>
      </DatesProvider>
    </MantineProvider>
  )
}

/**
 * Renders `element` at `path` (default "/") inside a memory router. Pass `routes` to
 * mount several pages and follow navigation between them.
 */
export function renderView(
  element: ReactNode,
  opts: { data?: TestData; path?: string; route?: string; routes?: RouteObject[] } = {},
): RenderResult & { app: AppData } {
  const app = makeAppData(opts.data)
  const routes = opts.routes ?? [{ path: opts.route ?? '/', element }]
  const router = createMemoryRouter(routes, { initialEntries: [opts.path ?? '/'] })
  const result = render(
    <Providers app={app}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { ...result, app }
}
