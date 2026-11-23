# Kalustonhallinta ja keikkasuunnittelu: kevyt suunnitelma

*Laadittu 23.11.2026 (vk 48). Korvaa laajan suunnitelman (`suunnitelma-v1-laaja.md`) ja perustuu käyttäjän vastauksiin sen avoimiin kysymyksiin. Kirjastoversiot ovat laajan suunnitelman npm-tarkistuksesta. Firebasen Spark- ja Blaze-erot on tarkistettu 23.11.2026 Firebasen hinnoittelusivulta ja varmuuskopio-ohjeesta. "(tarkista)" = ei varmistettu ensikäden lähteestä.*

---

## 1. Tiivistelmä

### 1.1 Mitä rakennetaan

Kevyt, suomenkielinen sisäinen verkkosovellus puhelimelle, tabletille ja läppärille:

1. **Kalustolista.** Jokainen varattava asia on oma rivinsä, esim. "KAM-03 Sony FX6" tai "XLR 10 m, 40 kpl", ja sillä on kunto, kotipaikka ja vastuuhenkilö.
2. **Kaluston suunnittelu keikoille.** Mikä kalusto menee millekin keikalle ja milloin, missä se on, kuka vastaa ja miten se siirtyy keikalta toiselle, myös suoraan ilman käyntiä studiolla. Päällekkäiset varaukset näkyvät heti.

"Visuaalinen" tarkoittaa kalenteria, kalustotaulua (laitteet × päivät) ja päiväkohtaista roudauslistaa. Käyttäjiä on noin viisi ja kalustoa 50–200 riviä.

### 1.2 Mikä muuttui ja miksi

- **Google-tilit ja sallittujen lista, ei rooleja** (vastaus 1, toive kirjautua Google-tunnuksilla, "poista vaikeat roolit").
- **Yksi kalustokokoelma**, koska varataan aina tietty laite (vastaus 2).
- **Ei varastopaikkoja eikä ajoneuvoja**, vain studion tilat ja ulkoiset kohteet (vastaus 3).
- **Neljä aikaa ja muokattavat aikapohjat** (vastaus 4).
- **Ei palvelinkoodia:** päällekkäisyydet lasketaan selaimessa testatulla funktiolla, ja "ensin vahvistanut voittaa" tarkistetaan tallennettaessa (vastaukset 5 ja 6).
- **Tietosuojaosuus poistettu** (sisäinen käyttö). **6 näkymää** 13:n sijaan.

### 1.3 Ostaa vai rakentaa

Lähin valmis ratkaisu on Rentman, noin 113 €/kk kahdella suunnittelijalla. Siinä ei ole suomenkielistä käyttöliittymää, keikalta toiselle -siirto on Rentmanin oman tukiartikkelin mukaan kiertotie, ja mukana on paljon tarpeetonta, kuten tarjoukset ja laskutus. Rakennetaan oma, koska tarve on kapea ja tarkasti tiedossa: suomi, tietyt laitteet, omat tilat ja suorat siirrot. Kevyenä sovellus pysyy yhden kehittäjän ylläpidettävänä, ja palvelinkulut ovat käytännössä nolla.

---

## 2. Käsitteet ja tietomalli

### 2.1 Sanasto

| Käsite (UI) | Merkitys |
|---|---|
| **Laite** | Yksittäinen asia lyhyellä tunnuksella, esim. KAM-03 (määrä 1) |
| **Määrätavara** | Tavara, jota ei seurata yksitellen, esim. XLR 10 m × 40 |
| **Paketti** | Tallennettu kalustolista, jonka voi lisätä keikalle kerralla |
| **Kohde** | Oma studio tai ulkoinen paikka tietokortteineen, ja sen tilat (Studio 3 Webinaari, Bysa 2) |
| **Keikka** | Työ, jolla on kohde, ajat, status ja kalusto. Myös studiotuotanto on keikka |
| **Kalustojakso** | *Kalusto lähtee → kalusto takaisin*. Rivi varaa kaluston tämän ajan |
| **Aikapohja** | Esim. "Studiopäivä". Täyttää ajat, jotka ovat aina muokattavia |
| **Suora siirto** | Rivi tulee suoraan toiselta keikalta. **Luovutushetkellä** varaus päättyy edellisellä keikalla ja alkaa tällä |
| **Päällekkäisyys** | Kalustoa on varattu enemmän kuin sitä on, tai se on pois käytöstä. **Lasketaan aina, ei tallenneta** |

Keikan **Status** on Alustava, Vahvistettu, Valmis (vahvistettu ja palautettu) tai Peruttu.

#### Sana "tila" puretaan kolmeen osaan

| UI-nimi | Kysymys | Arvot | Miten saadaan |
|---|---|---|---|
| **Sijainti** | Missä se on? | Oma studio, Clarion › Bysa 2, Matkalla… | **Lasketaan.** Käsin annettu "Siirretty tänne" näytetään rinnalla |
| **Kunto** | Onko se käyttökunnossa? | OK · Huollossa · Rikki, valinnaisesti paluuaika | **Tallennetaan** |
| **Tilanne** | Mitä sille nyt tapahtuu? | Vapaa · Keikalla · Palauttamatta · Pois käytöstä (määrätavaralla "vapaana 28/40") | **Lasketaan** |

### 2.2 Periaatteet

1. **Faktat tallennetaan, muu lasketaan.** Ainoa tallennettu johdettu kenttä on hakua varten oleva `awaitingReturn`.
2. **Ajat tallennetaan `Timestamp`-arvoina** ja näytetään Helsingin ajassa.
3. **Rivit ovat keikan sisällä**, ja suora siirto tallennetaan vain vastaanottavalle riville. Tallennus kirjoittaa siis aina yhden keikan.
4. **Kukaan ei kirjoita toisen päälle huomaamatta.** Lomake tallentaa transaktiossa vain muuttamansa kentät. Jos sama kenttä on muuttunut toisaalla lomakkeen avaamisen jälkeen, tallennus keskeytyy: "Keikkaa muutettiin juuri toisaalla. Tarkista ja tallenna uudelleen." Lähti ja Palautettu kirjoitetaan omiin kenttiinsä, joten lomake ei koskaan pyyhi niitä.
5. **Kenttien nimet englanniksi, käyttöliittymä suomeksi. Kalustoa ei poisteta vaan arkistoidaan.**

