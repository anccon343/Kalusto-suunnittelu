# UI research: Finnish equipment and gig planning app (responsive, online-only)

Checked 2026-11-23. Versions and prices come from official pages unless marked **(unverified)**.

## 1. Recommendation in one paragraph
Use **Mantine 9** (MIT; the docs site shows v9.8.2; needs React 19.2+) with **Vite + React + TypeScript**. Add **@mantine/dates** for pickers, **@mantine/schedule** (MIT, new in 9.0, March 2026) for the gig calendar, and **mantine-datatable 9.x** for tables. Build the **equipment availability timeline as your own CSS-grid component**: library resource views are built around time slots, and your need is day-level bars plus shortage tiles. Use **dayjs** as the only date library (Mantine Schedule requires it), with the `fi`, `utc`, `timezone` and `isoWeek` plugins. Read Firestore through **thin custom `onSnapshot` hooks**, not TanStack Query. Keep view state in the **URL** and use **Zustand** only for small UI state. Add a **manifest-only "add to home screen"** and no service-worker caching.

## 2. UI framework comparison

| | Mantine 9 | MUI (Material) + MUI X | shadcn/ui + Tailwind | Ant Design 6 |
|---|---|---|---|---|
| License/cost | MIT, everything free incl. Schedule | Core and DatePicker free. **Pro $299/dev/yr, Premium $599/dev/yr** (pricing page; licensing is per application since 8 Apr 2026). Date Range Picker is Pro **(tier not re-verified for v9)**. Scheduler `@mui/x-scheduler` is MIT but **beta** (v9.0.0-beta.16). Event Timeline (resource rows) is **Premium-only** | MIT, you copy the code into your project. Base UI is the default since July 2026; Radix and React Aria are optional | MIT |
| Finnish dates, Monday first | dayjs locale via `DatesProvider`. **`firstDayOfWeek` defaults to 1 (Monday)**. Values are `YYYY-MM-DD[ HH:mm:ss]` strings | Good: `fiFI` locale exists, adapters for dayjs/date-fns | react-day-picker supports `locale: fi` and Monday-first weeks. A v10 rename to `@daypicker/react` is **(unverified)** | `fi_FI` exists. Week start per locale **(unverified for v6)** |
| Mobile ergonomics | Good: container-query `MonthView`, `MobileMonthView`, Drawer, AppShell | Good, but Material look and a heavier bundle | Very good if you build it yourself, but more work | Built for desktop admin screens, weakest on phones |
| Scheduling | `Schedule`, Day/Week/Month/Year/Agenda views, **ResourcesDay/Week/MonthView** with drag between resources, `preventEventOverlap`, `canDropEvent`, `layout="days"` for one cell per resource per day | Timeline needs Premium | None: add FullCalendar or build your own | Basic Calendar only |
| Data grid | mantine-datatable (MIT, 9.x targets Mantine 9). The official mantine-react-table has no confirmed Mantine 9 release | Data Grid free. Pinning and grouping are in Pro/Premium | TanStack Table (headless) | Strong Table |

**Why Mantine:** one coherent, free toolkit covers forms, pickers, a calendar, resource views and tables. Its defaults already fit Finland (Monday first, locale-driven formatting). **Trade-offs:** `@mantine/schedule` is about 8 months old, so expect API churn. Its docs don't spell out multi-day events in resource views. React 19.2+ is required.

**Second choice:** shadcn/ui gives the most design control, but you assemble the table, calendar and timeline yourself. Avoid MUI X Premium (cost) and Ant Design (weak on phones).

Paid timeline libraries are not needed at first: FullCalendar Premium (resource timeline, print view) starts at $480 for 1–10 developers, Schedule-X Premium is €999 per project. The free MIT `react-calendar-timeline` is still on 0.30.0-beta and the maintainer is stretched, so avoid it.

## 3. Dates and times (Europe/Helsinki, multi-day gigs)
- **How to store:** keep instants as Firestore `Timestamp` (UTC). Keep pure calendar days (all-day holds) as `YYYY-MM-DD` strings. Never store formatted strings.
- **One display zone:** always render in `Europe/Helsinki` with `dayjs.tz`, whatever zone the device is in (e.g. a phone abroad). Finland changes clocks on the last Sunday of March and of October. Compute overlaps on UTC instants, and round to days only for display.
- **Each gig has phases, not just start and end:** *Pakkaus/lähtö → Rakennus → Tapahtuma (one or more days) → Purku → Paluu/tarkastus*. A booking blocks equipment for the **blocked period** (lähtö → paluu+tarkastus). This is the same idea as Rentman's planning period (blocked) versus usage period (shown to the customer).
- **Finnish conventions:** dates as `ma 23.11.2026`, times as `klo 9.00` (a dot, not a colon). Show **ISO week numbers** ("vk 48"); Finns use them a lot. Mantine Calendar's `withWeekNumbers` prop is **(unverified for v9)**.
- **Temporal API:** Chrome 144+ and Firefox 139+ have it, **stable Safari does not**, so don't use it yet (iPhones matter). date-fns v4 + `@date-fns/tz` (`TZDate`, the `in` option) is a good alternative, but running two date libraries is pointless with Mantine.

