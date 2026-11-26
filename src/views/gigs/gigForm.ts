/**
 * The gig edit form's state and its conversion to and from the domain `Gig`
 * (plan 2.3, 4.2). Pure: no React, no Firebase.
 *
 * Times have no defaults (user answer T2): a new form starts with all four empty.
 */
import type { Ms } from '../../core/time'
import type { Gig, GigStatus, Item, Line, LineFrom } from '../../core/types'
import { validateGig, validateLine, type LineProblem } from '../../core/validation'
import { t } from './texts'

/** Id used for a gig that does not exist yet, in draft availability models. */
export const NEW_GIG_ID = '#uusi'

export const TIME_KEYS = ['equipStart', 'eventStart', 'eventEnd', 'equipEnd'] as const
export type TimeKey = (typeof TIME_KEYS)[number]

export interface LineDraft {
  id: string
  itemId: string
  /** '' while the number field is empty. */
  qty: number | ''
  note: string
  /** Whether the line has its own time ("Mukana alkaen / asti"). */
  ownTime: boolean
  start: Ms | undefined
  end: Ms | undefined
  /** Direct transfer (phase 1b UI); kept unchanged when the gig is edited. */
  from: LineFrom | undefined
}

export interface GigForm {
  name: string
  client: string
  locationId: string | null
  room: string | null
  responsible: string | null
  crew: string[]
  notes: string
  status: GigStatus
  equipStart: Ms | undefined
  eventStart: Ms | undefined
  eventEnd: Ms | undefined
  equipEnd: Ms | undefined
  lines: LineDraft[]
}

export function emptyForm(author: string, locationId: string | null): GigForm {
  return {
    name: '',
    client: '',
    locationId,
    room: null,
    responsible: author,
    crew: [],
    notes: '',
    status: 'alustava',
    equipStart: undefined,
    eventStart: undefined,
    eventEnd: undefined,
    equipEnd: undefined,
    lines: [],
  }
}

export function lineToDraft(l: Line): LineDraft {
  return {
    id: l.id,
    itemId: l.itemId,
    qty: l.qty,
    note: l.note ?? '',
    ownTime: l.start !== undefined || l.end !== undefined,
    start: l.start,
    end: l.end,
    from: l.from,
  }
}

export function formFromGig(g: Gig): GigForm {
  return {
    name: g.name,
    client: g.client ?? '',
    locationId: g.locationId,
    room: g.room ?? null,
    responsible: g.responsible,
    crew: [...g.crew],
    notes: g.notes ?? '',
    status: g.status,
    equipStart: g.equipStart,
    eventStart: g.eventStart,
    eventEnd: g.eventEnd,
    equipEnd: g.equipEnd,
    lines: g.lines.map(lineToDraft),
  }
}

export function newLineDraft(id: string, item: Pick<Item, 'id'>): LineDraft {
  return {
    id,
    itemId: item.id,
    qty: 1,
    note: '',
    ownTime: false,
    start: undefined,
    end: undefined,
    from: undefined,
  }
}

/** A short line id, unique within the gig. */
export function newLineId(
  existing: readonly { id: string }[],
  random: () => string = () => crypto.randomUUID().slice(0, 8),
): string {
  const taken = new Set(existing.map((l) => l.id))
  let id = random()
  while (taken.has(id)) id = random()
  return id
}

function draftToLine(d: LineDraft): Line {
  const note = d.note.trim()
  return {
    id: d.id,
    itemId: d.itemId,
    qty: typeof d.qty === 'number' ? d.qty : 0,
    ...(note ? { note } : {}),
    ...(d.ownTime && d.start !== undefined ? { start: d.start } : {}),
    ...(d.ownTime && d.end !== undefined ? { end: d.end } : {}),
    ...(d.from ? { from: d.from } : {}),
  }
}

export type CompleteTimes = Pick<Gig, TimeKey>

export function completeTimes(f: GigForm): CompleteTimes | undefined {
  const { equipStart, eventStart, eventEnd, equipEnd } = f
  if (
    equipStart === undefined ||
    eventStart === undefined ||
    eventEnd === undefined ||
    equipEnd === undefined
  ) {
    return undefined
  }
  return { equipStart, eventStart, eventEnd, equipEnd }
}

const OPTIONAL_TEXT = ['client', 'notes'] as const

/**
 * The gig the form describes, or undefined while a required value (location,
 * responsible, any of the four times) is missing.
 *
 * `base` is the stored gig when editing: fields the form does not show (marks,
 * `lineMarks`, confirmation stamps) are carried over from it. Confirmation stamps are
 * set when the gig becomes confirmed and cleared when it becomes tentative again.
 */
