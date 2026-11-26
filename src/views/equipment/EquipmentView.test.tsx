import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { at, gigBInitial, gigW, item, items, locations } from '../../core/__fixtures__/scenario'
import { createItem } from '../../data/writes'
import { renderView, type TestData } from '../../test/render'
import EquipmentView from './index'

vi.mock(import('../../data/writes'), async (importOriginal) => ({
  ...(await importOriginal()),
  createItem: vi.fn<typeof createItem>(),
}))

const mixer = item('mix', 'MIX-01', { name: 'Äänipöytä', category: 'Ääni' })
const data: TestData = {
  items: [...items, mixer],
  gigs: [gigW(), gigBInitial()],
  locations,
  now: at('2026-12-01 12:00'),
}

const show = (d: TestData = data) =>
  renderView(<EquipmentView />, { data: d, path: '/kalusto', route: '/kalusto' })

const tags = () =>
  screen
    .getAllByRole('link')
    .map((a) => a.textContent)
    .filter((s): s is string => !!s)

beforeEach(() => vi.mocked(createItem).mockReset())

describe('Kalusto', () => {
  it('lists equipment sorted by tag with Kunto and Tilanne', () => {
    show()
    expect(screen.getByRole('heading', { level: 2, name: 'Kalusto' })).toBeInTheDocument()
    const links = tags()
    expect(links[0]).toMatch(/^KAM-01/)
    expect(links.at(-1)).toMatch(/^XLR10/)
    const kam03 = screen.getByRole('link', { name: /KAM-03/ })
    expect(within(kam03).getByText('Pois käytöstä')).toBeInTheDocument()
    expect(within(kam03).getByText('Huollossa')).toBeInTheDocument()
    const xlr = screen.getByRole('link', { name: /XLR10/ })
    // W holds 8 and B 20 of 40 cables on Tue 12.00.
    expect(within(xlr).getByText(/vapaana 12\/40/)).toBeInTheDocument()
  })

  it('searches without caring about case or accents', async () => {
    show()
    await userEvent.type(screen.getByLabelText('Haku'), 'aani')
    expect(tags()).toEqual([expect.stringMatching(/^MIX-01/)])
  })

  it('filters by Tilanne', () => {
    show()
    fireEvent.change(screen.getByLabelText('Tilanne'), { target: { value: 'pois-kaytosta' } })
    expect(tags()).toEqual([expect.stringMatching(/^KAM-03/)])
  })

  it('hides archived equipment unless asked', async () => {
    show({ ...data, items: [item('old', 'OLD-01', { archived: true }), mixer] })
    expect(screen.queryByRole('link', { name: /OLD-01/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Näytä arkistoidut'))
    expect(screen.getByRole('link', { name: /OLD-01/ })).toBeInTheDocument()
  })

  it('asks to create the own studio first when there is none', () => {
    show({ ...data, locations: locations.filter((l) => !l.isOwnStudio) })
    expect(screen.getByRole('link', { name: /Luo ensin oma studio/ })).toHaveAttribute(
      'href',
      '/asetukset',
    )
    expect(screen.getByRole('button', { name: 'Lisää kalustoa' })).toBeDisabled()
  })

  it('adds equipment with the own studio as home', async () => {
    vi.mocked(createItem).mockResolvedValue('new-id')
    const { app } = show()
    await userEvent.click(screen.getByRole('button', { name: 'Lisää kalustoa' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Tunnus/), 'kam-05')
    await userEvent.type(within(dialog).getByLabelText(/Nimi/), 'Sony FX6')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    await waitFor(() =>
      expect(createItem).toHaveBeenCalledWith(
        app.db,
        {
          tag: 'KAM-05',
          name: 'Sony FX6',
          category: '',
          quantity: 1,
          condition: 'ok',
          homeLocationId: 'studio',
          archived: false,
        },
        'anna@example.com',
      ),
    )
  })

  it('shows a table on wide screens and opens the item page from a row', async () => {
    const real = window.matchMedia
    window.matchMedia = (query: string) => Object.assign(real(query), { matches: true })
    try {
      renderView(null, {
        data,
        path: '/kalusto',
        routes: [
          { path: '/kalusto', element: <EquipmentView /> },
          { path: '/kalusto/:itemId', element: <p>Laitekortti avattu</p> },
        ],
      })
      expect(screen.getByRole('columnheader', { name: 'Tilanne' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('cell', { name: 'Äänipöytä' }))
      expect(await screen.findByText('Laitekortti avattu')).toBeInTheDocument()
    } finally {
      window.matchMedia = real
    }
  })

  it('refuses a tag that is already used', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Lisää kalustoa' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Tunnus/), 'Kam-01')
    await userEvent.type(within(dialog).getByLabelText(/Nimi/), 'Sony FX6')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    expect(await within(dialog).findByText(/Tunnus on jo käytössä/)).toBeInTheDocument()
    expect(createItem).not.toHaveBeenCalled()
  })
})
