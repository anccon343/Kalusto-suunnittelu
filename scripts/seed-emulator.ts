/**
 * Fills the local Firestore emulator (project demo-roudari) with realistic example data
 * for development and screenshots. Never touches production: it only talks to the
 * emulator on 127.0.0.1:8080.
 *
 *   pnpm emulators      # terminal 1
 *   pnpm seed:emu       # terminal 2 (clears the emulator first)
 *   pnpm dev:emu        # then sign in with any account in the emulator popup
 *
 * Sign-in in the emulator: the allowlist contains dev@example.com, so choose
 * "Add new account" and use that email.
 */
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { computeAwaitingReturn } from '../src/core/availability'
import { addDays, dateOf, localToInstantOrThrow, type LocalDate } from '../src/core/time'
import type { Gig, Item, Line, Location } from '../src/core/types'
import { EMULATOR_PROJECT_ID } from '../src/data/config'
import { gigToWire, itemToWire, locationToWire } from '../src/data/schemas'

const AUTHOR = 'dev@example.com'
const stamp = { updatedBy: AUTHOR, updatedAt: serverTimestamp() }

/** Helsinki time on the day `offset` days from this week's Monday. */
function at(monday: LocalDate, offset: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return localToInstantOrThrow({ ...addDays(monday, offset), hour: h ?? 0, minute: m ?? 0 })
}

function thisMonday(): LocalDate {
  const today = dateOf(Date.now())
  const weekday = (new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay() + 6) % 7
  return addDays(today, -weekday)
}

const locations: Location[] = [
  {
    id: 'studio',
    name: 'Oma studio',
    isOwnStudio: true,
    rooms: ['Iso studio', 'Pikku studio', 'Keittiöstudio', 'Pikku tarkkaamo', 'Iso tarkkaamo'],
    archived: false,
  },
  {
    id: 'clarion',
    name: 'Clarion Hotel Helsinki',
    isOwnStudio: false,
    rooms: ['Bysa 1', 'Bysa 2', 'Bysa 3', 'Sonck', 'Crusell', 'Ulappa 1', 'Ulappa 2'],
    address: 'Tyynenmerenkatu 2, Helsinki',
    loadingNotes: 'Ulappa 1–2 tornin 16. krs, kalusto hissillä.',
    archived: false,
  },
  {
    id: 'espoo',
    name: 'Asiakas Oy, Espoo',
    isOwnStudio: false,
    rooms: ['Auditorio'],
    address: 'Keilaranta 1, Espoo',
    archived: false,
  },
]

const unit = (
  id: string,
  tag: string,
  name: string,
  category: string,
  extra: Partial<Item> = {},
): Item => ({
  id,
  tag,
  name,
  category,
  quantity: 1,
  condition: 'ok',
  homeLocationId: 'studio',
  archived: false,
  ...extra,
})

function items(monday: LocalDate): Item[] {
  return [
    unit('kam01', 'KAM-01', 'Sony FX6', 'Kamerat', {
      manufacturer: 'Sony',
      model: 'FX6',
      serialNo: '5012001',
    }),
    unit('kam02', 'KAM-02', 'Sony FX6', 'Kamerat', {
      manufacturer: 'Sony',
      model: 'FX6',
      serialNo: '5012002',
    }),
    unit('kam03', 'KAM-03', 'Sony FX6', 'Kamerat', {
      manufacturer: 'Sony',
      model: 'FX6',
      condition: 'huollossa',
      conditionUntil: at(monday, 4, '16:00'),
      notes: 'Sensorin puhdistus huollossa.',
    }),
    unit('kam04', 'KAM-04', 'Sony FX6', 'Kamerat', { manufacturer: 'Sony', model: 'FX6' }),
    unit('ptz01', 'PTZ-01', 'Panasonic AW-UE150', 'Kamerat'),
    unit('ptz02', 'PTZ-02', 'Panasonic AW-UE150', 'Kamerat'),
    unit('ptz03', 'PTZ-03', 'Panasonic AW-UE150', 'Kamerat'),
    unit('pc01', 'PC-01', 'vMix-tuotantokone 1', 'Tietokoneet'),
    unit('pc02', 'PC-02', 'vMix-tuotantokone 2', 'Tietokoneet'),
    unit('pc03', 'PC-03', 'Läppäri (Teams/Zoom)', 'Tietokoneet'),
    unit('enk01', 'ENK-01', 'Kiloview-enkooderi', 'Striimaus'),
    unit('mik01', 'MIK-01', 'Yamaha DM3 -mikseri', 'Ääni'),
    unit('lan01', 'LAN-01', 'Langaton mikkisetti (4 kpl)', 'Ääni'),
    unit('val01', 'VAL-01', 'Aputure 600d', 'Valot'),
    unit('val02', 'VAL-02', 'Aputure 600d', 'Valot'),
    unit('tv01', 'TV-01', '65" näyttö jalalla', 'Näytöt', {
      condition: 'rikki',
      notes: 'Paneelissa halkeama.',
    }),
    unit('xlr10', 'XLR10', 'XLR 10 m', 'Kaapelit', { quantity: 40 }),
    unit('hdmi3', 'HDMI3', 'HDMI 3 m', 'Kaapelit', { quantity: 20 }),
    unit('sdi20', 'SDI20', 'SDI 20 m', 'Kaapelit', { quantity: 12 }),
  ]
}