## 4. Routing, data and state
- **Firestore real-time:** `onSnapshot` already works as a live cache. TanStack Query (v5.101.x seen in July 2026) adds a second cache plus `setQueryData` plumbing, and only community patterns exist for it. Invertase's tanstack-query-firebase lists Firestore for React as **"work in progress"**. react-firebase-hooks 5.1.1 got a housekeeping release in November but has a single maintainer.
  - **Recommendation:** write about 100 lines of your own hooks (`useDoc`, `useQuery`) on `useSyncExternalStore`. Use a shared subscription registry keyed by query, so two components on the same data open one listener.
  - Use TanStack Query only for non-live reads (history pages, reports), if at all.
  - Writes go through plain functions or Firestore transactions. A conflict check on save gives a better guarantee than the UI alone.
- **Firebase JS SDK:** 13.1.0 (21 Oct 2026).
- **Routing:** React Router (library/SPA mode) or TanStack Router. Both are fine and **versions are unverified**. Put filters and date windows in search params (`/aikajana?alku=2026-11-23&jakso=14&kategoria=kamerat`) so views can be shared and bookmarked.
- **Zustand:** use it only for cross-page UI state (selected gig, open drawers, "my tasks" filter). Domain data stays in the Firestore hooks.

## 5. PWA
Do it, but **manifest only**: `name`, `display: standalone`, icons, `theme_color`, and an `apple-touch-icon`. Chrome has allowed menu install without a fetch handler since **108 (mobile) / 112 (desktop)**. The *automatic* install prompt still wants a fetch handler, which you don't need. iOS "Lisää Koti-valikkoon" works for any site. **Skip caching service workers.** Offline is out of scope, and a cache risks crew running a stale app version. Possible later: Web Push for task notifications.

## 6. Lessons from Rentman and Current RMS
1. **Availability as a grid of tiles** (Current RMS): products as rows × days as columns. Each tile is coloured **green** (enough stock), **orange** (fully booked or within a buffer) or **red** (overbooked) and shows a count. Filters: group, tags, store, start date, 1–28 days with hourly detail at 1 day. Toggles: **"Shortages only"** and "Include quotations". Clicking a product opens its bookings.
2. **Timeline bars** (Rentman): the usage period is solid, the planning (blocked) period is striped. A shortage is a **red bar with a negative number, only for the overlapping hours**. There is a **legend button**. On the gig's equipment tab the line turns red with status "Shortage", and a **"Solve shortage"** menu lists alternatives and sub-rentals.
3. **Quarantine** (Current RMS): lost, damaged or in-service items leave availability, with an optional end date. Model this as *Huollossa / Rikki / Kadoksissa* holds.
4. **Tentative bookings:** Rentman and Current RMS let you count quoted or tentative bookings. Add a "Alustava" (tentative) toggle.
5. **Warehouse transfers** are first-class in both. Ours are **siirtymät** (moves), including gig → gig.

## 7. Views and screens
Status and location are **separate fields**, which resolves the "mikä tila" ambiguity:
- **Tila** (status): Varastossa / Varattu / Keikalla / Kuljetuksessa / Huollossa / Rikki / Kadoksissa.
- **Sijainti** (location): a studio room (HALLI, KEITTIÖ, WEBINAARI, Tarkkaamo 1/2, SPEAK, Väistötila 111a), a vehicle, or an external venue and its room (e.g. Clarion Hotel Helsinki, a named conference room).

On phones, use a **bottom tab bar**: Tänään · Keikat · Kalusto · Tehtävät · Lisää. On desktop, use a left sidebar.

