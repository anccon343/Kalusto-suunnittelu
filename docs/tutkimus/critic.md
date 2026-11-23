# Completeness critique of the draft plan (Kalustonhallinta ja keikkalogistiikka)

**Checked on 2026-11-23:**
- I read the floor plan PDF.
- I checked versions and licenses on the npm registry.
- I checked the FullCalendar pricing page, FullCalendar v7 time-zone docs, Rentman pricing, the Firebase Storage FAQ, the Mantine 8 changelog, and firebase-functions issue #1592.

The draft is careful and mostly well grounded. The problems below are inconsistencies and gaps, not wrong direction.

---

## P0: Fix before the plan goes to the user

### 1. The main worked example (5.3, wireframes 4.1 and 4.2) gets its own arithmetic and severity rules wrong
- **Arithmetic in 5.3.**
  - There are 3 FX6. KAM-03 is in maintenance, so capacity is 2. Webinaari X (confirmed) uses 2, so **0 are free**.
  - Clarion wants 3, so the shortage is **−3**, not "Puute −1 · 2/3 vapaana".
  - The stated fix, "2 × FX6 + 1 × FX3", can't turn green because no FX6 is free.
- **Severity in 4.1.** The gig is *Alustava*, yet the footer says "1 kova puute" and shows a red [PUUTE −1]. Rule 6.1.5 makes a shortage that exists only because of a tentative gig *soft* (yellow).
- **Board in 4.2.** Monday shows FX6 "2/3", although KAM-01 is on Lanseeraus, KAM-02 is in Clarion's block and KAM-03 is on hold. That leaves 0 free.
- **Wireframes disagree.** 4.1 assigns KAM-01 to Hybridiseminaari, while 4.2 shows KAM-01 only on Lanseeraus.
- **Fix:**
  - Recompute the scenario so the numbers work. For example: 4 × FX6, KAM-03 on hold, Webinaari X has 2, Clarion wants 3. That gives free 1, missing 2, soft. Then show the resolution "1 × FX6 + 2 × FX3".
  - Make the wireframes match it.
  - Define one cell legend and use it everywhere. For example, "vapaana / käytettävissä" (free / usable after holds), with the shortage shown as a negative number. Today "28/40" means *free/total* in 4.1, and the board cells are ambiguous.
  - These examples will be read as the specification, so they must be right.

### 2. Gig-to-gig (keikalta toiselle) is deferred to phase 1c, but the user named it as core, and phase 1b will produce false conflicts
- The user's priority list explicitly includes "moves between gigs".
- **The default phases create the false conflicts.** Packing starts the day before at 14:00, and return/check ends the next day at 12:00, so each external gig blocks gear for about two days.
  - Any two back-to-back gigs that share gear will clash during the four-week parallel run in 1b. The 5.4 example shows exactly this.
  - Users will either override, which pollutes the data, or stop trusting the app. Either way the phase 1b exit criterion ("0 availability errors") is at risk.
- **Fix:**
  - Move *minimal chaining* into 1b: a per-line toggle "Tulee suoraan keikalta A", the feasibility check (rule 6.1.8) and the chain-aware block interval. The engine already supports these.
  - Keep leg proposals, vehicles and the destination-grouped load-out list in 1c and 2.
- **Make default buffers depend on the venue.**
  - Own-studio gigs need roughly 0–30 min of prep and return. Daily webinars in Studio 3 would otherwise block gear for two days each.
  - External venues keep "pack the day before".
  - Store the defaults per location or location type in `settings` or on the `locations` doc.

### 3. Plan versus reality: late or unreturned gear never affects availability
- The engine frees a unit at `returnAt` whether or not it was returned. "Myöhässä olevat palautukset" appear only on Tänään.
- So a camera still in a van or at Clarion shows as *Vapaa* and can be booked for tomorrow without any warning.
- **Fix:** add the rule "a line whose return check is not done extends its block to `max(returnAt, now)` until it is returned". In practice this is an implicit overdue hold in the engine. Without it, the conflicts tomorrow's gig would show never appear.
- Apply the same idea to *Ei löydy* and *Puuttuu*. Those already create holds, which is good.

