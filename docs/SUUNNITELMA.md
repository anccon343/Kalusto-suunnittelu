# Kalustonhallinta ja keikkasuunnittelu: kevyt suunnitelma

_Laadittu 23.11.2026 (vk 48). Korvaa laajan suunnitelman (`tutkimus/suunnitelma-v1-laaja.md`) ja perustuu käyttäjän vastauksiin: ensimmäinen kierros laajan suunnitelman kysymyksiin ("L1–L6") ja tarkentava kierros (luku 9, "T1–T5"). Kirjastoversiot ovat laajan suunnitelman npm-tarkistuksesta. Firebasen Spark- ja Blaze-erot on tarkistettu 23.11.2026 Firebasen hinnoittelusivulta ja varmuuskopio-ohjeesta. "(tarkista)" = ei varmistettu ensikäden lähteestä._

---

## 1. Tiivistelmä

### 1.1 Mitä rakennetaan

Kevyt, suomenkielinen sisäinen verkkosovellus puhelimelle, tabletille ja läppärille:

1. **Kalustolista.** Jokainen varattava asia on oma rivinsä, esim. "KAM-03 Sony FX6" tai "XLR 10 m, 40 kpl", ja sillä on kunto, kotipaikka ja vastuuhenkilö.
2. **Kaluston suunnittelu keikoille.** Mikä kalusto menee millekin keikalle ja milloin, missä se on, kuka vastaa ja miten se siirtyy keikalta toiselle, myös suoraan ilman käyntiä studiolla. Päällekkäiset varaukset näkyvät heti.

"Visuaalinen" tarkoittaa kalenteria, kalustotaulua (laitteet × päivät) ja päiväkohtaista roudauslistaa. Käyttäjiä on noin viisi ja kalustoa 50–200 riviä.

### 1.2 Mikä muuttui ja miksi

- **Google-tilit ja sallittujen lista, ei rooleja** (L1, toive kirjautua Google-tunnuksilla, "poista vaikeat roolit").
- **Yksi kalustokokoelma**, koska varataan aina tietty laite (L2).
- **Ei varastopaikkoja eikä ajoneuvoja**, vain studion tilat ja ulkoiset kohteet (L3).
- **Neljä aikaa, jotka syötetään itse**, ei valmiita aikapohjia (L4, T2). **Monipäiväiset keikat** ja **kesken keikan lähtevä kalusto** (T5): rivillä voi olla oma aika, ja suora siirto voi lähteä kesken keikan.
- **Ei palvelinkoodia:** päällekkäisyydet lasketaan selaimessa testatulla funktiolla, ja "ensin vahvistanut voittaa" tarkistetaan tallennettaessa (L5, L6).
- **Tietosuojaosuus poistettu** (sisäinen käyttö). **6 näkymää** 13:n sijaan.

### 1.3 Ostaa vai rakentaa

Lähin valmis ratkaisu on Rentman, noin 113 €/kk kahdella suunnittelijalla. Siinä ei ole suomenkielistä käyttöliittymää, keikalta toiselle -siirto on Rentmanin oman tukiartikkelin mukaan kiertotie, ja mukana on paljon tarpeetonta, kuten tarjoukset ja laskutus. Rakennetaan oma, koska tarve on kapea ja tarkasti tiedossa: suomi, tietyt laitteet, omat tilat ja suorat siirrot. Kevyenä sovellus pysyy yhden kehittäjän ylläpidettävänä, ja palvelinkulut ovat käytännössä nolla.

---

## 2. Käsitteet ja tietomalli

### 2.1 Sanasto

| Käsite (UI)        | Merkitys                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laite**          | Yksittäinen asia lyhyellä tunnuksella, esim. KAM-03 (määrä 1)                                                                                   |
| **Määrätavara**    | Tavara, jota ei seurata yksitellen, esim. XLR 10 m × 40                                                                                         |
| **Paketti**        | Tallennettu kalustolista, jonka voi lisätä keikalle kerralla                                                                                    |
| **Kohde**          | Oma studio tai ulkoinen paikka tietokortteineen, ja sen tilat (Pikku studio, Bysa 2)                                                            |
| **Keikka**         | Työ, jolla on kohde, ajat, status ja kalusto. Myös studiotuotanto on keikka                                                                     |
| **Kalustojakso**   | _Kalusto lähtee → kalusto takaisin_. Rivi varaa kaluston tämän ajan                                                                             |
| **Rivin oma aika** | Monipäiväisellä keikalla osa kalustosta voi tulla myöhemmin tai lähteä aiemmin. Oletuksena rivi on mukana koko kalustojakson                    |
| **Suora siirto**   | Rivi tulee suoraan toiselta keikalta, myös kesken monipäiväisen keikan. **Luovutushetkellä** varaus päättyy edellisellä keikalla ja alkaa tällä |
| **Päällekkäisyys** | Kalustoa on varattu enemmän kuin sitä on, tai se on pois käytöstä. **Lasketaan aina, ei tallenneta**                                            |

Keikan **Status** on Alustava, Vahvistettu, Valmis (vahvistettu ja palautettu) tai Peruttu.

#### Sana "tila" puretaan kolmeen osaan

| UI-nimi      | Kysymys                  | Arvot                                                                             | Miten saadaan                                                     |
| ------------ | ------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Sijainti** | Missä se on?             | Oma studio, Clarion › Bysa 2, Matkalla…                                           | **Lasketaan.** Käsin annettu "Siirretty tänne" näytetään rinnalla |
| **Kunto**    | Onko se käyttökunnossa?  | OK · Huollossa · Rikki, valinnaisesti paluuaika                                   | **Tallennetaan**                                                  |
| **Tilanne**  | Mitä sille nyt tapahtuu? | Vapaa · Keikalla · Palauttamatta · Pois käytöstä (määrätavaralla "vapaana 28/40") | **Lasketaan**                                                     |

### 2.2 Periaatteet

1. **Faktat tallennetaan, muu lasketaan.** Ainoa tallennettu johdettu kenttä on hakua varten oleva `awaitingReturn`.
2. **Ajat tallennetaan `Timestamp`-arvoina** ja näytetään Helsingin ajassa.
3. **Rivit ovat keikan sisällä**, ja suora siirto tallennetaan vain vastaanottavalle riville. Tallennus kirjoittaa siis aina yhden keikan.
4. **Kukaan ei kirjoita toisen päälle huomaamatta.** Lomake tallentaa transaktiossa vain muuttamansa kentät. Jos sama kenttä on muuttunut toisaalla lomakkeen avaamisen jälkeen, tallennus keskeytyy: "Keikkaa muutettiin juuri toisaalla. Tarkista ja tallenna uudelleen." Lähti- ja Palautettu-merkinnät, myös rivikohtaiset (`lineMarks.<riviId>`), kirjoitetaan omiin kenttiinsä kenttäpolulla, joten lomake ei koskaan pyyhi niitä.
5. **Kenttien nimet englanniksi, käyttöliittymä suomeksi. Kalustoa ei poisteta vaan arkistoidaan.**

### 2.3 Kokoelmat (Firestore)

```text
allowedUsers/{email}  name, initials                    // id = Google-osoite pienillä kirjaimilla
settings/app          lastBackupAt?
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
                                start?, end?,                    // rivin oma aika (oletus: kalustojakso)
                                from?: { gigId, lineId, handoverAt, travelMin? } }],  // suora siirto
                      lineMarks?: { [lineId]: { departedAt?, departedBy?,  // oman ajan rivien Lähti
                                                returnedAt?, returnedBy? } }, // ja Palautettu
                      awaitingReturn, updatedAt, updatedBy
```

