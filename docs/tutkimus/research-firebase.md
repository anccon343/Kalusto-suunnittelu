# Firebase as the backend for the equipment and logistics app (research as of 2026-11-23)

## TL;DR recommendation
Use **Firebase on the Blaze plan**, with these pieces:
- **Cloud Firestore (Standard edition)** in **`europe-north1` (Finland)**
- **Firebase Authentication** with Google or Microsoft sign-in, plus email-link sign-in, gated by an allowlist
- **Security Rules** for admin, editor and viewer roles
- **Cloud Storage** for photos and manuals, in the same region
- **Firebase Hosting** for a Vite/React SPA
- **One or two Cloud Functions (2nd gen, europe-north1)** that write all bookings inside a transaction, so double-booking can't happen

At about 20 users, the realistic cost is **€0–3 per month**. Firestore's real-time listeners suit calendar and board views that several people watch at once.

**The serious alternative is Supabase (Postgres).** Its `tstzrange` columns and exclusion constraints model booking overlaps better than anything in Firebase. The catch is a realistic minimum of **$25/month (Pro)**, because free projects pause after a week of inactivity.

**Firebase SQL Connect (formerly Data Connect)** is not the right fit here. It is Postgres, but its managed GraphQL schema does not expose range types or exclusion constraints, its native SQL is still in Preview, and it costs about $9–15 a month for Cloud SQL after the 3-month trial.

---

## 1. Firestore for this domain

**Fit.** The data is small. Even a large rental house would have only a few thousand items, a few hundred gigs a year and some thousands of bookings. Firestore's weaknesses (joins, aggregations, overlap queries) hurt less at this size, and its strengths are well matched:
- real-time listeners for the shared calendar and Kanban views
- no server to run
- mature web SDK
- free tier

**Overlap queries are now possible.** Firestore supports range and inequality filters on **multiple fields** in one query, up to 10 range fields. The classic overlap test works directly:

```js
// bookings that overlap [S, E) for one item
query(collection(db,'bookings'),
  where('itemId','==',X), where('start','<',E), where('end','>',S))
```
- This needs a composite index on `itemId ASC, end ASC, start ASC` (or the other order). Put the more selective range field first.
- For the "what is where this week" calendar, the same query works without `itemId` and needs an index on `(end, start)`.
- Billing counts documents read plus index entries scanned. At this scale that is negligible.
- One limitation: a range filter combined with equality only on `__name__` is not supported.

**Transactions and double-booking: the key design point.**
- **Web/mobile SDK transactions** only read documents by reference, not queries. They are optimistic (version preconditions) and fail when the client is offline.
- **Server (Admin) SDK transactions** use pessimistic locking by default on Standard edition. Firestore guarantees serializable isolation, but the docs describe locks per document. **I could not verify that a query read inside a transaction prevents concurrent "phantom" inserts.**

The safe pattern is therefore:
1. A callable Cloud Function, `varaa()`, runs an Admin SDK transaction.
2. It reads and locks the `items/{id}` doc and queries overlapping bookings for that item.
3. It checks capacity: the sum of `qty` against `item.quantity`. This covers bulk items such as 20 XLR cables as well as serial-numbered cameras.
4. It writes the booking and increments `items/{id}.bookingSeq`.

Because every booking write touches the item doc, concurrent bookings of the same item are serialized, whatever happens with phantoms. Security Rules then deny direct client writes to `bookings`.

**UX suggestion:** keep a booking status of `alustava` (tentative) or `vahvistettu` (confirmed).
- Tentative overlaps appear as warnings on the timeline.
- Only confirmed bookings are blocked hard.

AV crews often pencil in gear on purpose, so blocking everything would get in their way.

**Real-time listeners.** You pay a read for each document that is added to, changed in, or removed from a listener's result set. If a listener is disconnected for more than 30 minutes, reconnecting re-bills the whole result set. Offline support isn't needed, but leaving the default cache on still reduces reads.

**Cost check.** The free quota is 50k reads, 20k writes and 1 GiB stored per day, and it covers one database per project (the `(default)` database).
- Example load: 20 users × 10 sessions a day × about 300 docs per open = about 60k reads/day. That is slightly over the free tier, and the overage costs cents (reads are about $0.03–0.06 per 100k, depending on region).
- Rules that call `get()` or `exists()` cost one read per referenced doc per request.

**Edition.** Use **Standard**. Enterprise (MongoDB-compatible, pipelines) defaults to optimistic concurrency and has no benefit here.

**Location.** `europe-north1` is a supported regional location, and **it cannot be changed after creation**. Choose it on day one.

