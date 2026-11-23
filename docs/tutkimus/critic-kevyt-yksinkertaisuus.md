# Simplicity critique of the light plan draft

Scope: the draft text given in the task, checked against the lead's decisions, `docs/tutkimus/suunnitelma-v1-laaja.md` and `docs/tutkimus/research-firebase.md` (auth section). No files written.

I recomputed every number in the worked example: the XLR free counts per day (10/12/20/28/40 and 10/12/32/40/40), the 0 free cables without the B → C chain, the "30/40 vapaana" in 4.2, both chain slacks (16 h 30 min and 15 h 25 min), the 21 h late return, and the DST cases (45 h, 00.30 UTC, 2026 and 2027 transition dates). All of them are correct. The draft is close, but it still carries about a third more mechanism than a 5-person, 200-item team needs.

---

## P1: Contradictions with the lead's decisions (fix these first)

1. **Return marks are per line, but the lead decided per gig.**
   - The draft has `lines[].returnedAt/returnedBy`, a "Kaikki palautettu" bulk action that "jättää yksittäisen rivin merkitsemättä", and per-line "Palauttamatta" logic.
   - The lead said: "simple per-gig 'lähti' and 'palautettu' marks".
   - **Cut to** gig-level `returnedAt` (and `departedAt`). Rule 4 becomes: the gig is not in the own studio, is firm, has no `returnedAt`, and `now ≥ equipEnd`. Lines that continue to another gig are excluded, as now.
   - With this, `hasUnreturned` is a trivial gig-level flag, or not needed at all.
   - **Why it is safe:** if one item is missing, the team leaves the gig unmarked. Everything on it stays booked, which is the conservative failure mode, and Tänään shows it. Per-line exceptions can go on the Myöhemmin list.
   - Optional: the "Palautettu" button also sets status to Valmis. That removes one concept, since Valmis and Vahvistettu behave the same everywhere else.

2. **"Hyväksy päällekkäisyys" (phase 2) brings back override snapshots.**
   - The draft says "Hyväksyntä koskee vain sillä hetkellä mukana olleita kilpailijoita, joten uusi kilpailija näkyy taas punaisena". That is the snapshot logic the lead explicitly ruled out.
   - **Cut to** a plain per-line note plus an "hyväksytty" flag that turns the conflict from red to grey with the note shown, or drop the feature entirely. The conflict is still recomputed live, so nothing is hidden for long.

3. **Blaze is made mandatory, but the lead said optional.**
   - The draft says "Blaze otetaan käyttöön, kun oikea data syötetään" (6.5), and phase 1 is only done when "Blaze-varmuuskopiot ovat päällä".
   - **Cut to:** stay on Spark, keep the JSON export as the backup, and list scheduled Blaze backups as an optional upgrade.
   - Also remove "budjettihälytys 5 €" as a requirement. A budget alert does not cap spending anyway.
   - Restoring a scheduled backup creates a new database, which means changing the database ID in config and redeploying rules. Say so: it is not simpler than the JSON restore.

4. **Packages are inconsistent within the draft.**
   - They appear in the data model (`packages`, 2.3) and in the wireframe (`[+ Paketti]`), but are scheduled for phase 2.
   - Decide one way. Either keep them in v1 as the lead modelled them, or move them to phase 2 and remove them from 2.3 and the wireframe.
   - Lighter alternative (a mild deviation): "Lisää kalusto keikalta…", which copies lines from an earlier gig. It covers most package use with no new collection, and "Kopioi keikka" is planned anyway.

5. **Locations are heavier than the lead's "simple locations list".**
   - The draft has a `kind` venue/room hierarchy with `parentId`, `source`, five separate info fields, and seeds 14 Clarion rooms with m² and ceiling heights.
   - Room sizes are irrelevant to equipment planning, and the user said no floor plans.
   - **Cut to:** `locations/{id}`: `name`, `isOwnStudio`, `info` (one free-text field for address, loading, parking and contact), `archived`. The gig gets `locationId` plus a `room` text field, with suggestions from the own studio rooms (Studio 1 Halli, Studio 2 Keittiö, Studio 3 Webinaari, Speak) and from rooms used earlier at the same venue.
   - Do not seed the control rooms or Lounge unless gigs happen there; that also drops the "nimet vahvistettava" item.
   - **Why it is safe:** nothing in the availability logic uses the room hierarchy; only `isOwnStudio` matters.

6. **"Studiotilan tuplavarausvaroitus" (phase 2) is a new feature nobody asked for.** Move it to Myöhemmin.

