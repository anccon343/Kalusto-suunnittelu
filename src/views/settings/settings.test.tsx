import { notifications } from '@mantine/notifications'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '../../app/appData'
import { at, locations } from '../../core/__fixtures__/scenario'
import * as writes from '../../data/writes'
import { makeAppData, Providers, renderView, type TestData } from '../../test/render'
import SettingsView from './index'
import { CLARION_PRESET, OWN_STUDIO_PRESET } from './locationForm'

type Writes = typeof import('../../data/writes')

vi.mock('../../data/writes', async (importOriginal) => ({
  ...(await importOriginal<Writes>()),
  createLocation: vi.fn<Writes['createLocation']>(() => Promise.resolve('new-id')),
  saveLocation: vi.fn<Writes['saveLocation']>(() => Promise.resolve(['name'])),
  addAllowedUser: vi.fn<Writes['addAllowedUser']>(() => Promise.resolve('uusi@example.com')),
  saveAllowedUser: vi.fn<Writes['saveAllowedUser']>(() => Promise.resolve(['name'])),
  removeAllowedUser: vi.fn<Writes['removeAllowedUser']>(() => Promise.resolve()),
  recordBackup: vi.fn<Writes['recordBackup']>(() => Promise.resolve()),
}))

const users = [
  { email: 'anna@example.com', name: 'Anna Virtanen', initials: 'AV' },
  { email: 'mikko@example.com', name: 'Mikko Mäkelä', initials: 'MM' },
]

const view = (path = '/asetukset', data: TestData = {}) =>
  renderView(<SettingsView />, { path, route: '/asetukset', data: { users, ...data } })

function renderApp(app: AppData, path: string) {
  const router = createMemoryRouter([{ path: '/asetukset', element: <SettingsView /> }], {
    initialEntries: [path],
  })
  return render(
    <Providers app={app}>
      <RouterProvider router={router} />
    </Providers>,
  )
}

// jsdom has no FontFaceSet; Mantine's autosize Textarea listens to it.
if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    value: { addEventListener: () => {}, removeEventListener: () => {} },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // The notification store is global; leftovers from earlier tests would queue new ones.
  notifications.clean()
  notifications.cleanQueue()
})