- **Laitetta** ei voi lisätä samalle keikalle kahdesti (laitteen paluu samalle keikalle kesken keikan on Myöhemmin-listalla). **Määrätavaran** rivin määrä on enintään `quantity`; rikkinäiset kaapelit vähennetään määrästä. Määrätavaralla voi olla samalla keikalla useita rivejä (esim. osa tulee myöhemmin tai suoraan toiselta keikalta); kapasiteetin tarkistaa saatavuuslaskenta.
- **Tunnus** on yksilöllinen kirjainkoosta ja välilyönneistä riippumatta. **Kategoria** on vapaa teksti, jota täydennetään aiemmista arvoista.
- **Suoran siirron** vastaanottava rivi voi ottaa lähderiviltä koko määrän tai osan. Jos B:llä on 20 kaapelia ja C ottaa 12, loput 8 palaavat B:ltä studiolle. Lähderivillä on enintään yksi vastaanottaja: sovellus ei tarjoa jo varattua lähderiviä, ja jos voimassa olevilla keikoilla on silti useampi, kaikki merkitään "ei täsmää".
- **Rivin oma aika** pysyy kalustojakson sisällä: _kalusto lähtee ≤ rivin alku < rivin loppu ≤ kalusto takaisin_. **Poikkeus:** suoran siirron rivin varaus alkaa luovutushetkestä, joka saa olla ennen tämän keikan kaluston lähtöä (laite odottaa vastaanottavalla keikalla). Vastaanottavalla rivillä `start` tarkoittaa "tarvitaan alkaen": se määrää pelivaran, ja jos siirto ei täsmää, siitä tulee rivin varauksen alku. Siksi se pysyy kalustojakson sisällä kuten muutkin omat ajat; vain luovutushetki saa olla ennen kaluston lähtöä.
- **Rivin oma Lähti ja Palautettu** (`lineMarks`): myöhemmin lähtevä rivi (oma alku) ja aiemmin palaava rivi (oma loppu) merkitään erikseen. Muut rivit seuraavat keikan merkintöjä.
- **`awaitingReturn`** = kohde ei ole oma studio, keikka on vahvistettu tai lähtenyt, eikä keikkaa ole merkitty palautetuksi. Keikan Palautettu kattaa myös aiemmin palaavat rivit, joita ei ole merkitty erikseen.
- **Ladataan** koko kalusto, kohteet, paketit ja käyttäjät, keikat joiden `equipEnd` on viimeisten 60 päivän aikana tai tulevaisuudessa, sekä keikat joilla `awaitingReturn == true`. Laitekortin historia lasketaan näistä, joten yhdistelmäindeksejä ei tarvita.

### 2.4 Kohteiden lähtödata

- **Oma studio:** Iso studio, Pikku studio, Keittiöstudio, Pikku tarkkaamo ja Iso tarkkaamo (T4).
- **Clarion Hotel Helsinki**, Tyynenmerenkatu 2 (hotellin esite 2016, tarkista): Bysa 1–3, Sonck, Crusell, Tallberg, Sandis, Saukko, Brygga, Kraana, Bunkkeri, Hiili, Ulappa 1–2. Kohdekorttiin: "Ulappa 1–2 tornin 16. krs, kalusto hissillä". Lastaus- ja pysäköintiohjeet kirjataan ensimmäisen keikan jälkeen.

---

## 3. Näkymät

Puhelimen alapalkissa ovat **Tänään · Kalenteri · Kalusto · Taulu · Lisää** (Roudaukset, Asetukset).

| Näkymä           | Sisältö                                                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kalenteri**    | FullCalendar: kuukausi, viikko ja lista. Viikko alkaa maanantaista, viikkonumerot näkyvät, alustavat ovat vinoviivoitettuja ja päällekkäisyydestä on merkki                                                                                                                       |
| **Keikka**       | Perustiedot, kohdekortti ja neljä aikaa (syötetään itse). Rivit saatavuusmerkkeineen, rivin oma aika ("Mukana asti…" / "Tulee alkaen…"), suorat siirrot ja päällekkäisyydet. Vahvista, Lähti, Palautettu (myös rivikohtaiset oman ajan riveille), + Paketti ja Tallenna paketiksi |
| **Kalusto**      | Haku (tunnus, nimi, sarjanumero), kategoria ja Tilanne. Lisää ja Monista. **Laitekortti:** Missä nyt, Seuraavaksi, viimeisimmät keikat, kunto ja Siirretty tänne                                                                                                                  |
| **Kalustotaulu** | Laitteet × päivät (puhelimessa 1 viikko, muuten 2): keikkapalkit, suorat siirrot, huollot ja määrätavaroiden "vapaana/omistettu". Oma CSS-grid, ensimmäinen sarake kiinnitetty                                                                                                    |
| **Roudaukset**   | Laskettu päivälista: mitä lähtee, siirtyy suoraan ja palaa (myös kesken monipäiväisen keikan), milloin, mistä mihin ja kuka vastaa. Studion sisäisiä siirtoja ei listata                                                                                                          |
| **Tänään**       | Tämän päivän ja huomisen roudaukset merkintäpainikkeineen sekä **Korjattavaa**: punaiset päällekkäisyydet, palauttamattomat keikat ja aiemmin palaavat rivit, menneet alustavat, ohitetut huollon paluuajat, täsmäämättömät suorat siirrot ja vanha varmuuskopio                  |
| _Asetukset_      | Käyttäjät, kohteet, paketit ja Lataa varmuuskopio (JSON)                                                                                                                                                                                                                          |

Kosketusalueet ovat vähintään 48 px, värin rinnalla on aina teksti, päivämäärät muodossa "ti 1.12.2026", "klo 9.00" ja "vk 49", eikä 360 px:n leveydellä ole vaakavieritystä.

**"Vapaana"** tarkoittaa keikan rivillä vapaata määrää _muiden_ keikkojen jälkeen rivin varausjaksolla (oletuksena kalustojakso), ja taululla vapaata määrää _kaikkien_ varausten jälkeen. Molemmissa näytetään pienin arvo.

### 3.1 Esimerkkitilanne (luvut 3–5 ja testit; monipäiväinen esimerkki luvussa 4.6)

**Kalusto:** FX6-kamerat KAM-01…04, joista **KAM-03 on huollossa pe 4.12. klo 16.00 asti**. PTZ-01…03. XLR 10 m × 40. **Syötetyt ajoajat:** studio → Clarion 30 min, Clarion → Espoo 35 min (ajoaika syötetään suoran siirron riville; tyhjä = 0 min).

| Keikka                 | Paikka                    | Status      | Kalusto lähtee  | Tapahtuma      | Takaisin       | Kalusto                                 |
| ---------------------- | ------------------------- | ----------- | --------------- | -------------- | -------------- | --------------------------------------- |
| **A Lanseeraus**       | Oma studio › Iso studio   | Vahvistettu | ma 30.11. 11.00 | ma 12.00–16.00 | ma 17.00       | PTZ-01, PTZ-02, XLR × 10                |
| **W Webinaari X**      | Oma studio › Pikku studio | Vahvistettu | ti 1.12. 8.00   | ti 9.00–16.00  | ti 17.00       | KAM-01, KAM-02, XLR × 8                 |
| **B Hybridiseminaari** | Clarion › Bysa 2          | Alustava    | ma 30.11. 14.00 | ti 10.00–16.00 | ke 2.12. 12.00 | aluksi KAM-01, PTZ-01, PTZ-02, XLR × 20 |
| **C Asiakastilaisuus** | Asiakas Oy, Espoo         | Alustava    | ti 1.12. 14.00  | ke 9.00–12.00  | to 3.12. 12.00 | PTZ-01, PTZ-02, XLR × 12                |

