/** Helpers for date and time form fields (Helsinki wall clock ↔ instant). */
import {
  instantToLocal,
  localToInstant,
  parseDate,
  parseTime,
  toIsoDate,
  type Ms,
} from '../core/time'

const pad = (n: number) => String(n).padStart(2, '0')

/** Instant → values for `<input type="date">` and `<input type="time">`. */
export function splitInstant(value: Ms | undefined): { date: string; time: string } {
  if (value === undefined) return { date: '', time: '' }
  const l = instantToLocal(value)
  return { date: toIsoDate(l), time: `${pad(l.hour)}:${pad(l.minute)}` }
}

export type Combined =
  { kind: 'empty' } | { kind: 'ok'; ms: Ms } | { kind: 'error'; message: string }

export function combine(date: string, time: string): Combined {
  if (!date && !time) return { kind: 'empty' }
  const d = parseDate(date)
  const t = parseTime(time)
  if (!d || !t) return { kind: 'error', message: 'Anna päivä ja kellonaika.' }
  const r = localToInstant({ ...d, ...t })
  if (r.ok) return { kind: 'ok', ms: r.ms }
  return r.reason === 'nonexistent'
    ? { kind: 'error', message: 'Tätä kellonaikaa ei ole kesäaikaan siirryttäessä.' }
    : { kind: 'error', message: 'Päivä tai kellonaika ei kelpaa.' }
}