## 2. SQL Connect (formerly Data Connect) vs Firestore
Facts:
- Renamed to **SQL Connect** on 2026-04-29. The CLI still uses `dataconnect`.
- `@refresh` real-time queries are new as of April 2026.
- Native SQL (`_select` / `_execute`) is labelled **Preview**. A third-party write-up calls it GA, which conflicts with the official page.
- Pricing: 250k operations/month free, then $0.90 per million (since 2026-05-01). Cloud SQL has a 3-month trial, then costs from about $9.37/month.
- Schema is defined in GraphQL. The default `STRICT` validation can drop tables or columns that aren't in the schema.

For overlap queries, Postgres is semantically better, but **SQL Connect does not let you use Postgres's best features cleanly**:
- Range types aren't part of the GraphQL scalar set.
- An exclusion constraint would have to be added by hand with psql under `schemaValidation: COMPATIBLE`. **I did not verify whether later migrations keep it.**

So SQL Connect costs money and adds moving parts without giving you the exclusion constraint. If you want Postgres, go to Supabase instead.

## 3. Authentication
- **Providers:**
  - **Google sign-in** if the company uses Google Workspace.
  - **Microsoft** if it uses M365, which is common in Finland. Check which one the company uses.
  - **Email link** as a fallback for freelancers. Dynamic Links shut down in August 2025, so email links now use the Hosting domain. This mainly affects native apps; web is fine.
- **Restricting access:** the Google `hd` parameter is only a hint and is not enforcement. Two options:
  - **(a) Simple, no Functions:** keep an allowlist collection, `members/{lowercaseEmail}` = `{role}`. Rules check `request.auth.token.email_verified` and `get(/members/$(email)).data.role`. Role changes take effect immediately and cost one read per request. **Recommended.**
  - **(b) Blocking functions** (`beforeUserCreated` rejects non-allowlisted users and sets claims). These need an **upgrade to "Firebase Authentication with Identity Platform"** and must respond within 7 seconds. This is useful if you also want to stop unknown accounts from being created at all.
- **Custom claims:** set only with the Admin SDK, with a 1000-byte limit. They reach the client on token refresh (or `getIdToken(true)`). They're a good optimisation later, for example a Firestore trigger on `members` that syncs the role into claims and so saves the extra read in rules.
- **Redirect gotcha:** `signInWithRedirect` breaks in browsers that block third-party storage (Safari, Firefox, Chrome M115+). Fixes:
  - set `authDomain` to the Firebase Hosting domain or your custom domain on Hosting, **or**
  - use `signInWithPopup`.
  
  This is one more reason to host on Firebase Hosting.

## 4. Security Rules sketch (Finnish role names fine in data)
```
function member() { return request.auth != null && request.auth.token.email_verified
  && exists(/databases/$(database)/documents/members/$(request.auth.token.email.lower())); }
function role() { return get(/databases/$(database)/documents/members/$(request.auth.token.email.lower())).data.role; }
function editor() { return member() && role() in ['admin','editor']; }
match /members/{e}  { allow read: if member(); allow write: if member() && role()=='admin'; }
match /items/{id}   { allow read: if member(); allow create, update: if editor(); allow delete: if member() && role()=='admin'; }
match /bookings/{id}{ allow read: if member(); allow write: if false; } // only via Function
match /gigs/{id}, /locations/{id}, /moves/{id} { allow read: if member(); allow write: if editor(); }
```
- Add field validation: types, `end > start`, an allowed `status` enum.
- Storage rules can't call Firestore `get()` the same way unless you use cross-service rules. The simplest approach is to mirror the role into custom claims, or to allow any verified member to read and only editors to write under `/items/{id}/`.

## 5. Cloud Storage
- **Requires Blaze.** This has been enforced since 2026-02-03, and Spark projects get 402/403 errors.
- New `*.firebasestorage.app` buckets have an always-free tier **only in us-central1, us-east1 and us-west1**.
- A bucket in `europe-north1` is billed from the first byte, at about $0.020/GB/month. Localized pages differ ($0.020 vs $0.022), so this is not fully verified. For example, 10 GB of photos and PDFs is about €0.20/month.
- **Recommendation:** keep the bucket in europe-north1 for GDPR consistency. Resize photos client-side, to about 1600 px WebP, before upload.