### 3.2 Rautalankamalli: Keikka (läppäri), B ennen ratkaisuja (C:tä ei vielä ole)

```text
+------------------------------------------------------------------------------+
| < Kalenteri   Hybridiseminaari · Asiakas Oy           [Alustava v] [Vahvista]|
| Clarion Hotel Helsinki › Bysa 2  [Kohdekortti]   Vastuu: Mikko        vk 49  |
| Kalusto lähtee   ma 30.11. klo 14.00                                          |
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

### 4.2 Keikan luonti

1. **Kalenteri → ti 1.12. → Uusi keikka:** Hybridiseminaari, Clarion › Bysa 2, vastuu Mikko, tiimi Anna ja Jussi. Status on oletuksena Alustava.
2. **Ajat syötetään itse:** kalusto lähtee ma 30.11. klo 14.00, tapahtuma ti 10.00–16.00, kalusto takaisin ke 2.12. klo 12.00. Valmiita oletuksia ei ole: uuden keikan kellonajat ovat tyhjiä, ja kalenterista valittu päivä täyttyy päivämääriin. Lomake tarkistaa järjestyksen _lähtee ≤ alkaa < päättyy ≤ takaisin_.
3. **Lisää kalustoa:** haku "kam" näyttää jokaisen FX6:n saatavuuden rivin varausjaksolla (tässä kalustojakso). Mikko lisää KAM-01:n, PTZ-01:n, PTZ-02:n ja XLR × 20.
4. **Merkit näkyvät heti** (kuva 3.2). XLR on OK: muut keikat käyttävät B:n jaksolla enintään 10 kaapelia (A, ma 14.00–17.00), joten vapaana on vähintään 30/40.
5. **Tallenna.** Alustava keikka tallentuu varoituksista huolimatta.

### 4.3 Kaksi keikkaa haluaa KAM-01:n

- Vahvistettu W varaa KAM-01:n ti 8.00–17.00, alustava B ajalle ma 14.00 – ke 12.00. **B:llä näkyy keltainen varoitus**, W:llä "Alustava keikka Hybridiseminaari haluaa myös KAM-01:n".
- **B:n vahvistus estetään:** "KAM-01 on jo vahvistetulla keikalla Webinaari X (vahvistettu 20.11. klo 10.02, Anna). Vaihda laite tai poista rivi."
- **Vaihda laite** näyttää: KAM-02 (Webinaari X), KAM-03 (huollossa pe 4.12. klo 16.00 asti) ja **KAM-04 (vapaa)**. Mikko valitsee KAM-04:n.
- **Jos molemmat ovat alustavia,** varoitus näkyy kummallakin ja **ensimmäisenä vahvistanut voittaa**: Anna vahvistaa W:n klo 10.02, joten Mikon yritys klo 10.05 estetään samalla viestillä.
- **Jos molemmat vahvistetaan samalla sekunnilla,** kumpikin tallennus voi mennä läpi. Silloin molemmilla keikoilla ja Tänään-näkymässä näkyy punainen "Päällekkäin", kunnes joku ratkaisee sen. Viiden hengen tiimissä riski hyväksytään.

### 4.4 Suora siirto: studio → Clarion → seuraava keikka

1. **A → B:** A:n PTZ-varaus (ma 11.00–17.00) osuu B:n jaksoon (alkaa ma 14.00), ja A:n tapahtuma alkaa ennen B:n tapahtumaa. Sovellus kysyy: **"Tuleeko suoraan keikalta Lanseeraus?"** Mitään ei ketjuteta ilman hyväksyntää.
2. **Hyväksy.** Luovutus on oletuksena A:n tapahtuman loppu + 60 min eli ma 17.00 (muokattavissa), ja ajoajaksi syötetään 30 min. A:n rivi päättyy ja B:n alkaa klo 17.00, joten laite ei ole päällekkäin itsensä kanssa. **Pelivara** 17.00 + 30 min → ti 10.00 = **16 h 30 min**.
3. **B → C:** Jussi luo C:n (vastuu Jussi) ja valitsee riveille PTZ-01, PTZ-02 ja XLR × 12 "Tulee suoraan keikalta Hybridiseminaari". Luovutus ti 17.00, ajo 35 min → ke 9.00: **pelivara 15 h 25 min**. C ottaa B:n 20 kaapelista 12; loput 8 palaavat studiolle.
4. **Hyöty kaapeleissa:** ilman suoraa siirtoa ti 14.00–17.00 kysyntä olisi 20 + 8 + 12 = 40/40, vapaana 0. Suoran siirron kanssa C:n kaapelit ovat B:n kaapeleita, ja vapaana on vähintään 12.
5. **Vahvistus:** B:llä on KAM-04, PTZ-01 ja PTZ-02 (← A, → C) ja XLR × 20 (12 → C). Vahvistettujen kysyntä on enimmillään 30/40 (ma 14.00–17.00: A 10 + B 20), joten B:n voi vahvistaa. C jää alustavaksi.
6. **Roudaukset:**

```text
ma 30.11. 14.00 Oma studio → Clarion › Bysa 2      Hybridiseminaari: KAM-04, XLR ×20       Mikko
          17.00 Oma studio › Iso studio → Clarion › Bysa 2  SUORA A → B: PTZ-01, PTZ-02 (30 min)  Mikko
