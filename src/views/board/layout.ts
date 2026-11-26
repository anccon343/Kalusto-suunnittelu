/**
 * Pure layout of the equipment board (plan section 3, wireframe 3.3).
 *
 * The visible window is a list of Helsinki calendar days. A position on the board is
 * a fractional column: `2.5` is the middle of the third day. Days are 23, 24 or 25
 * hours long, so positions are computed per day, never by dividing by 24 hours.
 */
import { CONDITION_SRC, type Demand, type Segment } from '../../core/availability'
import { addDays, dayRange, weekdayIndex, type LocalDate, type Ms } from '../../core/time'

export interface BoardDay {
  date: LocalDate
  start: Ms
  end: Ms
}

/** `count` consecutive Helsinki days starting at `first`. */
export function boardDays(first: LocalDate, count: number): BoardDay[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(first, i)
    return { date, ...dayRange(date) }
  })
}

/** The Monday of the week containing `d` (weeks start on Monday). */
export function mondayOf(d: LocalDate): LocalDate {
  return addDays(d, -weekdayIndex(d))
}

/** Fractional column of an instant, clamped to `[0, days.length]`. */
export function columnAt(t: Ms, days: readonly BoardDay[]): number {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last || t <= first.start) return 0
  if (t >= last.end) return days.length
  for (let i = 0; i < days.length; i++) {
    const d = days[i] as BoardDay
    if (t < d.end) return i + (t - d.start) / (d.end - d.start)
  }
  return days.length
}

export type BarKind = 'confirmed' | 'tentative' | 'condition' | 'late'

/** One interval to draw on a device row, before clipping to the window. */
export interface BarInput {
  start: Ms
  end: Ms
  kind: BarKind
  /** Gig name, or the condition text. */
  label: string
  /** Gig id, or `CONDITION_SRC`. */
  src: string
  /** The booking starts with a valid direct transfer from another gig (">"). */
  transferIn: boolean
}

export interface Bar extends BarInput {
  key: string
  startCol: number
  endCol: number
  /** The interval continues before / after the visible window. */
  clippedStart: boolean
  clippedEnd: boolean
  /** Vertical lane; overlapping bars get different lanes. */
  lane: number
}

export interface DescribeContext {
  gigName: (gigId: string) => string
  conditionLabel: string
  isTransferIn: (gigId: string, lineId: string) => boolean
}

/**
 * Turns an item's demands into drawable intervals. An unreturned booking (`dueAt`)
 * becomes its planned part plus an open-ended "Palauttamatta" part.
 */
export function demandsToBarInputs(demands: readonly Demand[], ctx: DescribeContext): BarInput[] {
  const out: BarInput[] = []
  for (const d of demands) {
    if (d.src === CONDITION_SRC) {
      out.push({
        start: d.start,
        end: d.end,
        kind: 'condition',
        label: ctx.conditionLabel,
        src: d.src,
        transferIn: false,
      })
      continue
    }
    const label = ctx.gigName(d.src)
    const transferIn = d.lineId !== undefined && ctx.isTransferIn(d.src, d.lineId)
    const kind: BarKind = d.firm ? 'confirmed' : 'tentative'
    const plannedEnd = d.dueAt ?? d.end
    if (d.start < plannedEnd) {
      out.push({ start: d.start, end: plannedEnd, kind, label, src: d.src, transferIn })
    }
    if (d.dueAt !== undefined) {
      const lateStart = Math.max(d.start, d.dueAt)
      out.push({ start: lateStart, end: d.end, kind: 'late', label, src: d.src, transferIn: false })
    }
  }
  return out
}

/** Clips intervals to the window and assigns lanes so that overlapping bars never share one. */
export function layoutBars(inputs: readonly BarInput[], days: readonly BoardDay[]): Bar[] {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return []
  const visible = inputs
    .filter((b) => b.start < last.end && first.start < b.end && b.start < b.end)
    .toSorted((a, b) => a.start - b.start || b.end - a.end)
  const laneEnds: Ms[] = []
  return visible.map((b, i) => {
    let lane = laneEnds.findIndex((end) => end <= b.start)
    if (lane === -1) lane = laneEnds.push(b.end) - 1
    else laneEnds[lane] = b.end
    return {
      ...b,
      key: `${b.src}-${b.kind}-${b.start}-${i}`,
      startCol: columnAt(b.start, days),
      endCol: columnAt(b.end, days),
      clippedStart: b.start < first.start,
      clippedEnd: b.end > last.end,
      lane,
    }
  })
}

export type Severity = 'red' | 'yellow'

export interface ConflictMark {
  key: string
  start: Ms
  end: Ms
  startCol: number
  endCol: number
  severity: Severity
}

const severityOf = (s: Readonly<Segment>): Severity | undefined =>
  s.red ? 'red' : s.yellow ? 'yellow' : undefined

/** Red and yellow segments inside the window; touching segments of equal severity are merged. */
export function conflictMarks(
  segments: readonly Readonly<Segment>[],
  days: readonly BoardDay[],
): ConflictMark[] {
  const first = days[0]
  const last = days.at(-1)
  if (!first || !last) return []
  const out: ConflictMark[] = []
  for (const s of segments) {
    const severity = severityOf(s)
    if (!severity || !(s.start < last.end && first.start < s.end)) continue
    const prev = out.at(-1)
    if (prev && prev.severity === severity && prev.end === s.start) {
      prev.end = s.end
      prev.endCol = columnAt(s.end, days)
      continue
    }
    out.push({
      key: `${severity}-${s.start}`,
      start: s.start,
      end: s.end,
      startCol: columnAt(s.start, days),
      endCol: columnAt(s.end, days),
      severity,
    })
  }
  return out
}

/** The worst conflict touching one day: red wins over yellow. */
export function daySeverity(
  segments: readonly Readonly<Segment>[],
  day: { start: Ms; end: Ms },
): Severity | undefined {
  let worst: Severity | undefined
  for (const s of segments) {
    if (!(s.start < day.end && day.start < s.end)) continue
    if (s.red) return 'red'
    if (s.yellow) worst = 'yellow'
  }
  return worst
}
