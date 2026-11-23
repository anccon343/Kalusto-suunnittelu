# Kalustonhallinta ja keikkalogistiikka: suunnitteludokumentti

*Laadittu 23.11.2026 (vk 48). Pohjana ovat kuusi tutkimusraporttia ja kolme toisistaan riippumatonta suunnitelmaehdotusta, ja versio on tarkistettu kriittisen läpiluvun jälkeen. Studion pohjapiirros on tarkistettu PDF:stä. Kirjastojen versiot ja lisenssit on tarkistettu npm-rekisteristä samana päivänä: FullCalendar 7.1.5 MIT, Mantine 9.8.2 MIT, AG Grid Community 36.3.0 MIT, mantine-datatable 9.8.4 MIT, Firebase JS SDK 13.4.0 Apache-2.0, firebase-functions 7.4.0 MIT ja dayjs 1.11.23 MIT. Microsoft-kirjautumisen `emailVerified`-vika on tarkistettu GitHubista (firebase-functions #1592: avoin, merkinnät *bug* ja *reproduced*). Merkintä "(tarkista)" tarkoittaa, että tietoa ei saatu varmistettua ensikäden lähteestä.*

---

## 1. Tiivistelmä

### 1.1 Mitä rakennetaan

Rakennetaan suomenkielinen verkkosovellus, joka toimii puhelimella, tabletilla ja läppärillä. Sovelluksessa on kaksi ydintä:

1. **Kalustolista.** Tiimi luo ja ylläpitää sitä itse sovelluksessa. Listassa on tuotemallit, sarjanumeroidut yksilöt (esim. KAM-03), määrätavarat (kaapelit, jalustat), kulutustavarat, laukut eli flightcaset sisältöineen, paketit ("Webinaaripaketti"), kunto ja huollot, kotipaikka ja vastuuhenkilö.
2. **Kaluston suunnittelu keikoille.** Sovellus kertoo, mikä kalusto menee millekin keikalle ja milloin. Saatavuus ja konfliktit näkyvät heti. Sovellus kertoo, missä laite on nyt ja minne se on menossa, ja kuka vastaa mistäkin. Se ehdottaa siirtoja, myös **suoraan keikalta toiselle** ilman käyntiä varastossa, ja tarkistaa, ehtiikö siirto.

"Visuaalinen" tarkoittaa tässä **kalenteria, aikajanoja ja tauluja**: mikä on missä ja milloin. Pohjapiirroseditoria ei tehdä. Studion huoneet ovat sovelluksessa nimettyjä sijainteja (Studio 1 Halli, Studio 3 Webinaari, Väistötila 111a…). Ulkoiset kohteet huoneineen, esimerkiksi Clarion Hotel Helsinki › Bysa 2, ovat samassa sijaintipuussa.

**Rajattu pois käyttäjän pyynnöstä:** QR-tarrat ja viivakoodit, puhelimella skannaus, offline-toiminta ja Excel-tuonti. Ne voi lisätä myöhemmin. Tunnus (KAM-03) sopii valmiiksi myöhemmälle tarralle.

### 1.2 Suositeltu tekniikka yhdessä kappaleessa

Sovellus on **Vite + React 19.3 + TypeScript -SPA**. Käyttöliittymäkirjasto on **Mantine 9** (MIT) ja keikkakalenteri **FullCalendar Standard 7.1.5** (MIT, suomen kieli mukana). Kalustolistan pöytäkonemuokkaukseen valitaan vaiheen 0 kokeilussa joko **AG Grid Community 36.3** (MIT) tai tavallinen Mantine-taulukko. Kalustotaulu eli aikajana on **oma CSS-grid-komponentti**, ja päivämäärät käsitellään **dayjs**-kirjastolla (Europe/Helsinki, viikkonumerot, "klo 9.00"). Taustapalveluna on **Firebase Blaze -tilaus**, jonka kaikki osat ovat alueella **europe-north1 (Hamina)**: Firestore Standard, Cloud Functions 2nd gen, Storage ja Hosting. Kirjautumiseen käytetään Firebase Authia: Google tai Microsoft sen mukaan, kumpaa yritys käyttää, ja freelancereille sähköpostilinkki. **Kaikki saatavuuteen vaikuttavat tallennukset kulkevat muutaman transaktionaalisen Cloud Functionin kautta.** Ne käyttävät samaa puhdasta TypeScript-saatavuusmoottoria kuin selain, ja moottori testataan perusteellisesti. Ylläpitokulut ovat noin **0–10 € kuukaudessa**.

### 1.3 Ostaa vai rakentaa: rehellinen arvio

| Vaihtoehto | Milloin parempi kuin oma sovellus | Miksi ei ensisijainen |
|---|---|---|
| **Rentman** (39 € alusta + Inventory 14 € + Equipment Tracking 9 € + Crew Essential 14 € per suunnittelija: noin 113 €/kk kahdella ja noin 187 €/kk neljällä; perustason käyttäjät ilmaisia) | Jos tarvitaan myös tarjoukset, laskutus, työtunnit ja kuljetukset, englanninkielinen käyttöliittymä kelpaa eikä kukaan pysty omistamaan omaa sovellusta pitkällä aikavälillä | Ei suomenkielistä käyttöliittymää (EN/NL/DE/FR/IT/ES). Keikalta toiselle -siirto on Rentmanin oman tukiartikkelin mukaan kiertotie. Mukana paljon tarpeetonta |
| **Cheqroom** (noin 166–184 $/ylläpitäjä/kk) | Jos ongelma on vain se, kenellä mikin kamera on | Ei keikka- eikä kuljetussuunnittelua. Core-tasossa yksi sijainti |
| **OnRent Events** (ent. Current RMS; 5 käyttäjää noin 281 €/kk) | Markkinoiden paras keikalta toiselle -toiminto ("Transfer In") | Kallis, ei suomea, nimenmuutos meneillään |
| **Oma sovellus** | Suomenkielinen käyttöliittymä, keikalta toiselle keskeisenä toimintona, studion huoneet ja kohteiden tilat samassa mallissa, ei käyttäjäkohtaisia maksuja | Suurin kustannus on **kehitys- ja ylläpitotyö**, ei palvelinkulu |

**Rehellisesti:** rahassa mitattuna Rentman on selvästi halvempi. Rentman maksaa noin 1,4–2,2 t€ vuodessa. Jos vaiheet 0–2 (3–6 kokeneen kehittäjän henkilökuukautta) ostetaan suomalaisella konsulttihinnalla, hinta on karkeasti 40–90 t€. Se vastaa **noin 20–60 vuoden Rentman-maksuja**. Lisäksi 3–6 kuukautta on tälle laajuudelle (oma aikajana, sääntöjen ja moottorin testit, useita funktioita) todennäköisesti optimistinen arvio. Oma sovellus kannattaa vain, jos (a) **sopivuus painaa enemmän kuin hinta** (suomi, keikalta toiselle -logistiikka, juuri nämä näkymät), (b) rakentaja ja **pitkäaikainen ylläpitäjä on olemassa** ja (c) laajuus pidetään kapeana.

**Suositus:** rakennetaan, jos ehdot (b) ja (c) täyttyvät. Vaiheessa 0 käytetään Rentmanin ilmaista 30 päivän kokeilua (ei korttia) noin viikon ajan vertailukohtana. Jos tarjoukset, laskutus ja tuntikirjaus joskus tulevat tarpeeseen, siirrytään Rentmaniin. Omasta sovelluksesta ei kasvateta toiminnanohjausjärjestelmää.

### 1.4 Miten kolmesta ehdotuksesta päädyttiin tähän

Pohjaksi valittiin **"foundation"-ehdotus**: malli ja yksilö ovat erillään, sanan "tila" kaksoismerkitys puretaan erillisiksi kentiksi, saatavuusmoottori on puhdas ja testattu, varaukset kirjoitetaan vain funktioissa, ja suunniteltu sijainti erotetaan kirjatusta. **"Field"-ehdotuksesta** otettiin kenttäkäytettävyys: laukun kuittaus kerralla, purkulista määränpään mukaan, sijainnin lähde ja ikä, tallennuksen tila, kohdekortin Opittua-havainnot ja studionäyttö. **"Robust"-ehdotuksesta** otettiin eheys: malli varataan ja yksilöt valitaan viimeistään pakatessa, kunto ja huolto mallinnetaan pitoina, ketjun estojaksot koskettavat toisiaan, `rev`-laskuri, siirtojen kattavuus ja yöllinen eheystarkistus.

| Kiistakysymys | Päätös | Perustelu |
|---|---|---|
| Varataanko malli vai yksilö | **Molemmat.** Rivi on aina "malli × määrä", ja yksilöt lukitaan heti tai valitaan pakatessa | Kattaa sekä tavan "3 kameraa" että "juuri KAM-03" |
| Kunto kenttänä vai pitoina | **Saatavuuteen vaikuttavat vain pidot.** Yksilöllä itsellään on vain OK/huomautus | Yksi totuuden lähde, alku ja loppu |
| Kalenteri | **FullCalendar Standard** ohuen sovittimen takana | Kypsä. @mantine/schedule on liian nuori |
| Kalustolistan muokkaus | **Päätetään vaiheen 0 kokeilussa:** AG Grid tai tavallinen muokattava Mantine-taulukko | Kaksi muokkauspintaa ja kolme tyylijärjestelmää ovat ylläpitokuorma. 200–1 500 riville Mantine voi riittää |
| Kenttien nimet | **Koodi englanniksi, käyttöliittymä suomeksi** (`fi.ts`) | Helpompi toiselle kehittäjälle |
| Ketjun estojakso | **Jaksot koskettavat:** A:n rivi päättyy ja B:n rivi alkaa hetkellä A.purku valmis | Ei aukkoa eikä tuplalaskentaa |
| Keikalta toiselle -siirron vaihe | **Ketjutus vaiheessa 1b**, siirtoehdotukset vaiheessa 1c, ajoneuvot vaiheessa 2 | Ilman ketjutusta peräkkäiset keikat tuottavat vääriä konflikteja heti ensimmäisestä keikkaviikosta |
| "Missä nyt" | **Kuitattu fakta ja suunnitelmasta johdettu odotus**, ero näytetään | Unohtunut kuittaus ei jää piiloon |
| Myöhässä oleva palautus | **Varaa kaluston, kunnes se on palautettu** | Pakettiautoon jäänyt kamera ei saa näkyä vapaana |
| Ohitus (ylivaraus) | **Sidotaan omaan riviinsä ja tilannekuvaan kilpailijoista** | Toisen keikan uusi puute ei saa piiloutua vanhan ohituksen alle |
| Kulutustavarat | **Eivät kuulu saatavuuslaskentaan** | Teippi ei palaa. Määrä vähennetään kulutuksen mukaan |
| Historialoki | **Yksi kirjoittaja per kokoelma**: funktiot omille kirjoituksilleen, laukaisin selaimen kirjoituksille | Ei tuplakirjauksia |
| Kuittaukset | **Suoraan `checks`-dokumentteihin** yksilötunnuksineen. Sijainnin muutokset funktion kautta | Rasti on välitön, ja sijainti pysyy johdonmukaisena |
| Budjettihälytykset | **5 € ja 20 €** | Varhainen ja selvä hätämerkki |

---

## 2. Tutkimuksen keskeiset löydökset

### 2.1 Markkina
- **Rentman** on lähin valmis ratkaisu: varasto, saatavuusaikajana, henkilöstö- ja kuljetussuunnittelu ja mobiilisovellus. Siinä ei ole suomea, eikä keikalta toiselle -siirtoa natiivisti (tukiartikkelia ei saatu auki, sisältö on hakutuloksen tiivistelmästä).
- **OnRent Events / Current RMS** on ainoa, jossa keikalta toiselle -siirto on varmasti sisäänrakennettu.
- **Suomalaista AV-tuotantotyökalua ei löytynyt.** Anolla, WayPAY ja Odoo Rental ovat vuokraamojen varausjärjestelmiä.
- Muilta lainattavat käsitteet: malli ja yksilö erillään, fyysinen laukku eri asia kuin paketti, estojakso eri asia kuin tapahtuma-aika, alustava varaus varoittaa ja vahvistettu estää, päivätty pito, puute punaisena heti ja "Ratkaise puute".

### 2.2 Firebase
- **Firestore europe-north1** on tuettu, eikä sijaintia voi vaihtaa jälkikäteen.
- Päällekkäisyyskysely `start < E && end > S` toimii yhdessä kyselyssä (useamman kentän rajausehdot).
- **Tuplavarauksen esto:** palvelin-SDK:n transaktiot lukitsevat lukemansa dokumentit, mutta kyselyvälin lukitusta ("phantom"-rivit) ei ole dokumentoitu. Siksi jokainen kapasiteettiin vaikuttava tallennus lukee ja päivittää mallidokumentin lukkolaskurin, jolloin saman mallin tallennukset käsitellään peräkkäin.
- **Storage vaatii Blaze-tilauksen** 3.2.2026 alkaen. europe-north1-alueella veloitus alkaa ensimmäisestä tavusta (noin 0,02 $/GB/kk).
- **Auth käsittelee tiedot Yhdysvalloissa** (DPF). Asia kirjataan selosteeseen käsittelytoimista.
- **Microsoft-kirjautuminen palauttaa `emailVerified: false`** (firebase-functions #1592, avoin). Microsoftin mukaan `email`-väite on muuttuva eikä varmistettu, joten sähköpostiin perustuva sallittujen lista on Microsoft-tileillä huijattavissa toisesta organisaatiosta. Ratkaisu on luvussa 7.4.
- `signInWithRedirect` ei toimi selaimissa, jotka estävät kolmannen osapuolen tallennuksen. Käytetään `signInWithPopup`-kirjautumista ja Hosting-domainia.
- **SQL Connect** ei sovi tähän. **Supabase** on varteenotettava vaihtoehto, jos tietokantatason eheys painaa enemmän kuin noin 300 $/vuosi.
- Varmuuskopiot: päivittäinen ja viikoittainen ajastus sekä PITR (7 päivää).
- **Mantine 8:sta alkaen `DatesProvider`-komponentilla ei ole aikavyöhykeasetusta.** Valitsimet palauttavat "naiiveja" merkkijonoja, joten vyöhykemuunnos tehdään itse (luku 6.1). FullCalendar 7 tukee nimettyjä vyöhykkeitä suoraan.

### 2.3 Kalustomalli ja muokkaus
- Snipe-IT, Rentman, Current RMS ja Cheqroom mallintavat kaluston samoin: malli ja yksilö erillään, seurantatapa (yksilö, määrä, kulutus), laukku on itse yksilö kiinteällä tai irtonaisella sisällöllä, paketti on suunnittelupohja, lisävaruste on mallin sääntö ja kunto on eri asia kuin saatavuus.
- **AG Grid Community** sisältää solumuokkauksen, kumoamisen, kiinnitetyt sarakkeet ja CSV-viennin. **Kumoamispino tyhjenee, kun reaaliaikainen päivitys saapuu**, joten kokeilussa testataan, miten se toimii, kun toinen tiimiläinen muokkaa samaan aikaan.
- MUI X Community (100 rivin sivuraja) ja Mantine React Table (jäänyt jälkeen) vältetään.
- Suurin aikasäästö käsin syötettäessä on **"Luo N kpl"**: juoksevat tunnukset KAM-04…KAM-08 ja tyhjät sarjanumerosolut.

### 2.4 Aikataulutus ja aikajanat
- **FullCalendar Standard** sisältää kuukausi-, viikko- ja listanäkymät sekä suomen. Resurssiaikajana kuuluu Premiumiin (alkaen 480 $, 1–10 kehittäjää; vanhentuneen lisenssin viimeistä versiota saa käyttää edelleen).
- Mikään kirjasto ei näytä määrätavaran laskuriruutuja, vinoviivoitettuja puskureita ja siirtomerkkejä. Siksi kalustotaulu tehdään itse (arvio 1–2 viikkoa vain luettavalle versiolle).
- **Bryntum Scheduler Community** on liian nuori. Arvioidaan uudelleen 2027.
- Saatavuuslogiikka: puoliavoimet aikavälit `[alku, loppu)`, päällekkäisyystarkistus yksilöille, pyyhkäisyalgoritmi määrille (samalla hetkellä vapautukset ennen varauksia), ja konflikti on varoitus, jonka voi ohittaa perustelulla. Rentman ja Current RMS toimivat samoin.

### 2.5 Logistiikka ja Clarion
- Isot järjestelmät mallintavat logistiikan näin: **sijainti** (hierarkkinen, ajoneuvot ja henkilöt mukana), **laukku**, **ajoneuvo** ja **siirto**. Keikalta toiselle -siirto on oma käsitteensä.
- Kapasiteetti tarkistetaan painona ja tilavuutena. AV-kalustolla tilavuus loppuu yleensä ensin. Täyttöaste: vihreä alle 70 %, keltainen 70–90 % ja punainen yli 90 %.
- **Reititysrajapintaa ei tarvita v1:ssä.** Käytetään käsin syötettyjä ajoaikoja ja ilmaisia Google Maps -linkkejä (ei API-avainta).
- **Clarion Hotel Helsinki** (Tyynenmerenkatu 2, Jätkäsaari):
  - Konferenssitilat ovat **pääosin** Makasiini-rakennuksessa. Bysa 1–3 ovat yhteensä 669 m², katto noin 6,2 m.
  - Ulappa 1–2 ovat tornin 16. kerroksessa, joten kalusto kulkee hissillä.
  - Crusell, Tallberg ja Sandis: katto noin 2,5 m.
  - Tiedot ovat hotellin vuoden 2016 esitteestä (tarkista). **Lastauslaiturin, tavarahissin, sähkön ja verkon tiedot eivät ole julkisia.** Tiimi täydentää ne ensimmäisen keikan jälkeen.

### 2.6 Käyttöliittymä
- **Mantine 9**: viikko alkaa maanantaista, Drawer ja AppShell puhelimille.
- **dayjs** sekä `Europe/Helsinki`. Temporalia ei vielä käytetä sovelluskoodissa, koska vakaa Safari ei tue sitä.
- **Omat `onSnapshot`-koukut** jaetulla kuuntelijarekisterillä. TanStack Queryä ei käytetä reaaliaikaiseen dataan.
- **PWA vain manifestina** ilman välimuistia. Vanhoja sovellusversioita torjutaan versiotarkistuksella (luku 7.3).
- Suomalaiset käytännöt: "ti 1.12.2026", "klo 9.00", "vk 49". Lajittelu ja haku `Intl.Collator('fi')`-vertailijalla, ja haku ei välitä aksenteista ("aani" löytää "Ääni…").

### 2.7 Omat havainnot pohjapiirroksesta
- **Väistötila 111a (25 m²), 111B ja väestösuoja (−1 krs) ovat pääkäytävän toisella puolella, studiokorttelin ulkopuolella**, vasemmassa yläkulmassa. Lastausovet ovat Studio 1 Hallin oikealla ulkoseinällä, pohjapiirroksen vastakkaisessa päässä. Jos 111a on päävarasto, siirto talon sisällä on todellinen työvaihe, ja se mallinnetaan sisäisenä siirtona.
- Merkitty sisääntuloreitti (sininen nuoli) kulkee käytävää pitkin **Studio 2 Keittiöön**. Hallin ovi on Studio Loungen puolella. Sisäinen reitti 111a:sta lastausoville kulkee siis todennäköisesti Keittiön tai Loungen kautta, mikä voi häiritä niissä käynnissä olevaa kuvausta (avoin kysymys).
- Studio 3 Webinaarin oikealla puolella on **merkitsemätön harmaa alue, jolla näyttää olevan omat ulko-ovet.** Se on todennäköisesti varsinainen lastaus- ja välivarastoalue (avoin kysymys).
- Tarkkaamoita on kaksi: **n. 16 m²** Loungen ja Hallin välissä ja **n. 11 m²** Studio 3:n vieressä. Molemmissa on akustiikkakatto.

---

## 3. Käsitteet ja tietomalli

### 3.1 Sanasto

| Käsite (UI) | Merkitys | Tietomallissa |
|---|---|---|
| **Malli** | Tuotetyyppi, esim. "Sony FX6" tai "XLR 10 m" | `models` |
| **Yksilö** | Sarjanumeroitu laite, jolla on tunnus (KAM-03), sarjanumero ja historia | `units` |
| **Määrätavara** | Palautettava tavara, jota ei seurata yksilöinä (40 × XLR 10 m) | `tracking = 'bulk'` |
| **Kulutustavara** | Kuluu käytössä (teippi, paristot). **Ei saatavuuslaskennassa.** Näkyy pakkauslistalla, ja käyttömäärä vähennetään varastosta. Hälytys, kun alittaa minimin | `tracking = 'consumable'` |
| **Laukku** | Fyysinen kotelo, joka liikkuu yhtenä kappaleena, ja itsekin yksilö. **Kiinteä** sisältö pysyy aina laukussa. **Irtosisältö** on pakkauslista, joka ehdotetaan keikalle riveiksi | Laukkumallilla `isCase`. Kiinteällä sisällöllä `parentCaseId` |
| **Paketti** | Suunnittelupohja ("Webinaaripaketti"), joka purkautuu keikalla tavallisiksi riveiksi. Ei fyysinen esine | `kits` |
| **Lisävaruste** | Mallin sääntö: "aina mukaan" tai "ehdota" (FX6 → 3 × V-mount-akku) | `models.accessories` |
| **Sijainti** | Studion huone, varasto, ajoneuvo, **henkilö** (esim. "Mikon auto" ennen aikaista keikkaa), ulkoinen kohde tai kohteen tila | `locations` (puu) |
| **Kohde** | Ulkoinen tapahtumapaikka, jolla on kohdekortti | `type = 'venue'` |
| **Keikka** | Työ, jolla on asiakas, kohde ja tila sekä vaiheet. Myös studiotuotanto on keikka | `gigs` |
| **Vaihe** | Pakkaus alkaa → lähtö → roudaus sisään → tapahtuma alkaa → tapahtuma päättyy → purku valmis → paluu ja tarkastus valmis | `gigs.phases` |
| **Varausrivi** | "Malli × määrä tälle keikalle", valinnaisesti lukitut yksilöt | `lines` |
| **Estojakso** | Aika, jonka rivi varaa kaluston. Oletuksena pakkauksesta paluutarkastukseen, ja **jatkuu, kunnes kalusto on palautettu** | `lines.blockStart/blockEnd` |
| **Suora siirto** (ketju) | Rivi jatkaa keikalta A suoraan keikalle B | `lines.origin/destination` |
| **Siirto** (roudaus) | Kuljetusosuus. Tyypit: lähtö, paluu, suora ja sisäinen (111a → Halli) | `legs` |
| **Kuittaus** | Ihmisen napautus: pakattu, lastattu, perillä, palautettu, puuttuu, vaurio | `checks`, `legs.status`, `movements` |
| **Pito** | Päivätty "pois käytöstä" -jakso: huolto, korjaus, rikki, kadonnut tai vuokrayksilön käyttöajan ulkopuolinen aika. Loppu voi olla avoin | `holds` |
| **Henkilö** | Jäsen ja rooli. Sama henkilö voi olla yksilön vastuuhenkilö, keikan vastuuhenkilö, tiimin jäsen tai kuljettaja | `members` |

#### Sana "tila" puretaan kolmeksi kentäksi

| UI-nimi | Vastaa kysymykseen | Arvot | Miten saadaan |
|---|---|---|---|
| **Sijainti** | *Missä se on?* | Studio 3 Webinaari, Pakettiauto ABC-123, Clarion › Bysa 2… | **Kuitattu** tallennetaan, **odotettu** johdetaan suunnitelmasta, ja ero näytetään |
| **Kunto** | *Onko se käyttökunnossa?* | OK · Huomautus · Huollossa · Korjauksessa · Rikki · Kadonnut | OK tai Huomautus tallennetaan. Muut tulevat aktiivisesta pidosta |
| **Tilanne** | *Mitä sille nyt tapahtuu?* | Vapaa · Varattu · Kuljetuksessa · Keikalla · Palautus myöhässä · Pois käytöstä | Johdetaan aina, ei tallenneta |

Keikan oma tila on nimeltään **Status**: Alustava, Vahvistettu, Valmis tai Peruttu.

### 3.2 Tietomallin periaatteet

1. **Tallennetaan faktat ja johdetaan tila.** Saatavuutta ja tilannetta ei tallenneta.
2. **Suunnitelma ja fakta pidetään erillään** ("Odotettu: Clarion › Bysa 2 (ei kuitattu)").
3. **Saatavuuteen vaikuttavat kentät kirjoittavat vain palvelinfunktiot.** Näitä ovat rivit, keikan vaiheet ja status, pidot, omistetut määrät, yksilöiden luonti ja arkistointi sekä laukun kiinteä sisältö. Kuvailevat kentät kirjoitetaan suoraan selaimesta sääntöjen rajoissa.
4. **Jokaisella kokoelmalla on yksi historian kirjoittaja.** Funktiot kirjoittavat historian omista muutoksistaan, ja laukaisin kirjoittaa sen vain selaimen suoraan muuttamista kokoelmista.
5. **Ajat tallennetaan UTC-muodossa Firestore `Timestamp` -arvoina ja näytetään vyöhykkeellä Europe/Helsinki.** Kalenteripäivät tallennetaan muodossa `YYYY-MM-DD`.
6. **Kentät ovat englanniksi** ja käyttöliittymän tekstit suomeksi (`fi.ts`). Tunnusten etuliitteissä (`tagPrefix`) on vain ASCII-merkkejä.

### 3.3 Kokoelmat (Firestore)

```text
members/{emailLower}       name, phone?, role: 'admin'|'planner'|'crew'|'viewer', active, uid?
                           (UI: Ylläpitäjä · Suunnittelija · Tekijä · Näyttö)

settings/app               transferSlackMin (30), directTransferSuggestMaxGapH (36),
                           loadingPointLocationId, minClientVersion,
                           phaseDefaults { own:      { loadInBeforeShowMin: 60, packBeforeLoadInMin: 30,
                                                        loadOutAfterShowMin: 60, returnAfterLoadOutMin: 30 },
                                           external: { packDayBeforeAt: '14:00', loadInBeforeShowMin: 90,
                                                        loadOutAfterShowMin: 120, returnNextDayAt: '12:00' } }
system/counters            assetTagCounters { KAM: 7, MIK: 12 }        (VAIN FUNKTIO)

locations/{id}             name, type: 'site'|'room'|'storage'|'vehicle'|'person'|'venue'|'venue_room',
                           parentId?, path[], sort, archived, bookable, isLoadingPoint,
                           phaseDefaults? (ohittaa yleiset), address?, lat?, lng?, travelMinFromBase?,
                           venueInfo? { loading, elevator, parking, power, network, contacts[], source },
                           vehicle? { plate, payloadKg, volumeM3, tailLift }, roomInfo? { areaM2, ceilingM, floor }
locations/{id}/learned/{n} text, by, at                                 ("Opittua", kaikki jäsenet)
travelTimes/{locA__locB}   minutes, note, updatedBy
categories/{id}            name, parentId?, tagPrefix (ASCII), fieldDefs[], defaultTracking, sort

models/{id}                name, manufacturer, categoryId, tags[], tracking: 'serial'|'bulk'|'consumable',
                           isCase, defaultLooseContents[{modelId, qty}],
                           accessories[{modelId, qty, mode: 'always'|'suggest'}],
                           weightKg?, volumeL?, homeLocationId, photoPath?, notes, custom{},
                           ownedQty? (FUNKTIO), minQty?, lockSeq (FUNKTIO), archived (FUNKTIO)

units/{id}                 modelId, categoryId, displayName (denorm), assetTag, serialNo, nickname,
                           condition: 'ok'|'note', conditionNote, homeLocationId, responsibleEmail,
                           ownership: 'own'|'rented'|'borrowed'|'client',
                           parentCaseId? (VAIN kiinteä sisältö, FUNKTIO), rental? {supplier, from, to, ref} (FUNKTIO),
                           recordedLocation { locationId, at, by, source } (FUNKTIO), archived (FUNKTIO)

holds/{id}                 modelId (aina, myös yksilöpidolla), unitId?, qty (yksilö: 1),
                           type: 'service'|'repair'|'broken'|'lost'|'rental'|'other',
                           start, end (avoimella pidolla 9999-12-31), openEnded, note, photos[], createdBy, closedAt?

kits/{id}                  name, lines[{modelId, qty} | {unitId}], optionalLines[]

gigs/{id}                  name, client, venueId, roomIds[], seriesId?,
                           status: 'tentative'|'confirmed'|'done'|'cancelled'                    (FUNKTIO)
                           phases { packStart, departAt, loadInAt, showStart, showEnd, loadOutEnd, returnAt } (FUNKTIO)
                           responsibleEmail, crew[{email, role, phases[]}], notes, color,
                           rev (FUNKTIO), conflictSummary { hard, soft, overridden, roomClash, crewClash } (FUNKTIO)

lines/{id}                 (VAIN FUNKTIO) gigId, modelId, qty, unitIds[] (≤ qty), roomId?,
                           source: 'manual'|'kit'|'case'|'accessory', kitInstanceId?, parentLineId?,
                           origin: {kind:'base'} | {kind:'line', lineId}, destination: (sama),
                           blockStart, blockEnd, gigStatus (kopio), returnState: 'pending'|'done',
                           override? { by, at, note, acceptedMissing, competing[] }

gigs/{gigId}/checks/{lineId}  (tekijä kirjoittaa suoraan, kenttäkohtaisilla päivityksillä)
                           packedUnitIds[], loadedUnitIds[], returnedUnitIds[], missingUnitIds[], damagedUnitIds[],
                           packedQty, loadedQty, returnedQty, missingQty, damagedQty, consumedQty, note, updatedBy, updatedAt

legs/{id}                  (VAIN FUNKTIO) type: 'outbound'|'return'|'direct'|'internal', origin: 'proposed'|'manual',
                           from {locationId, gigId?}, to {locationId, gigId?}, departAt, arriveAt,
                           vehicleId?, driverEmail?, payload[{lineId, qty, unitIds[]}],
                           status: 'planned'|'loaded'|'in_transit'|'delivered'|'cancelled', published, notes
movements/{id}             (FUNKTIO, vain lisäys) unitId | {modelId, qty}, fromLocationId, toLocationId, at, legId?, by, method
activity/{eventId}         (vain lisäys) ts, actor, entityType, entityId, action, changes{}, gigId?, summary
system/integrity           viimeisimmän eheystarkistuksen tulos
```

**Mallinnuksen ratkaisut:**
- **Rivi varaa mallin ja määrän.** `unitIds` täytetään heti tai pakatessa. Lisäksi tehdään yksilötason tarkistukset valituille yksilöille.
- **Ketjutettu rivi perii yksilöt.** B:n ketjurivin `unitIds` on aina sama kuin A:n rivin, koska kyse on samoista fyysisistä laitteista. Funktio pitää ne synkronissa.
- **Laukun kiinteä sisältö** (`parentCaseId`) ei kuulu mallinsa vapaaseen varantoon. Sijainti tallennetaan vain laukulle, ja sisältö perii sen. **Irtosisällölle ei aseteta `parentCaseId`-kenttää.** Se liikkuu omien rivien ja siirtojen mukana, joten vanhentuneita laukkulinkkejä ei synny. v1:ssä laukun kiinteä sisältö on vain yksilöitä. Kiinteä määrätavara laukussa siirretään myöhempään vaiheeseen, ja siihen asti se kirjataan irtosisältönä.
- **Vuokrattu tai lainattu yksilö** on tilapäinen yksilö, ja sen käyttöajan rajaavat kaksi pitoa (`type: 'rental'`): ennen noutoa ja palautuksen jälkeen. Moottori ei tarvitse erillistä vuokralogiikkaa. Yksilö arkistoidaan palautuksen jälkeen.
- **Määrätavaran sijainti johdetaan.** Rivin määrä on sen viimeisimmän kuitatun siirron määränpäässä (lastattu ja matkalla: ajoneuvossa). Kaikki, mikä ei ole ulkona, on kotipaikassa. Esimerkiksi: "XLR 10 m: 12 Clarion › Bysa 2 (perillä ti klo 8.40), 28 kotipaikassa".
- **Ajoneuvo ja henkilö ovat sijainteja.**

**Indeksit:**
- `lines(modelId, blockEnd, blockStart)`
- `lines(modelId, returnState, blockEnd)` (myöhässä olevat)
- `lines(gigId)`
- `lines(unitIds array-contains, blockEnd)`
- `holds(modelId, end, start)`
- `holds(unitId, start)`
- `legs(departAt)`
- `legs(driverEmail, departAt)`
- `units(recordedLocation.locationId)`
- `gigs(phases.returnAt, phases.packStart)`
- `gigs(seriesId)`

### 3.4 Sijaintien lähtödata (pohjapiirroksesta)

```text
Oma studio (site)
├─ Studio 1 Halli (room, 120 m², isLoadingPoint: lastausovet ulkoseinällä, bookable)
├─ Studio 2 Keittiö (room, 54 m², bookable)  ← sisääntuloreitti kulkee tänne
├─ Studio 3 Webinaari (room, 45 m², bookable)
├─ Tarkkaamo Halli (n. 16 m²) · Tarkkaamo Webinaari (n. 11 m²)       ← nimet vahvistettava
├─ Speak (2,0 m²) · Studio Lounge
├─ Lastausalue? (harmaa alue Studio 3:n oikealla puolella, omat ulko-ovet) ← vahvistettava
├─ Väistötila 111a (storage?, 25 m², käytävän toisella puolella)      ← päävarasto? vahvistettava
├─ 111B (storage?) · Väestösuoja (storage?, −1 krs)
Ajoneuvot ja henkilöt
└─ (täytetään: rekisteri, kantavuus, tilavuus, takalaitanostin; esim. "Mikon auto")
Kohteet
└─ Clarion Hotel Helsinki (venue, Tyynenmerenkatu 2; lähde: esite 2016, tarkista)
   ├─ Bysa 1 (154 m²) · Bysa 2 (259) · Bysa 3 (255)   (katto n. 6,2 m)
   ├─ Sonck (145) · Crusell (116) · Tallberg (115) · Sandis (113)   (katto n. 2,5 m)
   ├─ Saukko (81) · Brygga (80,5) · Kraana (40,5) · Bunkkeri (39,5) · Hiili (39,5)
   └─ Ulappa 1 (33,5) · Ulappa 2 (28,5)   (tornin 16. krs, kaikki hissillä)
```

---

## 4. Näkymät

**Navigointi:** puhelimessa alapalkissa ovat *Tänään · Keikat · Kalusto · Siirrot · Lisää*, ja yläpalkissa on aina **haku** (tunnus, nimi, sarjanumero, keikka). Pöytäkoneella navigointi on sivupalkissa. Suodattimet ja aikaikkunat tallentuvat URL-osoitteeseen (`/taulu?alku=2026-11-30&jakso=14&kategoria=kamerat`).

| # | Näkymä | Pääsisältö | Laite | Vaihe |
|---|---|---|---|---|
| 1 | **Tänään** | Tämän päivän ja huomisen lähdöt ja paluut, omat tehtävät, kovat puutteet, **myöhässä olevat palautukset** ja kuittaamattomat toimitukset | Puhelin ensin | 1b |
| 2 | **Keikat** | Lista suodattimin ja FullCalendar (kuukausi, viikko, agenda), viikkonumerot, alustavat vinoviivoin, merkit puutteista sekä tila- ja henkilötuplauksista | Molemmat | 1b |
| 3 | **Keikka** | Välilehdet *Yleiset* (vaiheet aikajanana), *Kalusto* (rivit, saatavuusmerkki, Tulee/Menee, Ratkaise), *Tiimi*, *Siirrot* ja *Pakkauslista* (A4 ja puhelimen tarkistuslista). Toiminnot "Kopioi keikka" ja "Toista viikoittain" | Suunnittelu pöytäkoneella, kuittaus puhelimella | 1b |
| 4 | **Kalusto** | Mallit ja määrät: omistettu, käyttökunnossa, pois käytöstä, varattu nyt. Luo N kpl, Tallenna ja uusi, Monista, Muokkaa valittuja, CSV-vienti | Pöytäkoneella taulukko, puhelimessa kortit | 1a |
| 5 | **Laitekortti** | "Nyt (kuitattu) · Odotettu · Seuraavaksi", 14 päivän minijana, historia, pidot, vastuuhenkilö. Painikkeet Siirretty tänne, Ilmoita vika ja Ei löydy | Puhelin ensin | 1a |
| 6 | **Kalustotaulu** | Rivit ovat yksilöitä ja malleja, sarakkeet päiviä. Estojakso vinoviivoin, tapahtuma umpinaisena, pidot harmaana, laskuriruudut ja merkki "→ B" suoralle siirrolle | Pöytäkone tai tabletti. Puhelimessa laitekohtainen agenda | 1b (perus), 3 (täysi) |
| 7 | **Siirrot** | Siirtokortit (mistä → minne, aika, kuorma laukuittain, Navigoi), "Suunnittelematta"-paneeli. Käsin lisättävät siirrot. Vaiheessa 2 ajoneuvo- ja kuljettajakaistat, täyttöpalkki ja julkaisu | Molemmat, kuljettajalla puhelin | 1c, 2 |
| 8 | **Missä nyt** | Sijaintipuu ja kunkin sijainnin kuitattu sisältö määrineen (myös määrätavarat). Vaiheesta 1c alkaen **aikavalitsin ("Missä huomenna klo 8?")** sekä "odotettu mutta kuittaamaton" | Molemmat | 1a, 1c |
| 9 | **Sijainnit ja kohdekortit** | Lastaus, hissi, pysäköinti, sähkö, verkko, puhelinnumerot napautettavina, Opittua-havainnot, Navigoi | Ylläpito pöytäkoneella | 1a (perus), 2 |
| 10 | **Omat** | Omat keikat, siirrot, pakkaustehtävät ja yksilöt | Puhelin ensin | 1b |
| 11 | **Sijaintiaikajana** | Rivit ovat sijainteja, laukut merkkeinä ja siirrot nuolina. Ketju näkyy yhtenä polkuna | Pöytäkone | 3 |
| 12 | **Studionäyttö** | Tabletti lastausovien vieressä: tämän päivän ja huomisen lähdöt ja paluut. **Kirjautunut näyttötili, rooli "Näyttö" (vain luku)** | Tabletti | 2 |
| 13 | **Asetukset ja Eheys** | Jäsenet (myös poistaminen käytöstä), kategoriat, ajoneuvot, vaiheiden oletukset, eheysraportti | Pöytäkone | 1a |
| – | *Pohjapiirrosnäkymä* | Valinnainen myöhempi idea. Ei kuulu suunniteltuihin vaiheisiin | – | – |

**Kenttäkäytettävyys:**
- Kosketusalueet ovat vähintään 48 px, ja päätoiminnot ovat alareunassa.
- Tunnukset näytetään suurella fontilla.
- Tumma Keikkatila tulee vaiheessa 2.
- Tallennuksen tila näkyy ("Tallennetaan…"), yhteyskatkoksesta näytetään banneri, ja sulkiessa varoitetaan tallentamattomista kuittauksista. Tämä ei ole offline-tila.
- Väri ei ole koskaan ainoa merkki: punaisen rinnalla on aina teksti.

**Lukujen yhteinen merkintätapa kaikissa näkymissä:** **"vapaana / käytettävissä"**. *Käytettävissä* = yksilöt tai määrä, josta on vähennetty pidot ja laukkujen kiinteä sisältö. *Vapaana* = käytettävissä, josta on vähennetty muiden keikkojen varaukset (keikan omalla rivillä ilman tätä riviä, taulussa kaikki varaukset, pienin arvo päivän aikana). Puute näytetään negatiivisena lukuna: **punaisena**, jos vahvistetut varaukset ylittävät, ja **keltaisena "alust."**, jos puute syntyy vain alustavien keikkojen takia.

### 4.1–4.3 Esimerkkitilanne, jota rautalangat ja luku 5 käyttävät

- **Sony FX6 × 4** (KAM-01…04). KAM-03 on huollossa 30.11.–4.12., joten käytettävissä on 3. **Sony FX3 × 2.** **PTZ-kamera × 3.** **Langaton mikki × 12. XLR 10 m × 40.**
- **A "Lanseeraus"**, Studio 1 Halli, ma 30.11., vahvistettu. Pakkaus klo 10.00, tapahtuma klo 12–16, purku valmis klo 18.00 ja paluu ja tarkastus klo 18.30 (oman studion oletusvarat). Varaa PTZ-01 ja PTZ-02.
- **"Webinaari X"**, Studio 3 Webinaari, ti 1.12., vahvistettu. Tapahtuma klo 9–17, estojakso klo 8.30–17.30. Varaa KAM-01 ja KAM-02, 4 mikkiä ja 4 XLR:ää.
- **B "Hybridiseminaari"**, Clarion › Bysa 2, ti 1.12., **alustava**. Pakkaus ma klo 14.00, lähtö ti klo 7.30, roudaus klo 8.30, tapahtuma klo 10–16, purku valmis klo 18.00, paluu ja tarkastus ke klo 12.00 (ulkoisen kohteen oletukset).
- **C "Asiakastilaisuus"**, Espoo, ke 2.12., vahvistettu. Roudaus klo 8.00, paluu ja tarkastus to 3.12. klo 12.00.

### 4.1 Rautalankamalli: Keikka › Kalusto (pöytäkone), tilanne ennen ratkaisua

```text
+--------------------------------------------------------------------------------------------+
| < Keikat   Hybridiseminaari - Asiakas Oy               Status: [Alustava v]   [Tallenna]    |
| Clarion Hotel Helsinki > Bysa 2     Vastuu: Mikko     vk 49                                 |
| Pakkaus ma 30.11. klo 14.00 | Lähtö ti 1.12. klo 7.30 | Roudaus 8.30 | Tapahtuma 10.00-16.00 |
| Purku valmis klo 18.00 | Paluu ja tarkastus ke 2.12. klo 12.00                               |
+--------------------------------------------------------------------------------------------+
| Yleiset | Kalusto (1 varoitus) | Tiimi | Siirrot | Pakkauslista                             |
+--------------------------------------------------------------------------------------------+
| [+ Lisää: hae nimellä, tunnuksella tai paketilla..........]  [Kopioi keikalta...]           |
|                                               vapaana/käytett.  Tulee / Menee              |
| v Striimikeissi 1 (KEI-01)          1 kpl   Vapaa             111a / -> C Asiakastilaisuus |
|     vMix-PC 2 (TPC-02)   kiinteä    1       OK                                             |
|     Enkooderi (ENK-01)   kiinteä    1       OK                                             |
|     Virtakaapeli         irto       4       Vapaa                                          |
| v Kamerat                                                                                  |
|     Sony FX6                        3 kpl   1/3  [-2 alust.]          [Ratkaise]            |
|       (yksilöt valitaan pakatessa)                                                         |
|       Kilpailee: Webinaari X, Studio 3, ti klo 8.30-17.30 (vahvistettu, 2 kpl)             |
|       Syy: KAM-03 huollossa 30.11.-4.12.                                                   |
|     PTZ-kamera                      2 kpl   3/3  OK      <- A Lanseeraus (Studio 1 Halli)  |
|       PTZ-01, PTZ-02 (perittyjä ketjusta)                                                  |
| v Audio                                                                                    |
|     Langaton mikki                  6 kpl   8/12  OK          111a                         |
|     XLR 10 m                       12 kpl   36/40 OK          111a / -> C Asiakastilaisuus |
|   Lisävaruste-ehdotus: Sony FX6 -> 3 x V-mount-akku          [Lisää] [Ohita]               |
+--------------------------------------------------------------------------------------------+
| 0 kovaa puutetta · 1 varoitus (alustava) · 0 ohitettua · Paino n. 186 kg · Tilavuus 1,9 m3 |
+--------------------------------------------------------------------------------------------+
```

### 4.2 Rautalankamalli: Kalustotaulu, "Alustavat mukana" päällä, ennen ratkaisua

```text
Kalustotaulu  [Kategoria: Kaikki v] [x] Alustavat mukana [ ] Vain puutteet  < vk 49 >  [Selite]
                        | ma 30.11  | ti 1.12   | ke 2.12   | to 3.12  | pe 4.12 | la 5.12 |
------------------------+-----------+-----------+-----------+----------+---------+---------+
KAMERAT
 KAM-01 Sony FX6        |           |/[Webin. X]/|          |          |         |         |
 KAM-02 Sony FX6        |           |/[Webin. X]/|          |          |         |         |
 KAM-03 Sony FX6        |:::::::::::: HUOLLOSSA 30.11.-4.12. :::::::::::::::::::|         |
 KAM-04 Sony FX6        |           |           |           |          |         |         |
 Sony FX6 (4, käyt. 3)  |    0/3    | -2 alust. |    0/3    |   3/3    |   3/3   |   4/4   |
 PTZ-01                 |/[Lanseer.]->B [Clarion Bysa 2====]//|        |         |         |
 PTZ-02                 |/[Lanseer.]->B [Clarion Bysa 2====]//|        |         |         |
 PTZ-kamera (3)         |    1/3    |    1/3    |    1/3    |   3/3    |   3/3   |   3/3   |
AUDIO
 Langaton mikki (12)    |   6/12    |   2/12    |   6/12    |  12/12   |  12/12  |  12/12  |
 XLR 10 m (40)          |  28/40    |  24/40    |  28/40    |  28/40   |  40/40  |  40/40  |
------------------------+-----------+-----------+-----------+----------+---------+---------+
Selite: luku = vapaana/käytettävissä (pienin arvo päivän aikana)
        /// estojakso (pakkaus, roudaus, purku, paluu)   === tapahtuma   -> suora siirto
        ::: pito   -2 punaisena = kova puute   -2 alust. keltaisena = puute vain alustavien takia
        Malliriveillä varatut, joille yksilöä ei ole vielä valittu, näkyvät vain malliriville.
```

### 4.3 Rautalankamalli: Laitekortti (puhelin)

```text
+----------------------------------+
| <  Haku                 PTZ-01   |
| PTZ-kamera                       |
| SN 7012345        Kunto: OK      |
+----------------------------------+
| NYT (kuitattu)                   |
| Clarion Hotel Helsinki > Bysa 2  |
| perillä ti 1.12. klo 8.40, Mikko |
+----------------------------------+
| SEURAAVAKSI                      |
| paluu Väistötila 111a            |
| (siirto ti 1.12. klo 18.15)      |
+----------------------------------+
| 14 pv:  [###.........]           |
| Vastuuhenkilö: Anna              |
| Kotipaikka: Väistötila 111a      |
| Historia >     Pidot >           |
+----------------------------------+
| [ Siirretty tänne ] [Ilmoita vika]|
| [        Ei löydy         ]      |
+----------------------------------+
```

Jos kuitattu ja odotettu sijainti eroavat, kortin yläosassa lukee: **"Odotettu: Clarion › Bysa 2 (ei kuitattu). Viimeksi kuitattu: Studio 1 Halli, ma 30.11. klo 18.10, Anna."**

---

## 5. Keskeiset käyttötapaukset

### 5.1 Kalustolistan rakentaminen (suunnittelija, pöytäkone)
1. **Uusi malli** "Sony FX6": kategoria Kamerat (etuliite KAM, lisäkentät), seurantatapa Yksilö, paino, kotipaikka 111a ja lisävaruste "V-mount-akku × 3, ehdota".
2. **Luo 4 yksilöä**: funktio luo tunnukset KAM-01…KAM-04 (`system/counters` transaktiossa) ja tyhjät sarjanumerosolut.
3. **Uusi malli** "XLR 10 m", seurantatapa Määrä, omistettu 40. Mallin kuvaus tallentuu suoraan, ja määrä tallentuu samassa lomakkeessa funktiolla (`saveInventory`).
4. **Laukku:** malli "Striimikeissi" (`isCase`) ja yksilö KEI-01. Kiinteä sisältö (vMix-PC 2, ENK-01) ja irtosisällön pakkauslista (4 × virtakaapeli, 2 × HDMI 3 m).
5. **Kapasiteettia pienentävät muutokset** (arkistointi, määrän lasku, kiinnitys laukkuun) ajetaan ensin koekäyttönä. Jos ne vaikuttavat keikkoihin, näytetään vaikutuslista ("Vaikuttaa 2 vahvistettuun keikkaan: …"), ja muutos tehdään vasta vahvistuksen jälkeen. Taulukossa solu näyttää "Tarkistetaan…", ja hylätty arvo palautuu ilmoituksen kera.
6. Lista syötetään kategoria kerrallaan, varattava kalusto ensin.

### 5.2 Keikan luonti, kopiointi ja toisto
1. **Uusi keikka** "Hybridiseminaari", kohde Clarion › Bysa 2, status Alustava. Keikan luo funktio (`saveGigPlan` ilman keikan tunnusta).
2. **Vaiheet täyttyvät kohteen tyypin mukaan.** Ulkoisella kohteella pakataan edellisenä päivänä klo 14, roudaus alkaa 1,5 h ennen tapahtumaa, lähtö = roudaus − ajoaika (20 min) − lastausvara, purku valmis 2 h tapahtuman jälkeen ja paluu ja tarkastus seuraavana päivänä klo 12. **Omassa studiossa** varat ovat lyhyet (oletus: pakkaus 30 min ennen roudausta, paluu 30 min purun jälkeen), jotta päivittäiset webinaarit eivät varaa kalustoa kahdeksi päiväksi. Oletukset voi muuttaa asetuksista ja sijaintikohtaisesti, ja jokaista aikaa voi muokata.
3. **Lisää paketti** (purkautuu riveiksi), laukku (irtosisältö ehdotetaan riveiksi) ja lisävarusteet.
4. Jokaisella rivillä näkyy saatavuusmerkki heti. Sen laskee selaimessa sama moottori kuin palvelimella.
5. **Tallenna.** Funktio tarkistaa ja tallentaa, ja konfliktiyhteenveto päivittyy kaikille keikoille, joihin muutos vaikuttaa.
6. **Tiimi** (Mikko vastuuhenkilö, Anna kamera, Jussi ääni) vaiheineen. Jos sama henkilö on päällekkäisellä keikalla, näytetään varoitus.
7. Jos keikka on omassa studiotilassa (`bookable`) ja samassa tilassa on päällekkäinen keikka roudauksesta purkuun, näytetään varoitus **"Studio 3 Webinaari on jo varattu: Webinaari X"**.
8. **Kopioi keikka** (rivit, tiimi, vaiheiden suhteelliset ajat) ja **Toista viikoittain N kertaa** luovat uudet keikat funktion kautta yhteisellä `seriesId`-tunnisteella. Jokainen kopio saa oman saatavuustarkistuksensa.

### 5.3 Kaksi keikkaa haluaa samoja kameroita: saatavuus ja ratkaisu
Tilanne on luvun 4 esimerkki: FX6:ia on 4, KAM-03 on huollossa, joten käytettävissä on 3. Vahvistettu Webinaari X varaa 2 ti klo 8.30–17.30. Hybridiseminaari haluaa 3 ajalle ma klo 14 – ke klo 12.

1. Suunnittelija lisää rivin "Sony FX6 × 3". Merkki näyttää heti **"1/3 · −2 alust."**. Kilpaileva keikka ja huolto on lueteltu syinä. Puute koskee vain jaksoa ti klo 8.30–17.30.
2. Hybridiseminaari on alustava, joten tallennus onnistuu ja puute näkyy **keltaisena varoituksena**.
3. **Ratkaise** tarjoaa:
   - **Vaihda vastaavaan:** "Sony FX3: 2/2 vapaana".
   - **Siirrä aikaa:** näyttää, milloin FX6 vapautuu (ti klo 17.30).
   - **Ota suoraan toiselta keikalta**, jos ehtii (5.4).
   - **Vuokraa:** tilapäinen yksilö, jolle merkitään toimittaja sekä nouto- ja palautuspäivä. Funktio luo käyttöajan rajaavat pidot.
   - **Hyväksy ylivaraus:** pakollinen perustelu. Tallentuu muotoon `override {by, at, note, acceptedMissing: 2, competing: [Webinaari X:n rivi, KAM-03:n pito]}`.
4. Hän valitsee **1 × FX6 + 2 × FX3**. Merkit muuttuvat vihreiksi (FX6 1/3 ja FX3 2/2).
5. **Vahvistaminen:** kun status vaihdetaan Vahvistetuksi, funktio laskee tilanteen **ikään kuin keikka olisi jo vahvistettu**. Jos syntyisi kovia puutteita, vahvistus estetään, kunnes ne on ratkaistu tai ohitettu. Ilman kohtaa 4 vahvistus olisi siis estynyt puutteen −2 takia. **Ensimmäisenä vahvistanut voittaa:** jos toinen alustava keikka kilpailee samoista kameroista, sen vahvistus estyy myöhemmin samalla tavalla.
6. **Rinnakkaiset tallennukset:** mallin lukkolaskuri käsittelee saman mallin tallennukset peräkkäin. Jälkimmäinen saa joko vastauksen "Keikkaa on muutettu, lataa uudelleen" (`rev`) tai tiedon uudesta puutteesta. Vahvistetulla keikalla tallennus hylätään, jos se aiheuttaisi uuden kovan puutteen ilman ohitusta.
7. **Ohitus ei laajene.** Jos myöhemmin kolmas vahvistettu keikka tai uusi pito osuu samaan jaksoon, sitä ei löydy ohituksen tilannekuvasta, joten puute muuttuu taas punaiseksi, vaikka puutteen määrä ei kasvaisi.

### 5.4 Keikalta toiselle: studio → Clarion → Espoo
1. Suunnittelija lisää B:lle 2 × PTZ, joita myös A käyttää. A:n paluutarkastus (ma klo 18.30) ja B:n pakkaus (ma klo 14.00) menisivät päällekkäin klo 14.00–18.30: kysyntä 4, käytettävissä 3, puute −1 (alust.).
2. Moottori ehdottaa: **"Ota 2 × PTZ suoraan keikalta Lanseeraus (Studio 1 Halli, purku valmis ma klo 18.00). Ehtii: pelivaraa 14 h 10 min."** Ajoaika on kohdeparin opittu aika tai muuten molempien kohteiden ajoaika kotipaikasta yhteenlaskettuna (oma studio = 0 min, Clarion 20 min).
3. **Hyväksy** (vaiheesta 1b). Funktio ketjuttaa rivit. A:n rivi päättyy ja B:n rivi alkaa ma klo 18.00, ja B:n rivi perii yksilöt PTZ-01 ja PTZ-02. Konflikti poistuu.
   - **Jako:** jos A:lla olisi 3 PTZ:ta ja B tarvitsisi 2, A:n rivi jaetaan: 2 → B ja 1 → kotipaikka. Yksilöt jaetaan oletuksena A:n järjestyksessä (tai jo B:lle lukitut ensin), ja jakoikkunassa suunnittelija voi vaihtaa ne. Jos yksilöitä ei ole valittu, molemmat osat jäävät valitsematta.
4. Sama B → C: Striimikeissi 1 ja 12 × XLR menevät suoraan Clarionista Espooseen. Tarkistus: ti klo 18.00 + 35 min ≤ ke klo 8.00, pelivaraa 13 h 25 min. Alle 30 min pelivara antaa varoituksen, ja jos aika ei riitä, syntyy kova konflikti "Siirto ei ehdi".
5. **Siirrot → Ehdota siirrot** (vaihe 1c) luo seuraavat siirrot: sisäinen *111a → Halli* (ma), suora *Halli → Clarion* (ti klo 7.30), suora *Clarion → Espoo* (ti klo 18.15 tai ke aamulla) ja paluut. Siirtoja voi myös lisätä ja muokata käsin. Vaiheessa 2 valitaan ajoneuvo ja kuljettaja ja siirrot julkaistaan. Tekijät näkevät vain julkaistut siirrot.
6. B:n **purkulista ryhmittyy määränpään mukaan**: "→ Keikka C (Espoo, ke klo 8.00): 5 laukkua" ja "→ Väistötila 111a: 8 laukkua".
7. **Missä yön yli?** PTZ:t ovat odotetusti Studio 1 Hallissa ma klo 18.00 – ti klo 7.30, koska ne ovat A:n tilassa, kunnes suora siirto lähtee.
8. Jos A:n purku venyy, funktio näyttää **vaikutuslistan ennen tallennusta** ("Suora siirto A → B: pelivara 40 min, varoitus"). Jos C perutaan, ketjun B-rivit palaavat kotipaikkaan ja merkitään tarkistettaviksi.

### 5.5 Pakkaus, lähtö ja palautus (käsin, ei skannausta)
1. **Pakkaus** (Tänään → "Pakkaa Hybridiseminaari" → **Aloita**):
   - Lista on laukuittain, ja siinä on edistymispalkki. Laukun rasti kuittaa sen kiinteän sisällön, ja irtosisällön voi kuitata yksitellen tai napilla "kaikki".
   - Kuittaus tallentaa **yksilötunnukset** (`packedUnitIds`) kenttäkohtaisella päivityksellä, joten kaksi tiimiläistä voi rastia samaa listaa yhtä aikaa.
   - Malliriveille sovellus ehdottaa yksilöitä: ensin ketjusta tulevat, sitten ne, joiden kuitattu sijainti on varasto. Valinta tallentuu funktiolla `fieldOp: assignUnits`, joka tarkistaa päällekkäisyydet.
   - Pitkä painallus avaa toiminnot **Puuttuu**, **Vaurio** ja **Korvaa**.
2. **Lastattu → [ajoneuvo]**, **Matkalla** ja **Perillä** (`fieldOp: confirmLeg`): kaikkien kuitattujen yksilöiden ja laukkujen sijainti päivittyy yhdellä kutsulla, ja määrätavaroiden määrät siirtyvät siirron kuorman mukaan.
3. **Palautustarkastus** riveittäin: Palautettu, Puuttuu tai Vaurio (kuva ja huomautus) sekä kulutustavaroille *käytetty määrä*.
   - *Puuttuu* luo pidon *kadonnut* ja *Vaurio* pidon *rikki*. Kulutettu määrä vähennetään varastosta.
   - Kun rivi on käsitelty, `returnState = done` ja estojakso päättyy.
   - **Jos riviä ei ole palautettu paluuajan jälkeen, se varaa kalustoa edelleen.** Huomisen keikka näyttää punaisena "KAM-02 ei ole palautettu keikalta Hybridiseminaari (myöhässä 5 h)".
4. Kun kaikki on kuitattu, keikan status muuttuu tilaan **Valmis**.
5. **Studiokeikoilla** siirto on sisäinen, ja kuittaukseksi riittää "Kaikki paikalla".

### 5.6 "Missä X on nyt?" ja "Missä huomenna?"
1. Hakuun kirjoitetaan "fx6", "kam0" tai "vmix". Jokaisella yksilöllä on rivit **Nyt** (kuitattu sijainti, lähde, aika, henkilö) ja **Seuraavaksi**. Laukussa oleva näyttää laukun sijainnin.
2. Jos todellisuus poikkeaa: **Siirretty tänne** (oma keikka, viimeisimmät sijainnit, studion huoneet). Muutos kirjataan liikelokiin.
3. **Ei löydy** luo pidon *kadonnut* ja ilmoittaa vastuuhenkilölle.
4. **Missä nyt** → Studio 1 Halli: kuitattu sisältö (myös määrätavarat) ja "odotetaan tänne". Aikavalitsimella näkee suunnitellun tilanteen mihin tahansa hetkeen.

---

## 6. Saatavuus- ja konfliktilogiikka

Logiikka on puhtaassa TypeScript-paketissa `packages/core`, jossa ei ole Firebase-riippuvuuksia. Selain ja funktiot käyttävät samaa koodia.

### 6.1 Säännöt
1. **Aikavälit ovat puoliavoimia `[alku, loppu)` UTC-millisekunteina.** Vain näyttö käyttää vyöhykettä Europe/Helsinki.
2. **Lomakkeiden ajat muunnetaan yhdellä testatulla apufunktioparilla** `helsinkiLocalToInstant()` ja `instantToHelsinkiLocal()`, koska Mantinen valitsimet palauttavat vyöhykkeettömiä merkkijonoja. Kesäaikasiirtymissä **28.3.2027** klo 3.00–4.00 ei ole olemassa (lomake ilmoittaa siitä), ja **25.10.2026** ja **31.10.2027** klo 3.00–4.00 toistuu (valitaan aiempi ja näytetään vyöhykelyhenne).
3. **Vaiheiden järjestys:** `packStart ≤ departAt ≤ loadInAt ≤ showStart < showEnd ≤ loadOutEnd ≤ returnAt` (Zod-skeema selaimessa ja funktiossa).
4. **Estojakso:** oletuksena `[packStart, returnAt)`. Ketjussa A → B raja on `A.loadOutEnd`. **Myöhässä oleva palautus:** jos rivin määränpää on kotipaikka, `returnState = pending` ja nyt ≥ `blockEnd`, rivin tehollinen loppu on avoin, kunnes palautus kuitataan.
5. **Kapasiteetti** mallille: *serial* = yksilöt, jotka eivät ole arkistoituja eivätkä laukun kiinteää sisältöä. *bulk* = `ownedQty`. **Pidot vähentävät kapasiteettia** pidon ajan, ja avoin pito toistaiseksi. Vuokrayksilön käyttöaika rajataan pidoilla. **Kulutustavarat eivät ole saatavuuslaskennassa.**
6. **Vakavuus:**
   - **Kova (punainen):** vahvistetut rivit, pidot ja myöhässä olevat palautukset ylittävät kapasiteetin, tai yksi yksilö on kahdella päällekkäisellä vahvistetulla rivillä tai pidon aikana.
   - **Pehmeä (keltainen, "alust."):** se osa puutteesta, joka syntyy vasta, kun alustavat keikat lasketaan mukaan.
   - **Ohitettu (harmaa ääriviiva):** kova puute, jonka kattaa yksi sen lähteenä olevan rivin ohitus. Ohitus kattaa puutteen vain, jos `acceptedMissing ≥ puute` **ja** puutteen kaikki muut lähteet (rivit ja pidot) ovat ohituksen tilannekuvassa `competing`. Uusi kilpailija tai suurempi puute muuttaa sen taas punaiseksi.
   - **Peruttu keikka** ei vaikuta saatavuuteen.
7. **Tallennussääntö:** alustavan keikan tallennus onnistuu aina varoituksin. Vahvistetun keikan tallennus hylätään, jos se aiheuttaa **uuden** kovan puutteen ilman ohitusta (vertailu tallennusta edeltävään tilaan samalla hetkellä "nyt"). **Vahvistus:** tilanne lasketaan ikään kuin keikka olisi vahvistettu, eikä uusia kovia puutteita ilman ohitusta saa syntyä.
8. **Kapasiteetin muutokset** (pidot, arkistointi, määrät, laukun sisältö, palautustarkastus) eivät estä faktojen kirjaamista. Ne näyttävät vaikutuslistan, kirjoittavat lukkolaskurin ja päivittävät vaikutuksen kohteena olevien keikkojen `conflictSummary`-arvot.
9. **Laukku:** laukun rivi varaa laukkuyksilön, ja kiinteä sisältö kulkee mukana. Jos kiinteällä sisällöllä on pito, laukun riville tulee varoitus "Laukun sisältö: vMix-PC 2 huollossa". Irtosisältö ehdotetaan riveiksi, joilla on `parentLineId`.
10. **Suoran siirron toteutettavuus:** `A.loadOutEnd + ajoaika ≤ B.loadInAt`. Jos ehto ei täyty, konflikti on kova. Jos pelivaraa on alle `transferSlackMin`, näytetään varoitus.
11. **Suoran siirron ehdotus** syntyy, kun sama malli on A:lla ja B:llä, B alkaa A:n jälkeen ja joko kotipaikan kautta kulkeminen aiheuttaisi päällekkäisyyden tai väli on alle 36 h. Ehdotus pitää aina hyväksyä erikseen, eikä kalustoa koskaan reititetä uudelleen hiljaa. `assignUnits` suosii ketjusta tulevia tai läheiseltä keikalta saapuvia yksilöitä.
12. **Tila- ja henkilötuplaukset (varoitus):** sama `bookable`-studiotila jaksolla `[loadInAt, loadOutEnd)` tai sama henkilö päällekkäisissä vaiheissa.

### 6.2 Pseudokoodi

```ts
type Ms = number; interface Iv { start: Ms; end: Ms }            // puoliavoin
const overlaps = (a: Iv, b: Iv) => a.start < b.end && b.start < a.end

function blockInterval(line, gig, linesById, gigsById): Iv {
  const start = line.origin.kind === 'line'
    ? gigsById[linesById[line.origin.lineId].gigId].phases.loadOutEnd : gig.phases.packStart
  const end = line.destination.kind === 'line' ? gig.phases.loadOutEnd : gig.phases.returnAt
  return { start, end }
}
const effectiveEnd = (l, now: Ms) =>                                 // myöhässä = avoin
  l.destination.kind === 'base' && l.returnState === 'pending' && now >= l.blockEnd ? Infinity : l.blockEnd

function demandsForModel(model, lines, holds, units, win: Iv, mode: 'hard'|'soft', now: Ms, asConfirmed?: GigId) {
  if (model.tracking === 'consumable') return null                    // ei saatavuuslaskentaa
  const C = model.tracking === 'serial'
    ? units.filter(u => u.modelId === model.id && !u.archived && !u.parentCaseId).length
    : model.ownedQty
  const d = []
  for (const l of lines) {
    if (l.modelId !== model.id || l.gigStatus === 'cancelled') continue
    const confirmed = l.gigStatus === 'confirmed' || l.gigStatus === 'done' || l.gigId === asConfirmed
    if (mode === 'hard' && !confirmed) continue
    d.push({ start: l.blockStart, end: effectiveEnd(l, now), qty: l.qty, src: l })
  }
  for (const h of holds) if (h.modelId === model.id)                // sis. vuokrapidot
    d.push({ start: h.start, end: h.openEnded ? Infinity : h.end, qty: h.qty, src: h })
  return { C, d: d.filter(x => overlaps(x, win)) }
}

// Pyyhkäisy: saman aikaleiman muutokset käsitellään ennen vertailua, vapautukset ensin
function shortages(C: number, demands): Shortage[] {
  const ev = demands.flatMap(x => [[x.start, +x.qty, x], [x.end, -x.qty, x]])
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let used = 0, open = null; const active = new Set(), out = []
  for (let i = 0; i < ev.length; ) {
    const t = ev[i][0]
    while (i < ev.length && ev[i][0] === t) { const [, dq, x] = ev[i++]; used += dq; dq > 0 ? active.add(x) : active.delete(x) }
    if (used > C) {
      if (!open) open = { start: t, end: Infinity, missing: used - C, sources: new Set(active) }
      else { open.missing = Math.max(open.missing, used - C); active.forEach(x => open.sources.add(x)) }
    } else if (open) { open.end = t; out.push(open); open = null }
  }
  if (open) out.push(open)
  return out
}

function classify(hard: Shortage[], soft: Shortage[]) {
  for (const s of hard) {
    const covering = [...s.sources].find(x => isLine(x) && x.override
      && x.override.acceptedMissing >= s.missing
      && [...s.sources].every(y => y === x || x.override.competing.includes(y.id)))
    s.severity = covering ? 'overridden' : 'hard'
  }
  for (const s of soft) {                                             // vain alustavien aiheuttama lisäosa
    const h = Math.max(0, ...hard.filter(x => overlaps(x, s)).map(x => x.missing))
    if (s.missing > h) { s.severity = 'soft'; s.extra = s.missing - h }
  }
}

function transferCheck(A, B, s): 'ok'|'warn'|'fail' {
  const travel = travelTimes[`${A.venueId}__${B.venueId}`]?.minutes
              ?? (A.venue.travelMinFromBase ?? 0) + (B.venue.travelMinFromBase ?? 0)
  const slack = (B.phases.loadInAt - (A.phases.loadOutEnd + travel * 60_000)) / 60_000
  return slack < 0 ? 'fail' : slack < s.transferSlackMin ? 'warn' : 'ok'
}

// Odotettu sijainti hetkellä t (Missä nyt / Missä huomenna)
function expectedLocation(unit, t, ctx) {
  const l = ctx.lineCovering(unit, t); if (!l) return unit.homeLocationId
  const g = ctx.gigs[l.gigId], room = l.roomId ?? g.roomIds[0] ?? g.venueId
  const legs = ctx.legsFor(l)                                          // suunnitellut tai kuitatut
  const moving = legs.find(x => x.departAt <= t && t < x.arriveAt)
  if (moving) return moving.vehicleId ?? 'matkalla'
  const last = legs.filter(x => x.arriveAt <= t).at(-1)
  if (last) return last.to.locationId                                  // esim. yö A:n tilassa ennen suoraa siirtoa
  if (legs.length === 0) {                                             // siirtoja ei vielä suunniteltu (1b)
    if (t >= g.phases.loadInAt && t < g.phases.loadOutEnd) return room
    if (t >= g.phases.loadOutEnd) return l.destination.kind === 'line' ? room : 'paluumatkalla'
  }
  return l.origin.kind === 'line' ? ctx.roomOf(l.origin.lineId) : unit.homeLocationId
}
```

Yksilötason tarkistus (`unitConflicts`) vertaa yksilön rivejä ja pitoja keskenään. Se on kova, jos molemmat ovat vahvistettuja tai toinen on pito. Tilanne johdetaan tässä järjestyksessä: Pois käytöstä → Palautus myöhässä → Kuljetuksessa → Keikalla → Varattu → Vapaa.

### 6.3 Kirjoituspolku ja rinnakkaisuus

```ts
// Callable (europe-north1), Admin SDK -transaktio. Yhteinen alku kaikille kutsuille:
//   aktiivinen members-dokumentti + rooli, Zod-validointi, clientVersion ≥ settings.minClientVersion
saveGigPlan({ gigId | null, rev, gigPatch?, lineOps[], overrides[], confirm?, dryRun? }):
  tx:
    gig = gigId ? get(gigs/gigId) : uusi;  if (gig.rev !== rev) throw 'Keikkaa on muutettu – lataa uudelleen'
    affectedModels = lineOps-mallit ∪ (aikamuutoksessa) keikan kaikki mallit ∪ ketjunaapurien mallit
    for m: get(models/m)                                    // lukitsee mallin (lockSeq)
    window = keikan ja ketjunaapurien estojaksojen yhdiste
    lines = query(modelId == m && blockEnd > window.start && blockStart < window.end)
          ∪ query(modelId == m && returnState == 'pending' && blockEnd < now)     // myöhässä
    holds = query(modelId == m && end > window.start && start < window.end)
    apply muistissa; jaa ketjurivit; peri unitIds; laske estojaksot; zod
    before = engine.evaluate(ennen), after = engine.evaluate(jälkeen, asConfirmed = confirm ? gigId : undefined)
    if ((gig.status === 'confirmed' || confirm) && after.newHardWithoutOverride.length) return { ok:false, after }
    if (dryRun) return { ok:true, after }
    write: rivit, gig (rev+1), conflictSummary muuttuneille keikoille, models.lockSeq+1, activity-tiivistelmä
```

- **Samaa kaavaa** (mallin lukko, ennen ja jälkeen -arvio, `conflictSummary`-päivitys) noudattavat `saveInventory`, `saveHold` ja ne `fieldOp`-toiminnot, jotka luovat pitoja tai kuittaavat palautuksia.
- Keikan `rev` estää kirjoittamasta toisen muutosten päälle. Selaimen käyttöliittymä on optimistinen ("Tarkistetaan…").
- **`overdueSweep`** (ajastettu tunnin välein) päivittää niiden keikkojen yhteenvedot, joihin myöhässä olevat palautukset vaikuttavat. Selain laskee myöhästymisen muutenkin reaaliajassa.

### 6.4 Eheystarkistus (joka yö ja ylläpitäjän painikkeella)

v1:ssä tarkistetaan:
1. mikään yksilö ei ole kahdella päällekkäisellä rivillä,
2. vahvistettu kysyntä on enintään kapasiteetti tai ohitettu,
3. ketjulinkit ovat kaksisuuntaisia, malli, määrä ja yksilöt täsmäävät ja siirto ehtii,
4. `conflictSummary` vastaa uudelleenlaskentaa,
5. vaiheiden järjestys ja estojaksojen kaava (halpoja, mukana alusta).

Ominaisuuksien mukana lisätään:
- siirtojen kattavuus (1c),
- laukkuketjujen silmukat (1a),
- yksilö varattuna oman pitonsa aikana (1b).

### 6.5 Testit (moottori ennen käyttöliittymää)
- **Taulukkotestit:**
  - puoliavoimet rajat ja monipäiväiset keikat,
  - kesäaikasiirtymät 25.10.2026, 28.3.2027 ja 31.10.2027, myös lomakkeen apufunktiot (puuttuva ja toistuva tunti),
  - samanaikaiset tapahtumat pyyhkäisyssä,
  - jaetut ketjut ja yksilöiden periytyminen,
  - laukku, jonka kiinteä sisältö on rikki,
  - avoin pito ja vuokrapidot,
  - peruttu keikka ketjussa,
  - **ohitus, jota ei saa laajentaa uuteen kilpailijaan** (sama määrä, uusi lähde → punainen),
  - ohitus, kun puute kasvaa,
  - **myöhässä oleva palautus näkyy huomisen keikalla**,
  - kulutustavara ei vaikuta saatavuuteen,
  - **vahvistus "ikään kuin vahvistettu"** ja kilpaileva vahvistus,
  - tila- ja henkilötuplaukset,
  - luvun 4 esimerkin luvut (1/3, −2 alust., 0/3, 4/4) testitapauksena, jotta dokumentti ja koodi pysyvät samassa.
- **Ominaisuustestit (fast-check):** pyyhkäisyn tulos on sama kuin raa'an voiman minuuttikohtaisen laskennan, ja eheystarkistus pysyy puhtaana minkä tahansa sallitun kutsusarjan jälkeen.
- **Emulaattori:** 20 rinnakkaista tallennusta viimeisestä vapaasta FX6:sta jättää täsmälleen yhden varauksen. Sama tehdään määrätavaralle ja pito- tai arkistointikilpailulle.

---

## 7. Tekninen arkkitehtuuri

### 7.1 Kirjastot ja lisenssit (tarkistettu 23.11.2026)

| Kerros | Valinta | Lisenssi |
|---|---|---|
| Sovellus | Vite + React 19.3 + TypeScript (strict), SPA | MIT |
| UI | Mantine 9.8 (`core`, `dates`, `form`, `notifications`) | MIT |
| Kalenteri | FullCalendar Standard 7.1.5 (`fi`, nimetty aikavyöhyke, peer `temporal-polyfill`) sovittimen takana | MIT |
| Kalustolistan editori | AG Grid Community 36.3 **tai** muokattava Mantine-taulukko (päätetään vaiheessa 0) | MIT |
| Muut listat | Mantine `Table` tai mantine-datatable 9.8 | MIT |
| Aikajanat | Oma CSS-grid-komponentti, TanStack Virtual yli noin 300 rivin | MIT |
| Päivämäärät | dayjs 1.11 + `utc`, `timezone`, `isoWeek`, `fi` | MIT |
| Validointi | Zod, skeemat `packages/core`-paketissa | MIT |
| Tila | Omat `onSnapshot`-koukut, URL-parametrit, Zustand pieneen UI-tilaan | MIT |
| Firebase | JS SDK 13.4, firebase-functions 7.4 (2nd gen, Node 22 tai uusin tuettu LTS) | Apache-2.0 / MIT |
| Testit | Vitest, fast-check, Emulator Suite, `@firebase/rules-unit-testing`, Playwright (390 px ja 1440 px) | MIT / Apache-2.0 |
| Repo | pnpm-monorepo (`packages/core`, `apps/web`, `functions`), GitHub Actions | – |
| Kartat | Google Maps URL -linkit ("Navigoi") | 0 € |

### 7.2 Firebase-palvelut ja alue
- **Blaze-tilaus.** **Kaikki europe-north1**-alueella: Firestore Standard, Functions ja Storage. Firestoren sijainti valitaan ensimmäisenä päivänä.
- **Kaksi projektia** (`…-dev` ja `…-prod`) ja Hostingin esikatselukanavat.
- **Hosting** palvelee SPA:n ja `__/auth`-polun samasta domainista. Jokaisessa julkaisussa on `version.json`.
- **Storage:** kuvat pienennetään selaimessa noin 1600 px:n WebP-muotoon. **Säännöt lukevat jäsenyyden suoraan Firestoresta** (cross-service rules, `firestore.get()`), joten erillistä roolien synkronointia ei tarvita ja poisto tulee voimaan heti.
- **App Check jätetään pois v1:stä.** Sovellus on sallittujen listalla rajattu sisäinen työkalu, ja reCAPTCHA voi epäonnistua hotellien kirjautumissivullisissa wifi-verkoissa. Arvioidaan myöhemmin uudelleen. Huomaa, että 24/7 päällä oleva studionäyttö kuluttaa ilmaiskiintiötä.

### 7.3 Cloud Functions

| Funktio | Tyyppi | Kuka |
|---|---|---|
| `saveGigPlan` (luonti, rivit, vaiheet, status ja vahvistus, ketjutus, ohitukset, kopiointi ja toisto, koekäyttö) | callable | suunnittelija, ylläpitäjä |
| `saveInventory` (luo N yksilöä tunnuslaskurilla, arkistoi, `ownedQty`, laukun kiinteä sisältö, vuokrayksilö pitoineen; koekäyttö ja vaikutuslista) | callable | suunnittelija, ylläpitäjä |
| `saveHold` (pidon luonti ja sulkeminen, vaikutuslista) | callable | suunnittelija, ylläpitäjä |
| `saveLegs` (ehdotus idempotentisti ilman pidemmälle edenneisiin siirtoihin koskemista, käsin luonti ja muokkaus, ajoneuvo, kuljettaja, julkaisu) | callable | suunnittelija, ylläpitäjä |
| **`fieldOp`** (`assignUnits`, `confirmLeg`, `moveManually`, `returnCheck`, `reportFault`) | **yksi callable** | ylläpitäjä, suunnittelija, tekijä |
| `auditOnWrite` (historia vain selaimen suoraan kirjoittamista kokoelmista; tapahtuman id dokumentin id:nä) | laukaisin | – |
| `overdueSweep` | ajastettu tunnin välein | – |
| `integrityCheck` | ajastettu yöllä + callable | ylläpitäjä |

- **Kenttätoiminnot ovat yhdessä funktiossa**, jotta yksi lämmin instanssi palvelee niitä kaikkia heikossa verkossa. Jos kylmäkäynnistys häiritsee, `minInstances: 1` otetaan käyttöön ensin `fieldOp`-funktiolle (muutama euro kuukaudessa, tarkista).
- Kaikilla funktioilla on `maxInstances` 3–5.
- **Funktiot ohittavat tietoturvasäännöt**, joten jokainen callable tarkistaa itse aktiivisen jäsenyyden, roolin, Zod-skeeman ja asiakasversion.
- Tekijä saa tehdä kenttätoimintoja kaikilla keikoilla (pieni tiimi). Toimija kirjataan aina, ja rajausta voi tiukentaa myöhemmin.
- **Vanhentuneet asiakkaat:** sovellus vertaa omaa versiotaan julkaistuun `version.json`-tiedostoon ja näyttää bannerin "Päivitä sovellus". Callablet hylkäävät `minClientVersion`-arvoa vanhemmat kutsut selkeällä viestillä.

### 7.4 Tunnistautuminen ja roolit
- **Google Workspace:** Google-kirjautuminen. Säännöt vaativat `email_verified`-tiedon ja aktiivisen jäsenyyden.
- **Microsoft 365:** `email_verified` on Microsoft-tileillä aina `false`, eikä sähköpostiväitteeseen voi luottaa. Siksi:
  - Entra-sovellus rekisteröidään **yhden organisaation (single-tenant)** sovellukseksi, ja `tenant`-parametri annetaan kirjautuessa.
  - Säännöt hyväksyvät `sign_in_provider == 'microsoft.com'` ilman `email_verified`-ehtoa. Vaihtoehtoisesti `beforeUserSignedIn`-estofunktio tarkistaa organisaatiotunnuksen ja asettaa varmistusmerkinnän. Estofunktio vaatii Identity Platform -päivityksen (ilmaiskiintiö, tarkista).
  - Freelancerit kirjautuvat vain sähköpostilinkillä.
  - Tämä testataan oikealla M365-tilillä dev-projektissa vaiheessa 0.
- **Sallittujen lista** `members/{emailLower}` haetaan säännöissä `get()`-kutsulla.
- **Käytöstä poisto:** `active: false`, Auth-käyttäjän esto ja päivitystunnusten mitätöinti yhdellä ylläpitäjän toiminnolla.

| Oikeus | Ylläpitäjä | Suunnittelija | Tekijä | Näyttö |
|---|---|---|---|---|
| Lukea kalustoa, keikkoja, siirtoja, sijainteja ja historiaa | ✓ | ✓ | ✓ | vain Studionäyttö |
| Muokata kalustoa, kohteita ja keikan kuvailevia tietoja | ✓ | ✓ | – | – |
| Rivit, vaiheet, status, pidot, siirrot ja ohitukset (funktiot) | ✓ | ✓ | vain vikailmoitus | – |
| Kuittaukset, yksilöiden valinta, "Siirretty tänne", Opittua | ✓ | ✓ | ✓ | – |
| Jäsenet, eheystarkistus, palautus varmuuskopiosta | ✓ | – | – | – |

### 7.5 Tietoturvasäännöt (luonnos, olennaiset kohdat)

```js
function em()      { return request.auth.token.email.lower(); }
function mdoc()    { return /databases/$(db)/documents/members/$(em()); }
function verified(){ return request.auth.token.email_verified == true
                       || request.auth.token.firebase.sign_in_provider == 'microsoft.com'; } // vain single-tenant
function member()  { return request.auth != null && verified() && exists(mdoc()) && get(mdoc()).data.active == true; }
function role()    { return get(mdoc()).data.role; }
function planner() { return member() && role() in ['admin', 'planner']; }
function worker()  { return member() && role() in ['admin', 'planner', 'crew']; }
function stamped() { return request.resource.data.updatedBy == em() && request.resource.data.updatedAt == request.time; }
function untouched(keys) { return !request.resource.data.diff(resource.data).affectedKeys().hasAny(keys); }

match /members/{e}, /settings/{d}   { allow read: if member(); allow write: if admin(); }
match /locations/{id}               { allow read: if member(); allow create, update: if planner() && stamped(); }
match /locations/{id}/learned/{n}   { allow read: if member();
                                      allow create: if worker() && request.resource.data.by == em(); }
match /models/{id}  { allow read: if member();
  allow create: if planner() && stamped() && !request.resource.data.keys().hasAny(['lockSeq','ownedQty','archived']);
  allow update: if planner() && stamped() && untouched(['lockSeq','ownedQty','archived','tracking']); }
match /units/{id}   { allow read: if member(); allow create, delete: if false;
  allow update: if planner() && stamped() && untouched(['modelId','recordedLocation','parentCaseId','rental','archived']); }
match /gigs/{id}    { allow read: if member(); allow create, delete: if false;
  allow update: if planner() && stamped() && untouched(['phases','status','rev','conflictSummary','seriesId']);
  match /checks/{lineId} { allow read: if member();
    allow write: if worker() && stamped() && request.resource.data.keys().hasOnly([
      'packedUnitIds','loadedUnitIds','returnedUnitIds','missingUnitIds','damagedUnitIds','packedQty','loadedQty',
      'returnedQty','missingQty','damagedQty','consumedQty','note','updatedBy','updatedAt']); } }
match /lines/{id}, /holds/{id}, /legs/{id}, /movements/{id}, /activity/{id}, /system/{id} {
  allow read: if member(); allow write: if false; }                     // vain funktiot
```

Näyttö-rooli saa säännöissä lukea vain Studionäytön tarvitsemat kokoelmat (`gigs`, `legs`, `locations`). Lisäksi säännöt tarkistavat tyypit ja enum-arvot, ja sääntötesteissä jokainen rooli kokeillaan jokaista kokoelmaa ja kiellettyä kenttää vastaan.

### 7.6 Varmuuskopiot ja tietosuoja
- **Varmuuskopiot:** päivittäinen (säilytys 7 päivää), viikoittainen (14 viikkoa) ja PITR (7 päivää).
- **Palautusharjoitus** skriptatun README-ohjeen mukaan ennen oikean datan syöttöä ja sen jälkeen kahdesti vuodessa. Palautus tehdään uuteen tietokantaan, ja sitä vastaan ajetaan eheystarkistus.
- **Tietosuoja:**
  - Firebase Auth käsittelee nimet ja sähköpostit Yhdysvalloissa (DPF). Asia kirjataan selosteeseen käsittelytoimista, ja **Firebase Data Processing and Security Terms hyväksytään konsolissa**.
  - **Lyhyt tietosuojaseloste henkilöstölle** (GDPR art. 13): mitä kirjataan (kuka kuittasi, siirsi tai muutti mitäkin), miksi ja kuinka kauan.
  - **Säilytysaika:** `activity`- ja `movements`-merkinnät, joissa on henkilön nimi, esimerkiksi 3 vuotta, minkä jälkeen henkilö korvataan pseudonyymillä (ajastettu funktio). Lopullinen aika päätetään yrityksessä.
  - **Lähtevä jäsen:** jäsenyys poistetaan käytöstä, historia säilyy säilytysajan, ja puhelinnumero poistetaan.
  - **Puhelinnumerot näkyvät kaikille jäsenille**, koska kentällä soitetaan toisille. Kenttä on vapaaehtoinen, ja asia kerrotaan selosteessa.
  - **Yhteistoiminta:** loki on työn tekemisen dataa eikä varsinaista valvontaa. Jos yrityksessä on **vähintään 20 työntekijää**, on selvitettävä, kuuluuko käyttöönotto yhteistoimintamenettelyn piiriin (laki yksityisyyden suojasta työelämässä 759/2004, 4 luku, ja yhteistoimintalaki 1333/2021). Tämä tarkistetaan, ei oleteta.

### 7.7 Kustannusarvio (noin 20 käyttäjää)

| Palvelu | €/kk |
|---|---|
| Firestore. Sovelluksen avaus lukee noin 3–6 tuhatta dokumenttia (kalusto noin 1 500 + näkymän aikaikkunan rivit ja keikat). Ilmaiskiintiö on 50k lukua päivässä, ja ylitys maksaa senttejä 100k lukua kohden | 0–5 |
| Hosting, Auth (50k MAU), Functions (2 milj. kutsua) | 0 |
| Storage europe-north1 (10 GB ≈ 0,20 €) | 0,1–0,5 |
| Varmuuskopiot, PITR, Artifact Registry (siivoussääntö) | senttejä |
| **Yhteensä** | **noin 0–10** |
| Valinnainen: `minInstances: 1` (`fieldOp`) | muutama € (tarkista) |

Budjettihälytykset asetetaan 5 €:oon ja 20 €:oon. Hälytykset eivät rajoita kulutusta. Lukumäärät pidetään kurissa näin:
- kalusto ladataan kokonaan,
- rivit ja keikat ladataan näkymän aikaikkunasta (esim. −14…+60 päivää taululla), ja kaukaiset keikat haetaan tarvittaessa,
- historia luetaan sivuittain.

Vertailun vuoksi Rentman maksaa noin 113–187 €/kk.

---

## 8. Toteutusvaiheet

Määräaikoja ei ole, kuten käyttäjä toivoi. Jokainen vaihe päättyy poistumiskriteeriin ja oikeaan käyttöön ennen kuin seuraava alkaa.

> **Versio 1 = vaiheet 1a + 1b (ketjutus mukana).** Tämän jälkeen käyttäjä voi:
> - syöttää ja muokata kalustolistaa (mallit, yksilöt, määrät, laukut, paketit, pidot),
> - hakea "missä X on" ja korjata sijainnin yhdellä napautuksella,
> - luoda, kopioida ja toistaa keikkoja vaiheineen ja tiimeineen,
> - varata kaluston ja nähdä saatavuuden, puutteet, Ratkaise-vaihtoehdot ja myöhästyneet palautukset,
> - ketjuttaa kaluston suoraan keikalta toiselle ja nähdä, ehtiikö siirto,
> - saada varoituksen studiotilan ja henkilön tuplavarauksesta,
> - käyttää kalenteria, kalustotaulua (vain luku), Tänään- ja Omat-näkymää sekä tulostaa pakkauslistan.
>
> Siirtojen kuittaukset, purkulista määränpään mukaan ja "Missä huomenna" tulevat vaiheessa 1c, ja ajoneuvot vaiheessa 2.

### Vaihe 0: Selvitys ja perusta
- Vastaukset luvun 10 "nyt tarvittaviin" kysymyksiin.
- Rentmanin kokeilu noin viikon ajan: kirjataan, mitä siellä on ja mitä tästä suunnitelmasta puuttuu.
- **Klikattava prototyyppi** näkymistä Keikka › Kalusto, Kalustotaulu, Laitekortti ja Purku. Testataan omalla puhelimella Studio 1 Hallissa ja pimeässä huoneessa, mukana 1–2 tiimiläistä.
- **Editorikokeilu:** 20 oikeaa laitetta AG Gridillä ja muokattavalla Mantine-taulukolla. Mukana testi, jossa toinen käyttäjä muokkaa samaan aikaan (kumoamispino). Käyttäjä valitsee tavan.
- Firebase dev ja prod (europe-north1, Blaze, budjettihälytykset), Auth valitulla tavalla (M365:llä single-tenant-testi), sallittujen lista.
- Monorepo, CI, emulaattorit ja siemendata (studion huoneet, Clarion merkinnällä "tarkista", luvun 4 esimerkki).
- **`packages/core`: tyypit, Zod-skeemat, aikavyöhykeapurit ja saatavuusmoottori testeineen.**
- Tietoturvasäännöt testeineen.

**Rinnakkaistus:** heti kun mallien ja yksilöiden skeema on vakaa, vaiheen 1a kalustolistan rakentaminen voi alkaa moottorityön rinnalla, jotta käyttäjä pääsee syöttämään kalustoa aikaisin.

**Poistumiskriteeri:** moottorin testit ovat vihreinä (myös ominaisuus- ja rinnakkaisuustestit), prototyyppi on hyväksytty ja kirjautuminen on testattu oikealla tilillä.

### Vaihe 1a: Kalustolista ja sijainnit
- Kirjautuminen, roolit ja käytöstä poisto. Sijaintipuu (myös henkilöt ja ajoneuvot) ja kohdekortit (perus, Opittua).
- Kategoriat, mallit, yksilöt, määrä- ja kulutustavarat, laukut, paketit, lisävarusteet ja kuvat.
- Luo N kpl, Tallenna ja uusi, Monista, Muokkaa valittuja, CSV-vienti (`;` ja UTF-8 BOM, testattu Excelissä ä- ja ö-kirjaimilla).
- Pidot, Ilmoita vika, vaikutuslistat ja historia. Laitekortti, haku (`Intl.Collator('fi')`), Siirretty tänne ja Missä nyt (kuitattu).
- Tallennuksen tila, yhteysbanneri ja päivitysbanneri. Ensimmäinen palautusharjoitus ennen oikeaa dataa.

**Poistumiskriteeri:** varattava sarjanumeroitu kalusto ja laukut on syötetty, ja haku "missä X on" toimii.

### Vaihe 1b: Keikat, varaukset, saatavuus ja ketjutus
- Keikat vaiheineen. Vaiheiden oletukset kohdetyypin mukaan (oma studio ja ulkoinen kohde).
- `saveGigPlan`: luonti, rivit, paketit, lisävarusteet, ohitukset tilannekuvineen, `rev`, vahvistus "ikään kuin vahvistettu", Kopioi keikka ja Toista viikoittain.
- **Minimaalinen ketjutus:** "Tulee suoraan keikalta…" -valinta ja ehdotus, toteutettavuustarkistus, estojaksot ketjun mukaan, rivin jako ja yksilöiden periytyminen.
- Myöhässä olevat palautukset saatavuudessa (`returnCheck` yksinkertaisena: "Kaikki palautettu" tai rivikohtaisesti) ja `overdueSweep`.
- Saatavuusmerkit, Ratkaise-laatikko, tila- ja henkilötuplausvaroitukset.
- Keikat-lista ja kalenteri, Keikka-sivu, **kalustotaulu (vain luku)**, Tänään, Omat ja A4-pakkauslista.
- Yöllinen eheystarkistus (v1-invariantit).

**Poistumiskriteeri:** tiimi suunnittelee kaikki oikeat keikkansa sovelluksessa noin neljän viikon ajan rinnakkain vanhan tavan kanssa. Saatavuuslaskennassa ei havaita yhtään virhettä, ja eheystarkistus on puhdas.

### Vaihe 1c: Liike
- Pakkaus- ja palautuslistat puhelimella yksilötunnuksineen: laukkutason kuittaus, Puuttuu, Vaurio, Korvaa ja kulutetut määrät.
- `saveLegs` (ehdotukset ja käsin lisätyt siirrot) ja `fieldOp: confirmLeg`. Kattavuustarkistus ("Suunnittelematta").
- Purkulista määränpään mukaan. Vaikutuslista aikamuutoksissa ja peruutuksissa.
- Missä nyt: kuitattu ja odotettu sijainti, määrätavaroiden sijainnit ja **aikavalitsin**.

**Poistumiskriteeri:** vähintään yksi oikea ketju on suunniteltu ja kuitattu alusta loppuun, ja sijainnit vastaavat todellisuutta pistokokeissa.

### Vaihe 2: Kuljetuslogistiikka
- Ajoneuvot ja täyttöpalkki.
- Kaistat ajoneuvoittain ja kuljettajittain, luonnos ja julkaisu, varoitus kuljettajan tuplauksesta. Vihje, kun kahden keikan siirrot voisi ajaa samalla autolla.
- Täydet kohdekortit, opitut ajoajat, Navigoi ja valinnainen Maps Embed.
- Studionäyttö (näyttötili) ja tumma Keikkatila.

**Poistumiskriteeri:** päivän roudaukset suunnitellaan ja julkaistaan sovelluksessa, ja kuljettajat käyttävät siirtokortteja.

### Vaihe 3: Visuaalinen syvyys
- Täysi kalustotaulu: vinoviivoitus, lämpötilavärit, siirtomerkit, henkilörivit, Vain puutteet ja virtualisointi.
- Sijaintiaikajana.
- Järjestetty Ratkaise-lista. Yksilön historia aikajanana.
- Mahdollisesti: kiinteä määrätavara laukuissa ja kohdennettavuusheuristiikka.

### Vaihe 4: Valinnainen, tarpeen mukaan
- Sähköposti "huomisen lähdöt", Web Push, "Laske ajoaika" (Routes API), vetäminen aikajanalla, iCal-syöte, App Check.
- Kaluston sijoittaminen pohjapiirrokseen.
- Myöhemmin mahdollisia: QR-tarrat, offline-tila ja taulukkotuonti.

---

## 9. Riskit ja niiden hallinta

| Riski | Hallinta |
|---|---|
| Saatavuuslaskenta on väärin, ja luottamus menee | Moottori testataan ensin, ominaisuustestit raa'an voiman oraakkelia vastaan, palvelin laskee aina uudelleen, eheystarkistus ja 1b:n rinnakkaiskäyttö. Dokumentin esimerkkiluvut ovat testitapauksia |
| Peräkkäiset keikat tuottavat vääriä konflikteja | Vaiheiden oletukset kohdetyypin mukaan ja ketjutus jo vaiheessa 1b |
| Palauttamaton kalusto näkyy vapaana | Myöhässä oleva rivi varaa kaluston, kunnes palautus kuitataan. Tänään-hälytys |
| Kuittauksia unohdetaan | Kuitattu ja odotettu sijainti erikseen, lähde ja ikä näkyvissä, laukkutason kuittaus, Siirretty tänne |
| Käsin syöttäminen on raskasta | Luo N kpl, Monista, Tallenna ja uusi, solumuokkaus, syöttö kategoria kerrallaan. Syöttö alkaa jo vaiheen 0 aikana |
| Rinnakkaiset tallennukset ja tuplavaraus | Mallin lukko kaikissa kapasiteettiin vaikuttavissa funktioissa ja keikan `rev`. Emulaattoritesti |
| Ohitus peittää uuden puutteen | Ohitus sidotaan riviin ja kilpailijoiden tilannekuvaan. Testi |
| Microsoft-kirjautuminen lukitsee kaikki ulos tai on huijattavissa | Single-tenant, tenant-parametri, provider-ehto tai estofunktio. Testi oikealla tilillä vaiheessa 0 |
| Ketjutettu siirto ei ehdi | Toteutettavuustarkistus, pelivaravaroitus, vaikutuslista ja peruutuksen käsittely |
| Huono kenttä kohteissa | Tallennuksen tila, yhteysbanneri, tulostettu lista ja yksi lämmin `fieldOp` |
| Vanhat sovellusversiot puhelimissa | `version.json`-banneri ja funktioiden `minClientVersion` |
| Nuoret kirjastot | Lukitut versiot, kalenteri sovittimen takana, aikajanat omaa koodia |
| Väärä Firestore-alue | europe-north1 vaiheen 0 tarkistuslistalla |
| Kustannukset | Hälytykset 5 € ja 20 €, aikarajatut kuuntelijat, `maxInstances`, siivoussääntö |
| Tietojen menetys | Päivittäiset ja viikoittaiset varmuuskopiot, PITR, palautusharjoitus kahdesti vuodessa |
| Laajuuden paisuminen | Laajuus jäädytetään. Tarpeen kasvaessa siirrytään Rentmaniin |
| Vain yksi tekijä (bus factor) | Valtavirran tekniikat, englanninkielinen koodi, testit määrittelynä, README ja nimetty ylläpitäjä |
| Henkilötiedot ja työelämän tietosuoja | Seloste, henkilöstön tiedote, säilytysaika, DPA ja yhteistoimintavelvoitteen selvitys |
| Clarionin tiedot vanhentuneita | Merkintä "tarkista" ja Opittua-havainnot |

---

## 10. Avoimet kysymykset käyttäjälle

### Tarvitaan ennen vaiheen 0 loppua

| # | Kysymys | Mihin vaikuttaa |
|---|---|---|
| 1 | Käyttääkö yritys **Google Workspacea vai Microsoft 365:tä**? Tarvitsevatko freelancerit pääsyn? | Kirjautuminen ja säännöt |
| 2 | Suunnitteletko tapaan "3 kameraa" ja valitset yksilöt pakatessa, vai varaatko aina tietyt yksilöt? | Rivin oletustapa |
| 3 | **Varasto:** onko 111a päävarasto? Onko harmaa alue Studio 3:n vieressä (omat ulko-ovet) lastaus- tai välivarastoalue? Säilytetäänkö mitään 111B:ssä tai väestösuojassa? Mitä reittiä kalusto kulkee 111a:sta lastausoville, ja pitääkö Keittiössä tai Loungessa käynnissä olevaa kuvausta varoa? | Sijaintipuu, sisäiset siirrot |
| 4 | **Tyypilliset ajat:** omassa studiossa ja ulkoisilla kohteilla: pakkaus, roudaus, purku ja palautustarkastus | Vaiheiden oletukset |
| 5 | Riittääkö, että **alustava** keikka vain varoittaa ja vahvistettu estää, ja että ensimmäisenä vahvistanut voittaa? | Konfliktisäännöt |
| 6 | **Kuka rakentaa ja kuka ylläpitää pitkällä aikavälillä?** Voiko tiimi käyttää Rentmanin kokeilua viikon? | Ostaa vai rakentaa |

### Voi odottaa (vastataan vaiheiden 1a–2 aikana)

| # | Kysymys | Mihin vaikuttaa |
|---|---|---|
| 7 | Montako käyttäjää ja kuka luo ja vahvistaa keikat, kuka muokkaa kalustoa ja kuka kuittaa? Näkevätkö freelancerit kaikki keikat? | Roolit |
| 8 | Kaluston määrä: sarjanumeroidut laitteet, määrätavararivit, laukut | Syöttötyö, virtualisointi |
| 9 | Mitkä kategoriat seurataan yksilöinä ja mitkä määrinä? | Seurantatavat |
| 10 | Nykyisen listan sarakkeet (ei tuontia, vain kentät) | Kentät ja kategoriat |
| 11 | Onko studioissa kiinteitä asennuksia, joita ei viedä ulos? | Varattavuus |
| 12 | Tarkkaamoiden ja muiden tilojen viralliset nimet | Sijaintien nimet |
| 13 | Ajoneuvot: montako, kantavuus ja tilavuus. Yksityisautot? | Vaihe 2 |
| 14 | Montako keikkaa viikossa ja kuinka usein kalusto menee suoraan keikalta toiselle? Toistuvatko studiokeikat viikoittain? | Ketjutus, toisto |
| 15 | Vaihtuuko monipäiväisen tapahtuman tila päivien välillä? | Vaiheiden mallinnus |
| 16 | Kuinka usein vuokraatte tai lainaatte kalustoa? | Vuokrayksilöt |
| 17 | Halutaanko tulostetut pakkauslistat ja laukkujen sisältölaput? | Tulosteet |
| 18 | Asiakkaan yhteyshenkilö keikalla vai CRM:ssä? | Keikan kentät |
| 19 | Keikat omiin kalentereihin (iCal)? | Vaihe 4 |
| 20 | Kelpaako jako Sijainti, Kunto ja Tilanne? | Sanasto |
| 21 | Montako työntekijää yrityksessä on (yhteistoimintamenettely), ja kuinka kauan historiaa säilytetään? | Tietosuoja |

---

## 11. Lähteet (keskeiset)

**Markkina:**
- [Rentman pricing](https://rentman.io/pricing)
- [Rentman roll-overs](https://support.rentman.io/hc/en-us/articles/35217346228370-Best-Practices-Managing-Equipment-Roll-Overs-Between-Projects) (hakutuloksen tiivistelmä)
- [Rentman combinations](https://support.rentman.io/hc/en-us/articles/4402870209682-Equipment-Combinations-and-How-to-Work-with-Them)
- [Current RMS transfers](https://current-rms.com/latest-features/planned-transfer-of-assets)
- [Current RMS availability](https://help.current-rms.com/articles/660517-what-is-availability)
- [Current RMS containers](https://help.current-rms.com/en/articles/3035889-differences-between-temporary-and-permanent-serialized-containers)
- [Flex containers](https://helpcenter.flexrentalsolutions.com/hc/en-us/articles/12053032516503-Containers-and-Packages)
- [Cheqroom bulk](https://knowledge.cheqroom.com/helpcenter/whats-the-difference-between-bulk-items-and-individual-items-1)
- [Snipe-IT](https://snipe-it.readme.io/docs/overview)
- [Anolla](https://anolla.com/fi/varustevuokrausohjelmisto)

**Firebase:**
- [locations](https://firebase.google.com/docs/firestore/locations)
- [multiple range fields](https://firebase.google.com/docs/firestore/query-data/multiple-range-fields)
- [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [transaction contention](https://firebase.google.com/docs/firestore/transaction-data-contention)
- [pricing](https://firebase.google.com/docs/firestore/pricing)
- [backups](https://firebase.google.com/docs/firestore/backups)
- [PITR](https://firebase.google.com/docs/firestore/use-pitr)
- [Storage changes FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [Storage cross-service rules](https://firebase.google.com/docs/storage/security/rules-conditions)
- [redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Microsoft OAuth](https://firebase.google.com/docs/auth/web/microsoft-oauth)
- [firebase-functions #1592](https://github.com/firebase/firebase-functions/issues/1592)
- [blocking functions](https://firebase.google.com/docs/auth/extend-with-blocking-functions)
- [privacy](https://firebase.google.com/support/privacy)
- [Supabase range columns](https://supabase.com/blog/range-columns)

**Käyttöliittymä ja aikajanat:**
- [AG Grid community vs enterprise](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise.md)
- [AG Grid undo/redo](https://www.ag-grid.com/react-data-grid/undo-redo-edits/)
- [Mantine dates](https://mantine.dev/dates/getting-started/)
- [Mantine 7→8](https://mantine.dev/guides/7x-to-8x)
- [FullCalendar pricing](https://fullcalendar.io/pricing)
- [FullCalendar timeZone](https://fullcalendar.io/docs/timeZone)
- [Bryntum changelog](https://bryntum.com/products/scheduler/changelog/)
- [Chrome install criteria](https://developer.chrome.com/blog/update-install-criteria)
- [caniuse Temporal](https://caniuse.com/temporal)
- npm-rekisteri, tarkistettu 23.11.2026

**Logistiikka ja Clarion:**
- [Rentman transport](https://rentman.io/solutions/crew-and-transport-management)
- [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
- [Visit Finland: Clarion](https://fcb.visitfinland.com/en/venue/267/Clarion-Hotel-Helsinki/)
- [Clarion fact sheet (2016)](https://www.conferencehotelgroup.com/img/hotels/files/2575/Fact%20Sheet%20ClarionHelsinki%20ENG%20NEW.pdf)
- [Cvent](https://www.cvent.com/venues/en-US/helsinki/hotel/clarion-hotel-helsinki/venue-838950d3-854c-4f2b-b0e0-6c98fb4717f4)

**Lainsäädäntö (tarkistettava soveltuvuus):**
- Laki yksityisyyden suojasta työelämässä 759/2004
- Yhteistoimintalaki 1333/2021

**Omat:** studion pohjapiirros (PDF, tarkistettu 23.11.2026).

---

## 12. Muutokset kritiikin perusteella

1. **Esimerkkilaskelmat korjattu (5.3, 4.1, 4.2).** Esimerkissä on nyt 4 × FX6, ja KAM-03 on huollossa. Webinaari X varaa 2 ja Hybridiseminaari haluaa 3, joten puute on −2 ja keltainen, koska keikka on alustava. Ratkaisu on 1 × FX6 + 2 × FX3. Rautalangat ja taulu laskettiin uudelleen samasta tilanteesta, yksilöt täsmäävät ja yhteinen merkintätapa "vapaana / käytettävissä" on määritelty. Luvut ovat myös testitapauksia.
2. **Ketjutus siirretty vaiheeseen 1b.** Vaiheiden oletukset riippuvat kohdetyypistä (oma studio vai ulkoinen kohde), ja ne voi asettaa sijaintikohtaisesti.
3. **Myöhässä oleva palautus varaa kaluston** (`returnState`, avoin tehollinen loppu, `overdueSweep`, kyselyindeksi).
4. **Ohitus sidottu omaan riviinsä ja kilpailijoiden tilannekuvaan** (`competing`). Pseudokoodi ja testi korjattu, ja pehmeä puute lasketaan kovan puutteen ylittävänä osana.
5. **Kulutustavarat poistettu saatavuuslaskennasta.** Kulutettu määrä kirjataan palautuksessa.
6. **Microsoft-kirjautuminen:** single-tenant, tenant-parametri, provider-ehto tai estofunktio ja freelancereille sähköpostilinkki. Vika on varmistettu GitHubista, ja asia lisättiin riskeihin ja vaiheeseen 0.
7. **Säännöt ja funktiot yhtenäistetty:**
   - Opittua omana alikokoelmanaan.
   - Historia kaikkien luettavissa.
   - Keikan luonti `saveGigPlan`-funktiolla.
   - Käsin lisättävät siirrot `saveLegs`-funktiolla.
   - Tunnuslaskurit kokoelmassa `system/counters`.
   - `ownedQty` ja `archived` estetty myös luonnissa.
   - Funktioiden omat tarkistukset kirjattu.
8. **Yksilöiden tunnistus säilyy:**
   - kuittauksissa on yksilötunnukset ja kenttäkohtaiset päivitykset,
   - ketjurivi perii yksilöt,
   - jaon säännöt on määritelty.
9. **Määrätavaroiden sijainti johdetaan** siirroista ja riveistä.
10. **Vahvistussääntö täsmennetty:** lasketaan "ikään kuin vahvistettu", ja ensimmäinen vahvistus voittaa.
11. **Tietomallin aukot korjattu:**
    - pidoilla on aina `modelId`,
    - avoimella pidolla on kaukainen loppupäivä,
    - kaikki kapasiteettia muuttavat funktiot käyttävät mallin lukkoa ja päivittävät `conflictSummary`-arvot.
12. **Kaluston muutoksiin vaikutuslista ja koekäyttö.** Taulukon solun tarkistus- ja hylkäystila on kuvattu.
13. **Vaiheeseen 1b lisätty:**
    - studiotilan ja henkilön tuplausvaroitus,
    - Kopioi keikka ja Toista viikoittain.
14. **"Missä huomenna" ja yön yli -sijainti:** aikavalitsin vaiheessa 1c, ja `expectedLocation` on kirjoitettu uudelleen.
15. **Sijainnit ja kenttätoiminnot:**
    - henkilö lisätty sijaintityypiksi,
    - `version.json` ja `minClientVersion` torjuvat vanhat sovellusversiot,
    - aikavyöhykeapurit ja kesäaikatestit lisätty,
    - kenttätoiminnot yhdistetty `fieldOp`-funktioon.
16. **Kirjautuminen ja tietosuoja:**
    - `syncRoleClaims` korvattu cross-service-säännöillä, ja käytöstä poisto on kuvattu,
    - tietosuojaa täydennetty: seloste henkilöstölle, säilytysaika, DPA, lähtevä jäsen, puhelinnumerot ja yhteistoimintavelvoitteen selvitys,
    - studionäytölle oma kirjautunut näyttörooli.
17. **Ostaa vai rakentaa -vertailu korjattu:** kehitystyö vastaa noin 20–60 vuoden Rentman-maksuja, ja 3–6 kuukauden arvio on todennäköisesti optimistinen.
18. **Laajuus ja kysymykset:**
    - "Versio 1" määritelty omassa laatikossaan,
    - kaluston syöttö voi alkaa moottorityön rinnalla,
    - avoimet kysymykset jaettu "nyt tarvittaviin" ja "voi odottaa".
19. **Keveneminen:**
    - poistettu vuokrajaksojen erillislogiikka (korvattu pidoilla), laukun kiinteä määrätavara, kohdennettavuusheuristiikka, kuukausittainen Coldline-vienti ja App Check,
    - palautusharjoitus kahdesti vuodessa,
    - eheystarkistus rajattu v1-invariantteihin,
    - editori päätetään AG Gridin ja Mantine-taulukon vertailulla,
    - historialla on yksi kirjoittaja per kokoelma.
20. **Pienet korjaukset:**
    - `line.roomId` usean tilan keikoille,
    - irtosisällöllä ei ole `parentCaseId`-kenttää,
    - suomenkielinen lajittelu ja aksentiton haku, ASCII-etuliitteet,
    - pohjapiirroksen havainnot tarkennettu (varastot käytävän toisella puolella, sisääntuloreitti Keittiöön, harmaan alueen ulko-ovet),
    - Clarion: "pääosin Makasiinissa",
    - siirtojen yhdistämisvihje vaiheessa 2,
    - lukumääräarvio korjattu ja kokonaiskustannukseksi päivitetty 0–10 €/kk.
21. **Ei muutettu** tarkistettuja kohtia: kirjastoversiot ja lisenssit, FullCalendar Premiumin hinta, Rentmanin hinnat, Storagen Blaze-vaatimus, lukkolaskuriratkaisu, kalenteripäivät ja rajaukset (QR, offline, tuonti ja pohjapiirros pysyvät myöhempinä).
