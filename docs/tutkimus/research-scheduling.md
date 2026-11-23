# Scheduling research: timeline UI and availability logic for the equipment planner

Research date: 2026-11-23. Versions and dates were checked against the npm registry and vendor pages where noted. Anything not verified is marked **[unverified]**.

## 1. Summary and recommendation

- **Month calendar and gig lists:** use **FullCalendar Standard (MIT, v7.1.5, 2026-11-12)** with the `dayGridMonth` and `list` views. The Finnish locale ships in v7 (`@fullcalendar/react/locales/fi.js`, confirmed in the package). It is free, mature and works on phones.
- **Resource timeline (rows = items or crew, bars = bookings):** build a **custom CSS-grid "availability board"** in phase 1.
  - The views that matter most here are domain-specific and no library gives them out of the box:
    - quantity rows like "XLR: 34/40" per day,
    - hatched prep and return buffers,
    - gig-to-gig transfer markers,
    - red shortage cells.
  - Editing happens in forms (the gig detail view), not by dragging. That is more reliable on phones anyway.
- **If drag-and-drop on the timeline becomes essential later**, there are two upgrade paths:
  - **(a) FullCalendar Premium `resourceTimeline`**: from $480, covers 1–10 developers. Same API and theme as the month view, and the lowest-risk path.
  - **(b) Bryntum Scheduler Community (MIT)**: free, but the tier is only 3 weeks old and the buffer feature is paid (see below). Re-evaluate in mid-2027.
- **Logic:** store each booking as a half-open interval with separate prep and return buffers. Use per-item overlap checks for serialized items and a sweep line for bulk quantities. Expand kits into their parts before checking. Show conflicts as warnings that can be overridden, not hard blocks. Rentman and Current RMS both work this way; Current RMS allows overbooking by default.

## 2. Library comparison (verified 2026-11-23)

| Library | Version / date | License / cost | Month view | Resource timeline | Mobile | Fit |
|---|---|---|---|---|---|---|
| **FullCalendar** | 7.1.5, 2026-11-12 | Standard MIT. Timeline and resource views are **Premium**, "starting at $480" for 1–10 developers. Renewal before expiry is 50% off, and if you stop renewing you can keep using the last version released before expiry. Premium is also offered under AGPLv3 or CC BY-NC-ND, but neither suits a for-profit company. | Yes (free) | Yes (paid). v7 adds `virtualization: true` and `resourceGroupField` | Month and list views are good. The timeline needs horizontal scrolling | **Use Standard now, Premium as the upgrade** |
| **Schedule-X** | @schedule-x/calendar 4.9.1, 2026-09-29 | MIT core. Premium costs €479/yr or €999 lifetime (ex VAT), per project. The resource scheduler is Premium. | Month grid, month agenda, week, day. `isResponsive` switches views on narrow screens | Paid | Good | Good alternative month view. It has an `fiFI` translation. One inconsistency: the site marks drag-and-drop as Premium, but `@schedule-x/drag-and-drop` 3.7.3 on npm is MIT **[unclear]** |
| **vis-timeline** | 8.5.6, 2026-10-26 | Apache-2.0 OR MIT | No | Yes: `groups`, `nestedGroups`, subgroups, `type:'background'` items, `editable`, `cluster` | Pinch zoom, long press | The strongest free timeline. It is imperative DOM code with no official React wrapper, and has 268 open issues |
| **react-calendar-timeline** | Stable 0.28.0 (uses moment). 0.30 betas run to beta.19 (2026-07-24), and npm's `latest` tag points at a beta | MIT | No | Yes, groups = rows | Pinch zoom, `itemTouchSendsClick` | Workable, but 0.30 has been in beta for a long time. Risky |
| **react-big-calendar** | 1.20.0, 2026-06-01 | MIT | Yes | No. `resources` are columns in day/week views only | Weak | No |
| **frappe-gantt** | 1.2.2, 2026-02-25 | MIT | No | No. It is a task Gantt with one row per task | Fair | No |
| **Bryntum Scheduler** | 8.0.0 released 2026-11-03. `@bryntum/scheduler-community` 8.0.2, 2026-11-19 | **New Community tier, MIT.** Core is $850 and Enterprise $1,300 per developer per year: the license is perpetual, the yearly fee covers updates | No (separate Calendar product) | Excellent | Touch support **[unverified for 8.0]** | Community includes EventDrag, EventResize, EventDragCreate, EventEdit, tooltips and Dependencies. It does **not** include `EventBuffer` (Enterprise only) or `TimeRanges`, `NonWorkingTime`, `ResourceTimeRanges`, `EventFilter` and `Labels` (Core). About 11.8 MB unpacked and uses a React wrapper. Very new, so watch it |
| **DHTMLX Scheduler** | 7.2.15, 2026-08-17 | Standard GPLv2 has **no Timeline view**. PRO is $599 (Individual) or $1,299 (Commercial) | Yes | PRO only | Fair | No: the free version is GPL and the timeline is paid |
| **Custom CSS grid** | – | Your own code | – | Full control | You design it | **Phase 1 choice for the board** |

