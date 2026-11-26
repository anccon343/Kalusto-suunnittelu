# Roudari – käyttöliittymän periaatteet

Käytännöllinen työkalu, ei esittelysivu. Ilme on hillitty ja tiivis; jokaisella
elementillä on tehtävä.

## Visuaalinen tyyli

- **Värit merkitsevät jotain, eivät koristele.** Pohja on harmaa ja valkoinen, ja
  ainoa korostusväri (tumma siniharmaa) on pääpainikkeissa.
  - Punainen = päällekkäin tai palauttamatta (este).
  - Oranssi = varoitus (alustava keikka kilpailee).
  - Harmaa/vinoviivoitus = alustava, huollossa, arkistoitu.
  - Väri ei ole koskaan ainoa merkki: aina myös teksti ("Päällekkäin", "alust.").
- **Ei liukuvärejä, varjoja, hehkuja, emojeja eikä animaatioita.** Siirtymät ovat
  välittömiä. Ei "New ✨" -merkkejä, isoja ikoneja otsikoissa eikä koristekuvia.
- **Pienet kulmanpyöristykset** (2–4 px). Ei pillereitä eikä pyöreitä kortteja.
- **Ohuet reunaviivat** erottavat alueet; ei varjoja.
- **Typografia:** järjestelmäfontti, otsikot 600-paksuudella, ei VERSAALIA
  harvennettuna. Numerot tasalevyisinä taulukoissa (`font-variant-numeric: tabular-nums`).

## Asettelu

- Tiivis mutta kosketukseen sopiva: painikkeet vähintään 44 px puhelimessa.
- Taulukot leveillä näytöillä, listakortit puhelimessa. Ei vaakavieritystä sivulla
  (kalustotaulu vierii vain omassa laatikossaan).
- Näkymän otsikko (h2) vasemmalla, päätoiminto oikealla samalla rivillä.
- Tyhjät tilat: yksi lause ja seuraava toimenpide, ei kuvitusta.

## Tekstit

- Lyhyt, asiallinen suomi. Painikkeissa verbi: "Tallenna", "Lisää kalustoa", "Vahvista".
- Ajat aina muodossa "ti 1.12.2026", "klo 9.00", "vk 49".
- Virheilmoitus kertoo mitä tapahtui ja mitä tehdä.
