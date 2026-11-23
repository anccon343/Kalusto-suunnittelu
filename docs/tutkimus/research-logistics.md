# Logistics research: equipment transport, venue profiles, maps and routing (as of 2026-11-23)

## 1. How AV and rental companies model logistics

The big rental and production systems treat logistics the same way. This summary uses vendor documentation, so the claims are vendor-stated.

- **Containers and cases are inventory objects.** Flex Rental Solutions separates a *kit* (a reusable bundle used for quoting and scheduling) from a *container* (a physical case, rack or truck tracked through prep, transit and return). It prints an "Inside Container Report", one page per case listing its contents, to attach to the case. Its trucking module builds a *truck manifest* from the pick list and assigns cases and racks to a specific truck.
- **Vehicles are resources with a capacity.** Rentman stores the fleet, shows which vehicles are free for a job, and filters vehicles by volume or weight capacity. It markets "weight and volume calculations" and a distance calculator. Vehicles are scheduled the same way as crew shifts.
- **Gig-to-gig transfers are first-class.** Current RMS has a "Transfer In" feature: on the destination job you pull items straight from another job without checking them back into the warehouse. Their stated purpose is "resolve shortages and avoid overlapping orders by transferring equipment rather than sub-renting." Once the transfer exists, the item is *reserved* on the destination. When it is booked out, the transfer is *complete*.
- **Capacity has two dimensions.** General load-planning sources agree that you check weight and volume separately. AV gear is bulky and light, so volume usually runs out first.

**Takeaway for this app.** Copy the concepts and leave out the enterprise parts: scanning, sub-rental and invoicing. The four objects worth copying are case, vehicle, transport leg, and direct transfer between gigs.

## 2. Recommended logistics data model (Firestore-friendly)

Finnish UI terms are in parentheses.

**`locations` (Sijainnit): one hierarchical collection for every place equipment can be.**
- Fields: `type` (studio room, storage, vehicle, venue, venue room), `parentId`, `name`.
- Example tree: "Oma studio" > STUDIO 1 HALLI / STUDIO 2 KEITTIÖ / STUDIO 3 WEBINAARI / Tarkkaamo 1 / Tarkkaamo 2 / SPEAK / Väistötila 111a (storage) / Väestösuoja.
- Example external tree: "Clarion Hotel Helsinki" > Bysa 1, Sonck, ...
- Vehicles are also locations, because "it's in the van" is a real state.
- This covers both meanings of *tila*. *Status* is a separate enum on the item: available, booked, in transit, at a gig, in repair, lost. *Space* is `locationId`.

**`venues` (Kohteet / Tapahtumapaikat): reusable venue profile cards**, stored on the venue-type location or in a 1:1 document. Fields:
- address and `lat`/`lng` (optional)
- loading instructions (*lastausohjeet*): dock or door, door dimensions, ramp
- freight elevator: dimensions, kg limit, access key or contact
- parking or unloading zone, with height limits and cost
- venue contacts: name, role, phone, email
- power: phase type and connectors, e.g. 3x16A or 32A CEE
- network: wired uplink, VLAN or guest Wi-Fi, who to contact, upload speed tested
- default travel time from base in minutes, plus a rush-hour note
- free-text "lessons learned"
- attachments: floor plan PDF, photos of the loading route (Firebase Storage)
- `rooms` subcollection: name, m², ceiling height, floor, notes

Venue profiles are the main time saver. They are entered once and reused for every gig.

**`cases` (Kotelot / Flightcaset):**
- Fields: `name`, `tareKg`, outer dimensions (cm), and `volumeM3` computed from the dimensions.
- `defaultContents` is the case's standard packing list.
- Items carry `caseId` when they normally live in that case.
- A gig's pack list is generated grouped by case (*pakkauslista*), with manual checkboxes: Pakattu, Lastattu, Purettu, Palautettu. Manual checkboxes are enough; no scanning is needed (scanning is out of scope).

**`vehicles` (Ajoneuvot):**
- Fields: `payloadKg`, `cargoVolumeM3`, cargo length/width/height, tail-lift (yes/no), licence note.
- In Finland a category B licence covers up to 3,500 kg gross vehicle mass, which is typical for vans. The user enters actual payload and volume from the vehicle registration and spec sheet.