describe('Kohteet', () => {
  it('offers the starter locations when none exist and creates them in one click', async () => {
    const user = userEvent.setup()
    const { app } = view()
    expect(await screen.findByRole('heading', { name: 'Asetukset', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Luo oma studio' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Luo oma studio' }))
    expect(writes.createLocation).toHaveBeenCalledWith(app.db, OWN_STUDIO_PRESET, app.author)

    await user.click(screen.getByRole('button', { name: 'Lisää Clarion Hotel Helsinki' }))
    expect(writes.createLocation).toHaveBeenCalledWith(app.db, CLARION_PRESET, app.author)
  })

  it('hides the starter card when both locations exist and lists them', async () => {
    view('/asetukset', { locations })
    expect(await screen.findByText('Clarion Hotel Helsinki')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Luo oma studio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Lisää Clarion/ })).not.toBeInTheDocument()
    expect(screen.getByText('Oma studio', { selector: 'h4' })).toBeInTheDocument()
  })

  it('hides archived locations behind a toggle', async () => {
    const user = userEvent.setup()
    view('/asetukset', {
      locations: [
        ...locations,
        { ...locations[2]!, id: 'old', name: 'Vanha halli', archived: true },
      ],
    })
    await screen.findByText('Clarion Hotel Helsinki')
    expect(screen.queryByText('Vanha halli')).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: /Näytä arkistoidut/ }))
    expect(screen.getByText('Vanha halli')).toBeInTheDocument()
    expect(screen.getByText('Arkistoitu')).toBeInTheDocument()
  })

  it('creates a location from the form', async () => {
    const user = userEvent.setup()
    const { app } = view('/asetukset', { locations })
    await user.click(await screen.findByRole('button', { name: 'Lisää kohde' }))
    const dialog = await screen.findByRole('dialog', { name: 'Uusi kohde' })
    await user.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    expect(await within(dialog).findByText('Anna kohteelle nimi.')).toBeInTheDocument()
    expect(writes.createLocation).not.toHaveBeenCalled()

    await user.type(within(dialog).getByRole('textbox', { name: /Nimi/ }), ' Kulttuuritalo ')
    await user.type(within(dialog).getByLabelText('Tilat'), 'Iso sali{Enter}')
    await user.type(within(dialog).getByRole('textbox', { name: 'Lastaus ja pysäköinti' }), 'Takaa')
    await user.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    await waitFor(() =>
      expect(writes.createLocation).toHaveBeenCalledWith(
        app.db,
        {
          name: 'Kulttuuritalo',
          isOwnStudio: false,
          rooms: ['Iso sali'],
          loadingNotes: 'Takaa',
          archived: false,
        },
        app.author,
      ),
    )
  })

  it('saves an edit with the baseline it was opened with', async () => {
    const user = userEvent.setup()
    const { app } = view('/asetukset', { locations })
    await user.click(
      await screen.findByRole('button', { name: 'Muokkaa kohdetta Clarion Hotel Helsinki' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Muokkaa kohdetta' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Osoite' }), 'Tyynenmerenkatu 2')
    await user.click(within(dialog).getByRole('switch', { name: /Arkistoitu/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    const baseline = app.locationsById.get('clarion')
    await waitFor(() =>
      expect(writes.saveLocation).toHaveBeenCalledWith(
        app.db,
        baseline,
        {
          id: 'clarion',
          name: 'Clarion Hotel Helsinki',
          isOwnStudio: false,
          rooms: ['Bysa 1', 'Bysa 2'],
          address: 'Tyynenmerenkatu 2',
          archived: true,
        },
        app.author,
      ),
    )
  })

  it('shows a conflict as an error and keeps the form open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(writes.saveLocation).mockRejectedValueOnce(new writes.ConflictError(['name']))
    const user = userEvent.setup()
    view('/asetukset', { locations })
    await user.click(await screen.findByRole('button', { name: 'Muokkaa kohdetta Oma studio' }))
    const dialog = await screen.findByRole('dialog', { name: 'Muokkaa kohdetta' })
    await user.type(within(dialog).getByRole('textbox', { name: /Nimi/ }), ' 2')
    await user.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    expect(await screen.findByText(/Tietoja muutettiin juuri toisaalla/)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Muokkaa kohdetta' })).toBeInTheDocument()
  })
})

describe('Käyttäjät', () => {
  it('lists users, marks the signed-in user and hides removal for them', async () => {
    view('/asetukset?valilehti=kayttajat')
    expect(await screen.findByText('Anna Virtanen')).toBeInTheDocument()
    expect(screen.getByText('sinä')).toBeInTheDocument()
    expect(screen.getByText('mikko@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Poista käyttäjä Mikko Mäkelä' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Poista käyttäjä Anna Virtanen' }),
    ).not.toBeInTheDocument()
  })

  it('adds a user with initials suggested from the name', async () => {
    const user = userEvent.setup()
    const { app } = view('/asetukset?valilehti=kayttajat')
    await user.click(await screen.findByRole('button', { name: 'Lisää käyttäjä' }))
    const dialog = await screen.findByRole('dialog', { name: 'Uusi käyttäjä' })
    await user.type(within(dialog).getByRole('textbox', { name: /Sähköposti/ }), 'Uusi@Example.com')
    await user.type(within(dialog).getByRole('textbox', { name: 'Nimi' }), 'Liisa Laine')
    expect(within(dialog).getByRole('textbox', { name: /Nimikirjaimet/ })).toHaveValue('LL')
    await user.click(within(dialog).getByRole('button', { name: 'Lisää käyttäjä' }))
    await waitFor(() =>
      expect(writes.addAllowedUser).toHaveBeenCalledWith(
        app.db,
        { email: 'Uusi@Example.com', name: 'Liisa Laine', initials: 'LL' },
        app.author,
      ),
    )
  })

  it('rejects an email already on the list', async () => {
    const user = userEvent.setup()
    view('/asetukset?valilehti=kayttajat')
    await user.click(await screen.findByRole('button', { name: 'Lisää käyttäjä' }))
    const dialog = await screen.findByRole('dialog', { name: 'Uusi käyttäjä' })
    await user.type(
      within(dialog).getByRole('textbox', { name: /Sähköposti/ }),
      'MIKKO@example.com',
    )
    await user.type(within(dialog).getByRole('textbox', { name: 'Nimi' }), 'Mikko')
    await user.click(within(dialog).getByRole('button', { name: 'Lisää käyttäjä' }))
    expect(await within(dialog).findByText('Tämä osoite on jo listalla.')).toBeInTheDocument()
    expect(writes.addAllowedUser).not.toHaveBeenCalled()
  })

  it('edits name and initials', async () => {
    const user = userEvent.setup()
    const { app } = view('/asetukset?valilehti=kayttajat')
    await user.click(await screen.findByRole('button', { name: 'Muokkaa käyttäjää Mikko Mäkelä' }))
    const dialog = await screen.findByRole('dialog', { name: 'Muokkaa käyttäjää' })
    const initials = within(dialog).getByRole('textbox', { name: /Nimikirjaimet/ })
    await user.clear(initials)
    await user.type(initials, 'mim')
    await user.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    await waitFor(() =>
      expect(writes.saveAllowedUser).toHaveBeenCalledWith(
        app.db,
        app.usersByEmail.get('mikko@example.com'),
        expect.objectContaining({
          email: 'mikko@example.com',
          name: 'Mikko Mäkelä',
          initials: 'MIM',
        }),
        app.author,
      ),
    )
  })

  it('removes another user after confirmation', async () => {
    const user = userEvent.setup()
    const { app } = view('/asetukset?valilehti=kayttajat')
    await user.click(await screen.findByRole('button', { name: 'Poista käyttäjä Mikko Mäkelä' }))
    const dialog = await screen.findByRole('dialog', { name: 'Poistetaanko käyttäjä?' })
    expect(writes.removeAllowedUser).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Poista käyttäjä' }))
    await waitFor(() =>
      expect(writes.removeAllowedUser).toHaveBeenCalledWith(
        app.db,
        'mikko@example.com',
        app.author,
      ),
    )
  })

  it('shows an InvalidStateError message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(writes.removeAllowedUser).mockRejectedValueOnce(
      new writes.InvalidStateError('cannot-remove-self'),
    )
    const user = userEvent.setup()
    view('/asetukset?valilehti=kayttajat')
    await user.click(await screen.findByRole('button', { name: 'Poista käyttäjä Mikko Mäkelä' }))
    const dialog = await screen.findByRole('dialog', { name: 'Poistetaanko käyttäjä?' })
    await user.click(within(dialog).getByRole('button', { name: 'Poista käyttäjä' }))
    expect(await screen.findByText('Et voi poistaa itseäsi listalta.')).toBeInTheDocument()
  })
})