### 2.3 Kokoelmat (Firestore)

```text
allowedUsers/{email}  name, initials                    // id = Google-osoite pienillä kirjaimilla
settings/app          presets: [{ id, name, eventStart, eventEnd,      // 'HH:mm'
                                  out: { dayOffset, time }, back: { dayOffset, time } }],
                      lastBackupAt?
locations/{id}        name, isOwnStudio, rooms: string[], address?, loadingNotes?, contact?, archived
items/{id}            tag, name, category, manufacturer?, model?, quantity (1), serialNo?,
                      condition: 'ok'|'huollossa'|'rikki', conditionUntil?,
                      homeLocationId (Oma studio), responsible?, notes?, archived,
                      locationOverride?: { text, at, by },             // "Siirretty tänne"
                      updatedAt, updatedBy
packages/{id}         name, lines: [{ itemId, qty }]
gigs/{id}             name, client?, locationId, room?, responsible, crew: email[], notes?,
                      status: 'alustava'|'vahvistettu'|'valmis'|'peruttu', confirmedAt?, confirmedBy?,
                      equipStart, eventStart, eventEnd, equipEnd,
                      departedAt?, departedBy?, returnedAt?, returnedBy?,  // Lähti, Palautettu
                      lines: [{ id, itemId, qty, note?,
                                from?: { gigId, lineId, handoverAt, travelMin? } }],  // suora siirto
                      awaitingReturn, updatedAt, updatedBy
```

- **Laitetta** ei voi lisätä samalle keikalle kahdesti. **Määrätavaran** rivin määrä on enintään `quantity`; rikkinäiset kaapelit vähennetään määrästä.
- **Tunnus** on yksilöllinen kirjainkoosta ja välilyönneistä riippumatta. **Kategoria** on vapaa teksti, jota täydennetään aiemmista arvoista.
- **Suoran siirron** vastaanottava rivi voi ottaa lähderiviltä koko määrän tai osan. Jos B:llä on 20 kaapelia ja C ottaa 12, loput 8 palaavat B:ltä studiolle. Lähderivillä on enintään yksi vastaanottaja.
- **`awaitingReturn`** = kohde ei ole oma studio, keikka on vahvistettu tai lähtenyt, eikä sitä ole palautettu.
- **Ladataan** koko kalusto, kohteet, paketit ja käyttäjät, keikat joiden `equipEnd` on viimeisten 60 päivän aikana tai tulevaisuudessa, sekä keikat joilla `awaitingReturn == true`. Laitekortin historia lasketaan näistä, joten yhdistelmäindeksejä ei tarvita.

### 2.4 Kohteiden lähtödata

- **Oma studio:** Studio 1 Halli, Studio 2 Keittiö, Studio 3 Webinaari ja Speak.
- **Clarion Hotel Helsinki**, Tyynenmerenkatu 2 (hotellin esite 2016, tarkista): Bysa 1–3, Sonck, Crusell, Tallberg, Sandis, Saukko, Brygga, Kraana, Bunkkeri, Hiili, Ulappa 1–2. Kohdekorttiin: "Ulappa 1–2 tornin 16. krs, kalusto hissillä". Lastaus- ja pysäköintiohjeet kirjataan ensimmäisen keikan jälkeen.

---

## 3. Näkymät

Puhelimen alapalkissa ovat **Tänään · Kalenteri · Kalusto · Taulu · Lisää** (Roudaukset, Asetukset).

| Näkymä | Sisältö |
|---|---|
| **Kalenteri** | FullCalendar: kuukausi, viikko ja lista. Viikko alkaa maanantaista, viikkonumerot näkyvät, alustavat ovat vinoviivoitettuja ja päällekkäisyydestä on merkki |
| **Keikka** | Perustiedot, kohdekortti, aikapohja ja neljä aikaa. Rivit saatavuusmerkkeineen, suorat siirrot ja päällekkäisyydet. Vahvista, Lähti, Palautettu, + Paketti ja Tallenna paketiksi |
| **Kalusto** | Haku (tunnus, nimi, sarjanumero), kategoria ja Tilanne. Lisää ja Monista. **Laitekortti:** Missä nyt, Seuraavaksi, viimeisimmät keikat, kunto ja Siirretty tänne |
| **Kalustotaulu** | Laitteet × päivät (puhelimessa 1 viikko, muuten 2): keikkapalkit, suorat siirrot, huollot ja määrätavaroiden "vapaana/omistettu". Oma CSS-grid, ensimmäinen sarake kiinnitetty |
| **Roudaukset** | Laskettu päivälista: mitä lähtee, siirtyy suoraan ja palaa, milloin, mistä mihin ja kuka vastaa. Studion sisäisiä siirtoja ei listata |
| **Tänään** | Tämän päivän ja huomisen roudaukset merkintäpainikkeineen sekä **Korjattavaa**: punaiset päällekkäisyydet, palauttamattomat keikat, menneet alustavat, ohitetut huollon paluuajat, täsmäämättömät suorat siirrot ja vanha varmuuskopio |
| *Asetukset* | Käyttäjät, kohteet, aikapohjat, paketit ja Lataa varmuuskopio (JSON) |

Kosketusalueet ovat vähintään 48 px, värin rinnalla on aina teksti, päivämäärät muodossa "ti 1.12.2026", "klo 9.00" ja "vk 49", eikä 360 px:n leveydellä ole vaakavieritystä.

**"Vapaana"** tarkoittaa keikan rivillä vapaata määrää *muiden* keikkojen jälkeen keikan jaksolla, ja taululla vapaata määrää *kaikkien* varausten jälkeen. Molemmissa näytetään pienin arvo.

### 3.1 Esimerkkitilanne (luvut 3–5 ja testit)

**Kalusto:** FX6-kamerat KAM-01…04, joista **KAM-03 on huollossa pe 4.12. klo 16.00 asti**. PTZ-01…03. XLR 10 m × 40. **Ajoajat:** studio → Clarion 30 min, Clarion → Espoo 35 min.

**Aikapohjat:** *Studiopäivä*: tapahtuma klo 9.00–16.00, kalusto 8.00–17.00. *Ulkokeikka*: tapahtuma 10.00–16.00, kalusto lähtee edellisenä päivänä klo 14.00 ja palaa seuraavana päivänä klo 12.00.

