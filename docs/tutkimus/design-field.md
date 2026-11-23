# Design proposal: field usability first ("Kalusto & Keikat")

I wrote this proposal for how the team actually works. Planning happens on a laptop. Everything after that happens on a phone, held in one hand: in a van, in a dim hotel ballroom, or at the loading doors in a noisy studio.

## 0. Design principles (field-first)

1. **Every screen answers one question.**
   - "What do I do next?" → Tänään
   - "Where is X?" → Haku
   - "What goes where?" → Lista
   - "What leaves when?" → Siirrot
2. **Tick a case, not the cable.** Checklists work per case. Ticking a case also ticks its fixed contents. Loose contents expand only when needed. If ticking is slower than not ticking, crew will stop doing it.
3. **The destination comes before the item.** At load-out, the main question is "which van and which next stop?", not "is the XLR here?". Lists are therefore grouped by where the gear goes next.
4. **Big and calm.**
   - Tap targets of 48 px or more, with primary actions in the bottom thumb zone.
   - Asset tags (KAM-03) in large type, so they are easy to match against gaffer-tape labels.
   - A **dark "Keikkatila" theme** for dark venues during a show.
5. **No silent failures on bad signal.** Offline mode is out of scope, but signal drops in places like the Väestösuoja and hotel basements. Firestore's web SDK holds pending writes in memory. The app shows a "Tallennetaan…" chip (from `hasPendingWrites`), an offline banner, and a warning before the tab is closed with unsaved ticks.
6. **Location and status are separate fields.** This covers both meanings of "mikä tila":
   - **Sijainti** is a room, vehicle or venue room.
   - **Kunto** is the stored condition: ok, huomautus, huollossa, rikki or kadonnut.
   - **Tila** (status) is derived from bookings and moves: varastossa, varattu, keikalla or kuljetuksessa.
7. **"Visual" means time × place, not floor plans.** There are two complementary visual axes:
   - by item: the Kalustoaikajana
   - by place: the Sijaintiaikajana, a flow view

## 1. Tech stack (checked 2026-11-23)

| Layer | Choice | License / cost |
|---|---|---|
| App | Vite + React 19.2 + TypeScript, an SPA | MIT |
| UI kit | **Mantine 9.8** + `@mantine/dates` + `@mantine/schedule` (month, agenda, mobile month). Monday is the first day of the week by default | MIT |
| Inventory editor (desktop) | **AG Grid Community 36.3**: inline edit, undo, pinning, CSV export with `;` separator | MIT |
| Timelines | **Custom CSS-grid components**: per-day bars, bulk "34/40" tiles, gig-to-gig arrows. Add TanStack Virtual once there are more than a few hundred rows | MIT |
| Dates | dayjs with the `fi`, `utc`, `timezone` and `isoWeek` plugins. Times stored in UTC and always shown in `Europe/Helsinki` (`ma 23.11.`, `klo 9.00`, `vk 48`) | MIT |
| State | Own `onSnapshot` hooks (`useSyncExternalStore` plus a shared listener registry); URL search params for view state; Zustand for small UI state | MIT |
| Backend | Firebase Blaze. **Firestore Standard in `europe-north1`**: the region cannot be changed later. Hosting. Storage (photos) in europe-north1. Cloud Functions 2nd gen in europe-north1 | ≈ €0–3/month; set a €10 budget alert |
| Auth | Google *or* Microsoft sign-in, depending on what the company uses, plus email link for freelancers. A `members` allowlist checked in Security Rules. `signInWithPopup` or the Hosting `authDomain` to avoid Safari redirect problems | 50k MAU free |
| Hardening | App Check (reCAPTCHA Enterprise; 10k assessments/month free), daily and weekly backups, PITR | cents |
| Maps | Google Maps **URLs** for the "Navigoi" button (no key, free). Optional Maps Embed on venue cards (free, needs a key) | €0 |
| Testing | Vitest for the availability engine (DST, half-open intervals, bulk sweep); Firebase Emulator Suite + `@firebase/rules-unit-testing`; Playwright at 390 px and 1440 px viewports | MIT |
| Install | A PWA **manifest only** ("Lisää Koti-valikkoon"), no caching service worker | – |

**Fallback:** if `@mantine/schedule` (only about 8 months old) handles multi-day gigs badly, use FullCalendar Standard 7.1.5 (MIT) for the month view. Prototype this in week 1.

## 2. Data model (Firestore)