## 6. Hosting vs App Hosting
- **Firebase Hosting:** a global CDN for static SPAs, working on both Spark and Blaze, with 10 GB storage and 360 MB/day transfer free. Use it for a **Vite + React SPA**, with `__/auth` on the same domain.
- **App Hosting:** for SSR frameworks only (Next.js 13.5+, Angular 18.2+, Node 22). It requires billing, and bandwidth costs $0.15–0.20/GiB over 10 GiB. I could not confirm that europe-north1 is an App Hosting region.
- An internal tool behind a login has no SEO needs, so SSR adds nothing.

## 7. Cloud Functions needs (2nd gen, europe-north1, available)
Keep the list minimal:
1. `varaa` / `peruVaraus` / `siirraVaraus`: callable functions for booking create, cancel and move, with transactional conflict checks.
2. Optional: a `members` trigger that syncs roles into custom claims.
3. Optional: a scheduled daily job, for example a "tomorrow's load list" email or a status roll-over such as marking gigs past their end date as done.

Billing:
- 2M invocations/month are free.
- Builds go through Cloud Build and Artifact Registry. Set an image cleanup policy so stored images don't keep costing a few cents a month.

## 8. Region and GDPR
Put Firestore, Functions and Storage in **europe-north1 (Hamina, Finland)**.

**Caveat:** Firebase states that **Authentication runs only from US data centres.** That covers names, emails and sign-in metadata. Google acts as processor under the Firebase Data Processing and Security Terms and is certified under the EU–US Data Privacy Framework. The data here is low-risk employee data, so this is generally acceptable, but **note it in the company's records of processing**.

Keep personal data in Firestore minimal: name, email, phone for crew.

## 9. Pricing: Spark vs Blaze, realistic monthly cost
- **Spark** can't use Storage, Functions, scheduled backups or PITR. **Blaze is required** in practice.
- Blaze keeps the same free quotas. New accounts may get a $300 credit.
- Realistic monthly cost for about 20 users:

| Service | Monthly cost |
|---|---|
| Firestore | €0–1 |
| Hosting | €0 |
| Auth | €0 (50k MAU free) |
| Functions | €0 |
| Storage | €0.10–0.50 |
| Weekly backups | cents |
| Artifact Registry | cents |
| **Total** | **≈ €0–3/month** |

- **Set a budget alert at €10.** Alerts don't cap spending.
- **App Check:** use reCAPTCHA Enterprise. It is free for 10k assessments/month **per organisation**. The free tier was cut from 1M in 2026 (the exact date is unverified). Tokens are cached, so about 20 users stay far below the limit. Enable App Check in monitor mode first, then enforce on Firestore, Storage and Functions.

## 10. Backups and export
- **Scheduled backups** (Blaze): one daily and/or one weekly schedule per database, kept up to 14 weeks. Restores go into a *new* database.
- **PITR:** 7 days, enabled with gcloud or in the console.
- **Managed export** to a GCS bucket with `gcloud firestore export` gives an offline archive.
- **Recommendation:** daily backups kept 7 days, weekly backups kept 14 weeks, and PITR on. The cost is cents at this size.

## 11. Local development
Use the **Firebase Local Emulator Suite** (Auth, Firestore, Functions, Storage, Hosting; SQL Connect too).
- Write rules unit tests with `@firebase/rules-unit-testing`.
- Seed the emulator with studio rooms and sample gigs.
- Run the conflict-check function against the emulator in CI.

## 12. Supabase comparison (brief)
**Pros:**
- Real Postgres: `tstzrange` plus `EXCLUDE USING gist (item_id WITH =, period WITH &&)` (with `btree_gist`) makes overlapping bookings of serial items **impossible at the database level**. Postgres 18 also adds `WITHOUT OVERLAPS`.
- Foreign keys, SQL reporting ("free XLR cables on Friday"), RLS policies, Realtime and Auth.
- A Stockholm region (`eu-north-1`).

**Cons:**
- Free projects **pause after one week of inactivity**, have no backups and a 500 MB database limit. Production use means **Pro at $25/month**, which includes daily backups kept 7 days. PITR costs +$100/month.
- Bulk items still need a trigger or function that sums quantities, because exclusion constraints only cover one-to-one bookings.
- The user asked for something like Firebase. Firestore's real-time sync and zero cost outweigh the DB-level constraint at about 20 users, once bookings go through one transactional function.

**Verdict:** go with Firebase. Choose Supabase only if hard integrity in the database and SQL reporting matter more than $300/year.