| Keikka | Paikka | Status | Kalusto lähtee | Tapahtuma | Takaisin | Kalusto |
|---|---|---|---|---|---|---|
| **A Lanseeraus** | Oma studio › Studio 1 Halli | Vahvistettu | ma 30.11. 11.00 | ma 12.00–16.00 | ma 17.00 | PTZ-01, PTZ-02, XLR × 10 |
| **W Webinaari X** | Oma studio › Studio 3 Webinaari | Vahvistettu | ti 1.12. 8.00 | ti 9.00–16.00 | ti 17.00 | KAM-01, KAM-02, XLR × 8 |
| **B Hybridiseminaari** | Clarion › Bysa 2 | Alustava | ma 30.11. 14.00 | ti 10.00–16.00 | ke 2.12. 12.00 | aluksi KAM-01, PTZ-01, PTZ-02, XLR × 20 |
| **C Asiakastilaisuus** | Asiakas Oy, Espoo | Alustava | ti 1.12. 14.00 | ke 9.00–12.00 | to 3.12. 12.00 | PTZ-01, PTZ-02, XLR × 12 |

### 3.2 Rautalankamalli: Keikka (läppäri), B ennen ratkaisuja (C:tä ei vielä ole)

```text
+------------------------------------------------------------------------------+
| < Kalenteri   Hybridiseminaari · Asiakas Oy           [Alustava v] [Vahvista]|
| Clarion Hotel Helsinki › Bysa 2  [Kohdekortti]   Vastuu: Mikko        vk 49  |
| Kalusto lähtee   ma 30.11. klo 14.00       Aikapohja: [Ulkokeikka v]         |
| Tapahtuma        ti 1.12.  klo 10.00–16.00 Tiimi: Anna, Jussi                |
| Kalusto takaisin ke 2.12.  klo 12.00       Lähti: –   Palautettu: –          |
+------------------------------------------------------------------------------+
| ! 3 varoitusta vahvistettujen keikkojen kanssa: vahvistus estyy.             |
+------------------------------------------------------------------------------+
| [+ Lisää kalustoa: tunnus tai nimi...]  [+ Paketti]  [Tallenna paketiksi]    |
| KAM-01  Sony FX6     1   ! Varoitus: myös Webinaari X (vahvistettu)          |
|                            ti 1.12. klo 8.00–17.00            [Vaihda laite] |
| PTZ-01  PTZ-kamera   1   ! Varoitus: myös Lanseeraus (vahvistettu)           |
|                            ma 30.11. klo 14.00–17.00                         |
|                            [Tuleeko suoraan keikalta Lanseeraus?]            |
| PTZ-02  PTZ-kamera   1   ! Varoitus: myös Lanseeraus (vahvistettu), sama     |
| XLR 10 m            20   OK  vapaana vähintään 30/40                         |
+------------------------------------------------------------------------------+
```

Puhelimessa sivu on yksi sarake: aikakortti, varoitukset ja rivit kortteina, merkintäpainikkeet alareunassa.

### 3.3 Rautalankamalli: Kalustotaulu luvun 4.4 jälkeen

```text
Kalustotaulu   [Kategoria: Kaikki v]                          < vk 49 >
                 | ma 30.11.  |  ti 1.12.  |  ke 2.12.  |  to 3.12.  |  pe 4.12.  |
-----------------+------------+------------+------------+------------+------------+
 KAM-01 Sony FX6 |            |Webinaari X |            |            |            |
 KAM-02 Sony FX6 |            |Webinaari X |            |            |            |
 KAM-03 Sony FX6 |:::: HUOLLOSSA, takaisin pe 4.12. klo 16.00 ::::::::::::::::    |
 KAM-04 Sony FX6 |       [Hybridiseminaari=======]      |            |            |
 PTZ-01          |   [Lans.]>[Hybr.==]>[Asiakastil.//////////]       |            |
 PTZ-02          |   [Lans.]>[Hybr.==]>[Asiakastil.//////////]       |            |
 PTZ-03          |            |            |            |            |            |
 XLR 10 m (40)   |   10/40    |   12/40    |   20/40    |   28/40    |   40/40    |
-----------------+------------+------------+------------+------------+------------+
Selite: [===] vahvistettu  [///] alustava  > suora siirto  ::: huollossa tai rikki
        luku = vapaana / omistettu (pienin arvo päivän aikana)
        punainen "Päällekkäin" = vahvistettujen kesken, keltainen "Varoitus" = alustava mukana
```

---

## 4. Käyttötapaukset

### 4.1 Kaluston lisääminen
1. **Kalusto → Lisää:** KAM-01, "Sony FX6", Kamerat, sarjanumero, vastuu Anna. Määrä on oletuksena 1 ja kotipaikka Oma studio.
2. **Monista** ehdottaa tunnusta KAM-02 ja tyhjää sarjanumeroa. Tallennus tarkistaa, ettei tunnus ole käytössä.
3. **Määrätavara:** XLR10, "XLR 10 m", määrä 40.
4. **Kunto:** KAM-03 → Huollossa, takaisin pe 4.12. klo 16.00. Kunto tallentuu aina; jos se osuu vahvistettuun varaukseen, näkyy punainen päällekkäisyys. Tulevasta huollosta tehdään keikka "Huolto", jolla laite on.

### 4.2 Keikan luonti aikapohjalla
1. **Kalenteri → ti 1.12. → Uusi keikka:** Hybridiseminaari, Clarion › Bysa 2, vastuu Mikko, tiimi Anna ja Jussi. Status on oletuksena Alustava.
2. **Aikapohja Ulkokeikka** täyttää ajat: lähtee ma 30.11. klo 14.00, tapahtuma ti 10.00–16.00, takaisin ke 2.12. klo 12.00. Lomake tarkistaa järjestyksen *lähtee ≤ alkaa < päättyy ≤ takaisin*.
3. **Lisää kalustoa:** haku "kam" näyttää jokaisen FX6:n saatavuuden keikan jaksolla. Mikko lisää KAM-01:n, PTZ-01:n, PTZ-02:n ja XLR × 20.
4. **Merkit näkyvät heti** (kuva 3.2). XLR on OK: muut keikat käyttävät B:n jaksolla enintään 10 kaapelia (A, ma 14.00–17.00), joten vapaana on vähintään 30/40.
5. **Tallenna.** Alustava keikka tallentuu varoituksista huolimatta.