### 4. Override scoping bug (6.2 `classify`)
- `ov.some(o => o.acceptedMissing >= s.missing)` lets **any** override among a shortage's sources cover the whole shortage.
- Example: gig A accepts −1. Later another planner's gig B creates a different −1 in the same period, and it is silently shown as "Ohitettu" because of A's acceptance.
- **Fix:**
  - Bind an override to its own line and to a snapshot: the competing line ids and the shortage when it was accepted.
  - Re-flag the line as hard when *new* competing demand appears, not only when `missing` grows.
  - Add a table test for this case.

### 5. Consumables are modelled as returnable
- `demandsForModel` treats `consumable` exactly like `bulk`, releasing the quantity at `blockEnd`. Gaffer tape and batteries do not come back.
- **Fix (either option):**
  - **(a)** Drop consumables from availability in v1. They appear on pack lists only, with a `minQty` alert, and `returnCheck` records the amount consumed, which decrements `ownedQty` through the function.
  - **(b)** Defer consumables entirely to a later phase.
  - Option (a) is simpler and enough.

### 6. Microsoft sign-in would lock everyone out under the draft's rules, and email allowlisting needs hardening
- The rules require `email_verified == true`.
- Firebase returns **`emailVerified: false` for the microsoft.com provider**. This is firebase-functions issue #1592: open, labelled *bug* and *reproduced*, with a maintainer workaround of a `beforeUserSignedIn` blocking function, which needs the Identity Platform upgrade.
- Microsoft also says the `email` claim is unverified and mutable. That is the "nOAuth" class of problem: an allowlist keyed on email can be spoofed from another tenant.
- **Fix: decide based on open question 1.**
  - **Google Workspace:** keep the draft as it is.
  - **M365:**
    - register the Entra app as **single-tenant**,
    - pass the `tenant` parameter,
    - gate the rules on `sign_in_provider == 'microsoft.com'` instead of `email_verified`, or add a blocking function that sets a verified claim,
    - send freelancers through email-link sign-in only.
  - Add this to the risks table and to the phase 0 checklist. Test with a real M365 account in the emulator and in dev.

### 7. The security rules contradict the permission table and the function list
- **Crew can't add "Opittua" notes.** Table 7.4 says crew (Tekijä) can add Opittua-havainnot, but `locations` update is `planner()` only.
  - Fix: route it through a small callable, or allow `arrayUnion` on `venueInfo.learned` alone.
- **History visibility.** The table says crew see "oma ja keikkojen" history, but `activity` has `allow read: if member()`.
  - Fix: either drop the restriction (simpler, and fine for 5–20 people) or say how it is enforced.
- **No function creates gigs.** `gigs` has `create: false`, but no function in 7.3 creates a gig.
  - Fix: specify that `saveGigPlan({gigId: null, …})` creates one.
- **No manual legs.** `legs` has `create: false`, and only `proposeLegs` creates them.
  - Fix: add manual leg creation and editing, because reality drifts.
- **Asset-tag counters can be clobbered.** `settings/app` holds `assetTagCounters` and is admin-writable from the client.
  - Fix: move the counters to `system/counters`, which only functions write.
- **`ownedQty` and `archived` are function-only, but the `models` create rule allows them on create.**
  - Fix: block them on create as well.
- **Functions bypass rules.** Admin SDK functions are not covered by Security Rules.
  - State explicitly that every callable checks an active `members` doc and the role, validates input with Zod, and (for `assignUnits`, `checks` and similar) decides whether crew may act on gigs they are not on.

### 8. Unit identity is lost in pack checks, chains and splits
- `checks/{lineId}` stores only quantities. When a line of 3 has 2 packed, `confirmLeg` can't know *which* units moved, so `recordedLocation` can't be updated.
  - Fix: add `packedUnitIds[]`, `returnedUnitIds[]` and `missingUnitIds[]`, and use field-level updates so two crew members ticking at once don't overwrite each other.
- **Chained lines:** specify that B's line inherits A's `unitIds`. It is the same physical gear.
- **Automatic splits** (4 PTZ: 2 → B, 2 → home): say how units are split and that the planner can change it.

### 9. Bulk items have no location, against the requirement "track where each item is"
- `recordedLocation` exists only on `units`, so "where are the 12 XLRs?" has no answer.
- **Fix: define bulk location explicitly.**
  - Bulk at a venue is derived from delivered legs' `payload.qty` and active lines.
  - Everything not out is at `homeLocationId`.
  - Fixed bulk inside a case follows the case.
- Show this on Missä nyt. Keep `stockByLocation` deferred, as the inventory research suggests.

