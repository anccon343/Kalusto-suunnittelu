# Design proposal: Kalustonhallinta and logistics app (data model and robustness first)

*Written 2026-11-23. Floor plan checked against the PDF. Library versions come from the research reports; re-check them when the project starts.*

## 1. Design stance
Five principles keep the app correct when gigs overlap and gear moves directly from one gig to the next.

1. **Plan and fact are kept apart.**
   - *Plan* is what we intend: gig lines and transport legs.
   - *Fact* is what has been confirmed: deliveries ticked and returns checked.
   - The app never treats the plan as fact. If the plan says a camera should be at Clarion by now and nobody has ticked the delivery, the UI shows "Odotettu: Clarion (ei kuitattu)".
2. **Store as little derived state as possible.** Availability and status are always computed. The only denormalised values are written by one code path, and a nightly checker verifies them.
3. **One pure engine.** All availability, conflict and chain logic lives in one TypeScript package with no Firebase imports. The browser (instant feedback) and the Cloud Functions (the final check on save) run the same code.
4. **Anything that affects availability goes through a server function.** That covers gig lines, gig times and status, maintenance holds, and stock counts. Descriptive data such as names, notes, photos, venues and crew is written straight from the client, guarded by security rules.
5. **Gig-to-gig transfers are part of the data structure.** A transfer is a two-way link between two gig lines, and a transport leg carries it. It is not a status workaround.

"Mikä tila" covers two things, so both are stored as separate fields:
- **Kunto/Tila** (condition or status): partly stored, partly derived.
- **Sijainti** (location): a reference into the location tree.

## 2. Tech stack
| Layer | Choice | Licence / cost |
|---|---|---|
| Frontend | Vite + React 19.2 + TypeScript (strict) | MIT |
| UI kit | Mantine 9.x (core, dates, form, notifications) | MIT |
| Gig calendar | FullCalendar Standard 7.1.5 (`dayGridMonth`, `listWeek`, `fi` locale). Chosen over the 8-month-old `@mantine/schedule` because it is mature | MIT. Premium timeline ($480+) only if drag-and-drop is ever needed |
| Equipment board | Custom CSS-grid component; add TanStack Virtual if it gets slow | MIT |
| Lists | mantine-datatable 9.x, with editing in drawer forms. AG Grid Community 36.x only if spreadsheet-style editing proves necessary | MIT |
| Dates | dayjs with `utc`, `timezone`, `isoWeek` and `fi` | MIT |
| Validation | Zod schemas in `core`, shared by client and functions | MIT |
| Backend | Firebase on the Blaze plan: Firestore **Standard** in **europe-north1**, Functions 2nd gen (Node 22) in europe-north1, Storage in europe-north1, Hosting, Auth | about €0–5/month |
| Repo | pnpm monorepo: `packages/core` (types, schemas, engine), `apps/web`, `functions` | — |
| Tests | Vitest, fast-check, Firebase Emulator Suite, `@firebase/rules-unit-testing`, Playwright | MIT / Apache |

The Firestore location cannot be changed after the database is created, so pick europe-north1 on day one.