describe('Varmuuskopio', () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:roudari')
  const revokeObjectURL = vi.fn<(url: string) => void>()

  beforeEach(() => {
    Object.assign(URL, { createObjectURL, revokeObjectURL })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('warns when no backup has been taken', async () => {
    view('/asetukset?valilehti=varmuuskopio')
    expect(await screen.findByText('Varmuuskopiota ei ole vielä otettu.')).toBeInTheDocument()
    expect(screen.getByText('Varoitus')).toBeInTheDocument()
  })

  it('shows the last backup time and warns when it is older than 30 days', async () => {
    const app = makeAppData({ users, now: at('2026-11-26 10:00') })
    app.data = { ...app.data, settings: { lastBackupAt: at('2026-10-01 08:00') } }
    renderApp(app, '/asetukset?valilehti=varmuuskopio')
    expect(
      await screen.findByText('Edellinen varmuuskopio: to 1.10.2026 klo 8.00'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Edellisestä varmuuskopiosta on 56 päivää/)).toBeInTheDocument()
  })

  it('does not warn about a recent backup', async () => {
    const app = makeAppData({ users, now: at('2026-11-26 10:00') })
    app.data = { ...app.data, settings: { lastBackupAt: at('2026-11-20 08:00') } }
    renderApp(app, '/asetukset?valilehti=varmuuskopio')
    expect(await screen.findByText(/Edellinen varmuuskopio: pe 20.11.2026/)).toBeInTheDocument()
    expect(screen.queryByText('Varoitus')).not.toBeInTheDocument()
  })

  it('downloads the JSON file and records the backup', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    const { app } = view('/asetukset?valilehti=varmuuskopio', { locations })
    await user.click(await screen.findByRole('button', { name: 'Lataa varmuuskopio (JSON)' }))
    await waitFor(() => expect(writes.recordBackup).toHaveBeenCalledWith(app.db, app.author))
    expect(click).toHaveBeenCalledTimes(1)
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toMatch(/^roudari-varmuuskopio-\d{4}-\d{2}-\d{2}\.json$/)
    const blob = createObjectURL.mock.calls[0]![0]
    const json = JSON.parse(await blob.text()) as { app: string; collections: object }
    expect(json.app).toBe('roudari')
    expect(Object.keys(json.collections)).toEqual([
      'allowedUsers',
      'settings',
      'locations',
      'items',
      'packages',
      'gigs',
    ])
  })
})