### 4.3 Kaksi keikkaa haluaa KAM-01:n
- Vahvistettu W varaa KAM-01:n ti 8.00–17.00, alustava B ajalle ma 14.00 – ke 12.00. **B:llä näkyy keltainen varoitus**, W:llä "Alustava keikka Hybridiseminaari haluaa myös KAM-01:n".
- **B:n vahvistus estetään:** "KAM-01 on jo vahvistetulla keikalla Webinaari X (vahvistettu 20.11. klo 10.02, Anna). Vaihda laite tai poista rivi."
- **Vaihda laite** näyttää: KAM-02 (Webinaari X), KAM-03 (huollossa pe 4.12. klo 16.00 asti) ja **KAM-04 (vapaa)**. Mikko valitsee KAM-04:n.
- **Jos molemmat ovat alustavia,** varoitus näkyy kummallakin ja **ensimmäisenä vahvistanut voittaa**: Anna vahvistaa W:n klo 10.02, joten Mikon yritys klo 10.05 estetään samalla viestillä.
- **Jos molemmat vahvistetaan samalla sekunnilla,** kumpikin tallennus voi mennä läpi. Silloin molemmilla keikoilla ja Tänään-näkymässä näkyy punainen "Päällekkäin", kunnes joku ratkaisee sen. Viiden hengen tiimissä riski hyväksytään.

### 4.4 Suora siirto: studio → Clarion → seuraava keikka
1. **A → B:** A:n PTZ-varaus (ma 11.00–17.00) osuu B:n jaksoon (alkaa ma 14.00), ja A:n tapahtuma päättyy ennen B:n tapahtumaa. Sovellus kysyy: **"Tuleeko suoraan keikalta Lanseeraus?"** Mitään ei ketjuteta ilman hyväksyntää.
2. **Hyväksy.** Luovutus on oletuksena A:n tapahtuman loppu + 60 min eli ma 17.00, ajoaika 30 min; molemmat muokattavia. A:n rivi päättyy ja B:n alkaa klo 17.00, joten laite ei ole päällekkäin itsensä kanssa. **Pelivara** 17.00 + 30 min → ti 10.00 = **16 h 30 min**.
3. **B → C:** Jussi luo C:n (vastuu Jussi) ja valitsee riveille PTZ-01, PTZ-02 ja XLR × 12 "Tulee suoraan keikalta Hybridiseminaari". Luovutus ti 17.00, ajo 35 min → ke 9.00: **pelivara 15 h 25 min**. C ottaa B:n 20 kaapelista 12; loput 8 palaavat studiolle.
4. **Hyöty kaapeleissa:** ilman suoraa siirtoa ti 14.00–17.00 kysyntä olisi 20 + 8 + 12 = 40/40, vapaana 0. Suoran siirron kanssa C:n kaapelit ovat B:n kaapeleita, ja vapaana on vähintään 12.
5. **Vahvistus:** B:llä on KAM-04, PTZ-01 ja PTZ-02 (← A, → C) ja XLR × 20 (12 → C). Vahvistettujen kysyntä on enimmillään 30/40 (ma 14.00–17.00: A 10 + B 20), joten B:n voi vahvistaa. C jää alustavaksi.
6. **Roudaukset:**

```text
ma 30.11. 14.00 Oma studio → Clarion › Bysa 2      Hybridiseminaari: KAM-04, XLR ×20       Mikko
          17.00 Studio 1 Halli → Clarion › Bysa 2  SUORA A → B: PTZ-01, PTZ-02 (30 min)    Mikko
ti 1.12.  17.00 Clarion › Bysa 2 → Asiakas Oy      SUORA B → C: PTZ-01, PTZ-02, XLR ×12    Jussi
ke 2.12.  12.00 Clarion › Bysa 2 → Oma studio      Hybridiseminaari: KAM-04, XLR ×8        Mikko
to 3.12.  12.00 Asiakas Oy → Oma studio            Asiakastilaisuus: PTZ-01, PTZ-02, XLR ×12  Jussi
```

Lähdöstä ja paluusta vastaa keikan vastuuhenkilö, suorasta siirrosta vastaanottavan keikan vastuuhenkilö.

7. **Jos C perutaan,** B:n rivit palaavat B:n omiin aikoihin (takaisin ke 12.00), ja Tänään näyttää "Suoran siirron keikka peruttu, tarkista roudaus". Samoin, jos keikan aikoja muutetaan niin, ettei luovutus enää osu keikkojen väliin: siirto jätetään laskennassa huomiotta ja merkitään "ei täsmää", kunnes luovutusaika korjataan.

### 4.5 Lähti, Palautettu ja "missä nyt"
1. **Lähti:** KAM-04 ja kaapelit lähtevät ma 14.10, ja Mikko painaa B:llä **Lähti**. Lähti on mahdollinen vain vahvistetulla keikalla.
2. **Missä nyt:**
   - KAM-04 ma 13.30: "Oma studio, lähdössä keikalle Hybridiseminaari klo 14.00". Ma 15.00: "Clarion › Bysa 2, Hybridiseminaari (lähti 14.10, Mikko)".
   - PTZ-01 ma 16.00: "Studio 1 Halli, Lanseeraus. Seuraavaksi suora siirto Hybridiseminaariin klo 17.00". Ma 17.15: "Matkalla Lanseeraus → Hybridiseminaari, perillä noin 17.30". Ti 12.00: "Clarion › Bysa 2", seuraavaksi "suora siirto Asiakastilaisuuteen ti 17.00".
   - Jos todellisuus poikkeaa, **Siirretty tänne** tallentaa tekstin, esim. "Mikon auto". Se näkyy laskennallisen sijainnin rinnalla, kunnes laitteelle tulee uudempi merkintä tai joku kuittaa sen pois.
