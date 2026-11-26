import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  at,
  gigA,
  gigBResolved,
  gigC,
  gigD,
  gigW,
  item,
  items,
  locations,
} from '../../core/__fixtures__/scenario'
import type { Gig, Item } from '../../core/types'
import { renderView } from '../../test/render'
import BoardView from '.'

const withCategories: Item[] = items.map((it) => ({
  ...it,
  category: it.id.startsWith('kam') ? 'Kamerat' : it.id.startsWith('ptz') ? 'PTZ' : 'Kaapelit',
}))

function renderBoard(opts: { gigs?: Gig[]; items?: Item[]; now?: number; path?: string } = {}) {
  return renderView(<BoardView />, {
    data: {
      items: opts.items ?? withCategories,
      gigs: opts.gigs ?? [gigA(), gigW(), gigBResolved(), gigC()],
      locations,
      now: opts.now ?? at('2026-11-30 09:00'),
    },
    path: opts.path ?? '/taulu',
    route: '/taulu',
  })
}

const rowOf = (tag: string) => {
  const header = screen.getByRole('rowheader', { name: new RegExp(`^${tag}`) })
  return header.closest('[role="row"]') as HTMLElement
}

describe('BoardView', () => {
  it('shows one Monday-first week on a phone with week number and dates', () => {
    renderBoard()
    expect(screen.getByRole('heading', { level: 2, name: 'Kalustotaulu' })).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(8)
    expect(headers[1]).toHaveTextContent('vk 49')
    expect(headers[1]).toHaveTextContent('ma 30.11.')
    expect(headers[1]).toHaveAttribute('aria-current', 'date')
    expect(headers[7]).toHaveTextContent('su 6.12.')
  })

  it('draws the bookings of the plan example as links to the gigs', () => {
    renderBoard()
    const ptz = within(rowOf('PTZ-01'))
    expect(ptz.getByRole('link', { name: /^Lanseeraus, vahvistettu:/ })).toHaveAttribute(
      'href',
      '/keikat/A',
    )
    expect(
      ptz.getByRole('link', { name: /^Hybridiseminaari, vahvistettu, suora siirto:/ }),
    ).toHaveTextContent('> Hybridiseminaari')
    expect(ptz.getByRole('link', { name: /^Asiakastilaisuus, alustava/ })).toHaveTextContent(
      '> alust. Asiakastilaisuus',
    )

    const kam03 = within(rowOf('KAM-03'))
    expect(
      kam03.getByRole('link', { name: /Huollossa, takaisin pe 4\.12\. klo 16\.00/ }),
    ).toHaveAttribute('href', '/kalusto/kam03')
  })

  it('shows free quantities per day for quantity items', () => {
    renderBoard()
    const cells = within(rowOf('XLR10')).getAllByRole('cell')
    expect(cells.map((c) => c.textContent)).toEqual([
      '10/40',
      '12/40',
      '20/40',
      '28/40',
      '40/40',
      '40/40',
      '40/40',
    ])
  })

  it('marks overlaps and unreturned equipment with text', () => {
    renderBoard({ gigs: [gigBResolved(), gigD()], now: at('2026-12-03 09:00') })
    const kam04 = within(rowOf('KAM-04'))
    expect(kam04.getByText('Päällekkäin')).toBeInTheDocument()
    expect(kam04.getByRole('link', { name: /^Palauttamatta: Hybridiseminaari/ })).toHaveTextContent(
      'Palauttamatta: Hybridiseminaari',
    )
  })

  it('moves between weeks and back to today', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: 'Seuraava viikko' }))
    expect(screen.getAllByRole('columnheader')[1]).toHaveTextContent('ma 7.12.')
    expect(screen.getAllByText('vk 50').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Tänään' }))
    expect(screen.getAllByRole('columnheader')[1]).toHaveTextContent('ma 30.11.')
    await user.click(screen.getByRole('button', { name: 'Edellinen viikko' }))
    expect(screen.getAllByRole('columnheader')[1]).toHaveTextContent('ma 23.11.')
  })

  it('opens the week given in the address', () => {
    renderBoard({ path: '/taulu?alku=2026-12-09' })
    expect(screen.getAllByRole('columnheader')[1]).toHaveTextContent('ma 7.12.')
  })

  it('filters by category and search and hides archived items', async () => {
    const user = userEvent.setup()
    renderBoard({
      items: [...withCategories, item('old', 'KAM-99', { category: 'Kamerat', archived: true })],
    })
    expect(screen.queryByRole('rowheader', { name: /^KAM-99/ })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Kategoria'), 'PTZ')
    expect(screen.queryByRole('rowheader', { name: /^KAM-01/ })).not.toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: /^PTZ-03/ })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Haku'), 'ptz-02')
    await waitFor(() => expect(screen.getAllByRole('rowheader', { name: /^PTZ-/ })).toHaveLength(1))

    await user.clear(screen.getByLabelText('Haku'))
    await user.type(screen.getByLabelText('Haku'), 'ei ole')
    expect(await screen.findByText('Hakuehdoilla ei löytynyt kalustoa.')).toBeInTheDocument()
  })

  it('explains what to do when there is no equipment', () => {
    renderBoard({ items: [] })
    expect(screen.getByRole('link', { name: 'Lisää kalustoa Kalusto-sivulla' })).toHaveAttribute(
      'href',
      '/kalusto',
    )
  })

  it('has a legend with text for every style', () => {
    renderBoard()
    const legend = screen.getByRole('region', { name: 'Selite' })
    for (const text of ['vahvistettu', 'alustava', 'palauttamatta', 'suora siirto']) {
      expect(within(legend).getByText(text)).toBeInTheDocument()
    }
  })
})