Field names are Finnish where the UI language leaks into the data. Every write also appends to `activity`.

- **members/{email}**: `nimi`, `rooli` (`admin` | `suunnittelija` | `tekijä`), `puhelin`, `aktiivinen`.
- **locations/{id}**: one tree for every place.
  - Core fields: `nimi`, `tyyppi` (`studiotila` | `varasto` | `ajoneuvo` | `kohde` | `kohteen_tila`), `parentId`, `järjestys`.
  - Venue fields (`kohde`): `osoite`, `lat/lng?`, `ajoaikaMin` (from the studio), `ruuhkaHuomio`, `lastausohje`, `hissi`, `pysäköinti`, `sähkö`, `verkko`, `yhteyshenkilöt[]`, `opittua[]` (notes from the field: `{teksti, kuka, pvm}`), `liitteet[]`.
  - Vehicle fields: `rekisteri`, `kantavuusKg`, `tilavuusM3`, `takalaitanostin`.
  - Seed data:
    - **Oma studio** → Studio 1 Halli (holds the **lastausovet**, the default load point), Studio 2 Keittiö, Studio 3 Webinaari, Tarkkaamo 16 m², Tarkkaamo 11 m², Speak, Studio Lounge, Väistötila 111a, 111B, Väestösuoja.
    - **Clarion Hotel Helsinki** → Bysa 1/2/3, Sonck, Crusell, … , Ulappa 1/2 (16th floor). Mark these "lähde: esite 2016, tarkista".
- **categories/{id}**: `nimi`, `etuliite` (e.g. KAM, MIK, used for asset tags), `kentät[]` (custom field definitions).
- **models/{id}**: one per product type.
  - `nimi`, `valmistaja`, `kategoriaId`, `tagit[]`, `seuranta` (`yksilö` | `määrä` | `kulutus`), `onKeissi`, `oletussisältö[] {modelId, määrä}`, `lisävarusteet[] {modelId, määrä, tapa: aina|ehdota}`, `painoKg`, `tilavuusL`, `kuva`, `ohjeLinkki`.
  - For bulk items: `omistettu`, `rikki`, `minimi`.
- **units/{id}**: serialized items only.
  - Identity: `modelId`, plus denormalised `nimi` and `kategoriaId`, `tunnus` (KAM-03), `sarjanumero`, `lempinimi`.
  - Condition: `kunto`, `kuntoHuomio`.
  - Case: `keissiId` (the case unit), `kiinteä` (bool: always stays in the case).
  - Location: `kotiSijaintiId`, `viimeisinSijainti {id, aika, kuka, lähde: siirto|käsin}`.
  - Other: `vastuuhenkilö` (long-term owner), `omistus` (`oma` | `vuokrattu` | `lainattu`), plus `toimittaja` and `palautus` when not owned; `arkistoitu`.
- **kits/{id}**: a planning template ("Webinaaripaketti", "Striimikitti S"): `rivit[] {modelId|unitId, määrä}`, `valinnaiset[]`.
- **gigs/{id}**
  - Basics: `nimi`, `asiakas`, `kohdeId`, `tilaIds[]`, `tila` (`alustava` | `vahvistettu` | `käynnissä` | `valmis` | `peruttu`), `vastuuhenkilö`, `väri`, `muistiinpanot`.
  - Crew: `tiimi[] {email, rooli, vaiheet[]}`.
  - **Phases** as separate timestamps: `pakkaus`, `lähtö`, `rakennus`, `alku`, `loppu`, `purku`, `paluu`. Equipment is blocked from `lähtö` to `paluu`. The show runs from `alku` to `loppu`.
  - Denormalised for the calendar: `puutteita`, `varoituksia`.
- **bookings/{id}**: one line per unit, or per model and quantity for bulk items.
  - `gigId`, `unitId | {modelId, määrä}`, `kitInstanceId?`.
  - Blocked interval: `alku`, `loppu`. These are recomputed whenever the gig's phases or a transfer change.
  - Chain links: `tuleeGigId?`, `meneeGigId?`. `meneeSijaintiId` defaults to the home location.
  - `pakkaustila` (`–` | `pakattu` | `lastattu` | `paikalla` | `purettu` | `palautettu` | `puuttuu` | `vaurio`), `ohitus? {kuka, syy}`.