3. **Palautettu** ke 12.30 vapauttaa B:n kaluston, joka ei jatka toiselle keikalle (KAM-04 ja XLR × 8), ja muuttaa statuksen Valmiiksi. Jos jotain puuttuu, keikkaa ei merkitä palautetuksi.
4. **Palauttamatta:** merkitsemättömän B:n kalusto pysyy varattuna. Vahvistettu studiokeikka **D Tuotevideo** (Studio 2 Keittiö, to 3.12., Studiopäivä) haluaa KAM-04:n, joten to 9.00 D:llä näkyy punaisena "KAM-04 ei ole palautettu keikalta Hybridiseminaari (myöhässä 21 h)". Alustavalla D:llä merkki olisi keltainen. Tänään-näkymässä on **Merkitse palautetuksi**.
5. **Oman studion keikoilla** merkintöjä ei tarvita. **Lähtenyttä keikkaa** ei voi perua ennen Palautettu-merkintää.

---

## 5. Saatavuus- ja konfliktisäännöt

Logiikka on kansiossa `src/core`: puhtaita funktioita ilman Firebase- ja React-riippuvuuksia, testattuina ennen käyttöliittymää. Tulokset lasketaan uudelleen aina datan muuttuessa ja kerran minuutissa, jotta myöhästyneet palautukset muuttuvat punaisiksi ilman sivun latausta.

### 5.1 Säännöt
1. **Aikavälit ovat puoliavoimia `[alku, loppu)`**: klo 17.00 päättyvä ja klo 17.00 alkava eivät ole päällekkäin.
2. **Helsingin aika:** lomakeajat muunnetaan apufunktioilla `helsinkiLocalToInstant()` ja `instantToHelsinkiLocal()`, jotka tehdään `Intl.DateTimeFormat`-pohjaisiksi (dayjs:n `tz()`-funktiossa on tunnettuja kesäaikabugeja). 28.3.2027 klo 3.00–3.59 ei ole olemassa, ja lomake ilmoittaa siitä. 25.10.2026 ja 31.10.2027 klo 3.00–3.59 toistuvat, ja valitaan aiempi (kesäaika). Aikapohjien päiväsiirrot ja taulun päivät lasketaan Helsingin kalenteripäivinä, ei 24 tunnin lisäyksinä.
3. **Rivin varaus** on keikan kalustojakso. Kelvollinen suora siirto aloittaa sen luovutushetkestä. Lähderivillä vastaanottajan ottama määrä päättyy luovutukseen ja loput keikan omaan loppuun.
4. **Suora siirto on kelvollinen**, jos molemmat keikat ovat voimassa, lähderivi on olemassa samalla laitteella, määrä riittää, lähderivillä ei ole toista vastaanottajaa ja *A:n tapahtuman loppu ≤ luovutus < B:n tapahtuman loppu*. Muuten siirto ohitetaan ja merkitään "ei täsmää".
5. **Palauttamaton kalusto varaa toistaiseksi**, kun keikka ei ole omassa studiossa, on vahvistettu, valmis tai lähtenyt, ei ole palautettu ja *nyt ≥ kalusto takaisin*. Ennen jakson loppua merkitty Palautettu päättää varauksen.
6. **Kunto** Huollossa tai Rikki varaa koko määrän paluuaikaan asti tai toistaiseksi. Arkistoidun kapasiteetti on 0. Peruttu keikka ei vaikuta, ellei se ole lähtenyt ja palauttamatta.
7. **Vakavuus** lasketaan jokaiselle aikajaksolle erikseen. **Päällekkäin (punainen):** ylitys syntyy jo vahvistetuista, valmiista ja lähteneistä keikoista, kunnosta ja palauttamattomasta kalustosta. **Varoitus (keltainen):** alustavat keikat aiheuttavat ylityksen tai lisäävät sitä.
8. **Pelivara** = *B:n tapahtuman alku − luovutus − ajoaika*. Alle 0 näytetään punaisena "Ei ehdi". Pelivara ei estä tallennusta.
9. **Ensin vahvistanut voittaa (vastaus 5):** alustava keikka tallentuu aina. Kun keikka on tai siitä tulee Vahvistettu tai Valmis, tallennus estetään, jos se synnyttää **uuden** punaisen yhdistelmän (laite + kilpailijat tai kunto). "Ennen" on tallennettu tilanne, "jälkeen" tilanne muutoksen kanssa, molemmat samalla hetkellä. Olemassa oleva päällekkäisyys ei estä muita muutoksia.
10. **Faktojen kirjaamista ei estetä:** kunto, Lähti, Palautettu ja Siirretty tänne tallentuvat aina, ja seuraukset näkyvät päällekkäisyyksinä. Myöskään perumista ei estetä päällekkäisyyksien takia.
11. **Suoran siirron ehdotus** näytetään, kun rivi osuu saman laitteen varaukseen keikalla, jonka tapahtuma päättyy ennen tämän keikan tapahtumaa.

### 5.2 Pseudokoodi

