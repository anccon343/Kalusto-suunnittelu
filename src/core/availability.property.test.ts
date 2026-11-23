/**
 * Property tests: the segment sweep and free-quantity timeline must agree with a
 * brute-force evaluation at every integer instant, for arbitrary demands.
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeFreeTimeline, computeSegments, type Demand } from './availability'

const demandArb = fc
  .record({
    start: fc.integer({ min: 0, max: 60 }),
    len: fc.integer({ min: 1, max: 40 }),
    qty: fc.integer({ min: 1, max: 4 }),
    firm: fc.boolean(),
    src: fc.constantFrom('a', 'b', 'c', 'd'),
  })
  .map(({ start, len, qty, firm, src }): Demand => ({
    start,
    end: start + len,
    qty,
    firm,
    src,
  }))

function bruteForce(capacity: number, demands: Demand[], t: number) {
  const active = demands.filter((d) => d.start <= t && t < d.end)
  const firmUse = active.filter((d) => d.firm).reduce((s, d) => s + d.qty, 0)
  const allUse = active.reduce((s, d) => s + d.qty, 0)
  return {
    red: firmUse > capacity,
    yellow: allUse - capacity > Math.max(0, firmUse - capacity),
    free: capacity - allUse,
  }
}

describe('availability properties', () => {
  it('segments classify every instant exactly like brute force', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.array(demandArb, { maxLength: 8 }),
        (cap, ds) => {
          const segs = computeSegments(cap, ds)
          for (let t = 0; t <= 100; t++) {
            const expected = bruteForce(cap, ds, t)
            const seg = segs.find((s) => s.start <= t && t < s.end)
            expect({ red: seg?.red ?? false, yellow: seg?.yellow ?? false }).toEqual({
              red: expected.red,
              yellow: expected.yellow,
            })
            if (seg) expect(seg.free).toBeLessThanOrEqual(expected.free)
          }
        },
      ),
      { numRuns: 300 },
    )
  })

  it('segments are ordered, non-overlapping and non-empty', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.array(demandArb, { maxLength: 8 }),
        (cap, ds) => {
          const segs = computeSegments(cap, ds)
          for (const [i, s] of segs.entries()) {
            expect(s.start).toBeLessThan(s.end)
            const next = segs[i + 1]
            if (next) expect(s.end).toBeLessThanOrEqual(next.start)
          }
        },
      ),
      { numRuns: 300 },
    )
  })

  it('the free timeline covers the window exactly and matches brute force', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.array(demandArb, { maxLength: 8 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (cap, ds, ws, wl) => {
          const window = { start: ws, end: ws + wl }
          const spans = computeFreeTimeline(cap, ds, window)
          expect(spans[0]?.start).toBe(window.start)
          expect(spans.at(-1)?.end).toBe(window.end)
          for (let t = window.start; t < window.end; t++) {
            const span = spans.find((s) => s.start <= t && t < s.end)
            expect(span?.free).toBe(bruteForce(cap, ds, t).free)
          }
        },
      ),
      { numRuns: 300 },
    )
  })
})
