import { describe, expect, it } from 'vitest'
import { at, gigBInitial, gigE, items } from '../../core/__fixtures__/scenario'
import type { Gig } from '../../core/types'
import {
  emptyForm,
  formFromGig,
  formToGig,
  hasErrors,
  newLineDraft,
  newLineId,
  validateForm,
  withConfirmation,
  type GigForm,
} from './gigForm'

const byId = new Map(items.map((i) => [i.id, i]))
const itemById = (id: string) => byId.get(id)
const now = at('2026-11-30 10:00')
const author = 'mikko@example.com'

function filled(): GigForm {
  return {
    ...emptyForm(author, 'clarion'),
    name: ' Hybridiseminaari ',
    client: '',
    room: 'Bysa 2',
    crew: ['anna@example.com'],
    equipStart: at('2026-11-30 14:00'),
    eventStart: at('2026-12-01 10:00'),
    eventEnd: at('2026-12-01 16:00'),
    equipEnd: at('2026-12-02 12:00'),
    lines: [newLineDraft('l1', { id: 'kam01' }), { ...newLineDraft('l2', { id: 'xlr' }), qty: 20 }],
  }
}

describe('emptyForm', () => {
  it('starts tentative, with the author responsible and no times (no defaults)', () => {
    const f = emptyForm(author, 'studio')
    expect(f.status).toBe('alustava')
    expect(f.responsible).toBe(author)
    expect([f.equipStart, f.eventStart, f.eventEnd, f.equipEnd]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })
})

describe('formToGig', () => {
  it('builds the gig, trimming text and leaving out empty optional fields', () => {
    const g = formToGig(filled(), { id: 'new', now, author })
    expect(g).toEqual({
      id: 'new',
      name: 'Hybridiseminaari',
      locationId: 'clarion',
      room: 'Bysa 2',
      responsible: author,
      crew: ['anna@example.com'],
      status: 'alustava',
      equipStart: at('2026-11-30 14:00'),
      eventStart: at('2026-12-01 10:00'),
      eventEnd: at('2026-12-01 16:00'),
      equipEnd: at('2026-12-02 12:00'),
      lines: [
        { id: 'l1', itemId: 'kam01', qty: 1 },
        { id: 'l2', itemId: 'xlr', qty: 20 },
      ],
    })
  })

  it('is undefined while a time is missing', () => {
    expect(formToGig({ ...filled(), eventEnd: undefined }, { id: 'x', now, author })).toBe(
      undefined,
    )
  })

  it('round-trips a stored gig unchanged, keeping direct transfers and marks', () => {
    const stored: Gig = {
      ...gigE(),
      departedAt: at('2026-12-06 14:10'),
      lineMarks: { e3: { returnedAt: at('2026-12-07 19:05') } },
      lines: [
        ...gigE().lines,
        {
          id: 'e5',
          itemId: 'ptz01',
          qty: 1,
          note: 'Varalle',
          from: { gigId: 'A', lineId: 'a1', handoverAt: at('2026-12-06 13:00'), travelMin: 30 },
        },
      ],
    }
    expect(formToGig(formFromGig(stored), { id: 'E', base: stored, now, author })).toEqual(stored)
  })

  it('drops own times when the switch is turned off', () => {
    const e = gigE()
    const f = formFromGig(e)
    f.lines = f.lines.map((l) => ({ ...l, ownTime: false }))
    const g = formToGig(f, { id: 'E', base: e, now, author })
    expect(g?.lines.find((l) => l.id === 'e3')).toEqual({ id: 'e3', itemId: 'ptz03', qty: 1 })
  })

  it('records who confirmed and when, and clears it when made tentative again', () => {
    const b = gigBInitial()
    const f = { ...formFromGig(b), status: 'vahvistettu' as const }
    const confirmed = formToGig(f, { id: 'B', base: b, now, author })
    expect(confirmed).toMatchObject({ confirmedAt: now, confirmedBy: author })

    const back = formToGig(
      { ...formFromGig(confirmed!), status: 'alustava' },
      { id: 'B', base: confirmed!, now: now + 1, author },
    )
    expect(back).not.toHaveProperty('confirmedAt')
    expect(back).not.toHaveProperty('confirmedBy')
  })
})

describe('withConfirmation', () => {
  it('keeps the original stamps when a confirmed gig is edited or marked done', () => {
    const g: Gig = { ...gigBInitial(), status: 'valmis', confirmedAt: 1, confirmedBy: 'anna' }
    expect(withConfirmation(g, 'vahvistettu', now, author)).toBe(g)
  })
})

describe('validateForm', () => {
  it('accepts a complete form', () => {
    expect(hasErrors(validateForm(filled(), itemById))).toBe(false)
  })

  it('requires a name, a location and all four times', () => {
    const e = validateForm({ ...emptyForm(author, null) }, itemById)
    expect(e.name).toBe('Anna keikalle nimi.')
    expect(e.locationId).toBe('Valitse kohde.')
    expect(e.equipStart).toBe('Anna päivä ja kellonaika.')
    expect(e.equipEnd).toBe('Anna päivä ja kellonaika.')
    expect(hasErrors(e)).toBe(true)
  })

  it('checks the order of the times', () => {
    const e = validateForm({ ...filled(), eventEnd: at('2026-12-01 09:00') }, itemById)
    expect(e.times).toMatch(/väärässä järjestyksessä/)
  })

  it('rejects the same device twice but allows several cable lines', () => {
    const f = filled()
    const dup = { ...f, lines: [...f.lines, newLineDraft('l3', { id: 'kam01' })] }
    expect(validateForm(dup, itemById).gig).toMatch(/kahdesti/)
    const cables = { ...f, lines: [...f.lines, { ...newLineDraft('l3', { id: 'xlr' }), qty: 4 }] }
    expect(validateForm(cables, itemById).gig).toBeUndefined()
  })

  it('reports line problems: own time outside the equipment period and too many cables', () => {
    const f = filled()
    f.lines = [
      { ...newLineDraft('l1', { id: 'kam01' }), ownTime: true, end: at('2026-12-03 10:00') },
      { ...newLineDraft('l2', { id: 'xlr' }), qty: 41 },
      { ...newLineDraft('l3', { id: 'xlr' }), qty: '' },
    ]
    const e = validateForm(f, itemById)
    expect(e.lines.l1).toEqual(['Oman ajan pitää olla kalustojakson sisällä.'])
    expect(e.lines.l2).toEqual(['Määrä on suurempi kuin kalustossa on.'])
    expect(e.lines.l3).toEqual(['Määrän pitää olla kokonaisluku, vähintään 1.'])
  })
})

describe('newLineId', () => {
  it('avoids ids already on the gig', () => {
    const ids = ['a', 'a', 'b']
    let i = 0
    expect(newLineId([{ id: 'a' }], () => ids[i++] ?? 'z')).toBe('b')
  })
})