```ts
type Ms = number                                                   // UTC-ms, puoliavoin [start, end)
interface Demand { start: Ms; end: Ms; qty: number; firm: boolean; src: string }  // src = gigId | 'kunto'
const cmp = (a: Ms, b: Ms) => (a < b ? -1 : a > b ? 1 : 0)         // ±Infinity vain muistissa
const live = (g?: Gig) => !!g && (g.status !== 'peruttu' || (!!g.departedAt && !g.returnedAt))
const firm = (g: Gig) => ['vahvistettu', 'valmis'].includes(g.status) || !!g.departedAt

function validFrom(b: Gig, r: Line, x: Ctx): boolean {              // sääntö 4
  const a = r.from && x.gig(r.from.gigId), s = a?.lines.find(l => l.id === r.from!.lineId)
  return !!s && live(a) && live(b) && s.itemId === r.itemId && r.qty <= s.qty
    && x.firstReceiver(s.id) === r.id && a!.eventEnd <= r.from!.handoverAt && r.from!.handoverAt < b.eventEnd
}

function lineDemands(g: Gig, l: Line, x: Ctx): Demand[] {
  const f = firm(g), start = validFrom(g, l, x) ? l.from!.handoverAt : g.equipStart
  const out = x.validReceiverOf(l.id), sent = out?.qty ?? 0
  let end = g.equipEnd
  if (g.returnedAt && g.returnedAt < end) end = g.returnedAt                          // aikainen palautus
  else if (!g.returnedAt && f && !x.ownStudio(g) && x.now >= g.equipEnd) end = Infinity // palauttamatta
  return [{ start, end, qty: l.qty - sent, firm: f, src: g.id },                      // jää keikalle
          { start, end: out?.from!.handoverAt ?? start, qty: sent, firm: f, src: g.id }] // jatkaa suoraan
    .filter(d => d.qty > 0 && d.start < d.end)
}

function demandsFor(it: Item, x: Ctx): Demand[] {
  const d = it.condition === 'ok' ? [] :
    [{ start: -Infinity, end: it.conditionUntil ?? Infinity, qty: it.quantity, firm: true, src: 'kunto' }]
  for (const g of x.gigs) if (live(g)) for (const l of g.lines) if (l.itemId === it.id) d.push(...lineDemands(g, l, x))
  return d
}

// Jaksot kaikkien alku- ja loppuhetkien välissä; saman hetken loppu ja alku eivät ole yhtä aikaa.
function segments(it: Item, ds: Demand[]): Seg[] {
  const cap = it.archived ? 0 : it.quantity, out: Seg[] = []
  const ts = [...new Set(ds.flatMap(d => [d.start, d.end]))].sort(cmp)
  for (let i = 0; i + 1 < ts.length; i++) {
    const act = ds.filter(d => d.start <= ts[i] && ts[i] < d.end)
    const firmUse = sum(act.filter(d => d.firm)), allUse = sum(act)
    const red = firmUse > cap, yellow = allUse - cap > Math.max(0, firmUse - cap)
    if (red || yellow) out.push({ start: ts[i], end: ts[i + 1], red, yellow, free: cap - allUse,
      redSrcs: red ? srcs(act.filter(d => d.firm)) : [], allSrcs: srcs(act) })
  }
  return mergeAdjacent(out)
}

// Punainen yhdistelmä, esim. 'KAM-01|B,W' tai 'KAM-04|B,D'
const redKeys = (x: Ctx) => x.items.flatMap(it =>
  segments(it, demandsFor(it, x)).filter(s => s.red).map(s => `${it.id}|${s.redSrcs.join(',')}`))

function blockingOnSave(before: Ctx, after: Ctx, saved: Gig): string[] {   // sääntö 9, sama now
  if (!firm(saved)) return []
  const old = new Set(redKeys(before))
  return redKeys(after).filter(k => !old.has(k))
}
```

Laskenta on suoraviivainen eikä optimoitu: laitteella on kymmeniä varauksia, joten 200 laitetta lasketaan millisekunneissa.

**Missä nyt** (laitteelle, hetkellä *t*): haetaan rivi, jonka varaus kattaa hetken. Suorasta siirrosta tullut rivi on "Matkalla A → B" välillä *luovutus … luovutus + ajoaika* ja sen jälkeen B:n paikassa. Muuten oman studion keikalla laite on keikan tilassa, lähteneellä keikalla keikan paikassa, lähtemättömällä "Oma studio, lähdössä" ja palauttamattomalla "Palauttamatta: X". Ilman riviä laite on kotipaikassa. "Siirretty tänne" näytetään rinnalla, jos se on uudempi kuin laitteen viimeisin Lähti, Palautettu tai ohitettu luovutus. **Määrätavaralle** näytetään jakauma, esim. "12 Asiakas Oy · 8 Clarion, palaa ke 12.00 · 20 Oma studio".

**Tilanne:** Pois käytöstä → Palauttamatta → Keikalla → Vapaa.

**Roudaukset:** lähtö kalustojakson alussa (ellei rivi tule suorasta siirrosta), suora siirto luovutushetkellä ja paluu jakson lopussa sille määrälle, joka ei jatka. Siirto listataan, jos jompikumpi pää on studion ulkopuolella, ja saman ajan ja reitin rivit ryhmitellään.

### 5.3 Testit (Vitest)
Testit ajetaan myös asetuksilla `TZ=UTC` ja `TZ=America/New_York`, jotta koodi ei riipu koneen aikavyöhykkeestä.
- **Rajat:** 17.00 loppu ja 17.00 alku eivät ole päällekkäin, minuutin päällekkäisyys on.
- **KAM-01:** B saa varoituksen ja sen vahvistus estyy; KAM-04:llä onnistuu; KAM-03 estää pe 15.59 asti, pe 16.00 alkava on OK; ensimmäinen vahvistus voittaa; vanha päällekkäisyys ei estä muistiinpanon tallennusta.
- **XLR ma–pe** (luvun 4.4 jälkeen: A, W ja B vahvistettuja, C alustava): kaikki mukana 10, 12, 20, 28, 40 /40; vain vahvistetut 10, 12, 32, 40, 40 /40; ilman B → C -siirtoa ti 14.00–17.00 vapaana 0.
- **Vakavuus:** vahvistetut ylittävät jaksolla [t1, t2) ja alustava lisää ylityksen jaksolle [t2, t3) → [t2, t3) on keltainen.
- **Suorat siirrot:** pelivarat 16 h 30 min ja 15 h 25 min; "Ei ehdi" (luovutus 9.40, ajo 30 min, tapahtuma 10.00); peruttu C palauttaa B:n rivin loppumaan ke 12.00; luovutusta aiemmaksi siirretty C, poistettu lähderivi ja kaksi vastaanottajaa → "ei täsmää"; osamäärä 12/20 jättää 8 B:lle.
- **Palauttamatta:** KAM-04 to 9.00 punainen vahvistetulla D:llä ("myöhässä 21 h"), keltainen alustavalla; ke 11.59 ei vielä; alustava lähtemätön ja oman studion keikka eivät jää varaamaan; aikainen Palautettu vapauttaa.
- **Missä nyt:** luvun 4.5 kohdat.
- **Aika:** Ulkokeikka su 28.3.2027 → la 27.3. 14.00 – ma 29.3. 12.00 = **45 h**; 28.3.2027 klo 3.30 hylätään; 31.10.2027 klo 3.30 = 00.30 UTC; taulun päivä 28.3.2027 on 23 h ja 31.10.2027 25 h; "ti 1.12.2026 klo 9.00", "vk 49".
- **Valinnainen fast-check:** satunnaisilla varauksilla `segments` antaa joka minuutille saman vakavuuden kuin minuuttikohtainen laskenta.
- **Säännöt (emulaattori):** listalla oleva pääsee, listaamaton ei lue eikä kirjoita, isoja kirjaimia sisältävä osoite löytää pienikirjaimisen dokumentin.