ti 1.12.  17.00 Clarion › Bysa 2 → Asiakas Oy      SUORA B → C: PTZ-01, PTZ-02, XLR ×12    Jussi
ke 2.12.  12.00 Clarion › Bysa 2 → Oma studio      Hybridiseminaari: KAM-04, XLR ×8        Mikko
to 3.12.  12.00 Asiakas Oy → Oma studio            Asiakastilaisuus: PTZ-01, PTZ-02, XLR ×12  Jussi
```

Lähdöstä ja paluusta vastaa keikan vastuuhenkilö, suorasta siirrosta vastaanottavan keikan vastuuhenkilö.

7. **Jos C perutaan,** B:n rivit palaavat B:n omiin aikoihin (takaisin ke 12.00), ja Tänään näyttää "Suoran siirron keikka peruttu, tarkista roudaus". Samoin, jos aikoja muutetaan niin, ettei luovutus enää osu lähderivin varaukseen tai ole ennen vastaanottavan keikan ja rivin loppua (sääntö 4): siirto jätetään laskennassa huomiotta ja merkitään "ei täsmää", kunnes luovutusaika korjataan.

### 4.5 Lähti, Palautettu ja "missä nyt"

1. **Lähti:** KAM-04 ja kaapelit lähtevät ma 14.10, ja Mikko painaa B:llä **Lähti**. Lähti on mahdollinen vain vahvistetulla keikalla.
2. **Missä nyt:**
   - KAM-04 ma 13.30: "Oma studio, lähdössä keikalle Hybridiseminaari klo 14.00". Ma 15.00: "Clarion › Bysa 2, Hybridiseminaari (lähti 14.10, Mikko)".
   - PTZ-01 ma 16.00: "Oma studio › Iso studio, Lanseeraus. Seuraavaksi suora siirto Hybridiseminaariin klo 17.00". Ma 17.15: "Matkalla Lanseeraus → Hybridiseminaari, perillä noin 17.30". Ti 12.00: "Clarion › Bysa 2", seuraavaksi "suora siirto Asiakastilaisuuteen ti 17.00".
   - Jos todellisuus poikkeaa, **Siirretty tänne** tallentaa tekstin, esim. "Mikon auto". Se näkyy laskennallisen sijainnin rinnalla, kunnes laitteelle tulee uudempi merkintä tai joku kuittaa sen pois.
3. **Palautettu** ke 12.30 vapauttaa B:n kaluston, joka ei jatka toiselle keikalle (KAM-04 ja XLR × 8), ja muuttaa statuksen Valmiiksi. Jos jotain puuttuu, keikkaa ei merkitä palautetuksi.
4. **Palauttamatta:** merkitsemättömän B:n kalusto pysyy varattuna. Vahvistettu studiokeikka **D Tuotevideo** (Keittiöstudio, to 3.12., kalusto klo 8.00–17.00) haluaa KAM-04:n, joten to 9.00 D:llä näkyy punaisena "KAM-04 ei ole palautettu keikalta Hybridiseminaari (myöhässä 21 h)". Alustavalla D:llä merkki olisi keltainen. Tänään-näkymässä on **Merkitse palautetuksi**.
5. **Oman studion keikoilla** merkintöjä ei tarvita. **Lähtenyttä keikkaa** ei voi perua ennen Palautettu-merkintää.

### 4.6 Monipäiväinen keikka, josta osa lähtee kesken

**E Messut**, Clarion › Bysa 1, vahvistettu, vastuu Anna. Kalusto lähtee su 6.12. klo 14.00, tapahtuma ma 7.12. klo 9.00 – ti 8.12. klo 16.00, kalusto takaisin ke 9.12. klo 12.00. Kalusto: KAM-01, KAM-02, PTZ-03, XLR × 16.

**F Studiohaastattelu**, Oma studio › Pikku studio, vahvistettu, vastuu Jussi. Kalusto ti 8.12. klo 8.00–13.00, tapahtuma 9.00–12.00. Tarvitsee KAM-01:n.

1. **Ilman siirtoa** KAM-01 on E:llä ke 12.00 asti, joten F:llä näkyy punainen "Päällekkäin: Messut", ja F:n tallennus vahvistettuna estetään.
2. **Suora siirto kesken keikan:** F:n KAM-01-rivillä "Tulee suoraan keikalta Messut", luovutus **ma 7.12. klo 18.00** (ensimmäisen päivän ilta), ajoaika 30 min. Luovutus on E:n rivin aikana (su 14.00 < ma 18.00 ≤ ke 12.00) ja ennen F:n loppua, joten siirto on kelvollinen. Se on ennen F:n kaluston lähtöä, mikä on suoralle siirrolle sallittua: KAM-01 odottaa studiolla. (Oletusluovutus olisi ollut ti 8.00, koska E:n tapahtuman loppu + 60 min = ti 17.00 on F:n tapahtuman lopun jälkeen; Jussi vaihtoi sen.) **Pelivara** ma 18.30 → ti 9.00 = **14 h 30 min**. Päällekkäisyys poistuu.
3. **Aiempi paluu studiolle:** PTZ-03 tarvitaan vain maanantaina. E:n PTZ-03-rivin oma aika: **mukana ma 7.12. klo 19.00 asti**. PTZ-03 on vapaa muille ma 19.00 alkaen, kun paluu merkitään. Merkitsemättä se jää varaamaan, ja tiistain vahvistettu keikka, joka haluaa PTZ-03:n, näkee punaisen "PTZ-03 ei ole palautettu keikalta Messut".
4. **Roudaukset:**

```text
su 6.12.  14.00 Oma studio → Clarion › Bysa 1            Messut: KAM-01, KAM-02, PTZ-03, XLR ×16   Anna
ma 7.12.  18.00 Clarion › Bysa 1 → Oma studio › Pikku st. SUORA Messut → Studiohaastattelu: KAM-01   Jussi
          19.00 Clarion › Bysa 1 → Oma studio            Messut, aiempi paluu: PTZ-03 [Palautettu] Anna