export function formToGig(
  f: GigForm,
  opts: { id: string; base?: Gig; now: Ms; author: string },
): Gig | undefined {
  const times = completeTimes(f)
  if (!times || f.locationId === null || f.responsible === null) return undefined
  const {
    updatedAt: _a,
    updatedBy: _b,
    ...base
  } = (opts.base ?? {}) as Partial<Gig> & {
    updatedAt?: unknown
    updatedBy?: unknown
  }
  const gig: Gig = {
    ...base,
    id: opts.id,
    name: f.name.trim(),
    locationId: f.locationId,
    responsible: f.responsible,
    crew: [...f.crew],
    status: f.status,
    ...times,
    lines: f.lines.map(draftToLine),
  }
  for (const k of OPTIONAL_TEXT) {
    const v = f[k].trim()
    if (v) gig[k] = v
    else delete gig[k]
  }
  if (f.room) gig.room = f.room
  else delete gig.room
  return withConfirmation(gig, opts.base?.status, opts.now, opts.author)
}

const CONFIRMED: readonly GigStatus[] = ['vahvistettu', 'valmis']

/**
 * Rule L5 bookkeeping: becoming confirmed records who confirmed and when; going back
 * to tentative clears it. Other changes keep the stored stamps.
 */
export function withConfirmation(
  g: Gig,
  previous: GigStatus | undefined,
  now: Ms,
  author: string,
): Gig {
  const wasConfirmed = previous !== undefined && CONFIRMED.includes(previous)
  if (CONFIRMED.includes(g.status) && !wasConfirmed) {
    return { ...g, confirmedAt: now, confirmedBy: author }
  }
  if (g.status === 'alustava') {
    const { confirmedAt: _a, confirmedBy: _b, ...rest } = g
    return rest
  }
  return g
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface FormErrors {
  name?: string
  locationId?: string
  responsible?: string
  equipStart?: string
  eventStart?: string
  eventEnd?: string
  equipEnd?: string
  /** Order of the four times. */
  times?: string
  /** Whole-gig problems (duplicate device). */
  gig?: string
  /** Problems per line id. */
  lines: Record<string, string[]>
}

export const NAME_MAX = 120
export const CLIENT_MAX = 120
export const NOTES_MAX = 4000
export const LINE_NOTE_MAX = 500

export function hasErrors(e: FormErrors): boolean {
  const { lines, ...rest } = e
  return Object.values(rest).some(Boolean) || Object.values(lines).some((l) => l.length > 0)
}

export function lineProblemText(p: LineProblem): string {
  return t.errors.line[p]
}

export function validateForm(
  f: GigForm,
  itemById: (id: string) => Item | undefined,
  storedLines: readonly Line[] = [],
): FormErrors {
  const e: FormErrors = { lines: {} }
  const name = f.name.trim()
  if (!name) e.name = t.errors.nameRequired
  else if (name.length > NAME_MAX) e.name = t.errors.tooLong(NAME_MAX)
  if (f.locationId === null) e.locationId = t.errors.locationRequired
  if (f.responsible === null) e.responsible = t.errors.responsibleRequired
  for (const k of TIME_KEYS) if (f[k] === undefined) e[k] = t.errors.timeRequired

  const gig = formToGig(f, { id: NEW_GIG_ID, now: 0, author: '' })
  if (!gig) {
    // Times or required selections are missing: line times cannot be checked yet.
    for (const d of f.lines) {
      const problems = itemById(d.itemId) ? [] : [lineProblemText('item-missing')]
      if (problems.length) e.lines[d.id] = problems
    }
    return e
  }
  const problems = validateGig(gig, itemById)
  if (problems.includes('times-out-of-order')) e.times = t.errors.timesOutOfOrder
  if (problems.includes('duplicate-device')) e.gig = t.errors.duplicateDevice

  const stored = new Map(storedLines.map((l) => [l.id, l]))
  for (const [i, l] of gig.lines.entries()) {
    const d = f.lines[i]
    // An empty number field is reported as a quantity problem by validateLine (qty 0).
    const lineProblems = validateLine(gig, l, itemById(l.itemId), stored.get(l.id))
    // Lines with an own-time switch on but no times entered are simply "whole period".
    if (lineProblems.length && d) e.lines[d.id] = lineProblems.map(lineProblemText)
  }
  return e
}