const line = (id: string, itemId: string, extra: Partial<Line> = {}): Line => ({
  id,
  itemId,
  qty: 1,
  ...extra,
})

function gigs(monday: LocalDate): Gig[] {
  const base = { responsible: AUTHOR, crew: [AUTHOR] }
  return [
    {
      id: 'lanseeraus',
      name: 'Lanseeraus',
      client: 'Tuote Oy',
      locationId: 'studio',
      room: 'Iso studio',
      status: 'vahvistettu',
      equipStart: at(monday, 0, '11:00'),
      eventStart: at(monday, 0, '12:00'),
      eventEnd: at(monday, 0, '16:00'),
      equipEnd: at(monday, 0, '17:00'),
      lines: [
        line('a1', 'ptz01'),
        line('a2', 'ptz02'),
        line('a3', 'xlr10', { qty: 10 }),
        line('a4', 'pc01'),
      ],
      ...base,
    },
    {
      id: 'webinaari',
      name: 'Webinaari X',
      client: 'Koulutus Ry',
      locationId: 'studio',
      room: 'Pikku studio',
      status: 'vahvistettu',
      equipStart: at(monday, 1, '08:00'),
      eventStart: at(monday, 1, '09:00'),
      eventEnd: at(monday, 1, '16:00'),
      equipEnd: at(monday, 1, '17:00'),
      lines: [
        line('w1', 'kam01'),
        line('w2', 'kam02'),
        line('w3', 'xlr10', { qty: 8 }),
        line('w4', 'pc02'),
      ],
      ...base,
    },
    {
      id: 'hybridi',
      name: 'Hybridiseminaari',
      client: 'Asiakas Oy',
      locationId: 'clarion',
      room: 'Bysa 2',
      status: 'alustava',
      equipStart: at(monday, 0, '14:00'),
      eventStart: at(monday, 1, '10:00'),
      eventEnd: at(monday, 1, '16:00'),
      equipEnd: at(monday, 2, '12:00'),
      notes: 'Striimi YouTubeen, kaksi kameraa + PTZ.',
      lines: [
        line('b1', 'kam01'),
        line('b2', 'ptz01', {
          from: {
            gigId: 'lanseeraus',
            lineId: 'a1',
            handoverAt: at(monday, 0, '17:00'),
            travelMin: 30,
          },
        }),
        line('b3', 'ptz02', {
          from: {
            gigId: 'lanseeraus',
            lineId: 'a2',
            handoverAt: at(monday, 0, '17:00'),
            travelMin: 30,
          },
        }),
        line('b4', 'xlr10', { qty: 20 }),
        line('b5', 'enk01'),
        line('b6', 'mik01'),
      ],
      ...base,
    },
    {
      id: 'asiakastilaisuus',
      name: 'Asiakastilaisuus',
      client: 'Asiakas Oy',
      locationId: 'espoo',
      room: 'Auditorio',
      status: 'alustava',
      equipStart: at(monday, 2, '07:00'),
      eventStart: at(monday, 2, '09:00'),
      eventEnd: at(monday, 2, '12:00'),
      equipEnd: at(monday, 3, '12:00'),
      lines: [line('c1', 'kam04'), line('c2', 'xlr10', { qty: 12 }), line('c3', 'lan01')],
      ...base,
    },
    {
      id: 'tuotevideo',
      name: 'Tuotevideo',
      client: 'Keittiö Oy',
      locationId: 'studio',
      room: 'Keittiöstudio',
      status: 'vahvistettu',
      equipStart: at(monday, 3, '08:00'),
      eventStart: at(monday, 3, '09:00'),
      eventEnd: at(monday, 3, '16:00'),
      equipEnd: at(monday, 3, '17:00'),
      lines: [line('d1', 'kam02'), line('d2', 'val01'), line('d3', 'val02')],
      ...base,
    },
    {
      id: 'messut',
      name: 'Messut',
      client: 'Messu Oy',
      locationId: 'clarion',
      room: 'Bysa 1',
      status: 'vahvistettu',
      equipStart: at(monday, 6, '14:00'),
      eventStart: at(monday, 7, '09:00'),
      eventEnd: at(monday, 8, '16:00'),
      equipEnd: at(monday, 9, '12:00'),
      lines: [
        line('e1', 'kam01'),
        line('e2', 'kam02'),
        line('e3', 'ptz03', { end: at(monday, 7, '19:00') }),
        line('e4', 'xlr10', { qty: 16 }),
      ],
      ...base,
    },
  ]
}

async function main() {
  const env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080 },
  })
  await env.clearFirestore()
  const monday = thisMonday()
  const own = new Set(locations.filter((l) => l.isOwnStudio).map((l) => l.id))
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, 'allowedUsers', AUTHOR), { name: 'Kehittäjä', initials: 'KE', ...stamp })
    for (const { id, ...l } of locations)
      await setDoc(doc(db, 'locations', id), { ...locationToWire(l), ...stamp })
    for (const { id, ...i } of items(monday))
      await setDoc(doc(db, 'items', id), { ...itemToWire(i), ...stamp })
    for (const g of gigs(monday)) {
      const { id, ...input } = g
      const awaitingReturn = computeAwaitingReturn(g, own.has(g.locationId))
      await setDoc(doc(db, 'gigs', id), { ...gigToWire(input), awaitingReturn, ...stamp })
    }
  })
  await env.cleanup()
  console.log(
    `Seeded the emulator for the week starting ${monday.day}.${monday.month}.${monday.year}.`,
  )
}

await main()
