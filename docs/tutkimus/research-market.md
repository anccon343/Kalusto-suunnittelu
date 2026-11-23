# Market research: AV, rental and production equipment management software
*Checked 2026-11-23. Prices are list prices without VAT and were read from vendor pages today unless a line says otherwise.*

## TL;DR
- **Rentman is the closest off-the-shelf fit** for an AV production company. It has inventory, availability timelines, crew and transport planning, and a mobile app, and it is cheap at this team size (about €113–190/month). It has two real gaps for this team:
  - There is no Finnish UI.
  - Gig-to-gig moves ("roll-overs") are not native. Rentman's own support article calls them a workaround that is "in development".
- **Cheqroom** is a good gear-booking and checkout tool. It has no crew or transport planning, charges per admin seat (about $166–184 per admin per month, billed annually), and the Core plan allows only one location. It is a poor fit for "what is where and when, and how do we move it".
- **No Finnish or Nordic AV-production tool exists.** I found only general rental-shop booking tools (Anolla, WayPAY, Odoo Rental).
- **Recommendation:** a custom Finnish-language app with a narrow scope is justified. The case rests on fit, not price: gig-to-gig logistics as a core concept, studio rooms and venue rooms as locations, a Finnish UI, and exactly the views this team needs. Before building, run Rentman's free 30-day trial (no card needed) for a week as a requirements benchmark, and borrow its core concepts listed below.

## 1. Vendor overview

| Product | What it is | Key concepts | Visual planning | Gig-to-gig | Mobile | Finnish UI | Cost for 5–20 people |
|---|---|---|---|---|---|---|---|
| **Rentman** (NL) | All-in-one AV/event production platform | Serialized and bulk items; physical combinations (a real case, can be serialized) vs virtual combinations (a package whose availability comes from its contents); red shortage lines with "Solve shortage" (alternatives, internal or external subrental); several warehouses; transfer projects; custom warehouse statuses; repairs | Availability timeline; Crew Planner timeline for crew and vehicles; draft vs final planning; travel time per vehicle or person | **Not native.** A support article says to use a custom-status workaround and that native support is "in development" | Free iOS/Android app: schedule, packing lists, scanning, damage reports, signatures | **No.** Official languages are EN/NL/DE/FR/IT/ES; Swedish is community-translated | Platform €39/mo, plus per *power user* per month: Inventory €14 (the price calculator shows €24, a conflict), Equipment Tracking €9 (needed for serial numbers and check-in/out), Crew Essential €14. **Basic users are free.** 2 planners ≈ €113/mo; 4 planners ≈ €187/mo |
| **Current RMS, now "OnRent Events"** (Klipboard, UK) | Event and AV rental | Serialized and bulk stock; opportunity stages decide whether a job blocks availability; **quarantine** (damaged or in-service items leave availability, with optional dates); containers; shortages | Availability overview across the company | **Yes.** "Transfer In" (Planned Transfer of Assets) takes gear straight from another job | Responsive web | **No.** Languages are EN/CS/FR/DE/HU/ES | €73 for the first user + €52 per extra user per month: 5 users = €281/mo, 10 = €541, 20 = €1,061 |
| **HireHop** (UK) | Rental and production | Serialized assets with service and repair status; packages and virtual kits; automatic accessories; job priority system; sub-hire purchase orders; depots | Live availability grid; warehouse dispatch schedule as a live link; route planner | Not verified | Browser app; driver app; repairs module | Not verified | Free tier: 1 user, 15 jobs/year. Professional: £46 + £23 per extra user per month, so 5 users = £138/mo and 10 = £253 |
| **Flex (Flex5)** (US) | Large rental houses | Containers and racks scanned as one group; pull sheets; truck manifests | Availability per job and location | Not verified | Flex5 app | Not verified | Quote only. Third-party sites say $435–510/mo (unverified) |
| **easyjob** (protonic, DE) | Enterprise rental and event ERP | Resources, staff and vehicles; editions S–XL; profitability planner | Resource planning | Not verified | Third parties list web and mobile | German-first; Finnish not verified | Quote only. The vendor site calls **easyjob 6** the current version. An old Capterra listing says €2,370 per user, one-time |
| **Booqable** | Customer-facing rental shop (webshop, payments) | Trackable vs bulk items; bundles; downtime for maintenance; shortage thresholds; locations | Availability calendar; Google/Apple calendar sync | No | Point-of-sale app | Not verified | Grow 69–87/mo (5 users); Scale 149–187/mo (10 users), currency not shown; multi-location add-on 29–37 per location per month |
| **Cheqroom** | Internal gear booking and checkout (media teams, schools) | Reservations; kits (reviewers call them clumsy); custody; overdue flags; maintenance status | Booking calendar | No | Native app with scanning | Not verified (I believe English only) | Per admin seat, annual billing: Core $166–184, Business $250–275, Enterprise $334–367 per admin per month. Non-admin users are free. Core allows 1 location, Business 3. "Unlimited bulk and consumables" is listed only for Custom |
| **Sortly** | Simple inventory (folders and tags) | Check-in/out; custom fields; date alerts | **No reservations or calendar** | No | Yes | Not verified | Ultra $149/mo list (5 users); Premium $299/mo (8 users) |
| **itemit** (UK) | Asset tracking | Bookings and check-outs; inspections; reminders | No timeline found | No | Yes | Not verified | Pro £133/mo or £1,599/yr, unlimited users |
| **Nordic / Finnish** | — | Anolla (Finnish-language rental-shop booking, free core plan); WayPAY (Danish booking and payments); Odoo Rental (ERP module, has a Finnish UI) | Booking calendars only | No | — | Anolla and Odoo: yes | Not built for production logistics |
| **Shelf.nu** (open source, AGPL-3.0) | Asset management with bookings | Bookings that block double-booking; printable gear lists | Basic | No | Paid companion app | No | Free to self-host. It needs Postgres and Supabase, not Firebase |