ke 9.12.  12.00 Clarion › Bysa 1 → Oma studio            Messut: KAM-02, XLR ×16                   Anna
```

5. **Kalustotaulu:** KAM-01:n rivillä on palkki [Messut] su 14.00 – ma 18.00 ja sen perässä "> [Studiohaastattelu]" ma 18.00 – ti 13.00. PTZ-03:n palkki päättyy ma klo 19.00.
6. **Missä nyt:** KAM-01 ti 10.00 on "Oma studio › Pikku studio, Studiohaastattelu". PTZ-03 ma 20.00 on "Palauttamatta: Messut (piti palata ma 19.00)" tai merkinnän jälkeen "Oma studio".

Jos kalustoa **tulee myöhemmin** (esim. lisävalot vasta tiistaiksi), rivin oma alku on ti 7.00, ja Roudaukset näyttää sille oman lähdön ja rivikohtaisen Lähti-painikkeen.

Jos kalustoa tulee kesken keikan **toiselta keikalta**, vastaanottavalle riville annetaan "tarvitaan alkaen" (esim. ti 7.00), ja pelivara lasketaan siihen.

---

## 5. Saatavuus- ja konfliktisäännöt

Logiikka on kansiossa `src/core`: puhtaita funktioita ilman Firebase- ja React-riippuvuuksia, testattuina ennen käyttöliittymää. Tulokset lasketaan uudelleen aina datan muuttuessa ja kerran minuutissa, jotta myöhästyneet palautukset muuttuvat punaisiksi ilman sivun latausta.

### 5.1 Säännöt

1. **Aikavälit ovat puoliavoimia `[alku, loppu)`**: klo 17.00 päättyvä ja klo 17.00 alkava eivät ole päällekkäin.
2. **Helsingin aika:** lomakeajat muunnetaan apufunktioilla `helsinkiLocalToInstant()` ja `instantToHelsinkiLocal()`, jotka tehdään `Intl.DateTimeFormat`-pohjaisiksi (dayjs:n `tz()`-funktiossa on tunnettuja kesäaikabugeja). 28.3.2027 klo 3.00–3.59 ei ole olemassa, ja lomake ilmoittaa siitä. 25.10.2026 ja 31.10.2027 klo 3.00–3.59 toistuvat, ja valitaan aiempi (kesäaika). Taulun päivät lasketaan Helsingin kalenteripäivinä, ei 24 tunnin lisäyksinä.
3. **Rivin varaus** alkaa kelvollisen suoran siirron luovutuksesta, muuten rivin omasta alusta tai kaluston lähdöstä, ja päättyy rivin omaan loppuun tai kaluston paluuseen. Lähderivillä vastaanottajan ottama määrä päättyy luovutukseen ja loput rivin loppuun.
4. **Suora siirto on kelvollinen**, jos molemmat keikat ovat voimassa, lähderivi on olemassa samalla laitteella, määrä riittää, lähderivillä on voimassa olevilla keikoilla täsmälleen yksi vastaanottaja, `from`-ketjussa ei ole kehää, _lähderivin alku < luovutus ≤ lähderivin loppu_ sekä _luovutus < B:n tapahtuman loppu_ ja _luovutus < vastaanottavan rivin loppu_. Luovutus voi siis olla myös kesken monipäiväisen keikan. Muuten siirto ohitetaan ja merkitään "ei täsmää".
5. **Palauttamaton kalusto varaa toistaiseksi**, kun keikka ei ole omassa studiossa, on vahvistettu, valmis tai lähtenyt, rivi ei ole palautettu ja _nyt ≥ rivin loppu_. Aiemmin palaavan rivin (oma loppu) palautus merkitään rivikohtaisesti (`lineMarks`), muut keikan Palautettu-merkinnällä; keikan Palautettu kattaa myös merkitsemättömät aiemmin palaavat rivit. Ennen loppua merkitty palautus päättää varauksen.
6. **Kunto** Huollossa tai Rikki varaa koko määrän paluuaikaan asti tai toistaiseksi. Arkistoidun kapasiteetti on 0, eikä arkistoidun laitteen kunto synnytä päällekkäisyyttä. Peruttu keikka ei vaikuta, ellei se ole lähtenyt ja palauttamatta.
7. **Vakavuus** lasketaan jokaiselle aikajaksolle erikseen. **Päällekkäin (punainen):** ylitys syntyy jo vahvistetuista, valmiista ja lähteneistä keikoista, kunnosta ja palauttamattomasta kalustosta. **Varoitus (keltainen):** alustavat keikat aiheuttavat ylityksen tai lisäävät sitä.
8. **Pelivara** = _tarvitaan − luovutus − ajoaika_, missä _tarvitaan_ on vastaanottavan rivin "tarvitaan alkaen" tai B:n tapahtuman alku. Alle 0 näytetään punaisena "Ei ehdi". Jos luovutus on B:n tapahtuman alun jälkeen eikä "tarvitaan alkaen" ole annettu, näytetään "Saapuu kesken tapahtuman klo X" ilman punaista. Pelivara ei estä tallennusta.
9. **Ensin vahvistanut voittaa (L5):** keltaiset varoitukset eivät estä mitään, joten alustava keikka tallentuu niistä huolimatta. Tallennus estetään, jos se synnyttää **uuden** punaisen yhdistelmän (laite + kilpailijat tai kunto). Tavallisesti näin käy vain vahvistetulla tai vahvistettavalla keikalla, mutta myös alustavan keikan suoran siirron muutos voi pidentää vahvistetun lähderivin varausta, joten tarkistus tehdään jokaiselle keikan tallennukselle. "Ennen" on tallennettu tilanne, "jälkeen" tilanne muutoksen kanssa, molemmat samalla hetkellä. Punainen jakso on **vanha**, jos samalla laitteella oli ennen ajallisesti päällekkäinen punainen jakso, jonka lähteet sisältävät kaikki sen lähteet. Olemassa oleva päällekkäisyys ei siis estä muita muutoksia, kolmen keikan päällekkäisyydestä poistumista eikä sen lyhentämistä, mutta sama pari uudella, erillisellä ajalla estetään.
10. **Faktojen kirjaamista ei estetä:** kunto, Lähti, Palautettu ja Siirretty tänne tallentuvat aina, ja seuraukset näkyvät päällekkäisyyksinä. Myöskään perumista ei estetä päällekkäisyyksien takia.
11. **Suoran siirron ehdotus** näytetään, kun rivi osuu saman laitteen varaukseen keikalla, jonka tapahtuma alkaa ennen tämän keikan tapahtumaa. Luovutuksen oletus on ensimmäinen sääntöön 4 sopiva näistä: lähdekeikan tapahtuman loppu + 60 min, lähderivin loppu tai tämän keikan kaluston lähtö (esim. monipäiväinen lähdekeikka). Jos mikään ei sovi, kenttä jää tyhjäksi ja käyttäjä syöttää sen. Käyttäjä muuttaa sen tarvittaessa (luvussa 4.6 ma 18.00).
12. **Rivin oma aika** ei saa ylittää keikan kalustojaksoa (lomake). Poikkeus: suoran siirron luovutus saa olla ennen kaluston lähtöä.

### 5.2 Pseudokoodi

```ts
type Ms = number // UTC-ms, puoliavoin [start, end)
interface Demand {
  start: Ms
  end: Ms
  qty: number
  firm: boolean
  src: string
} // src = gigId | 'kunto'
const cmp = (a: Ms, b: Ms) => (a < b ? -1 : a > b ? 1 : 0) // ±Infinity vain muistissa
const live = (g?: Gig) => !!g && (g.status !== 'peruttu' || (!!g.departedAt && !g.returnedAt))
const firm = (g: Gig) => ['vahvistettu', 'valmis'].includes(g.status) || !!g.departedAt

const lineEnd = (g: Gig, l: Line) => l.end ?? g.equipEnd
const lineStart = (g: Gig, l: Line, x: Ctx): Ms =>
  validFrom(g, l, x) ? l.from!.handoverAt : (l.start ?? g.equipStart)

function validFrom(b: Gig, r: Line, x: Ctx): boolean {
  // sääntö 4, tulos muistiin x.memo
  if (!r.from || x.inCycle(r.id)) return false // from-ketju seurataan visited-joukolla
  const a = x.gig(r.from.gigId),
    s = a?.lines.find((l) => l.id === r.from!.lineId),
    h = r.from.handoverAt
  return (
    !!s &&
    live(a) &&
    live(b) &&
    s.itemId === r.itemId &&
    r.qty <= s.qty &&
    x.receiversOf(s.id).filter((l) => live(x.gigOf(l))).length === 1 && // useampi → kaikki "ei täsmää"
    lineStart(a!, s, x) < h &&
    h <= lineEnd(a!, s) && // lähderivin varauksen aikana
    h < b.eventEnd &&
    h < lineEnd(b, r)
  ) // ennen vastaanottajan loppua
}

function lineDemands(g: Gig, l: Line, x: Ctx): Demand[] {
  const f = firm(g),
    start = lineStart(g, l, x)
  const out = x.validReceiverOf(l.id),
    sent = out?.qty ?? 0
  const ret = l.end ? (g.lineMarks?.[l.id]?.returnedAt ?? g.returnedAt) : g.returnedAt // oma merkintä
  let end = lineEnd(g, l)
  if (ret && ret < end)
    end = ret // aikainen palautus
  else if (!ret && f && !x.ownStudio(g) && x.now >= end) end = Infinity // palauttamatta
  return [
    { start, end, qty: l.qty - sent, firm: f, src: g.id }, // jää keikalle
    { start, end: out?.from!.handoverAt ?? start, qty: sent, firm: f, src: g.id },
  ] // jatkaa suoraan
    .filter((d) => d.qty > 0 && d.start < d.end)
}

function demandsFor(it: Item, x: Ctx): Demand[] {
  const d =
    it.condition === 'ok' || it.archived // arkistoidun kapasiteetti on jo 0
      ? []
      : [
          {
            start: -Infinity,
            end: it.conditionUntil ?? Infinity,
            qty: it.quantity,
            firm: true,
            src: 'kunto',
          },
        ]
  for (const g of x.gigs)
    if (live(g)) for (const l of g.lines) if (l.itemId === it.id) d.push(...lineDemands(g, l, x))
  return d
}

