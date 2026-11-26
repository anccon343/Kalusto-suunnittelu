import { describe, expect, it } from 'vitest'
import {
  lastDayOf,
  modeOfView,
  periodTitle,
  readViewState,
  VIEW_OF_MODE,
  writeViewState,
} from './viewState'

describe('readViewState', () => {
  it('defaults to the month on wide screens and the list on phones', () => {
    expect(readViewState(new URLSearchParams(), true)).toEqual({
      mode: 'kuukausi',
      date: undefined,
    })
    expect(readViewState(new URLSearchParams(), false)).toEqual({ mode: 'lista', date: undefined })
  })

  it('reads the mode and date from the address', () => {
    const p = new URLSearchParams('nakyma=viikko&paiva=2026-12-01')
    expect(readViewState(p, false)).toEqual({ mode: 'viikko', date: '2026-12-01' })
  })

  it('ignores unknown modes and invalid dates', () => {
    const p = new URLSearchParams('nakyma=vuosi&paiva=2026-13-01')
    expect(readViewState(p, true)).toEqual({ mode: 'kuukausi', date: undefined })
  })
})

describe('writeViewState', () => {
  it('sets the mode and date and keeps other parameters', () => {
    const next = writeViewState(new URLSearchParams('perutut=1&paiva=2026-01-01'), {
      mode: 'lista',
      date: '2026-12-01',
    })
    expect(next.toString()).toBe('perutut=1&paiva=2026-12-01&nakyma=lista')
  })

  it('drops the date when there is none', () => {
    const next = writeViewState(new URLSearchParams('paiva=2026-01-01'), {
      mode: 'kuukausi',
      date: undefined,
    })
    expect(next.toString()).toBe('nakyma=kuukausi')
  })
})

describe('view names', () => {
  it('maps modes to FullCalendar views and back', () => {
    for (const [mode, view] of Object.entries(VIEW_OF_MODE)) expect(modeOfView(view)).toBe(mode)
    expect(modeOfView('multiMonthYear')).toBeUndefined()
  })
})

describe('periodTitle', () => {
  it('names the month', () => {
    expect(periodTitle('kuukausi', '2026-12-01', '2026-12-31')).toBe('joulukuu 2026')
  })

  it('names the ISO week and its days', () => {
    expect(periodTitle('viikko', '2026-11-30', '2026-12-06')).toBe('vk 49 · 30.11.–6.12.2026')
    expect(periodTitle('viikko', '2026-12-28', '2027-01-03')).toBe('vk 53 · 28.12.2026–3.1.2027')
  })

  it('shows the list period', () => {
    expect(periodTitle('lista', '2026-11-30', '2026-12-13')).toBe('30.11.–13.12.2026')
  })

  it('is empty before the calendar has reported its period', () => {
    expect(periodTitle('lista', '', '')).toBe('')
  })
})

describe('lastDayOf', () => {
  it('turns an exclusive end into the last day, across months', () => {
    expect(lastDayOf('2027-01-01')).toBe('2026-12-31')
    expect(lastDayOf('nonsense')).toBe('')
  })
})
