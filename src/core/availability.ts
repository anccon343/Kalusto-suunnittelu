/**
 * Availability and conflict engine (plan, section 5).
 *
 * Pure and deterministic: given items, gigs, which locations are the own
 * studio, and "now", it derives every booking interval and every conflict.
 * Nothing computed here is stored; the UI recomputes whenever data changes.
 *
 * Intervals are half-open `[start, end)`: a booking ending at 17.00 and one
 * starting at 17.00 do not overlap.
 */
import { HOUR, MINUTE, type Ms } from './time'
import type { Gig, Item, Line } from './types'

/** Demand source id used for an item's own condition (huollossa / rikki). */
export const CONDITION_SRC = '#kunto'

export interface Demand {
  readonly start: Ms
  /** May be `Infinity` (open-ended condition or unreturned equipment). */
  readonly end: Ms
  readonly qty: number
  /** Confirmed, done, departed or a condition: counts towards red conflicts. */
  readonly firm: boolean
  /** Gig id, or `CONDITION_SRC`. */
  readonly src: string
  /** The line that produced this demand (absent for a condition). */
  readonly lineId?: string
  /**
   * Set when the booking is extended past its planned end because the equipment
   * has not been returned (rule 5): the planned end ("piti palata …").
   */
  readonly dueAt?: Ms
}

/** An unreturned booking active in a segment ("ei ole palautettu keikalta X, myöhässä …"). */
export interface LateRef {
  readonly gigId: string
  readonly lineId: string
  readonly dueAt: Ms
}

export interface Segment {
  start: Ms
  end: Ms
  /** Firm demand exceeds capacity. */
  readonly red: boolean
  /** Tentative demand causes the excess or makes it larger. */
  readonly yellow: boolean
  /** Capacity minus all demand (negative when overbooked); minimum over the segment. */
  free: number
  /** Sources of firm demand, sorted and unique; empty unless `red`. */
  readonly redSrcs: readonly string[]
  /** Sources of all demand, sorted and unique. */
  readonly allSrcs: readonly string[]
  /** Unreturned bookings active in the segment, sorted by gig and line. */
  readonly late: readonly LateRef[]
}

/** A red segment, the unit rule 9 compares before and after a save. */
export interface RedSegment {
  readonly itemId: string
  readonly start: Ms
  readonly end: Ms
  readonly srcs: readonly string[]
}

export interface FreeSpan {
  start: Ms
  end: Ms
  free: number
}

export type ChainProblem =
  | 'cycle'
  | 'source-missing'
  | 'gig-not-live'
  | 'item-mismatch'
  | 'qty-exceeds-source'
  | 'multiple-receivers'
  | 'handover-outside-source'
  | 'handover-after-receiver-end'

export type ChainCheck = { ok: true } | { ok: false; problem: ChainProblem }

export type Slack =
  | { kind: 'ok'; slack: Ms; arrivalAt: Ms }
  | { kind: 'too-late'; slack: Ms; arrivalAt: Ms }
  | { kind: 'arrives-mid-event'; arrivalAt: Ms }

export interface LineRef {
  gig: Gig
  line: Line
}

export interface LineConflict {
  readonly start: Ms
  readonly end: Ms
  readonly severity: 'red' | 'yellow'
  /** Other demand sources in the segment (gig ids or `CONDITION_SRC`), sorted. */
  readonly competitors: readonly string[]
  /** Unreturned bookings of other gigs in the segment. */
  readonly late: readonly LateRef[]
}

export interface AvailabilityInput {
  items: readonly Item[]
  gigs: readonly Gig[]
  ownStudioLocationIds: Iterable<string>
  now: Ms
}

export const DEFAULT_HANDOVER_DELAY: Ms = HOUR

export function lineKey(gigId: string, lineId: string): string {
  return `${gigId}/${lineId}`
}

export function isLive(g: Gig): boolean {
  return g.status !== 'peruttu' || (g.departedAt !== undefined && g.returnedAt === undefined)
}

export function isFirm(g: Gig): boolean {
  return g.status === 'vahvistettu' || g.status === 'valmis' || g.departedAt !== undefined
}

const uniqueSorted = (xs: Iterable<string>): string[] => [...new Set(xs)].sort()

/**
 * Builds red/yellow segments for one item from its demands. Only segments with a
 * conflict are returned; adjacent segments with identical classification are merged.
 */