**`gigs` (Keikat):**
- Fields: `venueId`, `roomIds`, responsible person (*vastuuhenkilö*), crew, and time blocks for prep, load-in (*roudaus sisään*), rig, show, load-out (*purku*), return.
- Model these as separate timestamps, not one start and end. Conflicts and transport depend on load-in and load-out, not show time.

**`bookings` (Varaukset):**
- Fields: `gigId`, `itemId` or `caseId`, `from`, `to` (from prep through return), `status`.
- The availability and conflict engine runs on this collection.

**`transportLegs` (Siirrot / Kuljetukset): first-class objects.**
- Fields: `fromLocationId`, `toLocationId`, `departAt`, `arriveAt`, `vehicleId`, `driverId`, `payload` (array of case and item IDs), `status` (planned > loaded > in transit > delivered), `gigOutId` and `gigInId` (which gig it serves).
- Types:
  - outbound (base → gig)
  - return (gig → base)
  - direct transfer (*suora siirto*, gig X → gig Y)
  - internal move (Studio 1 → Studio 3)

**Capacity check (simple and honest):**
- Sum the payload: item weights + case tare, and case volumes (plus loose-item volume if entered).
- Compare against the vehicle: green below 70% of volume, amber from 70% to 90%, red above 90% or over payload.
- Use a utilisation margin, because real packing never reaches 100% of nominal m³. Show the result as a bar on the leg card.
- Don't attempt 3D load optimisation. Tools such as EasyCargo3D exist but are overkill here.

**"Where is it now?" (Missä nyt):**
- Derive it from the last *delivered* leg that contains the item. With no legs, it is the item's `homeLocationId`.
- In Firestore, keep a denormalised `currentLocationId` and `currentLegId` on the item. Write them in the same batched write or transaction that marks the leg delivered.
- Keep an append-only `movements` history, so the derived value can be rebuilt and audited.
- A Cloud Function trigger is the alternative. It is more robust against client bugs, but it needs the Blaze plan, so check current Firebase pricing in the platform research. A client-side batch is enough for 5 to 20 users.
- Allow manual override ("siirretty käsin"). It records a movement without a leg, because reality drifts.

**Chaining gigs (gig X → gig Y):**
- When item A is booked on X and on Y, and Y's load-in is after X's load-out, the app suggests: "Siirrä suoraan X → Y (säästää paluun varastolle)".
- Accepting creates one direct-transfer leg instead of a return leg plus an outbound leg.
- Feasibility check: `X.loadOutEnd + travelMinutes(X.venue → Y.venue) + buffer ≤ Y.loadInStart`.
- If the check fails, show a hard conflict. If it passes with less than about 30 minutes of slack, show a warning.
- This is the Current RMS "Transfer In" idea, applied with time awareness.

**Views that fall out of this model:**
1. Timeline or Gantt per item or case, with rows = equipment and bars = bookings coloured by gig. Transport legs appear as small connector bars.
2. Day logistics board (*Päivän roudaukset*): columns = vehicles or drivers, cards = legs in time order, with load bars.
3. Location board (*Missä mitäkin on*): columns = locations (studio rooms, vans, venues), cards = cases and items, derived from current location.
4. Gig page: pack list by case, legs, and the venue card. On a phone, the driver opens the venue card with loading instructions and a "Navigoi" button.
5. Optional map: venues as pins, today's legs as straight lines or arrows, not routed polylines.

## 3. Clarion Hotel Helsinki (Tyynenmerenkatu 2, 00220 Helsinki, Jätkäsaari)

Facts from public sources. The operator brand moved from Nordic Choice to Strawberry, and older documents use @choice.fi addresses.

- **Layout.** Two hotel towers, connected to Lars Sonck's 1930s warehouse building. The warehouse is converted into the event venue, marketed as **"Makasiini"**, with 13 premises. The two **Ulappa** rooms are on the **16th floor** next to the Sky Room. That matters for logistics: everything goes up by elevator through the tower. The **Bysa** halls are on the top floor of the warehouse.
- **Bysa 1–3.** Combined 669 m², about 6.2 m ceiling (Strawberry quick-facts PDF via search snippet; the PDF now returns 404). Usable whole or split into three. Cvent lists ceilings of about 20 ft, roughly 6.2 m, which agrees.
- **Room table** from the hotel fact sheet. The PDF metadata says it was saved in 2016, so the figures may be outdated.