### 10. The rule for confirming a gig is under-specified
- "Confirmation requires hard conflicts resolved" is ambiguous. Before the save, the gig's own shortages are *soft*, because it is still tentative.
- **Fix:** evaluate the hard run **as if** the gig were already confirmed. Block the change, or require an override, if that produces hard shortages.
- State the competition rule too: whoever confirms first wins, and the other tentative gig is then blocked when it tries to confirm.

### 11. Data-model gaps that break the transaction query
- **Holds can't be queried by model.** `holds.target` is `{unitId} | {modelId, qty}`, yet index `holds(modelId, start)` assumes every hold has a `modelId`.
  - Fix: denormalise `modelId` onto unit holds.
- **Open-ended holds break range queries.** Holds with `end: null` can't take part in a Firestore range query.
  - Fix: query on `start < windowEnd` and filter `end` in memory, or store a far-future sentinel.
- **Not every capacity change goes through the lock.** Every function that changes capacity must also read and increment `models.lockSeq`: `setHold`, `returnCheck` holds, `saveInventoryCapacity` (archive, lowering `ownedQty`, rental dates) and fixed case contents. Today only `saveGigPlan` is shown doing so.
- **Affected gigs aren't recalculated.** These functions must also recompute `conflictSummary` on the gigs they affect. Otherwise calendar badges stay wrong until the nightly integrity check.

### 12. Inventory edits that reduce capacity skip the impact check
- Archiving KAM-02, lowering XLR `ownedQty` from 40 to 30, or fixing a unit into a case can create hard shortages on confirmed gigs.
- In the AG Grid flow some cells (`ownedQty`) go through a function. Their latency and possible rejection need UX.
- **Fix:** run the same engine evaluation and show an impact list ("Vaikuttaa 2 vahvistettuun keikkaan") before committing, as `saveGigPlan` does.

---

## P1: Important gaps

### 13. Studio room double-booking is deferred to phase 3
- Two gigs in Studio 3 Webinaari at the same time is a real, expensive error for a studio company.
- **Fix:** add a simple overlap warning on `gig.roomIds` for own-studio rooms in 1b. It is a few lines with the same interval logic.

### 14. Crew double-booking is only covered for drivers, in phase 2
- "Kuka sen tekee" is a stated requirement.
- **Fix:** add a soft warning in 1b when the same person is crew or responsible on overlapping gig phases.

### 15. "What is where WHEN" relies on the phase 3 Sijaintiaikajana
- **Fix:** give Missä nyt a date and time picker ("Missä huomenna klo 8?") in 1b or 1c, using the existing `expectedLocation(t)`.
- **Fix the overnight gap in chains.** In 5.4 the PTZs sit in Halli from Monday 18:00 until the leg departs Tuesday 7:30, but `expectedLocation` returns "pakkaus/matkalla" for that whole time. Specify "until the direct leg departs, at A's venue or room".

### 16. No recurring or copied gigs until phase 3
- A webinar company almost certainly runs recurring studio sessions.
- **Fix:** move "Kopioi keikalta…" into 1b and add "Toista viikoittain N kertaa", which creates N gigs through `saveGigPlan`.

### 17. A person as a location is missing
- The inventory research included a `henkilö` location type ("Mikko's car or home before an early gig"), and the draft dropped it.
- **Fix:** add the `person` location type.

### 18. Stale clients
- With a manifest-only PWA and no service worker, phones and the studio tablet keep old bundles open for days, while functions and rules change.
- **Fix:**
  - The app compares a deployed `version.json` and shows a "Päivitä sovellus" banner.
  - Callables reject a `clientVersion` older than the minimum.

### 19. Time-zone handling in forms is under-specified
- Since Mantine 8, `DatesProvider` has **no timezone option**, and pickers return naive `YYYY-MM-DD HH:mm:ss` strings (verified in the 7→8 migration guide).
- **Fix:** add one tested helper pair, `helsinkiLocalToInstant()` and `instantToHelsinkiLocal()`.
- **Handle the DST edge cases.** On 25.10.2026 and 31.10.2027, 03:00–04:00 happens twice; on 28.3.2027, 03:00–04:00 does not exist.
- Add these cases to the 6.5 tests.
- FullCalendar v7 is fine: it supports named zones natively through temporal-polyfill (verified).