export function computeSegments(capacity: number, demands: readonly Demand[]): Segment[] {
  // A Set removes duplicates, so the comparator never sees Infinity - Infinity.
  const times = [...new Set(demands.flatMap((d) => [d.start, d.end]))].sort((a, b) => a - b)
  const out: Segment[] = []
  for (let i = 0; i + 1 < times.length; i++) {
    const start = times[i] as Ms
    const end = times[i + 1] as Ms
    const active = demands.filter((d) => d.start <= start && start < d.end)
    if (active.length === 0) continue
    const firmActive = active.filter((d) => d.firm)
    const firmUse = sum(firmActive)
    const allUse = sum(active)
    const red = firmUse > capacity
    const yellow = allUse - capacity > Math.max(0, firmUse - capacity)
    if (!red && !yellow) continue
    const seg: Segment = {
      start,
      end,
      red,
      yellow,
      free: capacity - allUse,
      redSrcs: red ? uniqueSorted(firmActive.map((d) => d.src)) : [],
      allSrcs: uniqueSorted(active.map((d) => d.src)),
      late: lateRefs(active),
    }
    const prev = out.at(-1)
    if (prev && prev.end === seg.start && sameClass(prev, seg)) {
      prev.end = seg.end
      prev.free = Math.min(prev.free, seg.free)
    } else {
      out.push(seg)
    }
  }
  return out
}

function lateRefs(active: readonly Demand[]): LateRef[] {
  const refs = new Map<string, LateRef>()
  for (const d of active) {
    if (d.dueAt === undefined || d.lineId === undefined) continue
    refs.set(lineKey(d.src, d.lineId), { gigId: d.src, lineId: d.lineId, dueAt: d.dueAt })
  }
  return [...refs.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, r]) => r)
}

const lateKey = (refs: readonly LateRef[]) =>
  refs.map((r) => `${lineKey(r.gigId, r.lineId)}@${r.dueAt}`).join('\n')

function sameClass(a: Segment, b: Segment): boolean {
  return (
    a.red === b.red &&
    a.yellow === b.yellow &&
    lateKey(a.late) === lateKey(b.late) &&
    a.redSrcs.join('\n') === b.redSrcs.join('\n') &&
    a.allSrcs.join('\n') === b.allSrcs.join('\n')
  )
}

function sum(ds: readonly Demand[]): number {
  return ds.reduce((acc, d) => acc + d.qty, 0)
}

/**
 * Free quantity over `window`, split wherever demand changes. Demands from
 * `excludeSrc` are ignored (a gig's own line shows what is free for *other* gigs).
 */
export function computeFreeTimeline(
  capacity: number,
  demands: readonly Demand[],
  window: { start: Ms; end: Ms },
  excludeSrc?: string,
): FreeSpan[] {
  if (!(window.start < window.end)) return []
  const relevant = demands.filter(
    (d) => d.src !== excludeSrc && d.start < window.end && window.start < d.end,
  )
  const cuts = new Set<Ms>([window.start, window.end])
  for (const d of relevant) {
    if (d.start > window.start && d.start < window.end) cuts.add(d.start)
    if (d.end > window.start && d.end < window.end) cuts.add(d.end)
  }
  const times = [...cuts].sort((a, b) => a - b)
  const out: FreeSpan[] = []
  for (let i = 0; i + 1 < times.length; i++) {
    const start = times[i] as Ms
    const end = times[i + 1] as Ms
    const used = sum(relevant.filter((d) => d.start <= start && start < d.end))
    const free = capacity - used
    const prev = out.at(-1)
    if (prev && prev.free === free) prev.end = end
    else out.push({ start, end, free })
  }
  return out
}

export const redKey = (r: RedSegment): string => `${r.itemId}|${r.srcs.join(',')}`

/**
 * Rule 9: red combinations that a save would create. A red segment after the save
 * is pre-existing if, on the same item and overlapping it in time, a red segment
 * existed before whose sources include all of its sources. So leaving a 3-way
 * conflict (A,B,C → B,C) or shortening an existing one is never blocked, while the
 * same pair clashing on a new, non-overlapping period is.
 */
export function blockingOnSave(
  before: readonly RedSegment[],
  after: readonly RedSegment[],
): string[] {
  const existed = (a: RedSegment) =>
    before.some(
      (b) =>
        b.itemId === a.itemId &&
        b.start < a.end &&
        a.start < b.end &&
        a.srcs.every((x) => b.srcs.includes(x)),
    )
  return [...new Set(after.filter((a) => !existed(a)).map(redKey))].sort()
}

