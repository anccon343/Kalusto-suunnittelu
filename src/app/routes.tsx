/**
 * Route table. Each view lives in its own folder under src/views and is loaded lazily,
 * so the first page is quick even on a phone.
 */
import { createBrowserRouter, type RouteObject } from 'react-router'
import { AuthGate } from './AuthGate'
import { NotFound } from './NotFound'
import { Shell } from './Shell'

const view = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
})

export const routes: RouteObject[] = [
  {
    element: (
      <AuthGate>
        <Shell />
      </AuthGate>
    ),
    children: [
      { index: true, lazy: view(() => import('../views/today')) },
      { path: 'kalenteri', lazy: view(() => import('../views/calendar')) },
      { path: 'keikat/uusi', lazy: view(() => import('../views/gigs/GigEditPage')) },
      { path: 'keikat/:gigId', lazy: view(() => import('../views/gigs/GigPage')) },
      { path: 'keikat/:gigId/muokkaa', lazy: view(() => import('../views/gigs/GigEditPage')) },
      { path: 'kalusto', lazy: view(() => import('../views/equipment')) },
      { path: 'kalusto/:itemId', lazy: view(() => import('../views/equipment/ItemPage')) },
      { path: 'taulu', lazy: view(() => import('../views/board')) },
      { path: 'roudaukset', lazy: view(() => import('../views/moves')) },
      { path: 'asetukset', lazy: view(() => import('../views/settings')) },
      { path: '*', Component: NotFound },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
