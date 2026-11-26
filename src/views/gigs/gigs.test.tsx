import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { at, gigA, gigBInitial, gigW, items, locations } from '../../core/__fixtures__/scenario'
import type { Gig } from '../../core/types'
import * as writes from '../../data/writes'
import { renderView, type TestData } from '../../test/render'
import GigEditPage from './GigEditPage'
import GigPage from './GigPage'

type Writes = typeof import('../../data/writes')

vi.mock('../../data/writes', async (importOriginal) => ({
  ...(await importOriginal<Writes>()),
  createGig: vi.fn<Writes['createGig']>(() => Promise.resolve('new-id')),
  saveGig: vi.fn<Writes['saveGig']>(() => Promise.resolve(['status'])),
  deleteTentativeGig: vi.fn<Writes['deleteTentativeGig']>(() => Promise.resolve()),
}))

// jsdom has no FontFaceSet; Mantine's autosize Textarea listens to it.
if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    value: { addEventListener: () => {}, removeEventListener: () => {} },
  })
}

const users = [
  { email: 'anna@example.com', name: 'Anna', initials: 'AN' },
  { email: 'mikko@example.com', name: 'Mikko', initials: 'MI' },
]

const routes = [
  { path: '/keikat/uusi', element: <GigEditPage /> },
  { path: '/keikat/:gigId', element: <GigPage /> },
  { path: '/keikat/:gigId/muokkaa', element: <GigEditPage /> },
  { path: '/kalenteri', element: <h2>Kalenteri</h2> },
]

const open = (path: string, data: TestData = {}) =>
  renderView(null, {
    path,
    routes,
    data: { items, locations, users, now: at('2026-11-30 10:00'), ...data },
  })

function setTime(label: string, date: string, time: string) {
  fireEvent.change(screen.getByLabelText(`${label}, päivä`), { target: { value: date } })
  fireEvent.change(screen.getByLabelText(`${label}, kellonaika`), { target: { value: time } })
}

beforeEach(() => {
  vi.clearAllMocks()
  notifications.clean()
  notifications.cleanQueue()
})