### 20. Cold starts land in the field
- Every crew action (`assignUnits`, `confirmLeg`, `returnCheck`, `moveManually`, `reportFault`) is a separate 2nd-gen service that cold-starts separately, on a weak hotel or basement network.
- **Fix:** bundle the field operations into one callable (`fieldOp` with an action type) so one warm instance serves them all, and consider `minInstances: 1` on that one rather than on `saveGigPlan`.

### 21. `syncRoleClaims` is unnecessary
- Storage rules can read Firestore directly with **cross-service rules** (`firestore.get(...)`). That removes one trigger and the delay of up to an hour on revocation through claims.
- **Fix:** use cross-service rules.
- **Offboarding:** set `active: false`, disable the Auth user and revoke refresh tokens. Write this into the admin flow.

### 22. GDPR and employment are thin
The draft covers US Auth processing and data minimisation, but not:
- a retention period for `activity` and `movements`, which name people (for example 3 years, then pseudonymise),
- informing staff (GDPR Art. 13; a short tietosuojaseloste),
- accepting the Firebase Data Processing and Security Terms in the console,
- handling a departing member's data,
- that every member can read every member's phone number.

Finnish law: a log of who moved what is work data, not surveillance. Still, if the company has **20 or more employees**, check whether introducing it falls under the yhteistoiminta procedure (Act 759/2004 ch. 4 and the Cooperation Act 1333/2021). This needs confirming, not asserting.

### 23. The studio display (Studionäyttö) has no authentication model
- The draft calls it a "read-only link", which suggests a public URL that bypasses auth.
- **Fix:** use a dedicated signed-in display account with a `viewer` role. The research had this role and the draft dropped it.

### 24. The buy-vs-build cost comparison is understated
- The draft says 3–6 developer-months cost about the same as Rentman for 10 years.
- **Rentman (verified today):** €39 platform + €14 Inventory + €9 Equipment Tracking + €14 Crew Essential per power user. That is about €113/month for two planners and about €187/month for four, or roughly €1.4–2.2k a year.
- **Development:** 3–6 months at Finnish contractor rates is roughly €40–90k, which is **about 20–40+ years of Rentman**, not 10.
- **Fix:** correct the statement, and note that 3–6 months for phases 0–2 at this scope (11 functions, custom board, rules and property tests) is probably optimistic.
- The conclusion (build, for fit) can stand, but the number must be honest.

### 25. Version 1 is not clearly defined
- Phase 0 alone is large: engine plus tests, rules plus tests, a restore drill, a prototype, a Rentman trial and an AG Grid trial. All of it comes before the user can enter one device.
- No rush is wanted, but the user still needs to see what "version 1" is.
- **Fix:**
  - Add a short box "Versio 1 = 1a + 1b (+ minimal chaining)" listing what the user can do on day 1.
  - Let inventory entry (1a) start as soon as models and units are stable, in parallel with the engine work.