/**
 * The availability model for one snapshot of data at one instant.
 * Build a new one whenever data or "now" changes; results are memoised inside and
 * returned as shared read-only snapshots (use `toSorted()` etc., never mutate).
 */
export class Availability {
  readonly now: Ms
  readonly items: readonly Item[]
  readonly gigs: readonly Gig[]
  private readonly itemById = new Map<string, Item>()
  private readonly gigById = new Map<string, Gig>()
  private readonly ownStudio: ReadonlySet<string>
  private readonly lineByKey = new Map<string, LineRef>()
  private readonly receiversByKey = new Map<string, LineRef[]>()
  private readonly linesByItem = new Map<string, LineRef[]>()
  private readonly chainMemo = new Map<string, Readonly<ChainCheck>>()
  private readonly segmentMemo = new Map<string, readonly Readonly<Segment>[]>()
  private readonly demandMemo = new Map<string, readonly Demand[]>()

  constructor(input: AvailabilityInput) {
    this.now = input.now
    this.items = input.items
    this.gigs = input.gigs
    this.ownStudio = new Set(input.ownStudioLocationIds)
    for (const it of input.items) this.itemById.set(it.id, it)
    for (const g of input.gigs) {
      this.gigById.set(g.id, g)
      for (const line of g.lines) {
        const ref = { gig: g, line }
        this.lineByKey.set(lineKey(g.id, line.id), ref)
        push(this.linesByItem, line.itemId, ref)
        if (line.from) push(this.receiversByKey, lineKey(line.from.gigId, line.from.lineId), ref)
      }
    }
  }

  item(id: string): Item | undefined {
    return this.itemById.get(id)
  }

  gig(id: string): Gig | undefined {
    return this.gigById.get(id)
  }

  line(gigId: string, lineId: string): LineRef | undefined {
    return this.lineByKey.get(lineKey(gigId, lineId))
  }

  isOwnStudio(g: Gig): boolean {
    return this.ownStudio.has(g.locationId)
  }

  /** `awaitingReturn`: an external, confirmed or departed gig that has not been returned. */
  awaitingReturn(g: Gig): boolean {
    return !this.isOwnStudio(g) && isFirm(g) && g.returnedAt === undefined && isLive(g)
  }

  // -------------------------------------------------------------------------
  // Line intervals and direct transfers (rules 3, 4, 11)
  // -------------------------------------------------------------------------

  lineEnd(ref: LineRef): Ms {
    return ref.line.end ?? ref.gig.equipEnd
  }

  /** Booking start: the handover of a valid direct transfer, else own start, else departure. */
  lineStart(ref: LineRef): Ms {
    const { gig, line } = ref
    if (line.from && this.chainCheck(ref).ok) return line.from.handoverAt
    return line.start ?? gig.equipStart
  }

  /** Receivers pointing at this line, in gigs that are live. */
  liveReceivers(ref: LineRef): LineRef[] {
    const all = this.receiversByKey.get(lineKey(ref.gig.id, ref.line.id)) ?? []
    return all.filter((r) => isLive(r.gig))
  }

  /** The single valid receiver of this line, if any. */
  validReceiver(ref: LineRef): LineRef | undefined {
    const receivers = this.liveReceivers(ref)
    const only = receivers[0]
    return receivers.length === 1 && only && this.chainCheck(only).ok ? only : undefined
  }

  /** Rule 4: whether this line's direct transfer is valid, and why not. */
  chainCheck(ref: LineRef): Readonly<ChainCheck> {
    const key = lineKey(ref.gig.id, ref.line.id)
    const cached = this.chainMemo.get(key)
    if (cached) return cached
    const result = this.computeChainCheck(ref)
    this.chainMemo.set(key, result)
    return result
  }

  private computeChainCheck(ref: LineRef): ChainCheck {
    const { gig: b, line: r } = ref
    if (!r.from) return { ok: false, problem: 'source-missing' }
    // Detect cycles before recursing into the source's start time.
    if (this.inCycle(ref)) return { ok: false, problem: 'cycle' }
    const src = this.line(r.from.gigId, r.from.lineId)
    if (!src) return { ok: false, problem: 'source-missing' }
    if (!isLive(src.gig) || !isLive(b)) return { ok: false, problem: 'gig-not-live' }
    if (src.line.itemId !== r.itemId) return { ok: false, problem: 'item-mismatch' }
    if (r.qty > src.line.qty) return { ok: false, problem: 'qty-exceeds-source' }
    if (this.liveReceivers(src).length !== 1) return { ok: false, problem: 'multiple-receivers' }
    const problem = this.handoverProblem(src, b, this.lineEnd(ref), r.from.handoverAt)
    return problem ? { ok: false, problem } : { ok: true }
  }