## 3. Data model (Firestore)
```
jasenet/{emailLower}   rooli: admin|suunnittelija|tekija, nimi, puhelin, aktiivinen
sijainnit/{id}         nimi, tyyppi: kotipaikka|studiotila|varasto|ajoneuvo|kohde|kohteen_tila,
                       parentId, polku[] (ancestor ids), osoite?, lastausohje?, yhteyshenkilo?,
                       ajoaikaMin (from base), ajoneuvo?{kantavuusKg, tilavuusM3}, arkistoitu
matkaajat/{a__b}       min, huom   (learned pair travel times, gig→gig)
kategoriat/{id}        nimi, prefix ("KAM"), kentat[] (custom field defs)
mallit/{id}            nimi, valmistaja, kategoriaId, seuranta: yksiloity|maara|kulutus,
                       omaMaara (bulk only), onKotelo, vakioIrtosisalto[]{malliId,qty},
                       tarvikkeet[]{malliId,qty,tapa:'aina'|'ehdota'}, painoKg, tilavuusM3,
                       arvo, kotiSijaintiId, lukko (int, transaction lock), custom{}, arkistoitu
yksilot/{id}           malliId, tunnus ("KAM-03"), sarjanumero, lempinimi, kunto: ok|huomautus,
                       koteloId?, kiinteaKotelossa, kotiSijaintiId, vastuuhenkiloId,
                       omistus: oma|vuokrattu|lainattu|asiakkaan, vuokraAlku?/Loppu?, toimittaja?,
                       sijaintiId, sijaintiAika, sijaintiLahde (FACT; written only by functions),
                       arkistoitu
pidot/{id}             (holds) yksiloId | {malliId, qty}, syy: huolto|korjaus|rikki|kadonnut,
                       alku, loppu|null (open-ended), huom, kuvat[]
paketit/{id}           nimi, rivit[]{malliId,qty}, valinnaiset[]   (kit template, expanded on use)
keikat/{id}            nimi, asiakas, kohdeId, tilaIds[], tila: alustava|vahvistettu|valmis|peruttu,
                       vaiheet{pakkausAlku, lahto, roudausAlku, tapahtumaAlku, tapahtumaLoppu,
                       purkuLoppu, paluu}, vastuuhenkiloId, tiimi[]{uid, rooli},
                       rev (int), puutteet{kova, pehmea} (summary), muistiinpanot
rivit/{id}             (booking line) keikkaId, malliId, qty, yksiloIds[] (≤ qty, optional until packing),
                       pakettiInstanssi?, mista: {kotipaikka} | {riviId}, minne: {kotipaikka} | {riviId},
                       alku, loppu (blocked interval, computed), keikkaTila (copied),
                       ylivaraus?{uid, huom, aika}, pakattu/palautettu counts, poistettu
siirrot/{id}           (transport legs) tyyppi: lahto|paluu|suora|sisainen, mistaId, minneId,
                       mistaKeikkaId?, minneKeikkaId?, lahtee, perilla, ajoneuvoId?, kuljettajaId?,
                       rivit[]{riviId, qty, yksiloIds[]}, tila: suunniteltu|lastattu|matkalla|perilla|peruttu,
                       julkaistu
liikkeet/{id}          append-only fact log: yksiloId, mistaId, minneId, aika, siirtoId?, uid, tapa
historia/{eventId}     append-only audit: ts, uid, kohde, kohdeId, toiminto, muutokset{f:[old,new]}, keikkaId?
jarjestelma/eheys      result of the last invariant check
```

**Key modelling decisions:**
- **Book by model, carry out by unit.** A line says "3× Sony FX6". Specific units are assigned at the latest when the gear is packed. Rentman works the same way.
  - Availability then uses one count-based algorithm for serialized and bulk items alike.
  - Location tracking still works per unit, because ticking "pakattu" requires picking the units.
- **Cases (kotelot):**
  - A case is a unit whose model has `onKotelo` set.
  - Contents with `kiinteaKotelossa=true` (fixed in the case) are **not part of their model's loose pool**. They can only be used through the case.
  - A case only counts as usable if all of its fixed contents are usable; otherwise it shows a warning.
  - Only the case stores a location. Its contents inherit it, so moving a case is one write.
- **Kits and accessories** are expanded into ordinary lines with a `pakettiInstanssi` tag. They keep no lasting link to the template.
- **The studio from the floor plan is seeded as the base (kotipaikka)** with these child rooms:
  - Studio 1 Halli (default load-in point because of its loading doors)
  - Studio 2 Keittiö
  - Studio 3 Webinaari
  - Tarkkaamo 16 m², Tarkkaamo 11 m²
  - Speak
  - Studio Lounge
  - Väistötila 111a (storage?), 111B
  - Väestösuoja (−1 floor)
  - Vans are `ajoneuvo` locations.
  - Clarion Hotel Helsinki is a `kohde` with rooms (Bysa 1–3, Sonck, Crusell…), marked "tarkista" (to be verified).

## 4. Time and availability engine
- **Storage:** times are Firestore Timestamps in UTC, displayed in Europe/Helsinki. Intervals are half-open `[alku, loppu)`.
- **Phases must be in order:** `pakkausAlku ≤ lahto ≤ roudausAlku ≤ tapahtumaAlku < tapahtumaLoppu ≤ purkuLoppu ≤ paluu`. Zod checks this on the client and in the function.

**Blocked interval of a line** (the core of gig-to-gig correctness):
```
alku  = mista.riviId ? prevGig.purkuLoppu : gig.pakkausAlku
loppu = minne.riviId ? gig.purkuLoppu     : gig.paluu
```
For a chained pair A→B, the line on A ends exactly when the line on B starts. The two intervals touch but do not overlap, so the item is never double-counted and never "returns to base" on paper.

The transfer is feasible when `A.purkuLoppu + travel(A.kohde→B.kohde) + margin ≤ B.roudausAlku`. If it fails, that is a hard conflict ("Siirto ei ehdi"). Less than 30 minutes of slack is a warning.

