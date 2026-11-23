/**
 * The worked example of the plan (docs/SUUNNITELMA.md, sections 3.1, 4.3–4.6)
 * as test data, so the document and the code stay in sync.
 */
import { localToInstantOrThrow, type Ms } from '../time'
import type { Gig, Item, Line, Location } from '../types'

/** Helsinki wall-clock "YYYY-MM-DD HH:mm" → instant. */
export function at(s: string): Ms {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2})$/.exec(s)
  if (!m) throw new Error(`Bad fixture time: ${s}`)
  return localToInstantOrThrow({
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  })
}

export const STUDIO = 'studio'
export const CLARION = 'clarion'
export const ESPOO = 'espoo'

export const locations: Location[] = [
  {
    id: STUDIO,
    name: 'Oma studio',
    isOwnStudio: true,
    rooms: ['Iso studio', 'Pikku studio', 'Keittiöstudio', 'Pikku tarkkaamo', 'Iso tarkkaamo'],
    archived: false,
  },
  {
    id: CLARION,
    name: 'Clarion Hotel Helsinki',
    isOwnStudio: false,
    rooms: ['Bysa 1', 'Bysa 2'],
    archived: false,
  },
  { id: ESPOO, name: 'Asiakas Oy, Espoo', isOwnStudio: false, rooms: [], archived: false },
]

export const OWN_STUDIO_IDS = [STUDIO]

export function item(id: string, tag: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    tag,
    name: tag,
    category: 'Testi',
    quantity: 1,
    condition: 'ok',
    homeLocationId: STUDIO,
    archived: false,
    ...extra,
  }
}

export function line(id: string, itemId: string, extra: Partial<Line> = {}): Line {
  return { id, itemId, qty: 1, ...extra }
}

export function gig(
  id: string,
  extra: Partial<Gig> & Pick<Gig, 'equipStart' | 'eventStart' | 'eventEnd' | 'equipEnd'>,
): Gig {
  return {
    id,
    name: id,
    locationId: STUDIO,
    responsible: 'mikko@example.com',
    crew: [],
    status: 'alustava',
    lines: [],
    ...extra,
  }
}

export const items: Item[] = [
  item('kam01', 'KAM-01', { name: 'Sony FX6' }),
  item('kam02', 'KAM-02', { name: 'Sony FX6' }),
  item('kam03', 'KAM-03', {
    name: 'Sony FX6',
    condition: 'huollossa',
    conditionUntil: at('2026-12-04 16:00'),
  }),
  item('kam04', 'KAM-04', { name: 'Sony FX6' }),
  item('ptz01', 'PTZ-01'),
  item('ptz02', 'PTZ-02'),
  item('ptz03', 'PTZ-03'),
  item('xlr', 'XLR10', { name: 'XLR 10 m', quantity: 40 }),
]

/** A Lanseeraus: own studio, Iso studio, confirmed, Mon 30.11. */
export const gigA = (): Gig =>
  gig('A', {
    name: 'Lanseeraus',
    room: 'Iso studio',
    status: 'vahvistettu',
    equipStart: at('2026-11-30 11:00'),
    eventStart: at('2026-11-30 12:00'),
    eventEnd: at('2026-11-30 16:00'),
    equipEnd: at('2026-11-30 17:00'),
    lines: [line('a1', 'ptz01'), line('a2', 'ptz02'), line('a3', 'xlr', { qty: 10 })],
  })

/** W Webinaari X: own studio, Pikku studio, confirmed, Tue 1.12. */
export const gigW = (): Gig =>
  gig('W', {
    name: 'Webinaari X',
    room: 'Pikku studio',
    status: 'vahvistettu',
    equipStart: at('2026-12-01 08:00'),
    eventStart: at('2026-12-01 09:00'),
    eventEnd: at('2026-12-01 16:00'),
    equipEnd: at('2026-12-01 17:00'),
    lines: [line('w1', 'kam01'), line('w2', 'kam02'), line('w3', 'xlr', { qty: 8 })],
  })

const B_TIMES = {
  locationId: CLARION,
  room: 'Bysa 2',
  equipStart: at('2026-11-30 14:00'),
  eventStart: at('2026-12-01 10:00'),
  eventEnd: at('2026-12-01 16:00'),
  equipEnd: at('2026-12-02 12:00'),
}