- **moves/{id}**: Siirrot.
  - `tyyppi` (`lähtö` | `paluu` | `suora` = gig→gig | `sisäinen`).
  - Endpoints: `mistä {sijaintiId, gigId?}`, `minne {sijaintiId, gigId?}`.
  - Timing and assignment: `lähtee`, `perillä`, `ajoneuvoId`, `kuljettaja`.
  - Load: `kuorma {unitIds[], määrät[]}`.
  - `tila` (`luonnos` | `suunniteltu` | `lastattu` | `matkalla` | `perillä`) and `julkaistu` (crew see only published moves).
- **maintenance/{id}**: `unitId`, `tyyppi`, `alku`, `loppu?`, `kuvaus`, `kuvat[]`. An open record blocks bookings.
- **activity/{id}**: append-only; Security Rules allow create only.

**Where a unit is now** is resolved in this order:
1. its case's location (followed up the case chain);
2. the last move marked `perillä` that contains it;
3. a manual "siirretty käsin" entry;
4. its home location.

The UI always shows the source and age, e.g. "Clarion / Bysa 2 · siirto klo 8.40, Mikko".

**Writes**
- Planners save booking lines through a callable function, `tallennaVaraukset` (Admin SDK transaction). It locks each affected unit or model doc, recomputes conflicts and returns them, which keeps confirmed-vs-confirmed checks atomic.
- Crew make direct, rule-limited field updates: they can change `pakkaustila`, `kunto`, `viimeisinSijainti`, `moves.tila` and `opittua`, and nothing else.

## 3. Views

### Phone (bottom tab bar: **Tänään · Keikat · Haku · Siirrot · Lisää**)

1. **Tänään (my day).**
   - At the top is a large "Seuraavaksi" card, e.g. "Pakkaa Keikka A – 14 keissiä · klo 14.00 · 111a → lastausovet", with a single "Aloita" button.
   - Below it, a time-ordered list of my tasks for today and tomorrow, generated from gig roles and published moves.
   - A red row for any open shortage on my gigs.
2. **Haku (global search, also in the top bar everywhere).** Type "kam0", "FX6" or "langaton" and get a unit card:
   - **"Nyt: Keikalla — Clarion, Bysa 2"**
   - **"Seuraavaksi: 27.11. Studio 3 (Webinaari) · suoraan tältä keikalta"**
   - a 14-day mini-strip
   - three thumb buttons: **Siirretty tänne**, **Ilmoita vika** (photo + note), **Ei löydy**
3. **Keikka (mobile).** Four tabs:
   - *Info*: phases as a vertical timeline, the venue card (loading instructions, elevator, parking, tap-to-call contacts, **Navigoi**), and an **"+ Opittua"** field note.
   - *Pakkaus* and *Purku*: the checklists below.
   - *Tiimi*.
4. **Pakkaus checklist.**
   - Grouped by case, with a progress bar ("9/14 keissiä").
   - Ticking a case ticks its fixed contents. Loose contents are listed under it and can be ticked one by one or with "kaikki".
   - Swipe or long-press gives **Puuttuu**, **Vaurio** and **Korvaa** (pick a free unit of the same model).
   - At the end: "Lastattu → [ajoneuvo]". This sets the location of every ticked unit to the vehicle.
5. **Purku checklist, grouped by destination.** This is the main field feature. Example:
   - **"→ Keikka B (Messukeskus, huomenna klo 7.00) · pakettiauto ABC-123"**: 5 keissiä
   - **"→ Studio / 111a"**: 8 keissiä
   - **"→ Huolto"**: 1

   Crew load the right van without needing to ask the planner.
6. **Siirto card (driver).** Shows from → to, departure time, vehicle, a load list by case and the venue loading notes. It has three state buttons: **Lastattu → Matkalla → Perillä**. "Perillä" moves the whole load to the destination location in one batched write.
7. **Missä nyt? (list).** Locations as collapsible groups (Studio rooms, vehicles, venues), each with counts. Filter by category.

### Laptop / tablet (left sidebar)

8. **Keikkakalenteri.** Month and week views, with ISO week numbers. Gig bars are coloured by `tila`. Tentative gigs are hatched, and a badge such as "⚠ 2 puutetta" marks shortages. It has filters for venue and responsible person. On phones it falls back to the agenda view.
9. **Keikan suunnittelu (gig editor).**
   - Left: phase editor. Phase defaults come from the venue's `ajoaikaMin`.
   - Centre: booking lines grouped by kit or case. Each line shows inline availability ("3/4 vapaana", or red "Puute −1: Keikka C, Clarion 12.12.").
   - Actions: add a kit; **"Kopioi keikalta…"**.
   - **Ratkaise** drawer: swap for a free alternative, shift the time, mark as rented in, or accept the conflict with a reason.
   - Right: **suggested moves**. Example: "KAM-03, KAM-04 + Striimikeissi 1 ovat keikalla A, purku 24.11. klo 17 Clarionissa → **suora siirto**, aikaa jää 13 h" [Hyväksy].
