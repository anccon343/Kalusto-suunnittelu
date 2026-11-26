import { describe, expect, it } from 'vitest'
import { at, gig, item, line, locations, STUDIO, CLARION } from '../../core/__fixtures__/scenario'
import type { Stored } from '../../core/types'
import { backupAge, backupFileName, backupJson, buildBackup, type BackupSource } from './backup'

const stamp = { updatedAt: at('2026-11-20 12:00'), updatedBy: 'anna@example.com' }
const stored = <T>(x: T): Stored<T> => ({ ...x, ...stamp })
const iso = (s: string) => ({ _ts: new Date(at(s)).toISOString() })

function source(): BackupSource {
  const camera = item('kam1', 'KAM-01', {
    condition: 'huollossa',
    conditionUntil: at('2026-12-03 12:00'),
    locationOverride: {
      text: 'Pakettiautossa',
      at: at('2026-11-25 10:00'),
      by: 'anna@example.com',
    },
  })
  const cables = item('xlr', 'XLR-10', { quantity: 40 })
  const g = gig('b', {
    locationId: CLARION,
    equipStart: at('2026-12-01 07:00'),
    eventStart: at('2026-12-01 09:00'),
    eventEnd: at('2026-12-01 16:00'),
    equipEnd: at('2026-12-01 18:00'),
    lines: [
      line('l1', 'kam1'),
      line('l2', 'xlr', {
        qty: 12,
        start: at('2026-12-01 09:00'),
        end: at('2026-12-01 15:00'),
        from: { gigId: 'a', lineId: 'x', handoverAt: at('2026-12-01 08:00'), travelMin: 30 },
      }),
    ],
    status: 'vahvistettu',
    confirmedAt: at('2026-11-24 09:00'),
    confirmedBy: 'anna@example.com',
    departedAt: at('2026-12-01 07:05'),
    departedBy: 'anna@example.com',
    lineMarks: { l2: { departedAt: at('2026-12-01 09:05'), returnedAt: at('2026-12-01 15:10') } },
  })
  return {
    users: [stored({ email: 'anna@example.com', name: 'Anna', initials: 'AN' })],
    settings: { lastBackupAt: at('2026-10-01 08:00') },
    locations: locations.map(stored),
    items: [stored(camera), stored(cables)],
    packages: [stored({ id: 'p1', name: 'Perussetti', lines: [{ itemId: 'xlr', qty: 4 }] })],
    gigs: [stored(g)],
  }
}

describe('buildBackup', () => {
  const exportedAt = at('2026-11-26 10:00')
  const b = buildBackup(source(), exportedAt)

  it('has the header', () => {
    expect(b.app).toBe('roudari')
    expect(b.version).toBe(1)
    expect(b.exportedAt).toEqual(iso('2026-11-26 10:00'))
  })

  it('keys documents by id and keeps the fields as stored', () => {
    expect(Object.keys(b.collections.locations)).toEqual([STUDIO, CLARION, 'espoo'])
    expect(b.collections.allowedUsers['anna@example.com']).toEqual({
      name: 'Anna',
      initials: 'AN',
      updatedAt: iso('2026-11-20 12:00'),
      updatedBy: 'anna@example.com',
    })
    expect(b.collections.packages.p1).toMatchObject({ lines: [{ itemId: 'xlr', qty: 4 }] })
    expect(b.collections.items.xlr).toMatchObject({ quantity: 40, tag: 'XLR-10' })
    expect(b.collections.items.xlr).not.toHaveProperty('id')
  })

  it('writes every time field as {_ts}', () => {
    const { items, gigs, settings } = b.collections
    expect(settings.app).toEqual({ lastBackupAt: iso('2026-10-01 08:00') })
    expect(items.kam1).toMatchObject({
      conditionUntil: iso('2026-12-03 12:00'),
      locationOverride: { text: 'Pakettiautossa', at: iso('2026-11-25 10:00') },
      updatedAt: iso('2026-11-20 12:00'),
    })
    expect(gigs.b).toMatchObject({
      equipStart: iso('2026-12-01 07:00'),
      eventStart: iso('2026-12-01 09:00'),
      eventEnd: iso('2026-12-01 16:00'),
      equipEnd: iso('2026-12-01 18:00'),
      confirmedAt: iso('2026-11-24 09:00'),
      departedAt: iso('2026-12-01 07:05'),
      lineMarks: {
        l2: { departedAt: iso('2026-12-01 09:05'), returnedAt: iso('2026-12-01 15:10') },
      },
      lines: [
        { id: 'l1', itemId: 'kam1', qty: 1 },
        {
          id: 'l2',
          qty: 12,
          start: iso('2026-12-01 09:00'),
          end: iso('2026-12-01 15:00'),
          from: { gigId: 'a', lineId: 'x', handoverAt: iso('2026-12-01 08:00'), travelMin: 30 },
        },
      ],
    })
  })

  it('includes the derived awaitingReturn of gigs', () => {
    expect(b.collections.gigs.b).toMatchObject({ awaitingReturn: true })
  })

  it('leaves no raw numbers in time fields', () => {
    const json = backupJson(source(), exportedAt)
    for (const key of ['updatedAt', 'equipStart', 'handoverAt', 'start', 'end', 'at']) {
      expect(json).not.toMatch(new RegExp(`"${key}": \\d`))
    }
    expect(JSON.parse(json)).toEqual(b)
  })

  it('handles empty collections', () => {
    const empty = buildBackup(
      { users: [], settings: {}, locations: [], items: [], packages: [], gigs: [] },
      exportedAt,
    )
    expect(empty.collections).toEqual({
      allowedUsers: {},
      settings: { app: {} },
      locations: {},
      items: {},
      packages: {},
      gigs: {},
    })
  })
})

describe('backupFileName', () => {
  it('uses the Helsinki date', () => {
    // 23.30 UTC on 30.11. is already 1.12. in Helsinki.
    expect(backupFileName(Date.UTC(2026, 10, 30, 23, 30))).toBe(
      'roudari-varmuuskopio-2026-12-01.json',
    )
  })
})

describe('backupAge', () => {
  const now = at('2026-11-26 10:00')
  it('is never without a backup', () => {
    expect(backupAge(undefined, now)).toEqual({ kind: 'never' })
  })
  it('is ok up to 30 days', () => {
    expect(backupAge(at('2026-10-27 10:00'), now)).toEqual({ kind: 'ok', days: 30 })
  })
  it('is stale after 30 days', () => {
    expect(backupAge(at('2026-10-27 09:00'), now)).toEqual({ kind: 'stale', days: 30 })
    expect(backupAge(at('2026-09-26 10:00'), now)).toEqual({ kind: 'stale', days: 61 })
  })
})