/** B Hybridiseminaari before any resolution (section 3.2): tentative, wants KAM-01 and A's PTZs. */
export const gigBInitial = (): Gig =>
  gig('B', {
    name: 'Hybridiseminaari',
    ...B_TIMES,
    lines: [
      line('b1', 'kam01'),
      line('b2', 'ptz01'),
      line('b3', 'ptz02'),
      line('b4', 'xlr', { qty: 20 }),
    ],
  })

/** B after section 4.4: KAM-04, PTZs directly from A at Mon 17.00, confirmed. */
export const gigBResolved = (): Gig =>
  gig('B', {
    name: 'Hybridiseminaari',
    ...B_TIMES,
    status: 'vahvistettu',
    lines: [
      line('b1', 'kam04'),
      line('b2', 'ptz01', {
        from: { gigId: 'A', lineId: 'a1', handoverAt: at('2026-11-30 17:00'), travelMin: 30 },
      }),
      line('b3', 'ptz02', {
        from: { gigId: 'A', lineId: 'a2', handoverAt: at('2026-11-30 17:00'), travelMin: 30 },
      }),
      line('b4', 'xlr', { qty: 20 }),
    ],
  })

const C_TIMES = {
  locationId: ESPOO,
  equipStart: at('2026-12-01 14:00'),
  eventStart: at('2026-12-02 09:00'),
  eventEnd: at('2026-12-02 12:00'),
  equipEnd: at('2026-12-03 12:00'),
}

/** C Asiakastilaisuus: tentative; PTZs and 12 XLR directly from B at Tue 17.00. */
export const gigC = (handover = at('2026-12-01 17:00')): Gig =>
  gig('C', {
    name: 'Asiakastilaisuus',
    responsible: 'jussi@example.com',
    ...C_TIMES,
    lines: [
      line('c1', 'ptz01', {
        from: { gigId: 'B', lineId: 'b2', handoverAt: handover, travelMin: 35 },
      }),
      line('c2', 'ptz02', {
        from: { gigId: 'B', lineId: 'b3', handoverAt: handover, travelMin: 35 },
      }),
      line('c3', 'xlr', {
        qty: 12,
        from: { gigId: 'B', lineId: 'b4', handoverAt: handover, travelMin: 35 },
      }),
    ],
  })

/** C without direct transfers: everything from the studio. */
export const gigCUnchained = (): Gig =>
  gig('C', {
    name: 'Asiakastilaisuus',
    ...C_TIMES,
    lines: [line('c1', 'ptz01'), line('c2', 'ptz02'), line('c3', 'xlr', { qty: 12 })],
  })

/** D Tuotevideo: own studio, Keittiöstudio, Thu 3.12., wants KAM-04 (section 4.5). */
export const gigD = (status: Gig['status'] = 'vahvistettu'): Gig =>
  gig('D', {
    name: 'Tuotevideo',
    room: 'Keittiöstudio',
    status,
    equipStart: at('2026-12-03 08:00'),
    eventStart: at('2026-12-03 09:00'),
    eventEnd: at('2026-12-03 16:00'),
    equipEnd: at('2026-12-03 17:00'),
    lines: [line('d1', 'kam04')],
  })

/** E Messut (section 4.6): two-day gig at Clarion, PTZ-03 only on Monday. */
export const gigE = (): Gig =>
  gig('E', {
    name: 'Messut',
    locationId: CLARION,
    room: 'Bysa 1',
    status: 'vahvistettu',
    responsible: 'anna@example.com',
    equipStart: at('2026-12-06 14:00'),
    eventStart: at('2026-12-07 09:00'),
    eventEnd: at('2026-12-08 16:00'),
    equipEnd: at('2026-12-09 12:00'),
    lines: [
      line('e1', 'kam01'),
      line('e2', 'kam02'),
      line('e3', 'ptz03', { end: at('2026-12-07 19:00') }),
      line('e4', 'xlr', { qty: 16 }),
    ],
  })

/** F Studiohaastattelu (section 4.6): own studio, Pikku studio, Tue 8.12. */
export const gigF = (fromE: boolean): Gig =>
  gig('F', {
    name: 'Studiohaastattelu',
    room: 'Pikku studio',
    status: 'vahvistettu',
    responsible: 'jussi@example.com',
    equipStart: at('2026-12-08 08:00'),
    eventStart: at('2026-12-08 09:00'),
    eventEnd: at('2026-12-08 12:00'),
    equipEnd: at('2026-12-08 13:00'),
    lines: [
      line(
        'f1',
        'kam01',
        fromE
          ? {
              from: { gigId: 'E', lineId: 'e1', handoverAt: at('2026-12-07 18:00'), travelMin: 30 },
            }
          : {},
      ),
    ],
  })