**Chain rules:**
- Each line has exactly one origin and one destination.
- Moving 8 of A's 10 XLR cables to B splits A's line into 8 (→B) and 2 (→base). The function does the split automatically.
- The link is two-way: if `A.minne = B`, then `B.mista = A`.
- Both lines must be the same model with the same quantity.

**Availability per model** uses a sweep line:
- Events: lines (+qty / −qty), holds, and capacity changes (units added, archived, or rented for a limited window).
- At equal times, releases are processed before acquisitions.
- Two passes:
  - **Hard:** confirmed lines only, compared with capacity. Shown red.
  - **Soft:** confirmed and tentative lines. Shown amber.
- Lines with `ylivaraus` (an accepted overbooking) are still counted but shown grey, with who accepted it and their note.

**Unit-level checks are exact:**
- A unit cannot be assigned to two overlapping lines.
- A unit cannot be assigned during one of its holds.
- An open-ended "rikki" (broken) hold flags every future line that unit is assigned to.

**Edge case.** Counts can look fine while pre-assigned units leave the timeline too fragmented to cover the demand. A greedy assignment pass catches this and reports "ei kohdennettavissa". It is a warning, never a silent pass.

**Derived Tila** (status), in priority order:
1. Rikki / Huollossa / Kadonnut (from holds)
2. Kuljetuksessa (in a leg that is `matkalla`)
3. Keikalla (the confirmed location is a venue)
4. Varattu (assigned to an active line)
5. Varastossa (in storage)

## 5. Movement and transport model
**Legs are generated from line origins and destinations.** For each gig, "Ehdota siirrot" proposes:
- an outbound leg (base → venue) for lines coming from base,
- a return leg for lines going back to base,
- one `suora` leg for each chained pair,
- `sisainen` (internal) legs, such as storage → Halli, for studio gigs. These have no vehicle.

The function is idempotent. It does not touch legs that have progressed past `suunniteltu` and never removes them silently.

**Coverage invariant:** every active line's departure and return must belong to exactly one leg. Lines that are not covered appear in the "Suunnittelematta" (unplanned) side panel of the Siirrot view.

**Confirming a leg** (`kuittaaSiirto`, allowed for the crew role) is the only normal way locations change:
- `lastattu` (loaded) → `matkalla` (on the way) → `perilla` (arrived).
- On arrival it writes the case and unit `sijaintiId`, `liikkeet` entries and `historia`, all in one transaction.
- **"Siirretty käsin"** (moved by hand, `siirraKasin`) covers reality drifting from the plan.

**Return check-in:**
- Each line is marked returned, missing or damaged.
- Missing creates a `kadonnut` hold. Damaged creates a `rikki` hold with a photo.
- Both change availability immediately.

**Vehicle load bar:** the sum of weight and volume of the leg's cases and items. Green below 70% of capacity, amber at 70–90%, red above 90% or over payload.

**Travel times** are entered by hand:
- each venue stores its time from base,
- `matkaajat` stores learned pair times between venues,
- every leg has a free Google Maps "Navigoi" deep link.

No routing API in v1.

## 6. Write paths, concurrency and invariants
**Callable functions (Admin SDK transactions):**
- `tallennaRivit(keikkaId, rev, muutokset)`
- `paivitaKeikka(keikkaId, rev, vaiheet|tila)`
- `ketjuta`
- `asetaPito`
- `kuittaaSiirto`
- `siirraKasin`
- `ehdotaSiirrot`

**Transaction pattern:**
1. Read the `mallit/{id}` doc of every model involved. Every write bumps its `lukko`, so concurrent saves of the same model are serialized. This does not depend on how query locking behaves inside transactions.
2. Query overlapping lines with `malliId ==, loppu > S, alku < E` (composite index).
3. Run the engine.
4. Reject hard conflicts unless the line carries an override.
5. Write the lines, the gig's `puutteet` summary and `historia`.

**Stale edits:** the gig's `rev` integer stops two planners from overwriting each other. A stale save gets "Keikkaa on muutettu – lataa uudelleen".

**Gig time changes and cancellations** recompute every line interval of that gig and of its chained neighbours, then return an impact list. For example: "2 riviä menee päällekkäin, suora siirto keikalta X ei enää ehdi". When a gig is cancelled, its chained neighbours fall back to origin = base and are flagged.

**Nightly `eheystarkistus` (integrity check)** recomputes everything from scratch and writes any drift to `jarjestelma/eheys`. An admin can also trigger it from a button. It checks that:
1. the phases are in order,
2. each line's interval matches the formula,
3. no unit is assigned to overlapping lines,
4. confirmed demand ≤ capacity, or the line is overridden,
5. every chain link is two-way and feasible,
6. every line is covered by legs,
7. there are no cycles in the case chain, and contents share their case's location,
8. no unit is assigned during one of its holds.