**Takeaways:**
- **Gig-to-gig:** OnRent Events is the only product I confirmed that treats gig-to-gig moves as a built-in feature. That is the user's key logistics need.
- **Language:** none of the AV-specific tools has an official Finnish UI.
- **Transport UI to copy:** OnRent Go's (not Events') *Movement Scheduler* is a good pattern for a transport view. Unassigned moves sit in a side panel and are dragged onto vehicle or driver rows, with both a schedule view and a timeline view.

## 2. Concepts worth borrowing (not copying)
1. **Item type vs unit.** A *model* (e.g. "Sony FX6") has *serialized units* with their own ID, serial number and status. *Bulk* items (XLR cables, batteries, gaffer tape) have only a quantity. Every serious tool supports both.
2. **Physical vs virtual kits** (Rentman):
   - A *case* is a real container that moves as one, and its contents are fixed.
   - A *template* such as "Webinaaripaketti" expands into lines when added to a gig, and its availability comes from its contents.
3. **Two time windows per gig** (Rentman's planning vs usage period). The *equipment window* runs from packing to return and blocks availability. The *event window* is the show itself. Add optional buffers before and after.
4. **Availability = stock − overlapping reservations − units in maintenance.** When a line is short, show it in **red** at once, and offer alternatives such as "use an FX3 instead" (Rentman).
5. **Booking stages decide blocking** (Current RMS stages, Rentman draft vs final). For example: *Alustava* (provisional) gives a soft warning, *Vahvistettu* (confirmed) is a hard block, *Peruttu* (cancelled) releases the gear.
6. **Quarantine / maintenance as a dated state** (Current RMS). "Huollossa 1.–5.12." (in maintenance 1–5 Dec) removes the unit from availability for exactly that time.
7. **Roll-over / Transfer In** (Current RMS). A move goes straight from gig A to gig B and is its own record (from, to, when, who, vehicle). It does not pretend the gear returns to the warehouse in between.
8. **Location and status are separate fields.** Location answers *where it physically is*: room, vehicle or venue room. Status answers *what state it is in*: available, reserved, on a gig, in transit, broken, lost. This settles the "mikä tila" ambiguity by storing both.
9. **Warehouse/prep statuses on gig lines** (Rentman custom statuses): Pakattu (packed) → Lähtenyt (left) → Paikalla (on site) → Palautettu (returned) / Puuttuu (missing) / Vaurioitunut (damaged).
10. **Draft vs published plan for crew** (Rentman). The planner can sketch freely; crew see only published moves.
11. **Live read-only board link** (HireHop's warehouse dispatch screen), e.g. for a tablet in the studio.

## 3. Essential feature set for this team's internal tool
1. **Equipment list (kalustolista)** that users create and edit in the app: models, units, bulk quantities, categories, photos, notes, value, and a default home location.
2. **Cases and templates:** physical cases plus reusable kit templates.
3. **Location tree:**
   - *Oma studio* (own studio): HALLI, KEITTIÖ, WEBINAARI, Tarkkaamo 1 (~16 m²), Tarkkaamo 2 (~11 m²), SPEAK, Väistötila 111a as the storage room, 111B, Väestösuoja.
   - *Ajoneuvot* (vehicles).
   - *Ulkoiset paikat* (external venues), each with its own rooms, e.g. Clarion Hotel Helsinki → its meeting rooms.
4. **Gigs (keikat):** client, venue and room, the two time windows, stage, responsible person (vastuuhenkilö), crew, equipment lines with kit expansion, and notes. Studio productions are gigs whose venue is one of the studio's own rooms.
5. **Availability engine:** per unit and bulk quantity, conflict warning or block, shortage view, suggested alternatives. This is the hardest part to get right, so it must be correct and tested.
6. **Moves (siirrot):** warehouse→gig, gig→gig and gig→warehouse legs with time, person and vehicle. The app suggests a move automatically when a unit's next booking starts at a different place than where its current gig ends.
7. **Pack and return checklists** that are ticked by hand on a phone (no scanning). Missing or damaged items lead to a status change and a maintenance entry.
8. **Views:**
   - (a) Equipment timeline (Gantt): rows are units or models, bars are gigs, conflicts in red.
   - (b) Gig calendar (month/week).
   - (c) "Missä nyt?" (where is it now) board grouped by location.
   - (d) Transport day plan, Movement Scheduler style.
   - (e) "Omat" (mine): my gigs and my moves.
   - (f) Gig detail with the printable pack list.
9. **Change history** (Rentman sells this as a €12 add-on per power user per month) and two roles: planner/admin and crew (view, tick lists, report damage).
10. Responsive web UI in Finnish that is usable on phone, tablet and laptop.

## 4. Clearly overkill for this team
- Quotes, invoicing, price lists, discount rules, accounting/ERP integrations, CRM.
- Customer webshop, online booking and payments (Booqable, Anolla).
- Multi-depot, multi-currency and tax handling; inter-depot transfers; workspaces; SSO.
- Full sub-rental purchase orders and margin tracking. Keep at most a "rented from outside" unit with supplier and return date.
- Crew hours, timesheets, payroll; route optimisation and GPS.
- RFID, barcode and QR scanning, offline mode and Excel import, all of which the user ruled out. These are at most a "possible later" item.
- Depreciation and profitability planning, e-signatures, a floor-plan editor (an optional later phase at most).

## 5. Build vs buy: an honest assessment

**Buy Rentman if:**
- The team also wants quoting, invoicing, crew hours and transport in one place.
- Nobody can own maintenance of a custom app long term.
- An English UI is acceptable.
- Gig-to-gig moves can be handled with status workarounds.

At 2–4 planners plus free basic users it costs about €1.4–2.3k per year, which is far cheaper than any developer time. It is the market leader for exactly this segment and has a free crew app.

**Buy Cheqroom if:**
- The real problem is internal "who has which camera" booking and checkout.
- There is no gig logistics, crew or transport planning.

Even then, the per-admin price, the location limit on Core, and the bulk and consumables limits make it a weak fit here.

**OnRent Events (Current RMS)** handles transfers best but costs €281/month or more for 5 users, has no Finnish UI, and is going through a rebrand.

**A custom app gives what none of these do:**
- A native **Finnish** UI.
- **Gig-to-gig moves as the central object**, not a workaround.
- The **studio's own rooms and external venue rooms** as first-class locations, so studio productions and hotel gigs live in one model.
- **Exactly six views**, with none of the noise of a full ERP.
- No per-seat cost. The cost is development and maintenance instead.

**Risks of building:**
- Availability and conflict logic is subtle: overlapping windows, bulk quantities, kits, time zones and daylight-saving time.
- Bus factor: if one person built it, nobody else can maintain it.
- Feature creep toward quoting and invoicing.

Mitigate these by:
- Freezing the scope to Section 3.
- Writing tests for the availability engine.
- Running a short Rentman trial to check that no essential concept is missing.

**Verdict:** build it, keeping the scope narrow and borrowing the concepts in Section 2. If the team later needs quoting, invoicing and crew hours, switch to Rentman rather than growing the custom app into an ERP.

## Not verified / flags
- **Cheqroom:** the official pricing page returned 403. Prices come from Cheqroom's own IBC-2025 promotion page ($166/250/334) and third-party sites ($184/275/367). Minimum admin counts and supported languages are unknown.
- **Rentman:**
  - The language and roll-over support articles returned 403. Their content comes from search snippets.
  - Inventory Standard is listed at €14 but the calculator shows €24.
  - Which tier includes the timeline and transport features is not stated.
  - An older article ties the Crew Planner to the "Pro" licence.
- **Flex:** pricing is third-party only.
- **easyjob:** Flex and easyjob feature details are mostly from third parties; easyjob pricing is quote-only. The vendor site said version 6, while one search result mentioned version 7.
- **OnRent Events:** the rebrand date is inferred (about April/May 2026), and it is unclear whether every user needs a paid seat.
- **Booqable:** currency not stated.
- **Not covered:** Firebase running costs were not researched here; that is another topic.

## Sources
- https://rentman.io/pricing
- https://rentman.io/product/equipment-scheduling-software
- https://rentman.io/rentman-mobile-app
- https://support.rentman.io/hc/en-us/articles/14284880-Change-Language-in-Rentman (snippet only; the article is https://support.rentman.io/hc/en-us/articles/360014284880-Change-Language-in-Rentman)
- https://support.rentman.io/hc/en-us/articles/35217346228370-Best-Practices-Managing-Equipment-Roll-Overs-Between-Projects (snippet only)
- https://support.rentman.io/hc/en-us/articles/4402870209682-Equipment-Combinations-and-How-to-Work-with-Them
- https://support.rentman.io/hc/en-us/sections/360004282000-Check-availability-solve-shortages
- https://support.rentman.io/hc/en-us/articles/20306480095378-Differences-between-Subrentals-Transfer-Project
- https://support.rentman.io/hc/en-us/articles/360014610140-Crew-Planner-Module
- https://www.current-rms.com/pricing
- https://current-rms.com/latest-features/planned-transfer-of-assets
- https://help.current-rms.com/en/articles/6009521-creating-a-transfer
- https://intercom.help/current-rms/en/articles/422143-what-is-the-quarantine
- https://intercom.help/current-rms/en/articles/722470-how-do-the-stages-of-an-opportunity-impact-product-availability
- https://help.current-rms.com/en/articles/3777674-select-your-language
- https://help.current-rms.com/en/articles/12008464-klipboard-onrent-events
- https://www.hae.org.uk/news-events/klipboard-unifies-rental-software-portfolio-under-onrent-brand/
- https://intercom.help/OnRent/en/articles/14804632-movement-scheduler
- https://www.hirehop.com/pricing/
- https://www.hirehop.com/features/
- https://www.flexrentalsolutions.com/pricing
- https://www.capterra.com/p/135722/Flex/pricing/ (blocked; figures via search)
- https://www.protonic-software.com/en/
- https://www.capterra.com/p/35069/easyjob-3-0/
- https://booqable.com/pricing/
- https://booqable.com/features/
- https://go.cheqroom.com/25-ibc-special-pricing
- https://frontdeskreview.com/software/asset-tracking/cheqroom/
- https://www.cheqroom.com/features/reservations/ (403)
- https://www.capterra.com/p/140824/CHEQROOM/reviews/?page=2
- https://www.sortly.com/pricing/
- https://www.sortly.com/features/
- https://itemit.com/pricing/
- https://anolla.com/fi/varustevuokrausohjelmisto
- https://waypay.dk/en/guides/equipment-rental-software/
- https://www.odoo.com/fi_FI/app/rental
- https://github.com/Shelf-nu/shelf.nu
- https://www.shelf.nu/solutions/open-source-asset-management