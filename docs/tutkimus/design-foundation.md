# Design proposal: Kalustonhallinta ja keikkalogistiikka. Angle: a solid foundation, built in stages

I checked the floor plan PDF myself. Two things in it affect the design:

- **Väistötila 111a is at the far top-left corner. The loading doors (Lastausovet) are on the outer wall of Studio 1, on the far right.** If 111a is the main store, moving gear inside the building is a real logistics step. So internal moves ("111a → Halli → van") are modelled as moves, not ignored.
- **The plan shows an unlabelled grey area** between Studio 3 and the outer wall, next to the loading doors. It may be a loading or storage area. This is listed under open questions.

## 1. Design principles (these keep the data model from needing a rewrite)

1. **Separate the model from the unit from day one.** A *Malli* (product type) has *Yksilöt* (serialized units). Bulk and consumable stock is a quantity on the model. Adding serialized tracking to a flat `items` list later is the classic rewrite. Avoid it.
2. **Store facts and derive state.** Stored facts are bookings, moves, maintenance holds and recorded locations. Availability, "vapaa/varattu" and planned location are computed from them. Stored state that can drift (like `status: varattu`) is not stored.
3. **Split "tila" into three fields, so the word "tila" is never used alone in the UI:**
   - **Kunto**: the stored condition (ok / huomautus / huollossa / rikki / kadonnut / poistettu).
   - **Tilanne**: derived (Vapaa / Varattu / Kuljetuksessa / Keikalla / Huollossa).
   - **Sijainti**: a location reference (a room, vehicle or venue room).