// Jaksot kaikkien alku- ja loppuhetkien välissä; saman hetken loppu ja alku eivät ole yhtä aikaa.
function segments(it: Item, ds: Demand[]): Seg[] {
  const cap = it.archived ? 0 : it.quantity,
    out: Seg[] = []
  const ts = [...new Set(ds.flatMap((d) => [d.start, d.end]))].sort(cmp)
  for (let i = 0; i + 1 < ts.length; i++) {
    const act = ds.filter((d) => d.start <= ts[i] && ts[i] < d.end)
    const firmUse = sum(act.filter((d) => d.firm)),
      allUse = sum(act)
    const red = firmUse > cap,
      yellow = allUse - cap > Math.max(0, firmUse - cap)
    if (red || yellow)
      out.push({
        start: ts[i],
        end: ts[i + 1],
        red,
        yellow,
        free: cap - allUse,
        redSrcs: red ? srcs(act.filter((d) => d.firm)) : [],
        allSrcs: srcs(act),
      })
  }
  return mergeAdjacent(out)
}

// Punaiset jaksot; srcs() palauttaa lajitellut, yksilölliset id:t
const redSegments = (x: Ctx) =>
  x.items.flatMap((it) =>
    segments(it, demandsFor(it, x))
      .filter((s) => s.red)
      .map((s) => ({ itemId: it.id, start: s.start, end: s.end, srcs: s.redSrcs })),
  )