Why a custom board? Every library treats a row as "one resource with non-overlapping events". Bulk stock such as 40 XLR cables, 12 stands or 6 radio mics needs **count-per-period cells**, not bars. The fleet is a few hundred rows at day or half-day resolution, which a CSS grid handles easily (use TanStack Virtual if it grows). Plan about 1–2 weeks of work for a read-only board with click-through to the gig.

## 3. Views

1. **Kalenteri (month):** FullCalendar `dayGridMonth`, with `listWeek` on phones. Gig colour shows status (alustava/vahvistettu/peruttu), and a shortage badge reads e.g. "⚠ 3 puutetta".
2. **Kalustotaulu (resource board):**
   - **Rows:** items grouped by category. A serialized item gets one row. A bulk item gets one row of count cells, e.g. "34/40", turning red when demand exceeds stock.
   - **Columns:** days. Zooming to half-day or hour is optional.
   - **Bars:** the core gig time is solid. Prep and return buffers are a lighter hatched segment. Overlapping parts are drawn red and striped. A transfer is a "→ Clarion" chip at the end of the bar.
   - **Toggle:** rows can switch to crew ("kuka").
3. **Keikka (gig detail):**
   - times: prep, show, teardown, return,
   - venue and room: Studio 1 Halli, or Clarion Hotel Helsinki with its room,
   - responsible person and crew,
   - booking lines with kits shown as collapsible groups, each line with a conflict state,
   - a "Ratkaise" (resolve) panel with actions: swap item, change time, mark as sub-rental, or accept the overbooking.
4. **Tuote (item):** an agenda of where the item is and when, plus its transfer chain. This is the main mobile view for one item.

On phones, avoid showing the wide timeline. Use the list and agenda views and the gig checklist instead.

## 4. Data model (Firestore)

```ts
Location { id, name, type: 'studio_room'|'storage'|'vehicle'|'venue'|'venue_room', parentId? }
// The "tila" ambiguity is handled by two separate fields:
// Item.status = condition, and location = Location reference.

Item {                       // serialized
  id, name, categoryId, tracking: 'serial', serialNo?,
  homeLocationId, status: 'ok'|'huollossa'|'rikki'|'kadonnut',
  defaultPrepMin?, defaultReturnMin?
}
BulkItem {                   // quantity-based
  id, name, categoryId, tracking: 'bulk', totalQty, homeLocationId
}
OutOfService { id, itemId, qty, start, end, reason }   // repairs and losses reduce available stock

Kit {                        // template that is expanded when booked
  id, name, components: [{ itemId, qty }]   // e.g. "Striimikitti"
}
// A fixed flight case is modelled as a serialized Item with containsItemIds[].
// Booking the case books its contents.

Gig {
  id, name, venueLocationId, roomLocationId?,
  showStart, showEnd,                       // the actual event
  prepMin, returnMin,                       // packing, load-in, teardown, return
  status: 'alustava'|'vahvistettu'|'peruttu',
  responsibleUserId, crewUserIds[]
}
Booking {                    // one line per item (or per bulk quantity)
  id, gigId, itemId, qty,                   // qty = 1 for serialized items
  kitInstanceId?,                           // groups lines that came from one kit
  start, end,                               // blocked interval, denormalized from the gig and buffers
  fromGigId?: string,                       // null means it comes from base
  toGigId?: string,                         // null means it returns to base
  status (copied from the gig), override?: { by, note }   // overbooking was acknowledged
}
```

Storage rules:
- Store UTC timestamps and display them in `Europe/Helsinki`, so daylight-saving changes are handled. FullCalendar v7 uses `temporal-polyfill`.
- Recompute `start`/`end` whenever the gig's times or buffers change.
- Firestore now allows range filters on several fields in one query, so `start < windowEnd AND end > windowStart` works with a composite index. With 5–20 users you can also load the whole visible window and compute everything on the client.

## 5. Availability algorithms

Intervals are half-open `[start, end)`, so a booking ending at 12:00 does not clash with one starting at 12:00.

The blocked interval is `blocked(b) = [gig.showStart - prep, gig.showEnd + ret]`, with two exceptions:
- **Gig-to-gig transfer:** if `b.toGigId` is set, the return buffer is replaced by the transfer time and the next booking starts at the next gig's load-in. The item never returns to base in between.