### 26. There are too many open questions (21)
- **Fix:** split them into "needed before phase 0 can finish" and "can wait".
- Needed now:
  - Google or M365 (#1),
  - model vs unit planning (#5),
  - the 111a / grey area / storage question (#7),
  - typical buffers (#11),
  - whether tentative gigs only warn (#12),
  - who builds and maintains (#21).
- The rest can wait.

---

## P2: Over-engineering to trim or defer (small team, 5–20 users)

Defer these out of v1:
- **Rental gaps in capacity** (`rentalGaps`, `rental{from,to}` checks). In v1 a rented item is a temporary unit that is archived on return.
- **`fixedBulk` inside cases.**
- **The greedy "kohdennettavuus" heuristic** (6.1.10). The per-unit checks in `assignUnits` catch real clashes at packing time.
- **Monthly Coldline export.** Daily and weekly scheduled backups plus PITR are enough.
- **A quarterly restore drill.** Twice a year is plenty, with a scripted README.
- **App Check.** It is optional for an allowlisted internal app. If kept, note that reCAPTCHA can fail on captive hotel Wi-Fi, and that a tablet left on 24/7 plus hourly token refresh does count toward the 10k/month free tier.
- **The integrity check.** Keep invariants 3, 4, 5 and 9 in v1, and add the others as their features ship.

Review these as well:
- **Two editing UIs.** AG Grid on desktop plus a Mantine card list on phones means two editing surfaces to maintain, plus three styling systems (Mantine, AG Grid, FullCalendar). The planned AG Grid trial should also test the undo stack being wiped by teammates' realtime pushes, and compare against a plain Mantine editable table, which may be enough for 200–1,500 rows.
- **Duplicate audit logging.** Triggers plus function-written summaries will double-log `lines` changes. Pick one writer per entity.

---

## P3: Minor and polish

- **Multi-room gigs.** `expectedLocation` uses `roomIds[0]`. Add an optional `line.roomId`, for example Bysa 2 plus Sonck.
- **Loose case contents.** Say who clears `parentCaseId` for loose items on return. Otherwise inherited locations go stale.
- **Finnish search and sorting.** Use `Intl.Collator('fi')`, accent-insensitive search ("aani" finds "Ääni…"), and ASCII-only `tagPrefix`.
- **Floor plan details the draft missed.** I read the PDF to check these:
  - 111a, 111B and Väestösuoja are *across the main corridor*, outside the studio block.
  - The marked entrance route (blue arrow) leads into Studio 2 Keittiö.
  - The grey area to the right of Studio 3 has **its own outer double doors**, so it is likely the real loading and staging area.
  - Add to question 7: which internal route is used from 111a to the loading doors, and whether internal moves must avoid a shoot running in Keittiö or Lounge.
  - The draft's other floor-plan statements are correct: tarkkaamo positions and sizes, Speak, loading doors on Halli's right wall, Väestösuoja at −1 by 111B.
- **Clarion wording.** "Konferenssitilat ovat Makasiini-rakennuksessa" conflicts with Ulappa being on the 16th floor of the tower. Say "mostly".
- **"Most sensible way to move."** Beyond chain suggestions, `assignUnits` should prefer units already chained or arriving from a nearby gig. Phase 2 lanes should show when two gigs' legs could share one van run. A short note is enough.
- **Listener windows and read volume.** The window of −30…+180 days, about 150 gigs × 30 lines plus inventory, means about 5–6k reads per app open. That is still cheap (about €1–3/month), but say so instead of "300 docs". The engine also needs on-demand loading for gigs booked more than 180 days ahead.

---

## Checked and OK, so leave these as they are
- **npm versions and licenses** match the draft: FullCalendar 7.1.5 MIT (peer `temporal-polyfill`), Mantine 9.8.2 MIT (React ^19.2), mantine-datatable 9.8.4 MIT, AG Grid Community 36.3.0 MIT, firebase 13.4.0 (16.11.2026), firebase-functions 7.4.0, dayjs 1.11.23.
- **FullCalendar Premium:** "Starting at $480", covering 1–10 developers. Renewal is encouraged but optional, and after expiry you may use the last version released before it perpetually. The draft's "(tarkista myyjältä)" is fair. Named time zones are native in v7.
- **Rentman:** €39 platform, Inventory Standard €14, Equipment Tracking €9, Crew Essential €14, basic users free, 30-day trial without a card. Site languages are EN/NL/DE/FR/IT/ES.
- **Storage:** Spark projects lost default-bucket access on 3.2.2026, so Blaze is required, as stated.
- **Firestore transactions:** server SDKs are pessimistic on Standard edition and lock the documents they read. Query-range (phantom) locking is still undocumented, so the draft's lock-counter design is the right call.
- **Calendar:** the DST dates 25.10.2026, 28.3.2027 and 31.10.2027 are correct, and so are the dates and weekdays used (ma 23.11.2026 = vk 48, ma 30.11. = vk 49).
- **Scope:** QR, offline, import and floor-plan placement stay out of the core and appear only as "later". No scope creep found.

Sources:
- [FullCalendar pricing](https://fullcalendar.io/pricing)
- [FullCalendar v7 timeZone](https://fullcalendar.io/docs/timeZone)
- [Rentman pricing](https://rentman.io/pricing)
- [firebase-functions #1592](https://github.com/firebase/firebase-functions/issues/1592)
- [Firebase Microsoft OAuth](https://firebase.google.com/docs/auth/web/microsoft-oauth)
- [Firestore transaction serializability](https://firebase.google.com/docs/firestore/transaction-data-contention)
- [Storage changes FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [Mantine 7→8 migration](https://mantine.dev/guides/7x-to-8x)
- [Mantine 8.0.0 changelog](https://mantine.dev/changelog/8-0-0)
- npm registry: https://registry.npmjs.org/
- Floor plan PDF: /root/.claude/uploads/88bae90c-deaf-5631-87a4-7e919594a4fb/900ba122-654cc7dfdaa6513a277abd38_studio-pohjapiirustus.pdf