  /** The handover part of rule 4, shared by `chainCheck` and `defaultHandover`. */
  private handoverProblem(
    src: LineRef,
    receiver: Gig,
    receiverLineEnd: Ms,
    h: Ms,
  ): 'handover-outside-source' | 'handover-after-receiver-end' | undefined {
    if (!(this.lineStart(src) < h && h <= this.lineEnd(src))) return 'handover-outside-source'
    if (!(h < receiver.eventEnd && h < receiverLineEnd)) return 'handover-after-receiver-end'
    return undefined
  }

  /** True when following `from` links from this line leads back to it. */
  private inCycle(ref: LineRef): boolean {
    const startKey = lineKey(ref.gig.id, ref.line.id)
    const seen = new Set<string>()
    let cur: LineRef | undefined = ref
    while (cur?.line.from) {
      const k = lineKey(cur.line.from.gigId, cur.line.from.lineId)
      if (k === startKey) return true
      if (seen.has(k)) return false // a cycle further down the chain, not through this line
      seen.add(k)
      cur = this.lineByKey.get(k)
    }
    return false
  }

  /** Rule 8: slack of a direct transfer. Undefined for lines without `from`. */
  slack(ref: LineRef): Slack | undefined {
    const { gig, line } = ref
    if (!line.from) return undefined
    const arrivalAt = line.from.handoverAt + (line.from.travelMin ?? 0) * MINUTE
    if (line.start === undefined && line.from.handoverAt > gig.eventStart) {
      return { kind: 'arrives-mid-event', arrivalAt }
    }
    const neededAt = line.start ?? gig.eventStart
    const slack = neededAt - arrivalAt
    return slack < 0 ? { kind: 'too-late', slack, arrivalAt } : { kind: 'ok', slack, arrivalAt }
  }

  /**
   * Rule 11: default handover for a new direct transfer from `source` to a line on
   * `receiver`. The first candidate that satisfies rule 4: source event end + 1 h,
   * the end of the source line, or the receiver's departure (multi-day source).
   * Undefined when none fits; the user then enters the handover.
   */
  defaultHandover(source: LineRef, receiver: Gig, receiverLineEnd?: Ms): Ms | undefined {
    const rEnd = receiverLineEnd ?? receiver.equipEnd
    const candidates = [
      source.gig.eventEnd + DEFAULT_HANDOVER_DELAY,
      this.lineEnd(source),
      receiver.equipStart,
    ]
    return candidates.find((h) => this.handoverProblem(source, receiver, rEnd, h) === undefined)
  }

  /**
   * Rule 11: lines on other live gigs that book the same item during this line's
   * booking and whose event starts before this gig's event. Candidates for a
   * direct transfer; never applied automatically.
   */
  transferCandidates(ref: LineRef): LineRef[] {
    const start = ref.line.start ?? ref.gig.equipStart
    const end = this.lineEnd(ref)
    const selfKey = lineKey(ref.gig.id, ref.line.id)
    return (this.linesByItem.get(ref.line.itemId) ?? []).filter((other) => {
      if (other.gig.id === ref.gig.id || !isLive(other.gig)) return false
      if (!(other.gig.eventStart < ref.gig.eventStart)) return false
      const taken = this.liveReceivers(other).some((r) => lineKey(r.gig.id, r.line.id) !== selfKey)
      if (taken) return false
      return this.lineStart(other) < end && start < this.lineEnd(other)
    })
  }

  // -------------------------------------------------------------------------
  // Demands (rules 3, 5, 6)
  // -------------------------------------------------------------------------

