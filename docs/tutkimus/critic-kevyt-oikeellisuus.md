# Correctness and coverage review of the light plan

**Verdict:** The plan covers every core need: an editable list, gig ↔ equipment ↔ time, where it is now, who is responsible, gig-to-gig moves, a visual board, phone use, and answers 1–6. Four defects in the logic would produce wrong results and must be fixed before `src/core` is written (P1). The rest are smaller gaps (P2) and polish (P3).

## Checked and correct (no change needed)

**Worked-example arithmetic:**
- Chain slack A→B is 16 h 30 min and B→C is 15 h 25 min. The late return is "myöhässä 21 h".
- The DST case gives 45 h (Sat 27.3 12:00 UTC → Mon 29.3 09:00 UTC).
- XLR with all gigs counted is 10, 12, 20, 28 and 40 /40. Without tentatives it is 10, 12, 32, 40 and 40 /40. Without the B→C chain it is 0 free on Tue 14–17.
- At the B-creation step it is "≥ 30/40". With the chain it is "≥ 12". At B's confirmation the firm peak is 30/40.

**Dates:**
- 28.3.2027, 25.10.2026 and 31.10.2027 are all the last Sunday of the month.
- The repeated 3.30 hour resolves to 00.30 UTC.
- 23.11.2026 is a Monday in vk 48, and ti 1.12.2026 is in vk 49.
- The KAM-03 15.59 / 16.00 boundary is correct.

**Security rules syntax:** All valid: the function can use `db` inside the match scope, and `.lower()`, `firebase.sign_in_provider` and `email_verified` all work as used.

**Queries:**
- `equipEnd >= cutoff` and `hasUnreturned == true` use automatic single-field indexes.
- `itemIds array-contains` + `orderBy equipStart` does need the composite index the plan names.

**Firebase facts (checked on the official pages today):**
- Scheduled backups say "This feature requires the Blaze pricing plan". Retention is at most 14 weeks, and a restore goes to a new database.
- Spark gives 50K reads, 20K writes and 20K deletes per day, with 1 GiB stored. Hosting gives 10 GB and 360 MB/day. Auth gives 50K MAU. Cloud Storage is "Not applicable" on Spark.
- Everything else runs on Spark.
- The quota resets at Pacific midnight. That is 10.00 in Finland most of the year, but 09.00 in the weeks when the US and EU DST dates differ. Write "yleensä klo 10" or "klo 9–10".

---

## P1: Correctness defects (must fix)

### 1. `blockingOnSave` lets a tentative gig with an existing overlap be confirmed
`old = redPairsInvolving(gig.id, before, gig.id)` evaluates the before-state as if the gig were already confirmed.

When B (alustava) already overlaps W (vahvistettu) on KAM-01, the pair KAM-01|W is red in both "before" and "after". It is therefore not "new", and B's confirmation passes. This breaks rule 5 / test "B:n vahvistus estyy".

**Fix:**
```ts
const old = new Set(redPairsInvolving(gig.id, before))          // tallennetut statukset, ei asFirm
const now_ = redPairsInvolving(gig.id, after, /*asFirm*/ gig.id)
return firm(gig) ? now_.filter(p => !old.has(p)) : []
```
Also:
- Define `redPairsInvolving` explicitly.
- Key a pair as `${itemId}|${competitorGigId | 'kunto'}`, not by lineId. Otherwise re-adding or splitting a line creates false "new" pairs.
- Compute `before` and `after` with the same `now`.

### 2. `runTransaction` does not prevent lost updates, and can silently erase Lähti / Palautettu facts
The transaction only protects the few milliseconds of the save itself. A planner who opened the gig form 10 minutes ago and saves the whole `lines[]` array will overwrite a `returnedAt` (or a new line) written meanwhile from another phone.

The result is wrong data: equipment shows as "Palauttamatta" and keeps blocking, or a chain link disappears. Every Lähti or Palautettu mark rewrites the whole array, so this case is common, not rare.

**Fix (no rev counter needed):**
- Inside the transaction, re-read the fresh gig.
- Apply the user's changes as a patch: header fields that changed, and lines added, removed or changed by `line.id`. Then write.
- Marks (`departedAt`, `returnedAt`) also go through this patch path.
- Alternative: compare the fresh `updatedAt` with the form's base `updatedAt`. If they differ, show "Keikkaa on muutettu, tarkista" and merge.
- State this in 2.2 point 3.

