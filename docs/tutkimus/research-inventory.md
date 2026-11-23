# Equipment inventory (kalustolista): data model and editing UX

*Research date 2026-11-23. Versions come from the npm registry and official docs as of that date. Unverified items are flagged ⚠.*

## 1. How the established tools model inventory

| Tool | Product/type level | Individual unit | Quantity items | Cases and kits | Accessories | Other |
|---|---|---|---|---|---|---|
| **Rentman** | Equipment item | Serial numbers (needs the Equipment Tracking add-on; up to 999 can be generated at once) | "Bulk" items, not tracked individually | Since July 2024 Kits, Cases and Containers have been merged into **physical combinations**, which can be serialized and have "default content" and "actual content". **Virtual combinations** are sold together but are not a physical object. Cases can be nested. Content can be marked "Stays in combination" or "Reserved from stock" | Per item, set to **Automatic** (always added) or **No** (asks each time). Once planned, the link to the parent item ends | Subrentals (internal or external, supplier set per item), "temporary equipment" for one-off items |
| **Current RMS** | Product, with stock method serialised, bulk, non-stock or none | Serialised stock level (asset) | Bulk stock levels | **Permanent container**: holds serialised items only, can be nested, and its contents check out and back in with it. **Temporary container**: a loose flight case. Booking out empties it, and contents are checked in one by one. Packages are a product with stock method "none" plus accessories | Mandatory, default quantity or optional, charged or free, nested up to 4 levels | Help articles dated 20.8.2026 |
| **Cheqroom** | – | Individual items: own code, flags, purchase date, depreciation | Bulk items: one record per location with a quantity. Broken units are discarded, not repaired | Kits. **Locked kits** always move together. Bulk items can be included in kits | – | Bulk items cannot have a custodian |
| **Snipe-IT** (open source) | Asset model, Category, Manufacturer | Asset with a unique asset tag | Accessories (returned after use), Consumables (used up), Components (installed inside an asset) | Assets can be checked out to another asset (nesting). Predefined kits | – | Status labels of type Deployable, Pending, Undeployable or Archived. **Custom fieldsets attached to the model.** Maintenances (type, dates, cost, supplier). Full history log |
| **itemit** | – | Item with custom fields (a paid PowerUp adds dropdown and conditional fields) | Quantity information on the item | ⚠ I found no documentation on parent/child items | – | – |