4. **Bookings change in one place only.** All writes to bookings and gig times go through one transactional Cloud Function. That function uses the same availability library the UI uses for instant feedback. The client shows the result; the server decides.
5. **One availability engine as a pure TypeScript package with heavy tests.** It is the hardest part, and the part that most needs to be right.
6. **Conflicts are always visible and never silent.** They can be overridden with a recorded reason, not blocked forever. Rentman and Current RMS behave the same way, and AV teams pencil in gear on purpose.
7. **Two locations per unit: "planned" and "recorded".** Planned comes from bookings and moves. Recorded is the last real event (move delivered, return check, manual move). Showing the difference between the two, rather than hiding it, is what keeps "Missä nyt?" honest when someone forgets to record something.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React 19.2 + TypeScript + Vite**, as an SPA | Exact Vite and React Router versions to be checked at project start |
| UI kit | **Mantine 9** (MIT, 9.8.x) with `@mantine/dates`, `@mantine/form`, `@mantine/notifications` | Free, Monday-first week, Drawer/AppShell work well on phones |
| Tables | **mantine-datatable 9.x** (MIT) | Lists plus a drawer form for editing. AG Grid Community (MIT, 36.x) is an optional later "taulukkomuokkaus" mode |
| Calendar | **FullCalendar Standard 7.1.5** (MIT), views `dayGridMonth`, `timeGridWeek`, `listWeek`, `fi` locale | Mature. I prefer it over `@mantine/schedule`, which is only about 8 months old. Premium resource timeline ($480+, 1–10 devs) only if drag-and-drop is needed later |
| Equipment timeline | **Custom CSS-grid component** ("Kalustotaulu"); TanStack Virtual if rows exceed about 300 | No library shows bulk count tiles, buffers and transfer markers |
| Dates | **dayjs** with `utc`, `timezone`, `isoWeek`, `fi` | Store UTC `Timestamp`s, always display in `Europe/Helsinki`, show week numbers ("vk 48"), times as "klo 9.00". No Temporal API yet, because stable Safari lacks it |
| State | Own `onSnapshot` hooks (a shared listener registry, about 100 lines) + URL search params; Zustand only for small UI state | No TanStack Query for live data |
| Backend | **Firebase Blaze**, all in **europe-north1**: Firestore Standard, Functions 2nd gen, Storage, Hosting | Region cannot be changed later. Expected cost €0–3/month; budget alert at €10 |
| Auth | Google **or** Microsoft sign-in (depends on the company's Workspace/M365) + email link for freelancers; `members` allowlist checked in Rules; `signInWithPopup` | Note in the GDPR records that Auth data is processed in the US |
| Quality | pnpm monorepo (`apps/web`, `functions`, `packages/core`), Vitest + fast-check (property tests), `@firebase/rules-unit-testing`, Emulator Suite, Playwright for 3–4 key flows, GitHub Actions CI | Two Firebase projects: `-dev` and `-prod`; Hosting preview channels for trying out changes |
| PWA | Manifest only ("Lisää kotivalikkoon"), no caching service worker | Offline is out of scope, and caching would leave crew on stale versions |

All UI strings live in one `fi.ts` dictionary. Code and field names are English, so another developer can pick up the code (bus factor).

## 3. Data model (Firestore)

```text
members/{emailLower}   name, phone, role: admin|suunnittelija|tekijä, active, uid?
settings/app           defaultPrepMin, defaultReturnMin, transferSlackMin(30), assetTagCounters{KAM: 7,…}

locations/{id}         name, type: site|room|storage|vehicle|venue|venue_room, parentId, path[] (ancestor ids),
                       bookable(bool: studio rooms can double-book too), isLoadingPoint (Studio 1),
                       address, lat?, lng?, travelMinFromBase, travelMinRush?,
                       venueInfo?{loading, elevator, parking, power, network, contacts[], lessons, source},
                       vehicle?{plate, payloadKg, volumeM3, tailLift, note}, archived
travelTimes/{a__b}     minutes, note            // learned pair times, e.g. Clarion → Studio
categories/{id}        name, parentId?, tagPrefix ("KAM"), fieldDefs[{key,label,type}], sort
models/{id}            name, manufacturer, modelNo, categoryId, tags[], tracking: serial|bulk|consumable,
                       isContainer, defaultContents[{modelId, qty}], accessories[{modelId, qty, mode: aina|ehdota}],
                       weightKg?, dimsCm?, ownedQty (bulk), minQty (consumable), homeLocationId,
                       photoPath?, links[], notes, custom{}, archived,
                       lockSeq (written on every booking write = serialization point)
units/{id}             modelId, categoryId, displayName (denorm), assetTag "KAM-03", serialNo, nickname,
                       condition: ok|huomautus|huollossa|rikki|kadonnut|poistettu, conditionNote,
                       parentUnitId?, fixedInParent, homeLocationId,
                       recordedLocationId, recordedAt, recordedBy, responsibleEmail,
                       ownership: oma|alivuokrattu|lainattu|asiakkaan, rental?{supplier, from, to, ref},
                       purchaseDate?, purchasePrice?, replacementValue?, custom{}, archived
caseContents           (bulk inside a case) stored on the case unit: bulkContents[{modelId, qty}]
holds/{id}             unitId? | {modelId, qty}, type: huolto|korjaus|kadonnut|muu, start, end? (open = indefinite),
                       reason, createdBy                       // dated "out of service", blocks availability
kits/{id}              name, lines[{modelId, qty} | {unitId}], optionalLines[]   // template, expanded on use

gigs/{id}              name, client, venueId (location), roomIds[], status: alustava|vahvistettu|peruttu|valmis,
                       times{departAt, loadInAt, showStart, showEnd, loadOutEnd, returnAt},  // returnAt incl. return check
                       responsibleEmail, crew[{email, role, note}], notes, color,
                       conflicts{hard, soft, overridden} (written by the function), updatedAt/By
bookings/{id}          gigId, kind: unit|model, unitId?, modelId, qty (1 for unit),
                       parentBookingId? (case contents), kitInstanceId?, source: manual|kit|case|accessory,
                       transferFromBookingId?, transferToBookingId?,
                       blockStart, blockEnd, gigStatus   // denorm, ONLY the function writes these
                       override?{by, at, note}, packStatus: –|pakattu|lastattu|perillä|palautettu|puuttuu|vaurioitunut
legs/{id}              type: lähtö|paluu|suora_siirto|sisäinen, fromLocationId, toLocationId, fromGigId?, toGigId?,
                       departAt, arriveAt, vehicleId?, driverEmail?, bookingIds[], extraUnitIds[],
                       status: suunniteltu|lastattu|matkalla|perillä|peruttu, notes
activity/{id}          ts, actor, entityType, entityId, action, changes{field:[old,new]}, gigId?  // create-only
```

**Why this survives later phases without a rewrite:**

- **`kind: model` on a booking also covers serialized models.** A line can say "2× langaton mikki" before specific units are chosen. Bulk items and unassigned serialized demand go through the same engine.
- **`transferFrom/ToBookingId`** links a unit's consecutive bookings. A direct gig-to-gig move then shortens both blocks instead of raising a false conflict.
- **`bookable` rooms** let Studio 3 itself be checked for double-booking with the same engine. Rooms are treated like units.
- **Each vehicle is a location, plus a resource on legs.** "It's in the van" is a valid location.
- **Packing status lives on the booking line.** Checklists then need no separate collection.

**Indexes:**

- `bookings(unitId, blockEnd, blockStart)`
- `bookings(modelId, blockEnd, blockStart)`
- `bookings(gigId)`
- `bookings(blockEnd, blockStart)`
- `legs(departAt)`
- `units(recordedLocationId)`
- `holds(modelId, start)`

## 4. Availability engine (`packages/core`)

- **Intervals are half-open `[start, end)` in UTC milliseconds.** Default block = `departAt → returnAt`.
- **Transfers change the block ends.** With a transfer link, the earlier booking ends at `loadOutEnd`, and the later one starts when the transfer leg departs.
- **Units:** an overlap check per unit, plus holds, plus condition (`huollossa`/`rikki`/`kadonnut` block the unit indefinitely unless a dated hold exists).
- **Models (bulk and unassigned serialized demand):** a sweep line.
  - Capacity = `ownedQty` (or the number of usable units) minus active holds.
  - At equal timestamps, releases are processed before new demand.
  - Output: shortage periods, `{from, to, missing, gigIds}`.
- **Cases:** booking a case unit also books its fixed child units and its bulk contents. Loose contents are *proposed* as lines.
- **Severity:**
  - **Hard (red):** confirmed vs confirmed, or confirmed demand above stock.
  - **Soft (amber):** involves an `alustava` gig.
  - **Overridden (grey):** shows who accepted it and their note.
  - **Ignored:** `peruttu` gigs.
- **Transfer feasibility.** `A.loadOutEnd + travel(A→B) ≤ B.loadInAt`. If this fails it is hard. If the slack is under 30 minutes it is a warning.
- **Tests:** table tests for every edge case (back-to-back gigs, last Sunday of March/October, multi-day gigs, a case containing a broken unit, a hold with no end date). Property tests check that the sweep line equals a brute-force per-minute count.

**Write path.** One callable function, `saveGigPlan(gigId, gigPatch?, lineOps[], acceptOverrides[])`, does the following:

1. Runs an Admin SDK transaction.
2. Reads and increments `lockSeq` on every affected model. This serializes concurrent planners without relying on phantom-read protection.
3. Recomputes block intervals.
4. Runs the engine.
5. Rejects the save if there are new hard conflicts that have no override.
6. Writes the bookings, the gig's conflict summary and the `activity` entries.

Changing gig times uses the same function, so the denormalized `blockStart/End` values can never drift.

Crew can update only `packStatus` and leg `status` through Rules with a field allowlist. Reporting a fault ("Ilmoita vika") is a client batch: hold + condition + activity entry.

## 5. Views

**Navigation.** Phone: bottom tabs, *Tänään · Keikat · Kalusto · Siirrot · Lisää*. Desktop: left sidebar.

1. **Tänään** (phone first): today's and tomorrow's departures and returns ("klo 7.30 Halli → Clarion, Bysa 2"), my tasks, open hard conflicts, overdue returns.
2. **Keikat**: list (filters: status, venue, responsible person, date) + **calendar** (month/week; agenda on phones). Colour shows status. A badge shows "⚠ 2 puutetta".
3. **Keikka (gig page)**, with tabs:
   - *Yleiset*: client, venue/room, phase times on a mini time bar.
   - *Kalusto*: lines grouped by case/category, with an inline availability chip ("3/4 vapaana", "Puute −1"). Add by search, kit or case. A **Ratkaise** drawer offers swap to a free unit of the same model/category, shift the times, mark as sub-rental, or accept with a note.
   - *Tiimi*: who does what.
   - *Siirrot*: legs for this gig, plus suggestions.
   - *Pakkauslista*: printable A4 page, and a tick list on phones.
4. **Kalusto**: models table with counts (owned / usable / booked today). Expand a row to see its units. Searching by name, tag or serial gives cards on phones. Bulk edit, "Luo N kpl", duplicate.
5. **Laite (item page)**, phone first:
   - Header "Nyt: Keikalla — Clarion, Bysa 2 · Seuraavaksi 27.11. Studio 3". If planned and recorded locations differ, it says so.
   - 30-day agenda, history, holds, the "Ilmoita vika" button and the "Siirrä" button.
6. **Kalustotaulu** (desktop/tablet): rows are units grouped by category; bulk models get count tiles ("34/40", red "−4"). Columns are days with week numbers. The planning block is hatched and the show is solid. Only the overlapping part is red. Transfer chips ("→ Clarion"). Filters: category, "vain puutteet", include tentative. Click through to the gig. Phone fallback: per-item agenda.
7. **Siirrot**: day plan grouped by vehicle and driver. Each leg card shows from → to, time, load list, a capacity bar, and a "Navigoi" Google Maps URL. Unassigned suggestions sit in a side list.
8. **Sijainnit + Missä nyt**: a location tree (Oma studio → rooms, Ajoneuvot, Kohteet → rooms). Venue cards hold loading, elevator, power and network notes. For each location: what is there now and what is arriving.
9. **Omat**: my gigs, my legs, my responsible units.
10. **Asetukset**: members and roles, categories with custom fields, vehicles, defaults.

## 6. Key user flows

- **Building the equipment list:**
  1. Create a model (category gives the custom fields and tag prefix).
  2. "Luo 5 yksilöä" generates KAM-04…KAM-08 with blank serial fields.
  3. "Tallenna ja uusi" keeps the form open for the next one.
  4. A case is a model with `isContainer`; open its unit to add its contents.
- **Planning a gig:**
  1. Create the gig, pick the venue/room, and set the phases. Defaults come from settings and the venue's travel time.
  2. Add lines by search, kit or case; accessories are added (`aina`) or offered (`ehdota`).
  3. Live chips show availability. Save, and the server validates.
  4. Resolve or override any conflicts.
  5. Set the status to `vahvistettu`.
- **Generating logistics:**
  1. "Luo siirrot" proposes legs.
  2. Outbound legs start from each unit's planned location at departure, so gear on another gig is offered as a **direct transfer**: "KAM-03 tulee suoraan keikalta X, säästää paluun varastolle".
  3. Return legs go to home locations.
  4. Accepting a suggestion links the bookings and runs the feasibility check.
  5. Assign vehicle and driver; the capacity bar warns at 70% and turns red at 90%.
- **Gig day:**
  1. Crew tick the pack list on a phone (pakattu → lastattu).
  2. The driver marks the leg `perillä`. That batch updates `recordedLocationId` on the units and writes activity entries.
- **Return:**
  1. Return check per line.
  2. `puuttuu` or `vaurioitunut` creates a hold and changes the condition, and the planner sees it on Tänään.
  3. The gig is set to `valmis`.
- **"Missä on vMix-PC 2?"** Search → item page → recorded location, planned location, next booking.

## 7. Roadmap

There is no time pressure, so each stage ends with real use and feedback before the next one starts.

**Vaihe 0: Foundations and validation**
- Answer the open questions (section 9).
- Use Rentman's free trial for a week as a benchmark.
- Clickable wireframes of Keikka, Kalusto and Kalustotaulu, reviewed with 1–2 crew.
- Set up the monorepo, CI, the two Firebase projects (region europe-north1), Auth, the allowlist and Rules with tests.
- Build `packages/core` with the full test suite **before** any UI.
- Seed the locations: studio rooms from the floor plan, with Studio 1 as the loading point; Clarion and its rooms marked "lähde: esite 2016, tarkista".
- *Exit criterion:* engine tests green; the user approves the wireframes.

**Vaihe 1: Core (MVP)**
- Kalusto (models, units, bulk, cases, categories with custom fields, photos), holds and "Ilmoita vika".
- Locations, gigs with phases, bookings through `saveGigPlan` with conflicts and overrides, kits.
- Keikat list and calendar, the Keikka page, Laite page, a basic read-only Kalustotaulu, printable pack list and phone checklist.
- Activity log, Tänään, Omat.
- *Exit criterion:* the team plans all real gigs in the app for about 4 weeks without needing a spreadsheet alongside.

**Vaihe 2: Logistics**
- Legs, the "Luo siirrot" generator, direct gig-to-gig transfers with the feasibility check, vehicles and capacity.
- The Siirrot day plan, Missä nyt (planned vs recorded), full venue cards, learned pair travel times, Navigoi links, and an optional free Google Maps Embed on venue cards.

**Vaihe 3: Visual planning depth**
- Full Kalustotaulu: hatching, bulk heat tiles, transfer chips, crew rows, "vain puutteet".
- A ranked swap list in the Ratkaise drawer.
- Generic lines (book a model now, assign units later), copy equipment from an earlier gig, room double-booking warnings for studio rooms.

**Vaihe 4: Optional, driven by demand**
- Daily "huomisen lähdöt" email (scheduled function).
- CSV export (`;` separator + BOM).
- An on-demand "Laske ajoaika" button (Routes API via a function).
- AG Grid inline-edit mode.
- Drag-and-drop on the timeline (decide between FullCalendar Premium and keeping the custom board).
- Floor-plan placement.
- Possibly later: QR labels (`assetTag` is already shaped for them).

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Wrong availability or conflict results destroy trust | Pure engine, property tests, DST and edge-case tests, server-side recompute; Vaihe 1 runs alongside the old way of working for a while |
| Recorded locations go stale because people forget to record moves | Show planned location by default; show the difference between planned and recorded; quick "Siirrä" button; a delivered leg updates locations in bulk |
| Typing in the initial inventory is a burden (no import) | "Luo N kpl", duplicate, pre-seeded categories with prefixes, "Tallenna ja uusi"; enter one category per session |
| Bus factor and maintenance | Mainstream stack, English code with a Finnish dictionary, tests, a README for deploy and restore; frozen scope; if quotes and invoicing are ever needed, move to Rentman rather than growing this into an ERP |
| Cloud Function cold start (a few seconds on the first save) | Optimistic UI with a pending state; `minInstances: 1` only if it annoys people (costs a few euros a month) |
| Firestore read costs from listeners | Listen to date windows, not whole collections; share listeners; budget alert |
| Young libraries (Mantine 9, mantine-datatable 9) | Pin versions; the timeline is our own code; FullCalendar is mature |
| Data loss | Daily backups kept 7 days, weekly kept 14 weeks, PITR on; restore rehearsed once in Vaihe 0 |

## 9. Open questions for the user

1. Does the company use **Google Workspace or Microsoft 365**? Do freelancers need access too, and with what rights?
2. **Roles:** who may create and confirm gigs and edit the equipment list, and who only views and ticks lists?
3. **Storage:** Is Väistötila 111a the main store? What is the grey area next to Studio 3 and the loading doors? Is anything kept in Väestösuoja?
4. **Vehicles:** how many, which models, payload and cargo volume? Do you also use rentals or taxis?
5. **Inventory size:** roughly how many serialized items, and how many bulk lines?
6. **Typical buffers:** pack the day before? Return check the same day or the next?
7. Should **alustava** gigs only warn (my proposal), or also block?
8. Should **studio rooms** be checked for double-booking, like equipment?
9. Do you **sub-rent or borrow** gear often enough to track supplier and return date?
10. Which **Clarion rooms** and other recurring venues should be seeded? Who can fill in the loading, elevator and power details?
11. Should each gig show the **client contact**, or is that kept elsewhere (CRM)?
12. Who will **own and maintain** the app after it is built?