| Room | m² | Theatre |
|---|---|---|
| BYSA 1+2+3 | 669 | 700 |
| BYSA 3 | 255 | 220 |
| BYSA 2 | 259 | 220 |
| BYSA 1 | 154 | 100 |
| SONCK | 145 | 130 |
| CRUSELL | 116 | 100 |
| TALLBERG | 115 | 90 |
| SANDIS | 113 | 90 |
| SAUKKO | 81 | 60 |
| BRYGGA | 80.5 | 60 |
| KRAANA | 40.5 | – |
| BUNKKERI | 39.5 | 26 |
| HIILI | 39.5 | 26 |
| ULAPPA 1+2 | 62 | 60 cocktail |
| ULAPPA 1 | 33.5 | – |
| ULAPPA 2 | 28.5 | – |

  Visit Finland's venue listing has near-identical sizes, with a few different capacities.
- **Capacity totals disagree across sources:** 700 largest room, and 900, 1,000 or 1,200 total. Rooms in Crusell, Tallberg and Sandis have about 2.5 m ceilings (8.2 ft on Cvent). That limits screens and truss.
- **Access and parking:**
  - About one minute from the end of Länsiväylä by car; tram 9 and metro nearby.
  - Paid parking from about €27 per day or night (Strawberry page and Cvent).
  - Cvent lists "loading dock" as an amenity, with no details.
- **Not public (could not verify):** loading dock location, door dimensions, freight elevator size and weight limit, loading-zone time limits, power and network specs. No public floor plan PDF was found. Cvent links an interactive floor plan and a 360° tour, which I could not read.
- **Contact** (2016 sheet, verify): events.cl.helsinki@choice.fi, +358 10 850 3820.
- **Recommendation.** Seed the Clarion venue profile and its rooms from the table above, marked "lähde: hotellin esite 2016, tarkista". After the first gig there, the user fills in the loading route, elevator, power and network fields from their own experience. That first-hand data is worth more than anything published.

## 4. Maps and routing APIs (prices checked on 2026-11-23)

| Option | What you get | Free tier | Notes |
|---|---|---|---|
| **Google Maps URLs** (`google.com/maps/dir/?api=1&origin=…&destination=…&travelmode=driving`) | Opens navigation in the Google Maps app or browser, with live traffic | **No API key, no cost** | Best value. A "Navigoi" button on every leg and venue card. |
| **Google Maps Embed API** | Embedded map iframe per venue | **Unlimited, no charge** | Needs an API key (no paid usage). Good for venue cards. |
| Google Maps JS (Dynamic Maps) | Interactive map | 10,000 loads/month free, then $7 per 1,000 | Since March 2025, per-SKU free caps replaced the $200 credit. Billing account required. |
| Google Routes, Compute Routes Essentials | Travel time and distance | 10,000/month free, then $5 per 1,000 (Pro: 5,000 free, $10 per 1,000) | Traffic-aware routing is a Pro feature. Google's terms restrict caching route results. From memory, verify before storing computed times. |
| Mapbox | GL JS maps + Directions/Matrix | 50k web map loads, 100k Directions requests, 100k Matrix elements per month | Generous tiers. Credit card account. |
| OpenRouteService (HeiGIT) | Routing on OSM data | About 2,000 directions/day, 40/min | Keys are personal and should not be exposed client-side, so calls need a server. A search snippet says the free plan is non-commercial. I could not confirm this on the live plans page (it now redirects to account.heigit.org). Treat it as risky for a company. |
| Digitransit (HSL/Fintraffic) | Finnish public-transport routing (OTP2), geocoding, map tiles | Free with registration and a key | Built for public transport. It can route by car, but has no traffic data. Useful only if crew travel by public transport. |
| Leaflet + OSM tiles | Map rendering | Free; Leaflet stable is 1.9.4, 2.0 is still in beta | The OSM tile policy requires attribution and allows blocking without notice, with no SLA. Fine for light internal use. |
| Maanmittauslaitos open WMTS | Finnish background maps | Free API key, CC BY 4.0 | Good-quality Finnish base map alternative. |

**Is routing needed? No, not in v1.** Almost all gigs are in the Helsinki area (Jätkäsaari is roughly 15 to 30 minutes from most of the region). A small team cares about "will we make the load-in", not optimal routes. The real constraints are rush hour, loading-zone access and elevator queues. A routing API models none of these.