10. **Kalustoaikajana (equipment timeline).**
    - Rows are units grouped by category and model. Bulk models get one row of count tiles ("34/40": green, amber or red).
    - Columns are days.
    - Bars: the blocked period is striped and the show is solid. Only the overlapping part of a conflict is red, together with ⚠ and text, so colour is never the only signal. Maintenance is grey.
    - A small **"→ B"** arrow at the end of a bar marks a gig-to-gig chain.
    - Controls: "Vain puutteet", tentative gigs on/off, a legend button. Clicking a bar opens the gig.
11. **Sijaintiaikajana ("Kalustovirta").** This is the "what is where, when" view by place.
    - Rows are locations: Studio rooms, 111a, each vehicle, each active venue. Columns are days (or half-days).
    - Cells show gig blocks and case chips. Moves are drawn as arrows between rows.
    - Gig-to-gig chains read as one continuous path (Studio → van → Clarion → van → Messukeskus → Studio).
12. **Siirtosuunnitelma (transport day and week).**
    - Lanes per vehicle and driver.
    - An "Ilman ajoneuvoa" (no vehicle yet) side panel holds unassigned moves. Click to assign; drag comes later.
    - Each move card has a capacity bar (weight and volume: green below 70%, amber at 70–90%, red above). A conflict marker appears if a driver is in two places at once.
    - Draft vs **Julkaise**: crew see only published moves.
13. **Kalusto (inventory editor).**
    - Desktop: an AG Grid models grid with counts (owned / ok / in service / booked today). Expanding a model shows its units.
    - **Luo N kpl** creates units with running tags KAM-04…KAM-08 and empty serial-number cells.
    - **Muokkaa valittuja** is a batched bulk edit.
    - "Tallenna ja uusi".
    - Phone: a search-plus-card list with a full-screen edit drawer.
14. **Sijainnit & kohdekortit.** Maintain venues, rooms and vehicles. Each location page shows "nyt täällä" and "tulossa".
15. **Studionäyttö.** A read-only link for a tablet by the loading doors or in a tarkkaamo: today's and tomorrow's departures and returns, live.
16. **Tulosteet.** Print-styled (A4) pages: pack list per gig and per move, and a case contents sheet that can be taped inside the lid. **Asetukset**: members, roles, categories, vehicles.

## 4. Key flows

**A. Plan a hotel gig (laptop, about 5 minutes)**
1. Uusi keikka. Choose Clarion → Bysa 2.
2. The phases auto-fill: lähtö = alku − rakennus − ajoaika.
3. Add the kit "Hybridipaketti". Its lines expand and availability appears live.
4. One line goes red ("PTZ-02 huollossa"). Open Ratkaise and pick PTZ-05.
5. Set the gig to Vahvistettu.
6. The suggested moves appear: lähtö from 111a via the lastausovet, and paluu. Assign the van and Mikko, then Julkaise.

**B. Gig-to-gig**
1. Gig B is created for the day after A.
2. Adding the same cases shows "keikalla A, ehtii suoraan".
3. Hyväksy suora siirto. A's return move for those units is replaced by an A→B move. Their blocked intervals are recomputed without a return-to-studio buffer.
4. A's Purku list now shows them under "→ Keikka B".
5. If A's `purku` + travel time + 30 min > B's `lähtö`, the move shows "Siirto ei ehdi" in red.

**C. Pack in the morning (phone)**
1. Tänään → Aloita.
2. Tick cases. Mark one Puuttuu. The planner sees a live red line and can Korvaa.
3. Finish with Lastattu → van. The Studionäyttö updates.

**D. At the venue**
1. Perillä moves the load to Clarion / Bysa 2.
2. The loading dock was not where expected: add **+ Opittua**: "Lastaus Tyynenmerenkadun puolelta, tavarahissi 1000 kg, avain respasta". Every later gig there shows the note.

**E. Damage at load-out**
1. Vaurio + photo sets `kunto = rikki` and opens a maintenance record.
2. Future bookings of that unit turn red.
3. The planner gets a Tänään alert: "KAM-03 rikki – 2 tulevaa keikkaa".