  /** The booking intervals produced by one line (the part that stays and the part handed over). */
  lineDemands(ref: LineRef): Demand[] {
    const { gig: g, line: l } = ref
    if (!isLive(g)) return []
    const firm = isFirm(g)
    const start = this.lineStart(ref)
    const receiver = this.validReceiver(ref)
    const sent = receiver ? receiver.line.qty : 0
    const returnedAt =
      l.end !== undefined ? (g.lineMarks?.[l.id]?.returnedAt ?? g.returnedAt) : g.returnedAt
    const plannedEnd = this.lineEnd(ref)
    let end = plannedEnd
    let dueAt: Ms | undefined
    if (returnedAt !== undefined && returnedAt < end) {
      end = returnedAt // returned early
    } else if (returnedAt === undefined && firm && !this.isOwnStudio(g) && this.now >= end) {
      end = Infinity // not returned: keeps blocking (rule 5)
      dueAt = plannedEnd
    }
    const handoverAt = receiver?.line.from?.handoverAt ?? start
    const stay: Demand = { start, end, qty: l.qty - sent, firm, src: g.id, lineId: l.id }
    const handedOver: Demand = { start, end: handoverAt, qty: sent, firm, src: g.id, lineId: l.id }
    return [dueAt === undefined ? stay : { ...stay, dueAt }, handedOver].filter(
      (d) => d.qty > 0 && d.start < d.end,
    )
  }

  demandsFor(itemId: string): readonly Demand[] {
    const cached = this.demandMemo.get(itemId)
    if (cached) return cached
    const it = this.itemById.get(itemId)
    const out: Demand[] = []
    // An archived item already has capacity 0; its condition adds nothing (rule 6).
    if (it && !it.archived && it.condition !== 'ok') {
      out.push({
        start: -Infinity,
        end: it.conditionUntil ?? Infinity,
        qty: it.quantity,
        firm: true,
        src: CONDITION_SRC,
      })
    }
    for (const ref of this.linesByItem.get(itemId) ?? []) out.push(...this.lineDemands(ref))
    this.demandMemo.set(itemId, out)
    return out
  }

  capacity(itemId: string): number {
    const it = this.itemById.get(itemId)
    return !it || it.archived ? 0 : it.quantity
  }

  // -------------------------------------------------------------------------
  // Conflicts (rules 7, 9) and free quantities
  // -------------------------------------------------------------------------

  segments(itemId: string): readonly Readonly<Segment>[] {
    const cached = this.segmentMemo.get(itemId)
    if (cached) return cached
    const segs = computeSegments(this.capacity(itemId), this.demandsFor(itemId))
    this.segmentMemo.set(itemId, segs)
    return segs
  }

  /** Every red segment of every item; input to rule 9 (`blockingOnSave`). */
  redSegments(): RedSegment[] {
    return this.bookedItemIds().flatMap((itemId) =>
      this.segments(itemId)
        .filter((s) => s.red)
        .map((s) => ({ itemId, start: s.start, end: s.end, srcs: s.redSrcs })),
    )
  }

  /** Every red combination, e.g. "kam01|gigB,gigW". */
  redKeys(): Set<string> {
    return new Set(this.redSegments().map(redKey))
  }

  /** Conflicts that concern one gig line, for its badge. */
  lineConflicts(ref: LineRef): LineConflict[] {
    const own = this.lineDemands(ref)
    const gigId = ref.gig.id
    const out: LineConflict[] = []
    for (const s of this.segments(ref.line.itemId)) {
      if (!s.allSrcs.includes(gigId)) continue
      if (!own.some((d) => d.start < s.end && s.start < d.end)) continue
      const severity = s.red && s.redSrcs.includes(gigId) ? 'red' : 'yellow'
      out.push({
        start: s.start,
        end: s.end,
        severity,
        competitors: s.allSrcs.filter((x) => x !== gigId),
        late: s.late.filter((r) => r.gigId !== gigId),
      })
    }
    return out
  }

  /** Free quantity for other gigs during a window, excluding one gig's own demand. */
  freeTimeline(itemId: string, window: { start: Ms; end: Ms }, excludeGigId?: string): FreeSpan[] {
    return computeFreeTimeline(this.capacity(itemId), this.demandsFor(itemId), window, excludeGigId)
  }

  minFree(itemId: string, window: { start: Ms; end: Ms }, excludeGigId?: string): number {
    const spans = this.freeTimeline(itemId, window, excludeGigId)
    return spans.length === 0 ? this.capacity(itemId) : Math.min(...spans.map((s) => s.free))
  }

  private bookedItemIds(): string[] {
    const ids = new Set<string>(this.linesByItem.keys())
    for (const it of this.items) if (!it.archived && it.condition !== 'ok') ids.add(it.id)
    return [...ids].sort()
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k)
  if (arr) arr.push(v)
  else m.set(k, [v])
}