**Pragmatic model:**
1. **v1: manual times plus deep links.**
   - Each venue stores `travelMinutesFromBase` and an optional rush-hour value.
   - A leg defaults its duration from the venue, and the user can edit it.
   - Gig-to-gig legs default to the sum of both venues' base times, or a manually entered pair value. Pair values are stored in a small `travelTimes` lookup and learned over time.
   - Every leg has a "Navigoi" Google Maps URL button (free, live traffic in the app).
   - Venue cards use the free Google Maps Embed API.
2. **v2 (optional): a "Laske ajoaika" button.**
   - It calls Google Compute Routes Essentials or Mapbox Directions, on demand only, through a Cloud Function so the key stays server-side.
   - At about 5 to 50 calls a month this stays far inside the free tier.
   - Show the result as a suggestion the user accepts into the manual field.
3. **Map overview (optional):** Leaflet or MapLibre with venue pins and straight arrows for the day's legs. Real road polylines add cost and little insight.

## 5. Opinionated summary

- Build logistics around **four objects**: location (hierarchical, vehicles included), case, vehicle, and transport leg.
- Derive **"where is it now"** from the last delivered leg, with a denormalised field plus a movement log.
- Make the **direct gig-to-gig transfer** a suggested action with a time-feasibility check. That is the feature that most directly answers "how to move equipment most sensibly".
- Keep **capacity checks** to weight plus volume with a utilisation margin.
- Use **manual travel times plus free Google Maps deep links and embeds**. Add an on-demand routing call only if users ask for it.
- **Seed Clarion** from public data, but expect the user to supply the operational details (loading, elevator, power, network). Those are not published.

## Sources
- https://fcb.visitfinland.com/en/venue/267/Clarion-Hotel-Helsinki/
- https://www.conferencehotelgroup.com/img/hotels/files/2575/Fact%20Sheet%20ClarionHelsinki%20ENG%20NEW.pdf (hotel fact sheet, text extracted; PDF metadata 2016)
- https://www.cvent.com/venues/en-US/helsinki/hotel/clarion-hotel-helsinki/venue-838950d3-854c-4f2b-b0e0-6c98fb4717f4
- https://www.strawberryhotels.com/hotels/finland/helsinki/clarion-hotel-helsinki/
- https://www.strawberry.fi/globalassets/global/hotel-pictures/clarion-hotel/clarion-hotel-helsinki/pdf/small-talk-big-business.pdf (seen only as a search snippet; now 404)
- https://www.nordicchoicehotels.com/clarion/clarion-hotel-helsinki/conferences/
- https://www.flexrentalsolutions.com/event-rental-software-features/warehouse-scanning/trucking-transportation/
- https://helpcenter.flexrentalsolutions.com/hc/en-us/articles/12053032516503-Containers-and-Packages
- https://rentman.io/solutions/crew-and-transport-management
- https://support.rentman.io/hc/en-us/sections/360004367220-Plan-crew-and-transport
- https://www.current-rms.com/latest-features/planned-transfer-of-assets
- https://help.current-rms.com/en/articles/6009521-creating-a-transfer
- https://www.easycargo3d.com/fr/how-can-you-calculate-your-truckload-capacity-use-software-dont-do-it-manually
- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/billing/overview/
- https://developers.google.com/maps/documentation/urls/get-started
- https://www.mapbox.com/pricing
- https://giscience.github.io/openrouteservice/frequently-asked-questions
- https://openrouteservice.org/plans/ (redirects to https://account.heigit.org/info/plans)
- https://digitransit.fi/en/developers/api-registration/
- https://digitransit.fi/en/developers/apis/1-routing-api/bicycles-scooters-cars/
- https://digitransit.fi/en/developers/deprecations/
- https://operations.osmfoundation.org/policies/tiles/
- https://github.com/Leaflet/Leaflet/releases
- https://www.maanmittauslaitos.fi/en/maps-and-spatial-data/datasets-and-interfaces/general-information-about-interface-services

**Unverified or flagged:**
- ORS non-commercial restriction (search snippet only)
- Clarion loading, elevator, power and network details (not public)
- Clarion capacities (2016 data; sources conflict)
- @choice.fi contact still valid?
- Google route-caching terms (from memory)
- Leaflet 2.0 beta date year not shown on the page