---

## P2: Mechanism that is heavier than needed

7. **The chain link is stored on both sides, with line splitting.** This is the single heaviest remaining part.
   - The draft has `fromGig` and `toGig` on both lines with `lineId`, `handoverAt` and `travelMin` duplicated, an asymmetric-link check plus its test, a two-document transaction, and splitting A's line (12 → B, 8 → back).
   - **Cut to** a one-sided link stored only on the receiving line: `fromGigId`, `handoverAt`, optional `travelMin`. The sender's "menee keikalle Y" and its earlier end time are derived, because all gigs are in memory anyway. A gig save then always writes one document.
   - In v1, a chain moves a whole line: one unit, or the full quantity of a quantity item. No partial splitting.
   - **Why it is safe:** without a chain, cable demand is double-counted. That can only produce an extra warning, never a missed conflict. In the worked example, cables without a chain still fit (40/40 used on Tue 14–17, no conflict). Partial cable chains go on Myöhemmin.
   - This removes these tests: asymmetric link, and the line split. "Peruttu C palauttaa B:n rivin" stays.

8. **The save rule is a generic before/after "red pair" diff (`blockingOnSave`, `redPairsInvolving`).**
   - **Cut to** a line-level check. When a gig is (or becomes) Vahvistettu or Valmis, compute which of its lines are red before and after the edit, and block only if a line that was not red becomes red.
   - That still gives "first to confirm wins", and an existing conflict still does not block saving a note.
   - Missing a second competitor on a line that is already red is acceptable: it is already red.
   - **Naming:** "sääntö 5" (from the user's answer 5) clashes with item 5 in 5.1 (Kunto), while the save rule is item 9. In the UI and the text, call it "Ensin vahvistanut voittaa" or "vahvistussääntö".

9. **`itemIds` and its composite index exist only for the item-card history.**
   - **Cut both.** Compute "viimeisimmät keikat" from the gigs already loaded (60-day window). Older history can be a later one-off query if anyone asks.
   - This also removes a derived field that is stored, which contradicts the draft's own principle 1.

10. **"Missä nyt" (`whereIs`) has a 3-step precedence with four sub-cases.**
    - The cases are: own-studio room, departed, chained-from-previous, "lähdössä", plus "override if newer than latest mark".
    - **Cut to:** "Keikalla X (paikka)", or "Palauttamatta: X", or "Oma studio". The Lähti time is shown as plain text.
    - Show "Siirretty tänne" as a separate line ("Viimeksi nähty: Mikon auto, ma 17.30") next to the computed answer instead of replacing it. Clear it with one tap or automatically when the gig is marked Palautettu.
    - **Why it is safe:** this is information only; nothing blocks on it.

11. **The item model has too many states and fields.**
    - Tilanne has 5 values. Drop "Varattu": it describes the future and is already shown under "Seuraavaksi". Keep: Vapaa · Keikalla · Palauttamatta · Pois käytöstä.
    - `homeLocationId`: per answer 3, practically everything lives at Oma studio. Default it and hide it, or make it optional.
    - Merge `conditionNote` into `notes`.
    - Make `confirmedBy`, `departedBy` and `returnedBy` optional, or drop them. `updatedBy` is enough without history.

12. **Settings hold developer constants and editable lists.**
    - Hard-code `chainHandoverAfterEventMin` and `chainMinSlackMin`. The handover time is editable per chain anyway.
    - Make `categories` free text with autocomplete from existing values. That removes a settings list and open question 2.
    - Drop `presetId` on the gig: a preset is a fill-in action, not a fact.
    - Drop the "Tiukka" (yellow, < 60 min) tier. Show the slack as a number and only "Ei ehdi" in red.

13. **`runTransaction` is described as protection against concurrent edits.**
    - A transaction that writes the whole form state protects nothing.
    - Either compare `updatedAt` inside the transaction with the value the form loaded, and abort with "Joku muokkasi keikkaa juuri, tarkista", or say plainly that the last save wins and the page updates live.
    - With the one-sided chain (item 7), the "ketjun molemmat keikat samassa transaktiossa" part disappears.

---

## P3: Document weight and jargon (the reader is an AV professional, not a developer)

14. **Move the developer material into an appendix ("Liite: kehittäjälle").** That covers 2.2 principles 2–3, the 2.3 collection schema, the 5.2 pseudocode, 6.3 rules, and the transaction and index details.
    - The main body should be plain language: what you see, what you click, what turns red and why.
    - Words to remove from the main text or explain once: johdettu, puoliavoin aikaväli, pyyhkäisy, transaktio, kokoelma/dokumentti, Timestamp/UTC, 1 MiB, ominaisuustesti, raa'an voiman minuuttilaskenta, emulaattori, Admin SDK, MAU, SPA, kapasiteetti, src.
    - Use one word for each concept:
      - "Laite" in the UI, not "Yksilö".
      - "Suora siirto" in the UI, not "Ketju". Roudaukset already says SUORA.
      - "Tilanne" next to "Status" next to "Kunto" next to "Sijainti" is four state-like words. Consider "Nyt" for the item's derived Tilanne.

15. **Shorten 1.2.** The 9-row "laaja vs kevyt" table is history for the developer. Three bullets are enough for the team, or move the table to the appendix.

16. **Testing ceremony beyond what the lead kept.**
    - The lead kept the pure function plus unit tests: DST, half-open intervals, chains, late returns, example numbers. Keep those.
    - Drop the `@firebase/rules-unit-testing` rules test. The rules are a 6-line allowlist; a manual check at launch with a non-listed Google account is enough, documented in the README.
    - Make fast-check optional, a nice-to-have rather than a gate.
    - Remove the hedge "jos dayjs timezone antaa väärän tuloksen, tehdään Intl-pohjaisiksi". Decide once (the Intl-based helpers are the safer choice) and let the tests prove it.
    - Rename the test "ilman alustavia: 10, 12, 32, 40, 40": it assumes B is already confirmed (4.4 step 5), while table 3.1 lists B as Alustava.

17. **Drop Zod.** It is not in the lead's tech list, and Mantine form validation plus TS types cover a handful of forms.

18. **Auth section 6.2.**
    - Step 2 is unnecessary: the project's `*.firebaseapp.com` and `*.web.app` domains (and localhost) are authorized by default. Only a custom domain would need adding.
    - Mention the redirect fallback only in the risk table, not in the setup steps.
    - The "ei käyttöoikeutta" message should show the signed-in user's own address ("Osoitetta x@gmail.com ei ole listalla. Pyydä joku tiimistä lisäämään se.") rather than a named admin, since there are no roles.
    - Add one practical note: add the address exactly as the Google account shows it, in lowercase.

19. **Small view trims (each one is safe and removes a toggle or a branch).**
    - Kalustotaulu: drop the "Alustavat mukana" toggle (always show tentative gigs hatched). Choose 1 or 2 weeks automatically by screen width.
    - Roudaukset: drop "Näytä studion sisäiset". Just don't list moves inside the studio.
    - Kalusto: keep Monista, drop "Tallenna ja uusi".
    - Global top-bar search is optional, since Kalusto and Kalenteri already have search.
    - Tänään: keep today's and tomorrow's moves plus one "Korjattavaa" list (red conflicts and unreturned gigs). "Menneet alustavat" and "ohitetut huollon paluuajat" can be rows in that list rather than separate sections.
    - Optional: merge Roudaukset into Tänään with a date stepper. That saves one view, but the lead listed both, so this is optional.

20. **Phases.**
    - Phase 1 currently contains everything. Give it an earlier usable checkpoint:
      - **1a:** items, gigs, lines, conflicts, Kalenteri, Kalustotaulu, Keikka.
      - **1b:** suora siirto, Lähti/Palautettu, Roudaukset, Tänään.
    - Remove Blaze from the definition of done (item 3).
    - Trim the risk table to the 4–5 real risks: wrong availability calculation, DST, forgotten return mark, simultaneous confirmation, Google popup on phones. "Väärä alue", "laajuus paisuu" and "vain yksi kehittäjä" are process notes.
    - Cut the open questions to about 3:
      - tag format,
      - preset times,
      - fixed studio installations / multi-day gigs.
    - Q2 (categories) disappears with free-text categories, and Q4 (chain defaults) is a developer default the user can edit per chain.

---

## Already consistent with the lead's decisions (no change)

- No roles, Google popup sign-in, and an `allowedUsers` allowlist rule.
- GDPR removed.
- A single `items` collection.
- Four gig times with presets.
- Conflicts derived live in the browser: no Functions, lock counters or nightly job.
- Six views plus settings.
- europe-north1.
- Build-vs-buy kept to one paragraph.
- Pure core logic in `src/core` with tests.

Source files consulted: /home/user/Kalusto-suunnittelu/docs/tutkimus/suunnitelma-v1-laaja.md, /home/user/Kalusto-suunnittelu/docs/tutkimus/research-firebase.md