---

## 6. Tekniikka

### 6.1 Kirjastot

| Kerros | Valinta | Lisenssi |
|---|---|---|
| Sovellus | Vite + React 19 + TypeScript (strict), React Router | MIT; TS Apache-2.0 |
| UI | Mantine 9.8 (`core`, `dates`, `form`, `notifications`) | MIT |
| Kalenteri | FullCalendar Standard 7.1 (`fi`, `timeZone: 'Europe/Helsinki'`, peer `temporal-polyfill`) | MIT |
| Kalustotaulu | Oma CSS-grid-komponentti | – |
| Päivämäärät | dayjs 1.11 + `isoWeek`, `fi` muotoiluun; vyöhykemuunnokset omilla `Intl`-apufunktioilla | MIT |
| Firebase | JS SDK 13 (Auth, Firestore) | Apache-2.0 |
| Testit | Vitest, Emulator Suite, `@firebase/rules-unit-testing`, valinnaisesti fast-check | MIT, Apache-2.0 |

Yksi sovellus: puhdas logiikka `src/core`, Firebase ja reaaliaikaiset kuuntelijat `src/data`, näkymät `src/views`, tekstit `src/fi.ts`.

### 6.2 Firebasen käyttöönotto
1. **Firestore (Standard)** alueelle **europe-north1**. Aluetta ei voi vaihtaa jälkikäteen.
2. **Authentication → Google.** Projektin `<id>.web.app`, `<id>.firebaseapp.com` ja `localhost` ovat valmiiksi sallittuja; vain oma verkkotunnus pitäisi lisätä.
3. **`signInWithPopup`**, koska redirect ei toimi selaimissa, jotka estävät kolmannen osapuolen tallennuksen. `authDomain` asetetaan sovelluksen omaksi osoitteeksi (`<id>.web.app`).
4. **Ensimmäinen `allowedUsers`-dokumentti** luodaan konsolissa, muut Asetuksissa. Osoite kirjoitetaan pienillä kirjaimilla niin kuin Google-tili sen näyttää. Viimeistä käyttäjää ei voi poistaa. Listaamaton näkee: "Osoitetta x@gmail.com ei ole listalla. Pyydä joku tiimistä lisäämään se."
5. **Hosting** ohjaa kaikki reitit `index.html`-tiedostoon. Kehitys tehdään emulaattoreilla.

### 6.3 Tietoturvasäännöt

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function allowed() {
      return request.auth != null
        && request.auth.token.firebase.sign_in_provider == 'google.com'
        && request.auth.token.email_verified == true
        && exists(/databases/$(db)/documents/allowedUsers/$(request.auth.token.email.lower()));
    }
    match /{document=**} { allow read, write: if allowed(); }
  }
}
```

Muita sääntöjä ei tarvita, koska rooleja ei ole.

### 6.4 Varmuuskopiot
- **Lataa varmuuskopio (JSON)** tallentaa kaikki kokoelmat yhteen tiedostoon. Ajat tallennetaan tyyppimerkinnällä (`{"_ts":"2026-12-01T07:00:00Z"}`), jotta ne palautuvat aikoina. Tänään muistuttaa, jos kopiosta on yli 30 päivää. Palautus tehdään pienellä Admin SDK -skriptillä, joka kokeillaan emulaattorissa.
- **Valinnaiset ajastetut Firestore-kopiot vaativat Blazen** ("This feature requires the Blaze pricing plan"), esim. päivittäin 7 päivän säilytyksellä (enintään 14 viikkoa). Ne palautetaan aina uuteen tietokantaan, jolloin sovelluksen tietokantatunnus vaihdetaan ja säännöt julkaistaan uudelleen. Ne eivät ole JSON-palautusta helpompia, mutta eivät unohdu.

### 6.5 Spark vai Blaze ja kustannus
- **Spark riittää:** Firestore 50 000 lukua, 20 000 kirjoitusta ja 20 000 poistoa päivässä sekä 1 GiB; Hosting 10 GB ja 360 MB/pv; Auth 50 000 kuukausikäyttäjää. Storagea ei Sparkissa ole, eikä sitä tarvita.
- **Arvio:** avaus lukee 300–400 dokumenttia; viisi käyttäjää × kymmenen avausta ≈ 15 000–20 000 lukua päivässä.
- **Kiintiön ylitys pysäyttää Sparkissa toiminnon** Tyynenmeren ajan keskiyöhön (Suomessa yleensä klo 10, osan vuotta klo 9).
- **Suositus:** pysytään Sparkissa ja käytetään JSON-kopiota. Blaze otetaan, jos halutaan ajastetut kopiot tai kiintiö tulee vastaan; silloin budjettihälytys (se ei rajoita kulutusta). Kustannus **0 €/kk**, Blazella senttejä.

---

## 7. Toteutusvaiheet

Määräaikoja ei ole. Vaihe päättyy, kun se toimii oikeassa käytössä.

### Vaihe 1a: Kalusto, keikat ja päällekkäisyydet
1. **Perusta:** Firebase, Google-kirjautuminen, sallittujen lista, säännöt ja sääntötesti, emulaattorin siemendata (studio, Clarion "tarkista", luvun 3.1 esimerkki).
2. **`src/core` ensin:** aika-apurit, aikapohjat, varaukset, jaksot, vakavuus ja "ensin vahvistanut voittaa". Luvun 5.3 testit vihreinä ennen näkymiä.
3. **Kalusto:** lista, lisäys, Monista, kunto, arkistointi ja laitekortti.
4. **Keikat:** aikapohjat, rivit, saatavuusmerkit, Vaihda laite ja vahvistus.
5. **Näkymät** Kalenteri, Keikka, Kalusto ja Kalustotaulu sekä **Asetukset** (käyttäjät, kohteet, aikapohjat, JSON-kopio).

**Valmis, kun** tiimi suunnittelee oikeat keikkansa sovelluksessa ja päällekkäisyydet vastaavat todellisuutta.

### Vaihe 1b: Liike ja arki
1. **Suora siirto:** ehdotus, luovutus, ajoaika, osamäärä ja "ei täsmää".
2. **Lähti, Palautettu, Siirretty tänne** ja Missä nyt.
3. **Roudaukset ja Tänään.**
4. **Paketit** (Asetuksissa ja keikalla).
5. **Puhelintesti:** kirjautuminen iOS Safarilla (myös kotinäytön sovelluksena) ja Android Chromella, keikkasivu 360 px:n leveydellä.

**Valmis, kun** tiimi on käyttänyt sovellusta muutaman viikon kaikilla keikoillaan ilman lukuvirheitä.

### Vaihe 2: Helpotukset
- Kopioi keikka (myös "lisää kalusto keikalta…") ja tulostettava pakkauslista.
- Kohdekorttien täydennys.
- Valinnainen **Hyväksy päällekkäisyys** muistiinpanolla: keikkojen välinen päällekkäisyys näkyy harmaana ja sallii tallennuksen. Kunnon ja palauttamattoman kaluston päällekkäisyys pysyy punaisena. Uusi vahvistettu kilpailija ei voi liittyä huomaamatta, koska sen oma tallennus estetään.

### Myöhemmin (tarpeen mukaan)
QR-tarrat (tunnus sopii tarraan sellaisenaan) · offline-tila · taulukkotuonti · pohjapiirros · ajoneuvot ja kuormatila · laukut sisältöineen · kuvat ja ohjeet (Storage, vaatii Blazen) · muutoshistoria · studiotilan tuplavarausvaroitus · rivikohtaiset palautukset · tuleva huolto kuntoon · muistutukset ja iCal · ajoaikojen laskenta · monipäiväisen keikan päiväkohtaiset tilat.

---

## 8. Riskit

| Riski | Hallinta |
|---|---|
| Saatavuuslaskenta on väärin, ja luottamus menee | Logiikka testataan ensin, esimerkkiluvut ovat testitapauksia, ja laskenta on suoraviivainen |
| Kesäaikavirheet | Yksi testattu apufunktiopari, päivät Helsingin keskiöistä, testit kolmella vyöhykkeellä |
| Palautettu-merkintä unohtuu | Kalusto pysyy tarkoituksella varattuna; Tänään-listalla korjaus yhdellä napautuksella |
| Samanaikainen vahvistus | Hyväksytty riski; päällekkäisyys näkyy punaisena kaikkialla |
| Google-popup ei toimi jossain puhelimessa | Testataan vaiheen 1a alussa. Varalla redirect: `authDomain` on sovelluksen osoite, ja `https://<id>.web.app/__/auth/handler` lisätään Google Cloud Consolessa OAuth-asiakkaan uudelleenohjauksiin |
| Kuka tahansa voi muuttaa mitä tahansa | Arkistointi poiston sijaan, keskeytyvä tallennus ristiinmuokkauksessa, JSON-kopio |