describe('new gig', () => {
  it('saves a new gig with createGig and opens it', async () => {
    const user = userEvent.setup()
    const { app } = open('/keikat/uusi?paiva=2026-12-01')
    expect(await screen.findByRole('heading', { name: 'Uusi keikka', level: 2 })).toBeVisible()
    expect(screen.getByText('Kalenterista valittu päivä: ti 1.12.2026')).toBeVisible()

    await user.type(screen.getByLabelText(/^Nimi/), 'Hybridiseminaari')
    setTime('Kalusto lähtee', '2026-11-30', '14:00')
    setTime('Tapahtuma alkaa', '2026-12-01', '10:00')
    setTime('Tapahtuma päättyy', '2026-12-01', '16:00')
    setTime('Kalusto takaisin', '2026-12-02', '12:00')

    await user.type(screen.getByRole('combobox', { name: 'Lisää kalustoa' }), 'KAM-04')
    await user.click(await screen.findByRole('option', { name: /KAM-04 Sony FX6/, hidden: true }))
    expect(await screen.findByRole('button', { name: 'Poista rivi KAM-04 Sony FX6' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Tallenna' }))

    await waitFor(() => expect(writes.createGig).toHaveBeenCalledTimes(1))
    const [db, input, isOwnStudio, author] = vi.mocked(writes.createGig).mock.calls[0]!
    expect(db).toBe(app.db)
    expect(isOwnStudio).toBe(app.isOwnStudio)
    expect(author).toBe('anna@example.com')
    expect(input).toEqual({
      name: 'Hybridiseminaari',
      locationId: 'studio',
      responsible: 'anna@example.com',
      crew: [],
      status: 'alustava',
      equipStart: at('2026-11-30 14:00'),
      eventStart: at('2026-12-01 10:00'),
      eventEnd: at('2026-12-01 16:00'),
      equipEnd: at('2026-12-02 12:00'),
      lines: [{ id: expect.any(String), itemId: 'kam04', qty: 1 }],
    })
    expect(input).not.toHaveProperty('id')
    // Navigated to the new gig (not in the in-memory data, so it shows as not found).
    expect(await screen.findByRole('heading', { name: 'Keikkaa ei löytynyt' })).toBeVisible()
  })

  it('does not save without a name and times and has no default times', async () => {
    const user = userEvent.setup()
    open('/keikat/uusi')
    expect(await screen.findByLabelText('Kalusto lähtee, kellonaika')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Tallenna' }))
    expect(await screen.findByText('Anna keikalle nimi.')).toBeVisible()
    expect(screen.getAllByText('Anna päivä ja kellonaika.')).toHaveLength(4)
    expect(writes.createGig).not.toHaveBeenCalled()
  })
})

describe('editing a gig', () => {
  const data = { gigs: [gigA(), gigW(), gigBInitial()] }

  it('saves a tentative gig despite yellow warnings, against the opened baseline', async () => {
    const user = userEvent.setup()
    const { app } = open('/keikat/B/muokkaa', data)
    expect(await screen.findByRole('heading', { name: 'Muokkaa keikkaa' })).toBeVisible()
    expect(screen.getAllByText('Varoitus').length).toBeGreaterThan(0)
    expect(screen.getByText('myös Webinaari X')).toBeVisible()

    await user.type(screen.getByLabelText('Asiakas'), 'Asiakas Oy')
    await user.click(screen.getByRole('button', { name: 'Tallenna' }))

    await waitFor(() => expect(writes.saveGig).toHaveBeenCalledTimes(1))
    const [, baseline, edited] = vi.mocked(writes.saveGig).mock.calls[0]!
    expect(baseline).toBe(app.gigsById.get('B'))
    expect(edited).toMatchObject({ id: 'B', client: 'Asiakas Oy', status: 'alustava' })
    expect(edited.lines).toEqual(gigBInitial().lines)
  })

  it('blocks saving as confirmed when it creates a new red conflict (rule 9)', async () => {
    const user = userEvent.setup()
    open('/keikat/B/muokkaa', data)
    await user.click(await screen.findByRole('radio', { name: 'Vahvistettu' }))
    await user.click(screen.getByRole('button', { name: 'Tallenna' }))

    const alert = await screen.findByRole('alert', { name: /Tallennus estetty/ })
    expect(within(alert).getByText('KAM-01: Hybridiseminaari, Webinaari X')).toBeVisible()
    expect(writes.saveGig).not.toHaveBeenCalled()
  })

  it('swaps a conflicting device for a free one with the same name', async () => {
    const user = userEvent.setup()
    open('/keikat/B/muokkaa', data)
    const swaps = await screen.findAllByRole('button', { name: 'Vaihda laite' })
    await user.click(swaps[0]!)
    await user.click(
      await screen.findByRole('button', { name: 'Vaihda laitteeseen KAM-04 Sony FX6' }),
    )
    expect(screen.getByRole('button', { name: 'Poista rivi KAM-04 Sony FX6' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Poista rivi KAM-01 Sony FX6' })).toBeNull()
  })
})

describe('gig page', () => {
  it('blocks confirming B because W already has KAM-01, and does not save', async () => {
    const user = userEvent.setup()
    open('/keikat/B', { gigs: [gigA(), gigW(), gigBInitial()] })
    expect(await screen.findByRole('heading', { name: 'Hybridiseminaari', level: 2 })).toBeVisible()
    expect(screen.getByText(/3 varoitusta/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Vahvista' }))

    const alert = await screen.findByRole('alert', { name: /Vahvistus estetty/ })
    expect(within(alert).getByText('KAM-01: Hybridiseminaari, Webinaari X')).toBeVisible()
    expect(within(alert).getByText('PTZ-01: Lanseeraus, Hybridiseminaari')).toBeVisible()
    expect(writes.saveGig).not.toHaveBeenCalled()
  })

  it('confirms a gig without conflicts and stamps who confirmed', async () => {
    const user = userEvent.setup()
    const b: Gig = { ...gigBInitial(), lines: [{ id: 'b1', itemId: 'kam04', qty: 1 }] }
    const { app } = open('/keikat/B', { gigs: [gigA(), gigW(), b] })
    await user.click(await screen.findByRole('button', { name: 'Vahvista' }))
    await waitFor(() => expect(writes.saveGig).toHaveBeenCalledTimes(1))
    const [, , edited] = vi.mocked(writes.saveGig).mock.calls[0]!
    expect(edited).toMatchObject({
      status: 'vahvistettu',
      confirmedAt: app.now,
      confirmedBy: 'anna@example.com',
    })
  })

  it('deletes a tentative gig after confirmation and returns to the calendar', async () => {
    const user = userEvent.setup()
    const { app } = open('/keikat/B', { gigs: [gigBInitial()] })
    await user.click(await screen.findByRole('button', { name: 'Poista' }))
    await user.click(await screen.findByRole('button', { name: 'Poista keikka' }))
    await waitFor(() => expect(writes.deleteTentativeGig).toHaveBeenCalledWith(app.db, 'B'))
    expect(await screen.findByRole('heading', { name: 'Kalenteri' })).toBeVisible()
  })

  it('cancels a gig through a confirmation dialog', async () => {
    const user = userEvent.setup()
    open('/keikat/W', { gigs: [gigW()] })
    await user.click(await screen.findByRole('button', { name: 'Peru keikka' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Peru keikka' }))
    await waitFor(() => expect(writes.saveGig).toHaveBeenCalledTimes(1))
    expect(vi.mocked(writes.saveGig).mock.calls[0]![2]).toMatchObject({ status: 'peruttu' })
  })

  it('shows a friendly message for an unknown gig', async () => {
    open('/keikat/ei-ole')
    expect(await screen.findByRole('heading', { name: 'Keikkaa ei löytynyt' })).toBeVisible()
  })
})