## 7. Security, roles and audit
**Sign-in:**
- Google or Microsoft sign-in (depending on which the company uses), with email link as a fallback for freelancers.
- Use `signInWithPopup`, or set `authDomain` to the Hosting domain.
- Access is limited by the allowlist in `jasenet`. Rules require `email_verified` and look the role up with `get()`.
- Once that works, sync the role into custom claims to save the extra read per request.

**Roles:**

| | admin | suunnittelija | tekijä (crew) |
|---|---|---|---|
| Read everything except history | ✓ | ✓ | ✓ |
| Inventory, venues, gig details | ✓ | ✓ | – |
| Lines, times, status, holds, overrides (via functions) | ✓ | ✓ | fault report only |
| Confirm legs, pack/return ticks, move by hand | ✓ | ✓ | ✓ |
| Members, restore, integrity checker | ✓ | – | – |

**Rule specifics:**
- Clients cannot write `rivit`, `liikkeet` or `historia` at all.
- A client update to `keikat` must not touch `vaiheet`, `tila`, `rev` or `puutteet`, enforced with `diff().affectedKeys().hasAny(...)`.
- A client update to `yksilot` must not touch `sijainti*`.
- Every client write must set `paivittaja == request.auth.uid` and `paivitetty == request.time`.
- Hard deletes are admin-only. Everyone else archives (`arkistoitu`).

**Audit:**
- Firestore `onDocumentWritten` triggers diff each change into `historia`.
- The event ID is used as the document ID, so retried triggers never create duplicates.
- Functions also write readable entries such as "varasi 3× FX6 keikalle Clarion 12.12."

**App Check:** reCAPTCHA Enterprise, monitor mode first, then enforced.

**GDPR:** Auth data lives in the US under the Data Privacy Framework (DPF). Record this in the company's records of processing, and keep personal fields to a minimum.

## 8. Backup and cost control
**Backups:**
- Daily scheduled backups kept 7 days, weekly backups kept 14 weeks, and PITR (7 days) on.
- A monthly `gcloud firestore export` to a Coldline bucket with a lifecycle rule.
- **Every quarter, run a restore drill** into a new database and run the integrity checker against it.

**Cost control:**
- Budget alerts at €5 and €20. Alerts do not cap spending.
- `maxInstances` of 3–5 on every function.
- An Artifact Registry cleanup policy.
- Date-windowed listeners: gigs and lines from −30 to +180 days. The inventory is loaded in full, which is fine at about 1,500 documents.
- History is read in pages, never through a listener.
- Photos resized on the client (about 1600 px WebP).
- Expected cost is €0–5 a month.
- Optional: `minInstances: 1` on the booking function to avoid 1–3 second cold starts, at a few euros a month (verify the price).

## 9. Testing strategy
1. **Engine unit tests** (Vitest), table-driven:
   - half-open boundaries,
   - clock changes on **25.10.2026 and 28.3.2027**,
   - ties in the sweep,
   - split chains,
   - fixed case contents,
   - open-ended holds,
   - cancellation cascades.
2. **Property-based tests** (fast-check): random gigs, lines and holds. Check that the sweep agrees with a brute-force minute-by-minute oracle, and that the integrity checker finds nothing after any sequence of valid function calls.
3. **Rules tests** in the emulator: every role against every collection and forbidden field.
4. **Function integration tests** in the emulator. Example: 20 parallel `tallennaRivit` calls for the last free FX6 must leave exactly one booked. The same test runs for bulk quantities.
5. **Playwright E2E** at phone and desktop sizes for the main flows.
6. **CI** (GitHub Actions) runs all of the above against the emulator, with a seed of the studio rooms, Clarion and sample gigs.

## 10. Views
1. **Tänään** (today): today's and tomorrow's departures and returns, open shortages, overdue returns, unconfirmed deliveries.
2. **Keikat** (gigs): a filterable list plus a month/list calendar, with a shortage badge on each gig.
3. **Keikka** (gig) tabs: Yleiset (details), Kalusto (lines showing availability "3/4", red/amber chips and a "Ratkaise" (resolve) drawer), Siirrot (legs), Tiimi (team), Pakkauslista (pack list, printable and usable as a phone checklist).
4. **Kalusto** (equipment): model list with counts, unit list, edit drawer, "Luo N yksilöä" (create N units, e.g. KAM-04…08), bulk edit, CSV export.
5. **Laite** (item): "Nyt: … · Seuraavaksi: …" (now / next), a 30-day mini timeline, history, holds, "Ilmoita vika" (report a fault).
6. **Kalustotaulu** (equipment board): rows are models or units, columns are days with week numbers; striped buffers, red overlaps, count tiles for bulk items; "Vain puutteet" (shortages only) filter.
7. **Siirrot** (moves): day plan by vehicle or driver, the "Suunnittelematta" (unplanned) panel, load bars, draft vs published.
8. **Missä nyt** (where now): the location tree with confirmed contents, plus expected but unconfirmed items.
9. **Omat** (mine): my gigs, legs and packing tasks.
10. **Sijainnit** (locations and venue cards): loading instructions, contacts, power and network.
11. **Asetukset** (settings) and **Eheys** (integrity report).