---

## 9. Jäljellä olevat pienet kysymykset

| # | Kysymys | Mihin vaikuttaa |
|---|---|---|
| 1 | **Tunnukset:** kelpaako "KAM-03"? Onko laitteilla jo tunnuksia tai tarroja, jotka pitää säilyttää? | Tunnuskenttä, Monista |
| 2 | **Aikapohjat:** pitävätkö Studiopäivän ja Ulkokeikan ajat (luku 3.1)? Tarvitaanko muita pohjia? | Oletusarvot |
| 3 | **Kiinteät asennukset:** onko studioissa kalustoa, joka ei koskaan lähde talosta? Jätetäänkö se pois? | Kalustolistan laajuus |
| 4 | **Studion tilat:** riittävätkö Studio 1–3 ja Speak, vai tehdäänkö keikkoja myös tarkkaamoissa tai Loungessa? | Tilalista |
| 5 | **Monipäiväiset keikat:** riittääkö yksi tapahtuma-aika? Aluksi voi tehdä keikan päivää kohden ja siirtää kaluston suoraan | Keikan aikamalli |

---

## Muutokset laajaan suunnitelmaan verrattuna

**Poistettu tai kevennetty:**
- Roolit, Microsoft, sähköpostilinkit, freelancerit ja roolikohtaiset säännöt → Google-tilit, sallittujen lista, yksi sääntö.
- Tietosuojaseloste, säilytysajat ja yhteistoimintaselvitys.
- Mallit, yksilöt, kulutustavarat, laukut ja vuokrayksilöt → yksi `items`-kokoelma.
- Varastopaikat, ajoneuvot, siirto-osuudet, yksilökuittaukset ja liikeloki → Lähti, Palautettu, Siirretty tänne ja laskettu roudauslista.
- Seitsemän aikavaihetta → neljä aikaa ja aikapohjat.
- Cloud Functions, lukko- ja rev-laskurit, yöllinen eheysajo, tallennetut konfliktiyhteenvedot ja ohitusten tilannekuvat → selaimessa laskettavat päällekkäisyydet ja tallennuksen tarkistus.
- Kaksipuolinen ketjulinkki ja kahden keikan transaktio → linkki vain vastaanottavalla rivillä.
- Huonehierarkia ja neliömetrit → kohde ja tilalista.
- Storage, pakollinen Blaze ja palautusharjoitukset → Spark, JSON-kopio, valinnaiset ajastetut kopiot.
- 13 näkymää → 6 ja Asetukset. Kategorialista, "Alustavat mukana" -valinta, "Tiukka"-pelivara, Zod ja yhdistelmäindeksit pois.
- Rentman-kokeilu ja kustannusvertailu → yksi kappale.

**Säilytetty tarkoituksella:**
- Testattu saatavuuslaskenta puoliavoimilla aikaväleillä, punainen ja keltainen jaksoittain, "ensin vahvistanut voittaa".
- Suora siirto luovutushetkellä ja osamäärällä, kelpoisuustarkistus ja pelivara.
- Palauttamaton kalusto pysyy varattuna; lähtenyttä keikkaa ei voi perua ennen palautusta.
- Helsingin aika testatuilla apufunktioilla ja kesäaikatesteillä; esimerkkiluvut testitapauksina.
- Ristiinmuokkauksen tunnistus, jotta merkinnät eivät katoa.
- europe-north1, Google-popup ja sallittujen lista.