// Sääntö 9: jokaiselle keikan tallennukselle (ei perumiselle eikä säännön 10 faktoille), sama now.
// Jakso on vanha, jos samalla laitteella oli ajallisesti päällekkäinen punainen jakso,
// jonka lähteet sisältävät kaikki sen lähteet. Palauttaa uudet yhdistelmät, esim. 'KAM-01|B,W'.
function blockingOnSave(before: RedSeg[], after: RedSeg[]): string[] {
  const existed = (a: RedSeg) =>
    before.some(
      (b) =>
        b.itemId === a.itemId &&
        b.start < a.end &&
        a.start < b.end &&
        a.srcs.every((x) => b.srcs.includes(x)),
    )
  return unique(after.filter((a) => !existed(a)).map((a) => `${a.itemId}|${a.srcs.join(',')}`))
}
```

**Vapaana-luvut** lasketaan samoista varauksista funktiolla `freeTimeline(it, ds, ikkuna, ilmanKeikkaa?)`, joka palauttaa kaikki jaksot (ei vain punaisia ja keltaisia). Keikan rivillä oma keikka jätetään pois ja ikkuna on rivin varausjakso; taululla ikkuna on Helsingin kalenteripäivä.

Laskenta on suoraviivainen eikä optimoitu: laitteella on kymmeniä varauksia, joten 200 laitetta lasketaan millisekunneissa.

**Missä nyt** (laitteelle, hetkellä _t_): haetaan rivi, jonka varaus kattaa hetken. Suorasta siirrosta tullut rivi on "Matkalla A → B" välillä _luovutus … luovutus + ajoaika_ ja sen jälkeen B:n paikassa. Rivillä, jolla on oma alku, lähtö luetaan rivin omasta Lähti-merkinnästä: siihen asti laite on "Oma studio, lähdössä keikalle X". Aiemmin palaava rivi on oman loppunsa jälkeen "Palauttamatta: X", kunnes rivi tai keikka merkitään palautetuksi. Muuten oman studion keikalla laite on keikan tilassa, lähteneellä keikalla keikan paikassa, lähtemättömällä "Oma studio, lähdössä" ja palauttamattomalla "Palauttamatta: X". Ilman riviä laite on kotipaikassa. "Siirretty tänne" näytetään rinnalla, jos se on uudempi kuin laitteen viimeisin Lähti, Palautettu tai ohitettu luovutus. **Määrätavaralle** näytetään jakauma, esim. "12 Asiakas Oy · 8 Clarion, palaa ke 12.00 · 20 Oma studio".

**Tilanne:** Pois käytöstä → Palauttamatta → Keikalla → Vapaa.

**Roudaukset:** lähtö rivin alussa (ellei rivi tule suorasta siirrosta), suora siirto luovutushetkellä ja paluu rivin lopussa sille määrälle, joka ei jatka. Oman ajan riveille näytetään rivikohtainen Lähti- tai Palautettu-painike. Siirto listataan, jos jompikumpi pää on studion ulkopuolella, ja saman ajan ja reitin rivit ryhmitellään.

### 5.3 Testit (Vitest)

Testit ajetaan myös asetuksilla `TZ=UTC` ja `TZ=America/New_York`, jotta koodi ei riipu koneen aikavyöhykkeestä.

- **Rajat:** 17.00 loppu ja 17.00 alku eivät ole päällekkäin, minuutin päällekkäisyys on.
- **KAM-01:** B saa varoituksen ja sen vahvistus estyy; KAM-04:llä onnistuu; KAM-03 estää pe 15.59 asti, pe 16.00 alkava on OK; ensimmäinen vahvistus voittaa; vanha päällekkäisyys ei estä muistiinpanon tallennusta.
- **XLR ma–pe** (luvun 4.4 jälkeen: A, W ja B vahvistettuja, C alustava): kaikki mukana 10, 12, 20, 28, 40 /40; vain vahvistetut 10, 12, 32, 40, 40 /40; ilman B → C -siirtoa ti 14.00–17.00 vapaana 0.
- **Vakavuus:** vahvistetut ylittävät jaksolla [t1, t2) ja alustava lisää ylityksen jaksolle [t2, t3) → [t2, t3) on keltainen.
- **Suorat siirrot:** pelivarat 16 h 30 min ja 15 h 25 min; "Ei ehdi" (luovutus 9.40, ajo 30 min, tapahtuma 10.00); peruttu C palauttaa B:n rivin loppumaan ke 12.00; luovutus lähderivin varauksen ulkopuolella, poistettu lähderivi, kaksi voimassa olevaa vastaanottajaa (molemmat), vastaanottavan rivin oma loppu ennen luovutusta ja itseensä tai toisiinsa viittaavat rivit (kehä) → "ei täsmää", ja kehä ei kaada laskentaa; peruttu vastaanottaja ei estä uutta; osamäärä 12/20 jättää 8 B:lle; kesken tapahtuman saapuva rivi ilman "tarvitaan alkaen" → "Saapuu kesken tapahtuman", ei punaista; alustavan C:n luovutuksen siirto myöhemmäksi, joka tekee vahvistetusta B:stä punaisen, estetään.
- **Palauttamatta:** KAM-04 to 9.00 punainen vahvistetulla D:llä ("myöhässä 21 h"), keltainen alustavalla; ke 11.59 ei vielä; alustava lähtemätön ja oman studion keikka eivät jää varaamaan; aikainen Palautettu vapauttaa.
- **Missä nyt:** luvun 4.5 kohdat.
- **Monipäiväinen (luku 4.6):** KAM-01:n luovutus ma 18.00 kesken Messujen on kelvollinen ja pelivara 14 h 30 min; ilman siirtoa KAM-01 on punainen Studiohaastattelun kanssa; PTZ-03 on vapaa ma 19.00 alkaen, kun rivi on merkitty palautetuksi, ja merkitsemättä (now = ti 9.00) punainen tiistain vahvistetulle keikalle; keikan Palautettu kattaa merkitsemättömän rivin; myöhemmin lähtevä rivi on "Oma studio, lähdössä" ennen rivin Lähti-merkintää; luovutus ennen lähderivin alkua tai sen oman lopun jälkeen → "ei täsmää"; rivin oma aika jakson ulkopuolella hylätään, mutta luovutus ennen kaluston lähtöä hyväksytään.
- **Aika:** keikka la 27.3.2027 14.00 – ma 29.3. 12.00 = **45 h**; 28.3.2027 klo 3.30 hylätään; 31.10.2027 klo 3.30 = 00.30 UTC; taulun päivä 28.3.2027 on 23 h ja 31.10.2027 25 h; "ti 1.12.2026 klo 9.00", "vk 49".
- **Katselmoinnin regressiot:** "tarvitaan alkaen" kalustojakson ulkopuolella hylätään; määrätavaralla saa olla useita rivejä, laitteella ei; arkistoitu tai määrää pienennetty laite ei estä vanhan rivin tallennusta; arkistoidun laitteen kunto ei ole päällekkäisyys; kolmen keikan päällekkäisyydestä poistuminen ja sen lyhentäminen eivät esty; luovutus tasan lähderivin alussa ei täsmää; oletusluovutus putoaa lähderivin loppuun tai jää tyhjäksi; vuodet 2000–2100.
- **Valinnainen fast-check:** satunnaisilla varauksilla `segments` antaa joka minuutille saman vakavuuden kuin minuuttikohtainen laskenta.
- **Säännöt (emulaattori):** listalla oleva pääsee, listaamaton ei lue eikä kirjoita, isoja kirjaimia sisältävä osoite löytää pienikirjaimisen dokumentin; kalustoa ja vahvistettua keikkaa ei voi poistaa; omaa osoitetta ei voi poistaa listalta; väärässä järjestyksessä olevat ajat ja puuttuva `updatedBy`/`updatedAt` hylätään; muut polut on kielletty.

---

## 6. Tekniikka

### 6.1 Kirjastot

| Kerros           | Valinta                                                                                   | Lisenssi           |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------ |
| Sovellus         | Vite + React 19 + TypeScript (strict), React Router                                       | MIT; TS Apache-2.0 |
| UI               | Mantine 9.8 (`core`, `dates`, `form`, `notifications`)                                    | MIT                |
| Kalenteri        | FullCalendar Standard 7.1 (`fi`, `timeZone: 'Europe/Helsinki'`, peer `temporal-polyfill`) | MIT                |
| Kalustotaulu     | Oma CSS-grid-komponentti                                                                  | –                  |
| Päivämäärät      | Omat `Intl`-pohjaiset apufunktiot (`src/core/time.ts`), ei päivämääräkirjastoa            | –                  |
| Tiedon tarkistus | Zod 4, vain `src/data` (ei `src/core`)                                                    | MIT                |
| Laatu            | TypeScript 7 (strict, `exactOptionalPropertyTypes`), oxlint tyyppitietoisena, Prettier    | MIT                |
| Ajoympäristö     | Node 24 LTS, pnpm 10 (`minimumReleaseAge` 3 pv), Dependabot                               | –                  |
| Firebase         | JS SDK 13 (Auth, Firestore)                                                               | Apache-2.0         |
| Testit           | Vitest, Emulator Suite, `@firebase/rules-unit-testing`, valinnaisesti fast-check          | MIT, Apache-2.0    |

Yksi sovellus: puhdas logiikka `src/core`, Firebase ja reaaliaikaiset kuuntelijat `src/data`, näkymät `src/views`, tekstit `src/fi.ts`. `src/data` validoi jokaisen luetun ja kirjoitettavan dokumentin kokoelmakohtaisella Zod-skeemalla ja muuntaa `Timestamp`-arvot millisekunneiksi; `src/core` ei tuo Zodia, Firebasea eikä Reactia, ja oxlint valvoo tätä.

### 6.2 Firebasen käyttöönotto

1. **Firestore (Standard)** alueelle **europe-north1**. Aluetta ei voi vaihtaa jälkikäteen.
2. **Authentication → Google.** Projektin `<id>.web.app`, `<id>.firebaseapp.com` ja `localhost` ovat valmiiksi sallittuja; vain oma verkkotunnus pitäisi lisätä.
3. **`signInWithPopup`**, koska redirect ei toimi selaimissa, jotka estävät kolmannen osapuolen tallennuksen. `authDomain` asetetaan sovelluksen omaksi osoitteeksi (`<id>.web.app`).
4. **Ensimmäinen `allowedUsers`-dokumentti** luodaan konsolissa, muut Asetuksissa. Osoite kirjoitetaan pienillä kirjaimilla niin kuin Google-tili sen näyttää. Viimeistä käyttäjää ei voi poistaa. Listaamaton näkee: "Osoitetta x@gmail.com ei ole listalla. Pyydä joku tiimistä lisäämään se."
5. **Hosting** ohjaa kaikki reitit `index.html`-tiedostoon. `index.html` ei jää välimuistiin (`Cache-Control: no-cache`), tiivisteelliset `/assets/**`-tiedostot saavat pitkän välimuistin (`max-age=31536000, immutable`), ja mukana ovat turvaotsakkeet `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` ja `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Google-popup toimii). CSP otetaan ensin käyttöön vain raportoivana (`Content-Security-Policy-Report-Only`). Jos julkaisun jälkeen avoin välilehti ei löydä vanhaa koodipalaa, sovellus latautuu uudelleen (`vite:preloadError`). Kehitys tehdään emulaattoreilla.

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
    function d() { return request.resource.data; }
    function stamped() {
      return d().updatedBy == request.auth.token.email.lower() && d().updatedAt == request.time;
    }
    function validItem() {
      return d().tag is string && d().tag.size() > 0 && d().name is string
        && d().quantity is int && d().quantity >= 1
        && d().condition in ['ok', 'huollossa', 'rikki'] && d().archived is bool && stamped();
    }
    function validGig() {
      return d().status in ['alustava', 'vahvistettu', 'valmis', 'peruttu']
        && d().equipStart is timestamp && d().eventStart is timestamp
        && d().eventEnd is timestamp && d().equipEnd is timestamp
        && d().equipStart <= d().eventStart && d().eventStart < d().eventEnd
        && d().eventEnd <= d().equipEnd
        && d().lines is list && d().lines.size() <= 300
        && d().awaitingReturn is bool && stamped();
    }

    match /allowedUsers/{email} {
      allow read: if allowed();
      allow create, update: if allowed() && email == email.lower();
      allow delete: if allowed() && email != request.auth.token.email.lower(); // ei itseään
    }
    match /settings/{doc}      { allow read, write: if allowed(); }
    match /locations/{id}      { allow read, create, update: if allowed(); allow delete: if false; }
    match /packages/{id}       { allow read, write: if allowed(); }
    match /items/{id} {
      allow read: if allowed();
      allow create, update: if allowed() && validItem();
      allow delete: if false; // arkistoidaan
    }
    match /gigs/{id} {
      allow read: if allowed();
      allow create, update: if allowed() && validGig();
      allow delete: if allowed() && resource.data.status == 'alustava'; // muuten perutaan
    }
    // Kaikki muu on oletuksena kielletty.
  }
}
```

Rooleja ei ole, joten säännöt rajaavat pääsyn sallittujen listaan, estävät poistot (kalusto arkistoidaan, vahvistettu keikka perutaan) ja tarkistavat tärkeimmät tietotyypit ja aikajärjestyksen. Tarkempi rakenne tarkistetaan Zod-skeemoilla `src/data`-kerroksessa.

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
2. **`src/core` ensin:** aika-apurit, varaukset (myös rivin oma aika), jaksot, vakavuus ja "ensin vahvistanut voittaa". Luvun 5.3 testit vihreinä ennen näkymiä.
3. **Kalusto:** lista, lisäys, Monista, kunto, arkistointi ja laitekortti.
4. **Keikat:** ajat, rivit ja rivin oma aika, saatavuusmerkit, Vaihda laite ja vahvistus.
5. **Näkymät** Kalenteri, Keikka, Kalusto ja Kalustotaulu sekä **Asetukset** (käyttäjät, kohteet, JSON-kopio).

**Valmis, kun** tiimi suunnittelee oikeat keikkansa sovelluksessa ja päällekkäisyydet vastaavat todellisuutta.

### Vaihe 1b: Liike ja arki

1. **Suora siirto:** ehdotus, luovutus (myös kesken monipäiväisen keikan), ajoaika, osamäärä ja "ei täsmää".
2. **Lähti, Palautettu** (myös aiemmin palaavalle riville), **Siirretty tänne** ja Missä nyt.
3. **Roudaukset ja Tänään.**
4. **Paketit** (Asetuksissa ja keikalla).
5. **Puhelintesti:** kirjautuminen iOS Safarilla (myös kotinäytön sovelluksena) ja Android Chromella, keikkasivu 360 px:n leveydellä.

**Valmis, kun** tiimi on käyttänyt sovellusta muutaman viikon kaikilla keikoillaan ilman lukuvirheitä.

### Vaihe 2: Helpotukset

- Kopioi keikka (myös ajat ja "lisää kalusto keikalta…") ja tulostettava pakkauslista.
- Kohdekorttien täydennys.
- Valinnainen **Hyväksy päällekkäisyys** muistiinpanolla: keikkojen välinen päällekkäisyys näkyy harmaana ja sallii tallennuksen. Kunnon ja palauttamattoman kaluston päällekkäisyys pysyy punaisena. Uusi vahvistettu kilpailija ei voi liittyä huomaamatta, koska sen oma tallennus estetään.

### Myöhemmin (tarpeen mukaan)

QR-tarrat (tunnus sopii tarraan sellaisenaan) · offline-tila · taulukkotuonti · pohjapiirros · ajoneuvot ja kuormatila · laukut sisältöineen · kuvat ja ohjeet (Storage, vaatii Blazen) · muutoshistoria · studiotilan tuplavarausvaroitus · rivikohtaiset palautukset muillekin kuin aiemmin palaaville riveille · tuleva huolto kuntoon · muistutukset ja iCal · ajoaikojen laskenta · monipäiväisen keikan päiväkohtaiset tilat (nyt sama paikka koko keikan) · laitteen paluu samalle keikalle kesken keikan.

---

## 8. Riskit

| Riski                                           | Hallinta                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saatavuuslaskenta on väärin, ja luottamus menee | Logiikka testataan ensin, esimerkkiluvut ovat testitapauksia, ja laskenta on suoraviivainen                                                                                                       |
| Kesäaikavirheet                                 | Yksi testattu apufunktiopari, päivät Helsingin keskiöistä, testit kolmella vyöhykkeellä                                                                                                           |
| Palautettu-merkintä unohtuu                     | Kalusto pysyy tarkoituksella varattuna; Tänään-listalla korjaus yhdellä napautuksella                                                                                                             |
| Samanaikainen vahvistus                         | Hyväksytty riski; päällekkäisyys näkyy punaisena kaikkialla                                                                                                                                       |
| Google-popup ei toimi jossain puhelimessa       | Testataan vaiheen 1a alussa. Varalla redirect: `authDomain` on sovelluksen osoite, ja `https://<id>.web.app/__/auth/handler` lisätään Google Cloud Consolessa OAuth-asiakkaan uudelleenohjauksiin |
| Kuka tahansa voi muuttaa mitä tahansa           | Arkistointi poiston sijaan, keskeytyvä tallennus ristiinmuokkauksessa, JSON-kopio                                                                                                                 |

---

## 9. Tarkentavat vastaukset T1–T5 (23.11.2026)

| #   | Kysymys              | Vastaus                                                                      | Vaikutus                                                    |
| --- | -------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Tunnusmuoto          | "KAM-03" kelpaa                                                              | Monista ehdottaa seuraavaa numeroa                          |
| 2   | Aikapohjat           | Ei oletuksia, ajat syötetään itse                                            | Ei aikapohjia; Kopioi keikka (vaihe 2) tuo ajat halutessa   |
| 3   | Kiinteät asennukset  | Ei ole                                                                       | Ei erillistä käsittelyä                                     |
| 4   | Studion tilat        | Iso studio, Pikku studio, Keittiöstudio, Pikku tarkkaamo, Iso tarkkaamo      | Kohteen "Oma studio" tilalista (luku 2.4)                   |
| 5   | Monipäiväiset keikat | Samassa paikassa, joskus kaksi päivää; osa kalustosta lähtee välillä muualle | Rivin oma aika ja luovutus kesken keikan (luvut 4.6 ja 5.1) |

Avoimia kysymyksiä ei ole. Ennen vaihetta 1a tarvitaan vain Firebase-projekti, jonka käyttäjä luo omalla Google-tilillään ohjeiden mukaan.

---

## Muutokset laajaan suunnitelmaan verrattuna

**Poistettu tai kevennetty:**

- Roolit, Microsoft, sähköpostilinkit, freelancerit ja roolikohtaiset säännöt → Google-tilit, sallittujen lista, yksi sääntö.
- Tietosuojaseloste, säilytysajat ja yhteistoimintaselvitys.
- Mallit, yksilöt, kulutustavarat, laukut ja vuokrayksilöt → yksi `items`-kokoelma.
- Varastopaikat, ajoneuvot, siirto-osuudet, yksilökuittaukset ja liikeloki → Lähti, Palautettu, Siirretty tänne ja laskettu roudauslista.
- Seitsemän aikavaihetta → neljä itse syötettävää aikaa; aikapohjat jätettiin pois käyttäjän toiveesta.
- Cloud Functions, lukko- ja rev-laskurit, yöllinen eheysajo, tallennetut konfliktiyhteenvedot ja ohitusten tilannekuvat → selaimessa laskettavat päällekkäisyydet ja tallennuksen tarkistus.
- Kaksipuolinen ketjulinkki ja kahden keikan transaktio → linkki vain vastaanottavalla rivillä.
- Huonehierarkia ja neliömetrit → kohde ja tilalista.
- Storage, pakollinen Blaze ja palautusharjoitukset → Spark, JSON-kopio, valinnaiset ajastetut kopiot.
- 13 näkymää → 6 ja Asetukset. Kategorialista, "Alustavat mukana" -valinta, "Tiukka"-pelivara ja yhdistelmäindeksit pois.
- Rentman-kokeilu ja kustannusvertailu → yksi kappale.

**Säilytetty tarkoituksella:**

- Testattu saatavuuslaskenta puoliavoimilla aikaväleillä, punainen ja keltainen jaksoittain, "ensin vahvistanut voittaa".
- Suora siirto luovutushetkellä ja osamäärällä, kelpoisuustarkistus ja pelivara. Lisätty: luovutus kesken monipäiväisen keikan, rivin oma aika ja rivikohtaiset Lähti- ja Palautettu-merkinnät (`lineMarks`).
- Palauttamaton kalusto pysyy varattuna; lähtenyttä keikkaa ei voi perua ennen palautusta.
- Helsingin aika testatuilla apufunktioilla ja kesäaikatesteillä; esimerkkiluvut testitapauksina.
- Ristiinmuokkauksen tunnistus, jotta merkinnät eivät katoa.
- europe-north1, Google-popup ja sallittujen lista.