### 3. The yellow (Varoitus) filter can hide a shortage caused only by tentative gigs
`yellow.filter(s => !red.some(r => overlaps(r.iv, s.iv) && r.missing >= s.missing))` compares whole merged periods.

Example: the firm-only shortage is [t1, t2) with 2 missing, and a tentative gig adds 1 missing over [t2, t3). The merged "all demand" shortage is [t1, t3) with max missing 2, so the filter removes it. The tentative gig then gets no warning for [t2, t3).

**Fix:**
- Do one sweep that tracks `usedFirm` and `usedAll` per time segment.
- Segment severity: red if `usedFirm > cap`. Yellow if `usedAll > cap && usedAll − cap > max(0, usedFirm − cap)`.
- Merge adjacent segments that have the same severity and sources.
- Add this to the fast-check oracle: per-minute brute force must give the same severity per minute.

### 4. Invalid chain intervals break the sweep
`lineInterval` trusts `handoverAt` even when:
- the partner line no longer exists,
- the link is asymmetric,
- gig times were changed after chaining.

C rescheduled earlier gives C's line `[handover, equipEnd)` with start > end. A negative-length demand subtracts capacity first and hides real conflicts.

**Fix:**
1. Use a link only if the gig is live, the partner `lineId` exists and the partner points back with the same `handoverAt`. Otherwise use the gig's own times and show "ketju ei täsmää, tarkista".
2. Validate in the form: `A.eventEnd ≤ handoverAt`, and `handoverAt < B.equipEnd` and `handoverAt > A.equipStart`. `handoverAt > B.eventStart` is allowed but shows "Ei ehdi".
3. When either gig's times change, revalidate its chains in the same transaction and offer to move `handoverAt`.
4. `shortages()` ignores or flags demands with `start >= end`.

Add tests: C moved earlier than the handover, a deleted partner line, and an asymmetric link (the last one is already planned).

---

## P2: Coverage and consistency gaps

### 5. Rule 9 checks only one gig
Creating a chain or changing `handoverAt` rewrites both A and B. Run `blockingOnSave` for every gig written in the transaction.

### 6. "Lähti" does not make lines firm, and cancelled-after-departure frees equipment
A tentative gig with a Lähti mark has its equipment physically out. A confirmed gig can still take the same unit, which shows only yellow.

A gig cancelled on site after departure becomes `!live` and its gear immediately shows free.

**Fix:**
- `firm = firm(g) || !!g.departedAt || g.id === asFirm || late`.
- `live()` treats `peruttu` with `departedAt` and unreturned lines as still blocking. Alternatively, Peruttu after Lähti requires "Kaikki palautettu".
- Pressing Lähti on an alustava gig asks "Vahvista keikka?".

### 7. `whereIs` is wrong for chain lines when gig-level Lähti precedes the handover
Example: C has a laptop leaving the studio at 14.00. Jussi presses Lähti at 14.00, but the PTZs still come from B at 17.00. After 17.00 the PTZs show "Espoo" while they are really at Clarion or in a van.

**Fix:** for a chain line:
- t < handoverAt: previous gig's place.
- handoverAt ≤ t < handoverAt + travelMin: "matkalla A → B".
- After that: "odotettu: B:n paikka".
- Ignore `departedAt` if it is earlier than `handoverAt`.
- Define "laitteen viimeisin merkintä" (used for the Siirretty tänne priority) as the latest of `departedAt`, `returnedAt` and passed `handoverAt` on its lines.

### 8. Quantity items have no Missä nyt / Tilanne definition
`whereIs` returns one place, which is meaningless for "XLR × 40".

**Fix:**
- For `quantity > 1`, the item card shows a distribution, e.g. "12 Clarion › Bysa 2 (Hybridiseminaari), 8 → palaa ke 12.00, 20 kotipaikassa".
- Tilanne becomes "vapaana N/40".
- `locationOverride` is hidden for quantity items.

### 9. `hasUnreturned` is undefined
If it means "some line without `returnedAt`", own-studio gigs (which need no marks) and never-departed tentative gigs stay true forever. They are then loaded forever.

**Fix:** `hasUnreturned` = some line where all of these hold:
- no `returnedAt`,
- no live `toGig`,
- the location is not own studio (a room inherits `isOwnStudio` from its parent; write this in 2.3),
- the gig is not peruttu without Lähti,
- the gig is firm or departed.

Also: setting the status to Valmis offers "Kaikki palautettu" first.