**What they agree on:**
1. Keep the **model** separate from the **unit**.
2. Have **two or three tracking types**: serialized, quantity, consumable.
3. A **case is itself a unit that holds other units**. There are two kinds of contents: fixed and loose (the Current RMS permanent/temporary split, Rentman's "stays in combination").
4. A **kit (planning template)** is not the same as a **case (physical object)**.
5. **Accessories** are a rule on the model ("always add" or "suggest"), not physical nesting.
6. **Condition/maintenance status** is a different thing from **availability**, which is derived from bookings.

## 2. Recommended data model (Firestore)

The core idea is to store as little derived state as possible. Availability ("onko vapaa") is calculated from bookings, and the current location is calculated from the case chain plus the latest move. Only condition and ownership are stored as status. This covers both readings of "mikä tila": **Kunto/huoltotila** (condition) and **Sijainti/tila** (room or space).

### `categories` (Kategoriat, at most 2 levels) and `tags` (Tunnisteet, free-form)
Suggested categories: Kamerat · Objektiivit · PTZ-kamerat · Jalustat & tuet · Tuotantotietokoneet (vMix) · Kuvamikserit · Enkooderit & striimaus · Näytöt (TV/LED/monitorit) · Äänimikserit · Langattomat mikit · IEM · Kaiuttimet · Valot · Valo-/kaiutinjalustat · Kaapelit (video/audio/verkko/virta) · Sähkö (jatkot, UPS, akut) · Verkko (kytkimet, reitittimet, 4G/5G) · Laukut & flightcaset · Kulutustarvikkeet.

Tags cut across categories, for example "NDI", "Dante", "4K", "akkukäyttöinen", "streamaus".

Each category also carries **`fieldDefs`**, the custom fields for that category. This copies Snipe-IT's fieldsets. Examples:
- Langaton mikki / IEM: `taajuusalue`
- Objektiivi: `kiinnitys`
- Kaapeli: `pituus_m`, `liitin_A`, `liitin_B`
- Valo: `teho_W`, `värilämpötila`

### `models` (Tuotemalli), one document per product type
- `name`, `manufacturer`, `modelNumber`, `categoryId`, `tags[]`
- `trackingType`: `yksilöity` (serialized) | `määrä` (bulk, returnable) | `kulutus` (consumable)
- `isContainer` (true for flightcases and racks), `defaultContents[]: {modelId, qty}`, which is the case's packing list
- `accessories[]: {modelId, qty, mode: 'aina' | 'ehdota'}`, copying Rentman Automatic/No and Current RMS mandatory/optional
- Logistics fields used for load planning: `weightKg`, `dims` (cm), `powerW`, `needsTwoPeople`
- `photoUrl` (Firebase Storage), `manualUrl`/`links[]` (prefer links to the manufacturer's PDF over uploads), `notes`
- `replacementValue` (for insurance and lost-item estimates)
- For `määrä`/`kulutus` only: `ownedQty`, `brokenQty`, `minQty` (low-stock alert for consumables), `homeLocationId`. Optionally `stockByLocation: {locId: qty}`, but I suggest leaving that out of v1. Cheqroom shows that splitting stock by location makes the UX heavier.
- `custom: {}`, the values for the category's `fieldDefs`

### `units` (Yksilö), for serialized models only
- `modelId`. Copy `categoryId` and `name` onto the unit too, so grid queries need no joins.
- `assetTag` (Tunnus), human-readable, e.g. **KAM-03** or **MIK-12** (category prefix plus a running number from a Firestore transaction). People can write it on gaffer tape, since QR is out of scope.
- `serialNumber`, `nickname` (e.g. "Iso-Sony")
- `condition` (Kunto): `ok` | `huomautus` (works, with a note) | `huollossa` | `rikki` | `poistettu`. This is stored. `huollossa` and `rikki` block bookings.
- `conditionNote`
- `parentUnitId`: the case this unit is in. The location is inherited up the chain.
- `fixedInParent: bool`. true means the unit stays in the case permanently (e.g. a mixer racked into a case, an SDI card in a PC). false means loosely packed for each gig.
- `homeLocationId` (Kotipaikka, e.g. "Varasto 111a")
- `lastKnownLocationId` plus `lastMovedAt`/`lastMovedBy`. Updated when a move is recorded. The live location is shown as: the case chain first, then the active gig, then this value.
- `responsibleUserId` (Vastuuhenkilö, the long-term owner, e.g. the tech who looks after the vMix PC). Who does the job at a particular gig belongs on the booking/gig, not here.
- `ownership`: `oma` | `alivuokrattu` (sub-rented) | `lainattu` (borrowed) | `asiakkaan` (client's own). If not `oma`, also store `supplier`, `rentalFrom`/`rentalTo` and `rentalRef`. Sub-rented items are created as temporary units and archived after return, the same approach as Rentman's "temporary equipment".
- `purchaseDate`, `purchasePrice`, `warrantyUntil`, `photos[]` (e.g. damage photos), `custom: {}`, `archived`

### `maintenance` (Huoltotapahtumat)
- `unitId`, `type` (huolto | korjaus | tarkastus | päivitys), `start`, `end?`, `vendor`, `cost`, `notes`, `photos`
- An open record sets `condition = huollossa` and blocks availability for its time range.
- Add a quick **"Ilmoita vika"** button that anyone can use: it sets `rikki`, takes a note and an optional photo.

### `activity` (Historia), append-only
`{ts, userId, entityType, entityId, action, changes: {field: [old, new]}, gigId?}`, written in the same batched write as the change.

Any event can then be listed per unit ("kuka siirsi KAM-03:n ja milloin"). Make the security rules allow create only, never update or delete.

### `locations` (Sijainnit)
`{name, type: varasto | studiotila | ajoneuvo | ulkoinen kohde | henkilö, parentId}`

Seed it with the studio from the floor plan:
- Studio 1 Halli (holds the loading doors, so it is the default load-in point)
- Studio 2 Keittiö
- Studio 3 Webinaari
- Tarkkaamo 1 (16 m²)
- Tarkkaamo 2 (11 m²)
- Speak
- Studio Lounge
- Väistötila 111a (likely storage)
- 111B
- Väestösuoja (−1)

External venues are hierarchical, e.g. *Clarion Hotel Helsinki → its conference room*.

### `kits` (Paketit), a virtual planning template
`{name, lines: [{modelId, qty} | {unitId}], optionalLines[]}`

Example: "Streamauskitti S" = vMix-PC + 2× PTZ + encoder + "Streamikassi 1" case unit.

Booking a kit onto a gig **expands it into ordinary booking lines**, which can then be edited for that gig. This is how Rentman handles accessories too: the link ends once the lines are planned. A physical case is a unit with `isContainer`, and booking it books its contents.

How the model feeds booking (for the planning researchers): a booking line points to a `unitId` (exclusive, overlap means a conflict), a `{modelId, qty}` for bulk items (conflict if the sum over overlapping gigs exceeds `ownedQty − brokenQty`), or a container unit (which brings its `fixedInParent` children automatically and proposes the loose children).

## 3. Editing UX: grid library comparison (React)

| Library | License / price (Nov 2026) | Free editing features | Missing / caveats |
|---|---|---|---|
| **AG Grid Community** 36.3.0 (4.11.2026) | MIT | Cell editors (text, number, date, checkbox, select), **undo/redo** (`UndoRedoEditModule` is in community), CSV export (via API), print layout, column pinning, quick filter, row selection | Enterprise-only: range selection, fill handle, clipboard paste, Excel export, set filter, row grouping, tree data, batch editing, context menu. Caveat: undo/redo does nothing with `readOnlyEdit`, and the undo stack is cleared by any non-edit data update, which includes Firestore realtime pushes |
| AG Grid Enterprise | $999/developer, perpetual with 1 year of updates (landing page; the configurator covers 1–10 developers on internal apps). Vendr reports $995–1,295 ⚠ | Everything above | The cost is fine for one developer, but none of it is needed for a few hundred rows |
| **MUI X Data Grid** 9.18.0 | Community MIT. Pro $299/yr/dev, Premium $599/yr/dev (new pricing from 8.4.2026, licensed per application) | Editing, CSV, print, copy | **Community pages are capped at 100 rows and pagination cannot be disabled.** Column pinning is Pro. Paste, Excel export and undo/redo are Premium. Only worth it if the app already uses MUI |
| **TanStack Table** 9.3.1 (v9.0.0 released 4.8.2026) | MIT | Headless: sorting, filtering, grouping, pinning, selection | No UI, no editors, no keyboard navigation: you build all of it. Most online examples are still v8 |
| Mantine React Table | MIT | Good UX on top of TanStack | **Stale**: stable 1.3.4 (11/2023) targets Mantine 6, the v2 beta (2/2025) targets Mantine 7, and Mantine is now 9.8. **Avoid.** (Material React Table 3.2.1 from 3/2025 is the better-maintained sibling.) |
| Glide Data Grid | MIT | Canvas-based, very fast, built-in editing | Last stable 6.0.3 (2/2024, peer React ≤18). 6.0.4 alphas (to 10/2025) add React 19. Development is slow, and canvas makes printing and accessibility harder. Overkill for under 2,000 rows |
| react-data-grid (Comcast) | MIT | Editing, **copy/paste and fill-drag callbacks for free**, frozen columns, row grouping | Still `7.0.0-beta.64` (11/2026) after years in beta. Requires React 19.2+. Thin documentation |

### Recommendation
Use **AG Grid Community on desktop and tablet, and a card list with an edit drawer on phones.** It is the most mature free grid with real inline editing, undo, pinning, CSV export and printing, and the inventory (realistically 200 to 1,500 records) fits easily in the client-side row model.

Build the missing Enterprise pieces as app features instead. They are better suited to this domain anyway:
- **Bulk edit ("Muokkaa valittuja")**: checkbox selection, then a dialog that sets one field (category, home location, condition, owner, tag) on N rows in one Firestore batched write. Batches are limited by the 10 MiB request size, not a fixed operation count. Keep each batch to a few hundred documents.
- **Duplicate ("Monista" / "Luo N kpl")**: copy a model or unit and auto-generate N new units with running tags (KAM-04…KAM-08) and blank serial-number cells, ready to type into. This is the biggest time-saver for real data entry, the same idea as Rentman's 999-serial generator.
- **Two-level view instead of row grouping**: the models grid shows counts (owned, ok, in service, booked today). Expanding a row or opening a side panel shows its units. Category is handled with tabs or a filter.
- **Saving edits**: use `onCellValueChanged`, which sends an optimistic Firestore `updateDoc` plus an `activity` write. Keep the grid's own data (not `readOnlyEdit`) so undo works. Use `getRowId = doc.id` and apply snapshot changes with `applyTransaction`. Accept that a teammate's simultaneous change clears the undo stack. ⚠ Prototype this interaction early.
- **Phone**: grids work poorly on a phone. Use a searchable card list (photo, tag, condition chip, location), with the same form component as the desktop detail panel. Put "Ilmoita vika" and "Siirrä" one tap away.

### Printing and export (no import)
- **CSV** via `exportDataAsCsv({columnSeparator: ';', onlySelected, columnKeys})`. Use a semicolon because Excel in Finnish locale expects it. ⚠ AG Grid's docs don't say whether a UTF-8 BOM is added. Test that ä/ö open correctly in Excel, and prepend `﻿` yourself if not.
- **Printable lists** should be your own print-styled React pages (`@media print`, saved as PDF from the browser), not the grid's print layout. Two pages are needed: **packing list per gig** (grouped by case, with checkboxes and contents) and **case content list** (Rentman prints these too). Use the grid print layout only for "print the whole inventory". It renders every row without virtualisation, which is acceptable at this scale.

## 4. Trade-offs and open points
- An alternative to deriving the location is to store `currentLocationId` and update it on every move. That makes queries simpler, but it goes wrong when people forget to record moves. The derived-first approach still keeps `lastKnownLocationId` as a fallback.
- Bulk items per location are deliberately left out of v1. Cables and batteries "live" in cases or in storage, so `ownedQty` plus case contents is enough. Add `stockByLocation` later if the warehouse is split up.
- If the user later insists on Excel-style paste or fill, react-data-grid offers it for free and AG Grid Enterprise ($999 once) is the safe paid path. The data model does not change either way.
- ⚠ Not verified: itemit's parent/child model, AG Grid's CSV BOM default, and AG Grid's exact current Enterprise price (only the landing page and third-party figures were available).
- Possibly later: QR labels (the `assetTag` field is already shaped for them).

## Sources
- https://rentman.io/product-updates/introducing-a-new-flexible-way-to-manage-equipment-in-rentman
- https://rentman.io/product-updates/core-update-physical-combinations
- https://support.rentman.io/hc/en-us/articles/4402870209682-Equipment-Combinations-and-How-to-Work-with-Them
- https://support.rentman.io/hc/en-us/articles/24338169105298-Equipment-Import-How-do-I-format-my-import-file-for-bulk-equipment
- https://support.rentman.io/hc/en-us/articles/360013771040-Solve-Equipment-Shortages-with-Subrentals
- https://help.current-rms.com/en/articles/3035889-differences-between-temporary-and-permanent-serialized-containers
- https://intercom.help/current-rms/en/articles/404164-how-do-packages-or-kits-work-in-current-rms
- https://knowledge.cheqroom.com/helpcenter/whats-the-difference-between-bulk-items-and-individual-items-1
- https://knowledge.cheqroom.com/helpcenter/feature-release-bulk-items-in-kits-and-locked-kits
- https://snipe-it.readme.io/docs/overview
- https://snipe-it.readme.io/docs/custom-fields
- https://snipe-it.readme.io/reference/maintenances-1
- https://help.itemit.com/en/articles/82859-what-information-can-i-add-about-an-item
- https://help.itemit.com/en/articles/82867-is-it-possible-to-add-custom-fields-to-assets
- https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise.md
- https://www.ag-grid.com/license-pricing/
- https://www.ag-grid.com/landing-pages/enterprise-data-grid/
- https://www.ag-grid.com/community-edition/
- https://www.ag-grid.com/react-data-grid/undo-redo-edits/
- https://www.ag-grid.com/react-data-grid/value-setters/
- https://www.ag-grid.com/react-data-grid/csv-export/
- https://www.ag-grid.com/react-data-grid/printing/
- https://www.ag-grid.com/react-data-grid/column-pinning/
- https://www.vendr.com/marketplace/ag-grid
- https://mui.com/pricing/
- https://mui.com/blog/2026-mui-x-price-changes/
- https://mui.com/x/react-data-grid/pagination/
- https://mui.com/x/react-data-grid/clipboard/
- https://mui.com/x/react-data-grid/export/
- https://mui.com/x/react-data-grid/undo-redo/
- https://mui.com/x/react-data-grid/column-pinning/
- https://tanstack.com/table/latest
- https://github.com/glideapps/glide-data-grid
- https://github.com/adazzle/react-data-grid
- https://registry.npmjs.org/ (ag-grid-react, @mui/x-data-grid, @tanstack/react-table, mantine-react-table, material-react-table, @glideapps/glide-data-grid, react-data-grid, @mantine/core; versions and dates checked 2026-11-23)
- https://firebase.google.com/docs/firestore/manage-data/transactions