**F. "Where's the FX6?"**
Haku → "fx6" shows each unit's Nyt and Seuraavaksi lines. If reality differs, tap **Siirretty tänne** and pick the location from a short list (my current gig's room, recent locations, studio rooms).

## 5. Phased roadmap (quality over speed)

**Vaihe 0: Confirm and prototype**
- Use Rentman's free 30-day trial for about a week as a requirements benchmark.
- Answer the open questions (§7).
- Build a clickable prototype of Tänään, Haku, Purku-by-destination and the Kalustoaikajana. Test it on the user's own phone in Studio 1 and in a dark room.
- Create the Firebase project in europe-north1.

**Vaihe 1: Inventory + gigs + availability (core)**
- Auth and roles; seed the locations.
- Categories, models, units, cases, the Luo N kpl editor.
- Gigs with phases, booking lines and kits.
- **Availability engine with a test suite** (half-open intervals, DST weekends, bulk sweep, cases, maintenance holds), conflict display and Ratkaise.
- Kalenteri, Haku with the unit card, printable pack list.
- Start using it on real gigs; until Vaihe 2 the location is "kotipaikka + käsin".

**Vaihe 2: Field logistics**
- Moves and suggestions, including gig-to-gig chains with the feasibility check.
- Pakkaus and Purku checklists, Siirto cards with Perillä, Tänään / Omat.
- Vehicles and the capacity bar, Siirtosuunnitelma.
- Venue cards with Opittua notes, fault reporting and maintenance, Missä nyt.

**Vaihe 3: Visual depth**
- The full Kalustoaikajana with bulk tiles and chain arrows.
- Sijaintiaikajana (flow view), Studionäyttö.
- Per-unit history, drag-to-reassign on the timeline, "Keikkatila" polish.

**Possible later:** Web Push reminders, a "Laske ajoaika" routing button via a Function, a map of venue pins, QR labels (the tags already fit), placing gear on a floor plan.

## 6. Risks and mitigations

- **Getting availability logic wrong** (overlaps, bulk, cases, DST). Keep it as one pure TypeScript module shared by the client and the Function. Write tests first. Run it against the emulator in CI.
- **Initial data-entry burden.** Start with bookable, serialized gear and cases. Enter cables and consumables as bulk quantities. Use Luo N kpl. Don't try to inventory everything before the first gig.
- **Crew don't tick lists, so locations drift.** Case-level ticking, destination grouping and one-tap "Siirretty tänne". Always show the age and source of a location so stale data is visible rather than trusted.
- **Bad signal at venues.** Pending-write indicators and offline banners, plus a printed fallback list per gig. Not full offline mode, which is out of scope.
- **Library maturity.** `@mantine/schedule` is young, so the calendar sits behind a thin adapter and FullCalendar Standard is the fallback. Timelines are custom code we own.
- **Bus factor and scope creep.** README, emulator seed data and tests in the repo. Freeze the scope: no quotes, invoicing or hours. If those are ever needed, evaluate Rentman instead.
- **GDPR.** Firebase Auth stores data in the US. Record this in the processing register. Keep personal data minimal.
- **Gig-to-gig misuse.** A direct move must be accepted explicitly. Never auto-reroute gear silently.

## 7. Open questions for the user

1. Does the company use **Google Workspace or Microsoft 365** for sign-in? Do freelancers need access?
2. Is **Väistötila 111a** the main equipment store? On the floor plan there is an **unlabelled grey area between Studio 3 and the lastausovet**. What is it: a loading or staging area, or storage? Gear in 111a has a long way to the loading doors. Should a "staging" location exist?
3. Are some studio setups **fixed installations** (e.g. Studio 3's webinar rig) that are never booked out, or is everything bookable?
4. **Vehicles:** how many, owned or rented? Are private cars used? Do we need weight and volume capacity checks at all?
5. Rough scale: how many items, how many gigs per week, and how often does gear go **directly from one gig to the next**?
6. Typical **phase durations**: do you pack the day before? How long is the return check?
7. Should **tentative (alustava)** gigs only warn, or also block gear?
8. Who plans (1–2 people?), and should crew see draft plans or only published ones?
9. Do you rent in gear from rental houses often enough to track it with a return date?
10. Are **printed** pack lists or case labels still wanted alongside the phone checklists?
11. "Mikä tila": is it fine to show both *Sijainti* (room or place) and *Kunto/Tila* (condition or status)?
12. Who will build and maintain the app long term?