### 10. Auth setup step 6.2.2 is wrong or incomplete
- Bare `web.app` and `firebaseapp.com` are not added as authorized domains. The project's own `<id>.web.app`, `<id>.firebaseapp.com` and `localhost` are already authorized by default. Add only a custom domain, if there is one.
- For the redirect fallback (and more reliable popups), set `authDomain` to the domain that serves the app (`<id>.web.app`). Also add `https://<id>.web.app/__/auth/handler` to the Google OAuth client's authorized redirect URIs in Google Cloud Console. Firebase's redirect-best-practices page requires this.
- Note that popups can fail when the app runs as an iOS home-screen web app. Test in a Safari tab and in standalone mode.

### 11. The 3.2 wireframe contradicts rule 7 and the phasing
- B is Alustava, yet its rows say "! Päällekkäin" (that label is red, firm-only). They should read "! Varoitus: päällekkäin Webinaari X:n (vahvistettu) kanssa".
- The wireframe shows `[+ Paketti]`, but packages are in phase 2. No view creates or edits packages. Add "Paketit" to Asetukset, plus "Tallenna rivit paketiksi" on the Keikka view.
- Showing the venue info card (address, loading, parking, contact) from Keikka and Roudaukset is not stated. Add it.

### 12. Test and example states are under-specified
- "XLR ilman alustavia 10, 12, 32, 40, 40" is true only after 4.4, when B is confirmed and C is tentative. With B tentative, Monday would be 30. State the state in 5.3 and 3.3.
- "KAM-04 to klo 9.00: punainen" is red only if the Thursday gig is vahvistettu. A tentative Thursday gig gives yellow, because the late line is firm but the competitor is not. Name the Thursday gig and its status in 4.5 and 5.3.
- The draft uses "vapaana" in two meanings. On Keikka it excludes this gig's own line ("≥ 30/40"). On the board it includes all lines. Define both in 3.

### 13. Time-zone handling gaps
- Kalustotaulu, Roudaukset and Tänään day columns must be built from Helsinki midnights, not "+24 h". The 28.3 day is 23 h and the 31.10 day is 25 h. Add a test for "pienin arvo päivän aikana" on a DST day.
- Run Vitest with `TZ=UTC` and `TZ=America/New_York` in CI so code cannot depend on the host zone.
- dayjs `tz()` has known DST-edge bugs. Write the two helpers on `Intl.DateTimeFormat` from the start, and keep dayjs only for formatting.

---

## P3: Smaller improvements (optional)

14. **Same-second confirm race, optional cheap hardening without counters.** Inside the client transaction, `tx.get()` the competing gig documents for the affected items (already known locally) and the item docs. The Web SDK adds verify preconditions on read documents, so if two people confirm B and W at once, one commit fails, retries, re-reads and is blocked. A gig newly created and not yet in the local snapshot is the only remaining gap. Keep "acceptable risk" as the fallback.
15. **Early return.** `end = min(end, returnedAt)` when `returnedAt < equipEnd`, so gear that is already back is free.
16. **Re-evaluate on a clock.** Re-compute derived conflicts every minute (`now` tick), so late returns turn red without a reload.
17. **Sort comparator.** Use an explicit comparator (`a.t < b.t ? -1 : a.t > b.t ? 1 : 0`). `Infinity − Infinity = NaN` happens to be treated as 0 by the spec, but don't rely on it. Never persist ±Infinity.
18. **Tags and duplicate lines.** Check tag uniqueness case-insensitively after trimming (`kam-03` = `KAM-03`). Block adding the same unit twice to one gig.
19. **Laitekortti history query.** Use `equipStart <= now`, `orderBy desc`, `limit 5`. As written, future gigs fill the list.
20. **Planned future maintenance.** Conditions start at −∞, so "huoltoon ensi viikolla" cannot be entered. Document the workaround: a gig "Huolto" at the service shop with that unit.
21. **Studio room double-booking.** Moving the warning from phase 2 into v1 costs little: a room is a capacity-1 resource in the same sweep.
22. **JSON backup.** Serialize Timestamps with a type tag (`{"_ts":"2026-12-01T07:00:00Z"}`) so the Admin SDK restore script restores them as Timestamps. Test it in the emulator, as planned.
23. **Allowlist lockout.** The Asetukset page must not let anyone delete the last `allowedUsers` doc (otherwise recovery needs the console).
24. **Rules tests.** Add three cases: an unverified email is denied, a non-Google provider is denied, and a mixed-case email maps to the lower-case doc id.