```pseudo
function blockedInterval(b, gig):
  s = gig.showStart - (b.fromGigId ? transferMin(b.fromGigId, gig) : gig.prepMin)
  e = gig.showEnd   + (b.toGigId   ? 0                            : gig.returnMin)
  return [s, e)

// Serialized item: candidate check, O(k) per item
function serialConflicts(itemId, cand):
  return bookings.where(itemId == itemId AND status != 'peruttu'
                        AND start < cand.end AND end > cand.start
                        AND id != cand.id)

// Bulk item: sweep line, O(n log n)
function bulkShortages(itemId, window):
  ev = []
  for b in bookings(itemId, window): ev += (b.start, +b.qty, b), (b.end, -b.qty, b)
  for o in outOfService(itemId, window): ev += (o.start, +o.qty, o), (o.end, -o.qty, o)
  sort ev by (time, delta ascending)   // at equal times, releases come before new bookings
  used = 0; active = {}; out = []
  for (t, d, src) in ev:
    used += d; update active
    if used > item.totalQty: open or extend a shortage
         { from: t, peak: max(peak, used - totalQty), gigs: active.gigIds }
    else: close any open shortage at t
  return out   // e.g. [{from, to, missing: 4, gigs: [A, B]}]

// Kits: expand into component demands, then run the item checks
function kitAvailable(kit, interval):
  return min over c in kit.components of floor(freeQty(c.itemId, interval) / c.qty)
  // for a serialized part, freeQty = count of free units of that model

// Transfer feasibility (gig A → gig B)
function transferOK(A, B, item):
  arrive = A.showEnd + A.teardownMin + travelMin(A.venue, B.venue)
  return arrive <= B.showStart - B.prepMin
  // if not OK, flag "Siirto ei ehdi" (transfer will not make it)

// Where is the item at time t?
function locationAt(item, t):
  b = booking of item covering t
  if b: return t within the show time ? gig.room/venue : 'Kuljetuksessa / pakkaus'
  return item.homeLocationId
```

Severity levels:
- **Hard (red):** confirmed vs confirmed, or demand that exceeds stock.
- **Soft (amber):** any conflict involving a tentative (alustava) gig.
- **Overridden (grey outline):** shows who accepted it and their note.

Recompute conflicts whenever a gig or booking changes. Store a `conflictCount` on the gig for the calendar badge, using a Cloud Function or a client write.

**Concurrent edits:** two planners could take the last unit at the same moment. With this team size, a warning on save plus a live `onSnapshot` refresh is enough. If hard blocking is ever needed, run a Firestore transaction on a per-item lock document.

**Generic lines (optional, later):** "2× langaton mikki" (2 wireless mics) can be booked as a category demand before specific units are assigned. In that case, check availability against the sum of units in the category.

## 6. Showing conflicts clearly

- **Timeline:** only the overlapping part of the bar is red and striped, not the whole bar. Bulk cells show the shortfall, e.g. "−4".
- **Gig view:** each conflicting line has a red chip with text such as "Varattu: Clarion 12.12. klo 8–18". Tapping it opens the competing gig.
- **Resolve panel:** "Puutteet" (shortages) lists the missing items and quantities with one-click actions: swap for a similar item, shift the time, mark as sub-rental, or accept the overbooking.
- **Calendar:** a badge on the gig.
- **Accessibility:** never rely on colour alone. Pair it with ⚠ icons and text.

## 7. Trade-offs and risks

- **Custom board:** costs development time but gives full control and no licence fees. Drag-and-drop is postponed on purpose.
- **FullCalendar Premium:** the cleanest upgrade if dragging bookings becomes valuable.
  - It is unclear whether $480 is per year; the pricing page only says "renewal is encouraged" **[clarify with sales]**.
  - The licence page requires a commercial licence for "for-profit companies" and does not mention internal-only use separately. Assume a licence is required.
- **Bryntum Community:**
  - The free tier is three weeks old.
  - Buffers (`EventBuffer`) are Enterprise only. You can work around this by drawing buffers as separate events.
  - The bundle is heavy.
- **Schedule-X:** where its free and paid features split is not fully clear from its own site.

## Sources
- https://fullcalendar.io/pricing
- https://fullcalendar.io/license
- https://fullcalendar.io/docs/premium
- https://fullcalendar.io/docs/timeline-view
- https://fullcalendar.io/docs/upgrading-from-v6
- https://unpkg.com/@fullcalendar/react-scheduler@7.1.5/LICENSE.md
- https://data.jsdelivr.com/v1/packages/npm/@fullcalendar/react@7.1.5?structure=flat
- https://schedule-x.dev/premium
- https://schedule-x.dev/docs/calendar
- https://schedule-x.dev/docs/calendar/configuration
- https://github.com/schedule-x/schedule-x
- https://github.com/visjs/vis-timeline
- https://visjs.github.io/vis-timeline/docs/timeline/
- https://github.com/namespace-ee/react-calendar-timeline
- https://bryntum.com/?p=1017 (Bryntum Scheduler pricing)
- https://bryntum.com/products/scheduler/changelog/
- https://unpkg.com/@bryntum/scheduler-community@8.0.2/README.md
- https://dhtmlx.com/docs/products/dhtmlxScheduler/
- https://firebase.google.com/docs/firestore/query-data/multiple-range-fields
- https://help.current-rms.com/articles/660517-what-is-availability
- https://support.rentman.io/hc/en-us/articles/17035832287506-Resolving-New-Equipment-Shortages-After-Project-Shifts
- https://rentman.io/product-updates/solving-equipment-shortages-with-alternatives-and-subrentals
- npm registry (https://registry.npmjs.org/<package>) for versions and dates: vis-timeline, @schedule-x/*, react-big-calendar, frappe-gantt, react-calendar-timeline, @fullcalendar/*, dhtmlx-scheduler, @bryntum/*