| # | View | Purpose and key content | Phone vs desktop |
|---|---|---|---|
| 1 | **Tänään** (dashboard) | Today's and tomorrow's gigs with phases and times; departures and returns ("Lähtee klo 7.30 HALLIsta → Clarion"); open shortages (red); overdue returns; my tasks | **Phone first** (morning check) |
| 2 | **Keikat** list + **calendar** | List: filter by status (Alustava/Vahvistettu/Valmis), date, venue, responsible person. Calendar: Mantine `MonthView`/`WeekView`/`AgendaView`, `MobileMonthView` on phones, multi-day bars coloured by status | Both. Agenda on phones, month and week on desktop |
| 3 | **Keikan tiedot** (gig detail), with tabs | **Yleiset**: customer, venue+room, phases, contact. **Kalusto**: grouped lines (category/case), quantity, inline availability ("3/4 vapaana", red "Puute −1"), quick add with search, "Ratkaise puute" drawer (free alternatives in the same category). **Tiimi**: who does what, per phase. **Aikataulu**. **Kuljetukset**: legs (from → to, vehicle, driver, time), auto-suggested from the previous and next bookings ("Kamera A7S-2 tulee suoraan keikalta X"). Actions: duplicate a gig, copy equipment from an earlier gig | Desktop for planning. On phones a read-mostly summary, with status ticks during the gig |
| 4 | **Kalusto** (equipment list) | Fast create and edit: inline-editable table, "Tallenna ja uusi", duplicate item, bulk change of category or location. Two item kinds: **serialized items** and **quantity items** (cables, stands). Columns: name, category, status, current location, next booking. Search-as-you-type | Desktop for heavy editing. Phones: search plus a card list, edit in a full-screen drawer |
| 5 | **Laitteen tiedot** (item detail) | Header: **"Nyt: Keikalla — Clarion, Sali X · Seuraavaksi: 27.11. Studio 3 webinaari"**. Mini-timeline for the next 30 days. **History** list (where it has been, who moved it), holds (huolto), notes | **Phone first** ("where is this thing?") |
| 6 | **Kalustoaikajana** (equipment timeline), custom component | Rows = items, collapsible by category. Columns = days, with week numbers. Striped bars = blocked period, solid = event days, red overlap with a count, grey = maintenance hold. Heat-tile mode for quantity items (Current RMS style). Filters: category, "Vain puutteet", tentative on/off; legend button; click a bar to open the gig. Desktop: drag a bar to another identical item to reassign, with a conflict check. Virtualize rows once you pass a few hundred | **Desktop or tablet first**. On phones, fall back to per-item or per-day lists |
| 7 | **Siirrot** (moves/logistics) | Chronological list of all transport legs, grouped by day and vehicle: what leaves from where to where, who drives, load list per leg; gig-to-gig chains flagged. Optionally `ResourcesWeekView layout="days"` with vehicles and people as rows | Both. Drivers use it on phones |
| 8 | **Sijainnit** (locations/venues) | Own studio rooms, storage, vehicles, external venues with sub-rooms, address, load-in notes (e.g. "Lastausovet HALLIn ulkoseinällä"), parking, contacts. Per location: what is there now and what is coming | Desktop to maintain, phones to look up |
| 9 | **Pakkauslista** (pack list), printable | Per gig or per transport leg: grouped by case/category, checkboxes, quantity, serial, "lähtenyt / palannut" columns, signature line. `@media print` CSS, A4, browser print or save as PDF. On phones the same list works as a live checklist that updates the status | **Print from desktop**, tick on phones |
| 10 | **Omat tehtävät** (my tasks / who does what) | Tasks that come from gig roles and transport legs ("Pakkaa keikka X ke 26.11. klo 14", "Aja pakettiauto"). Filter by me or by person; a team view per week | **Phone first** |
| 11 | **Asetukset** | Users and roles, categories, status list, vehicles | Desktop |

## 8. Things I could not verify
- Mantine Schedule's handling of multi-day events in resource views, and `withWeekNumbers` in v9.
- Whether the MUI X Date Range Picker tier is still Pro in v9.
- Ant Design 6's week start for `fi_FI`.
- Current React Router and TanStack Router versions.
- Rentman help articles returned 403, so their content comes from search snippets.
- The floor-plan PDF was not read for this report. Room names come from the brief.

## Sources
- https://mantine.dev/dates/getting-started/
- https://mantine.dev/changelog/9-0-0
- https://mantine.dev/schedule/getting-started/
- https://mantine.dev/schedule/resources-schedule/
- https://mantine.dev/schedule/resources-week-view/
- https://mantine.dev/schedule/month-view/
- https://unpkg.com/mantine-datatable@9.4.0/README.md
- https://www.github.com/KevinVandy/mantine-react-table/releases
- https://mui.com/pricing/
- https://mui.com/blog/2026-mui-x-price-changes/
- https://mui.com/x/react-scheduler/
- https://mui.com/x/react-date-pickers/localization/
- https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- https://ui.shadcn.com/docs/changelog/2025-06-calendar
- https://daypicker.dev/docs/localization
- https://ant.design/docs/react/use-custom-date-library/
- https://ant.design/components/date-picker
- https://fullcalendar.io/pricing
- https://schedule-x.dev/premium
- https://classic.yarnpkg.com/en/package/react-calendar-timeline
- https://blog.date-fns.org/v40-with-time-zone-support/
- https://caniuse.com/temporal
- https://www.infoq.com/news/2026/02/chrome-temporal-date-api
- https://firebase.google.com/support/release-notes/js
- https://github.com/CSFrequency/react-firebase-hooks/releases
- https://github.com/invertase/tanstack-query-firebase
- https://www.github.com/TanStack/query/discussions/2621
- https://newreleases.io/project/github/TanStack/query/release/release-2026-07-20-1205
- https://developer.chrome.com/blog/update-install-criteria
- https://help.current-rms.com/en/articles/660523-get-an-overview-of-availability-across-your-company
- https://help.current-rms.com/articles/422143-what-is-the-quarantine
- https://rentman.io/product/equipment-planning
- https://support.rentman.io/hc/en-us/articles/360017698379-Why-is-some-planned-equipment-highlighted-in-red
- https://support.rentman.io/hc/en-us/sections/360004282000-Check-availability-solve-shortages
