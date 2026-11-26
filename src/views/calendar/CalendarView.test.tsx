import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import {
  at,
  gigA,
  gigBInitial,
  gigE,
  gigF,
  gigW,
  items,
  locations,
} from '../../core/__fixtures__/scenario'
import type { Gig } from '../../core/types'
import { renderView } from '../../test/render'
import { CalendarView } from './CalendarView'

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{`${loc.pathname}${loc.search}`}</p>
}

const cancelled: Gig = {
  ...gigA(),
  id: 'X',
  name: 'Peruttu tilaisuus',
  status: 'peruttu',
  lines: [],
}

function setup(path = '/kalenteri') {
  const user = userEvent.setup()
  const r = renderView(null, {
    path,
    data: {
      items,
      locations,
      gigs: [gigA(), gigW(), gigBInitial(), gigE(), gigF(false), cancelled],
      now: at('2026-11-30 09:00'),
    },
    routes: [
      {
        path: '/kalenteri',
        element: (
          <>
            <CalendarView />
            <Where />
          </>
        ),
      },
      { path: '/keikat/:gigId', element: <Where /> },
      { path: '/keikat/uusi', element: <Where /> },
    ],
  })
  return { user, ...r }
}

describe('CalendarView', () => {
  it('lists the gigs of the next two weeks on a phone, with status and conflicts', async () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'Kalenteri' })).toBeInTheDocument()
    const b = await screen.findByRole('button', { name: /^Hybridiseminaari, Alustava/ })
    expect(b).toHaveAccessibleName(
      'Hybridiseminaari, Alustava, ti 1.12.2026 klo 10.00–16.00, varoitus',
    )
    expect(
      screen.getByRole('button', {
        name: 'Lanseeraus, Vahvistettu, ma 30.11.2026 klo 12.00–16.00, varoitus',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Peruttu tilaisuus/)).not.toBeInTheDocument()
    // Conflicts are spelled out in the list, not only coloured.
    expect(screen.getAllByText('! Päällekkäin')).toHaveLength(3)
    expect(screen.getAllByText('! Varoitus')).toHaveLength(3)
    expect(screen.getByText('alkaa klo 9.00')).toBeInTheDocument()
    expect(screen.getByText('päättyy klo 16.00')).toBeInTheDocument()
  })

  it('moves between periods and keeps the view in the address', async () => {
    const { user } = setup()
    expect(await screen.findByText('30.11.–13.12.2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Seuraava jakso' }))
    expect(await screen.findByText('14.12.–27.12.2026')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Viikko' }))
    expect(await screen.findByText('vk 51 · 14.12.–20.12.2026')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(
        '/kalenteri?nakyma=viikko&paiva=2026-12-14',
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Tänään' }))
    expect(await screen.findByText('vk 49 · 30.11.–6.12.2026')).toBeInTheDocument()
  })

  it('opens a gig on click', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /^Webinaari X/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/keikat/W')
  })

  it('shows cancelled gigs when asked', async () => {
    const { user } = setup()
    await screen.findByRole('button', { name: /^Webinaari X/ })
    await user.click(screen.getByRole('switch', { name: 'Näytä perutut' }))
    expect(
      await screen.findByRole('button', { name: /^Peruttu tilaisuus, Peruttu/ }),
    ).toBeInTheDocument()
  })

  it('opens the month from the address and starts a new gig from a day', async () => {
    const { user } = setup('/kalenteri?nakyma=kuukausi&paiva=2026-12-01')
    expect(await screen.findByText('joulukuu 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Uusi keikka 3. joulukuuta 2026' }))
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/keikat/uusi?paiva=2026-12-03'),
    )
  })
})