## 11. Key flows
- **Create equipment:** create a model (e.g. "Sony FX6", serialized), then "Luo 5 yksilöä" generates KAM-01…05 with blank serial-number fields.
- **Plan a gig:**
  1. Create the gig with phases (defaults come from the venue's travel time).
  2. Add the kit "Hybridipaketti".
  3. Line availability updates live.
  4. Save → the server checks → the gig is saved with soft warnings.
  5. Confirming the gig turns tentative shortages into hard ones that must be resolved or overridden.
- **Chain:** when adding a line, the engine notices the model is on a gig that ends earlier at another venue and suggests "Ota 2 kpl suoraan keikalta X (ehtii, 1 h 40 min pelivaraa)". Accepting splits and links the lines and replaces the return and outbound legs with one `suora` leg.
- **Day before:** in Siirrot, click "Ehdota", assign a van and driver, then publish.
- **Packing (phone):** tick the lines and pick units (units currently at base are listed first), then set the leg to `lastattu` and then `matkalla`. The driver marks `perillä`, and the locations update.
- **Return:** tick each line returned, missing or damaged. Holds are created and history is written.
- **Time shift or cancellation:** the impact list is shown before the change is confirmed.

## 12. Phased roadmap
- **Phase 0:**
  - Answer the open questions.
  - Use Rentman's free trial for a week as a benchmark.
  - Create the Firebase project (europe-north1, Blaze, budget alerts), the monorepo and CI.
  - **Write the engine and its tests first.**
- **Phase 1 (MVP):**
  - Auth and allowlist.
  - Location seed.
  - Models, units, bulk items, categories, "Luo N".
  - Gigs with phases; model-level lines.
  - Booking functions and conflict display.
  - Calendar.
  - Audit, backups, integrity checker.
- **Phase 2:**
  - Unit assignment, pack and return checklists.
  - Holds and fault reports.
  - Legs and the Siirrot view; gig-to-gig chaining.
  - Missä nyt and Omat.
- **Phase 3:**
  - Kalustotaulu.
  - Cases and kits.
  - Vehicle load bars, full venue cards.
  - Printed pack lists.
- **Later (optional):**
  - Drag-and-drop timeline (FullCalendar Premium).
  - "Laske ajoaika" (compute travel time) through a function.
  - Sub-rental lines, notifications, iCal feed.
  - Placing equipment on a floor plan; QR labels.

## 13. Risks
- **Plan drifts from reality** because people forget to tick. Mitigation: show expected vs confirmed, flag overdue items, keep ticking to one tap, allow "siirretty käsin".
- **Subtle engine bugs.** Mitigation: one pure engine, property tests, the nightly checker.
- **Denormalised fields drift.** Mitigation: a single writer and the checker.
- **Cold-start latency on save.** Mitigation: an optimistic UI with an instant client-side check, and `minInstances` if needed.
- **Bus factor.** Mitigation: a typed monorepo, tests as specification, a short README for operations.
- **Scope creep toward quoting and invoicing.** Mitigation: freeze the scope; move to Rentman if those are ever needed.
- **Firestore lock-in.** Mitigation: the engine is free of Firebase code, and the monthly export is a portable archive.

## 14. Open questions for the user
1. Does the company use Google Workspace or Microsoft 365? This decides the sign-in method.
2. Who will build and maintain the app long term?
3. Do you plan as "3 kameraa" (3 cameras) and pick the units at packing, or do you always book specific units?
4. Should tentative (alustava) gigs only warn, and only confirmed ones block?
5. Is Väistötila 111a the main storage? Is some gear permanently installed in a studio, e.g. fixed in Studio 3?
6. What are typical packing and check-in times, and how many vans do you have? Who drives them?
7. Can freelancers see all gigs, or only their own?
8. Do multi-day events change rooms or venues between days?
9. How often do you sub-rent or borrow gear?
10. Do you want gigs to appear in your Google/Outlook calendars?