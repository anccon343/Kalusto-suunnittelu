import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { at, gigBInitial, gigW, items, locations } from '../../core/__fixtures__/scenario'
import { ConflictError, createItem, saveItem } from '../../data/writes'
import { renderView, type TestData } from '../../test/render'
import ItemPage from './ItemPage'

vi.mock(import('../../data/writes'), async (importOriginal) => ({
  ...(await importOriginal()),
  createItem: vi.fn<typeof createItem>(),
  saveItem: vi.fn<typeof saveItem>(),
}))

const data: TestData = {
  items: items.map((i) => (i.id === 'kam01' ? { ...i, category: 'Kamerat', serialNo: 'S-1' } : i)),
  gigs: [gigW(), gigBInitial()],
  locations,
  now: at('2026-11-30 12:00'),
}

const show = (itemId: string, d: TestData = data) =>
  renderView(<ItemPage />, { data: d, path: `/kalusto/${itemId}`, route: '/kalusto/:itemId' })

beforeEach(() => {
  vi.mocked(saveItem).mockReset().mockResolvedValue([])
  vi.mocked(createItem).mockReset().mockResolvedValue('new-id')
})

describe('Laitekortti', () => {
  it('shows a friendly message for an unknown item', () => {
    show('nope')
    expect(screen.getByRole('heading', { name: 'Laitetta ei löytynyt' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Takaisin kalustoon' })).toHaveAttribute(
      'href',
      '/kalusto',
    )
  })

  it('shows facts, where it is now, the next booking and its gigs', () => {
    show('kam01')
    expect(screen.getByRole('heading', { level: 2, name: 'KAM-01 Sony FX6' })).toBeInTheDocument()
    expect(screen.getByText('Kotipaikka: Oma studio')).toBeInTheDocument()
    // B (tentative) takes KAM-01 from Mon 14.00; W (confirmed) on Tue.
    const next = screen.getByRole('heading', { name: 'Seuraavaksi' }).closest('section')
    expect(
      within(next as HTMLElement).getByRole('link', { name: 'Hybridiseminaari' }),
    ).toBeInTheDocument()
    expect(within(next as HTMLElement).getByText(/ma 30.11.2026 klo 14.00/)).toBeInTheDocument()
    const history = screen.getByRole('heading', { name: /Viimeisimmät/ }).closest('section')
    const links = within(history as HTMLElement).getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(['Webinaari X', 'Hybridiseminaari'])
    expect(links[0]).toHaveAttribute('href', '/keikat/W')
    expect(screen.getByText('S-1')).toBeInTheDocument()
    // B wants KAM-01 while W holds it: a yellow warning, also as text.
    expect(screen.getByText('Varoitus')).toBeInTheDocument()
  })

  it('shows the gig holding the item now', () => {
    show('kam01', { ...data, now: at('2026-12-01 12:00') })
    const now = screen.getByRole('heading', { name: 'Nyt' }).closest('section') as HTMLElement
    expect(within(now).getByRole('link', { name: 'Webinaari X' })).toBeInTheDocument()
    expect(within(now).getByText(/Oma studio › Pikku studio/)).toBeInTheDocument()
  })

  it('archives only after confirmation', async () => {
    const { app } = show('kam02')
    await userEvent.click(screen.getByRole('button', { name: 'Arkistoi' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/1 tuleva varaus/)).toBeInTheDocument()
    expect(saveItem).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Arkistoi' }))
    const baseline = app.itemsById.get('kam02')
    await waitFor(() =>
      expect(saveItem).toHaveBeenCalledWith(
        app.db,
        baseline,
        { ...baseline, archived: true },
        'anna@example.com',
      ),
    )
  })

  it('saves an edit against the version the form was opened with', async () => {
    const { app } = show('kam01')
    await userEvent.click(screen.getByRole('button', { name: 'Muokkaa' }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByLabelText(/Nimi/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Sony FX6 II')
    await userEvent.clear(within(dialog).getByLabelText('Sarjanumero'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    const baseline = app.itemsById.get('kam01')
    await waitFor(() => expect(saveItem).toHaveBeenCalledOnce())
    const [, base, edited] = vi.mocked(saveItem).mock.calls[0] ?? []
    expect(base).toBe(baseline)
    expect(edited).toMatchObject({ name: 'Sony FX6 II', tag: 'KAM-01' })
    expect(edited).not.toHaveProperty('serialNo')
  })

  it('keeps the form open when the item was changed elsewhere', async () => {
    vi.mocked(saveItem).mockRejectedValue(new ConflictError(['name']))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    show('kam01')
    await userEvent.click(screen.getByRole('button', { name: 'Muokkaa' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Nimi/), ' II')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    expect(await screen.findByText(/muutettiin juuri toisaalla/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('duplicates with the next free tag and no serial number', async () => {
    show('kam01')
    await userEvent.click(screen.getByRole('button', { name: 'Monista' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/Tunnus/)).toHaveValue('KAM-05')
    expect(within(dialog).getByLabelText('Sarjanumero')).toHaveValue('')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tallenna' }))
    await waitFor(() => expect(createItem).toHaveBeenCalledOnce())
    const [, input] = vi.mocked(createItem).mock.calls[0] ?? []
    expect(input).toMatchObject({ tag: 'KAM-05', name: 'Sony FX6', category: 'Kamerat' })
    expect(input).not.toHaveProperty('serialNo')
  })

  it('records a "Siirretty tänne" note', async () => {
    show('kam04')
    await userEvent.type(screen.getByLabelText('Missä laite on?'), 'Mikon auto')
    await userEvent.click(screen.getByRole('button', { name: 'Tallenna merkintä' }))
    await waitFor(() => expect(saveItem).toHaveBeenCalledOnce())
    const [, , edited, author] = vi.mocked(saveItem).mock.calls[0] ?? []
    expect(edited?.locationOverride).toEqual({
      text: 'Mikon auto',
      at: expect.any(Number) as number,
      by: 'anna@example.com',
    })
    expect(author).toBe('anna@example.com')
  })

  it('removes a "Siirretty tänne" note', async () => {
    const override = { text: 'Mikon auto', at: at('2026-11-30 11:00'), by: 'anna@example.com' }
    show('kam04', {
      ...data,
      items: items.map((i) => (i.id === 'kam04' ? { ...i, locationOverride: override } : i)),
    })
    expect(screen.getByText('ma 30.11.2026 klo 11.00, Anna')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Poista merkintä' }))
    await waitFor(() => expect(saveItem).toHaveBeenCalledOnce())
    expect(vi.mocked(saveItem).mock.calls[0]?.[2]).not.toHaveProperty('locationOverride')
  })
})