## 13. Firestore data model sketch
```
members/{email}        role: admin|editor|viewer, nimi, puhelin, active
locations/{id}         nimi, tyyppi: studio_tila|varasto|ajoneuvo|ulkoinen_kohde|kohteen_tila,
                       parentId (e.g. "Clarion Hotel Helsinki" → "Sali X"; "Studio" → "Studio 1 Halli"),
                       osoite, lastausohje (e.g. "Lastausovet Studio 1"), yhteyshenkilö
categories/{id}        nimi (Kamerat, Valot, Audio, Striimaus, Kaapelit…)
items/{id}             nimi, kategoriaId, merkki, malli, sarjanumero, seurantatapa: yksilö|määrä,
                       määrä, kotiSijaintiId, nykyinenSijaintiId, kunto: ok|huollossa|rikki|kadonnut,
                       vastuuhenkilö (email), kitId?, kuvat[] (Storage paths), ohjeet[], muistiinpanot,
                       bookingSeq (lock counter), updatedAt/By
kits/{id}              nimi ("Striimauskeissi A"), itemIds[]   — book a whole case at once
gigs/{id}              nimi, asiakas, kohdeId (location), tilaId, alku, loppu, roudausSisään, roudausUlos,
                       status: alustava|vahvistettu|käynnissä|valmis|peruttu, tuottaja, crew[] (emails), väri
bookings/{id}          itemId, gigId, qty, start, end (gig window incl. prep/return buffer),
                       status: alustava|vahvistettu, denorm: itemNimi, gigNimi, kohdeNimi
moves/{id}             (siirrot/roudaukset) itemIds[] or bookingIds[], mistä{locationId|gigId},
                       minne{locationId|gigId}, aika, kuljettaja, ajoneuvoId, status: suunniteltu|matkalla|perillä
logs/{id}              append-only history: who changed what (item status, location, check-out/in)
```
**Gig-to-gig handoff:** a `moves` doc where `mistä.gigId = A` and `minne.gigId = B`. The timeline view can then draw arrows between consecutive bookings of the same item, and the app can suggest "send directly from gig A to gig B instead of via the studio" when the gap is short.

**Indexes:**
- `bookings(itemId, end, start)`
- `bookings(gigId)`
- `bookings(end, start)`
- `items(nykyinenSijaintiId, kategoriaId)`
- `moves(aika)`

**Possible later (out of scope now):** QR or barcodes, offline mode, spreadsheet import.

## Unverified / flagged
- Whether Firestore query reads in Admin SDK transactions protect against phantom inserts. The design above avoids depending on it.
- Exact europe-north1 prices for Firestore and Storage.
- Whether europe-north1 is an App Hosting region.
- Whether SQL Connect migrations keep hand-added exclusion constraints.
- Whether SQL Connect native SQL is Preview or GA (sources conflict).
- The exact date of the reCAPTCHA free-tier cut.

## Sources
- https://firebase.google.com/docs/firestore/query-data/multiple-range-fields
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/firestore/transaction-data-contention
- https://firebase.google.com/docs/firestore/pricing
- https://cloud.google.com/firestore/pricing
- https://firebase.google.com/docs/firestore/locations
- https://firebase.google.com/docs/firestore/backups
- https://firebase.google.com/docs/firestore/use-pitr
- https://firebase.google.com/docs/firestore/query-data/listen
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- https://cloud.google.com/storage/pricing
- https://firebase.google.com/docs/sql-connect/pricing
- https://firebase.blog/posts/2026/04/whats-new-sql-connect
- https://firebase.google.com/docs/sql-connect/native-sql
- https://firebase.google.com/docs/sql-connect/manage-schemas-and-connectors
- https://firebase.google.com/docs/sql-connect/configuration-reference
- https://firebase.blog/posts/2025/04/dataconnect-general-availability
- https://firebase.google.com/docs/auth/extend-with-blocking-functions
- https://firebase.google.com/docs/auth/admin/custom-claims
- https://firebase.google.com/docs/auth/web/redirect-best-practices
- https://firebase.google.com/docs/auth/android/email-link-migration
- https://firebase.google.com/support/dynamic-links-faq/
- https://firebase.google.com/support/privacy
- https://firebase.google.com/docs/app-hosting/frameworks-tooling
- https://firebase.blog/posts/2024/10/app-hosting-regions
- https://firebase.google.com/docs/functions/locations
- https://firebase.google.com/docs/app-check
- https://docs.cloud.google.com/recaptcha/docs/billing-information
- https://docs.cloud.google.com/recaptcha/docs/compare-tiers
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/regions
- https://supabase.com/docs/guides/security/gdpr-compliance
- https://supabase.com/blog/range-columns
- https://betterstack.com/community/guides/databases/postgres-temporal-constraints/