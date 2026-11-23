# Kalusto

Sisäinen verkkosovellus AV-kaluston hallintaan ja keikkasuunnitteluun: mikä kalusto menee millekin
keikalle ja milloin, missä se on, kuka vastaa ja miten se siirtyy keikalta toiselle.

Suunnitelma: [`docs/SUUNNITELMA.md`](docs/SUUNNITELMA.md). Taustatutkimus: [`docs/tutkimus/`](docs/tutkimus/).

## Tila

| Vaihe                                               | Tila             |
| --------------------------------------------------- | ---------------- |
| Saatavuus- ja päällekkäisyyslaskenta (`src/core`)   | Valmis, testattu |
| Firebase, kirjautuminen ja tietokerros (`src/data`) | Seuraavaksi      |
| Näkymät (`src/views`)                               | Tulossa          |

## Tekniikka

- **Vite + React 19 + TypeScript 7** (strict, `noUncheckedIndexedAccess`)
- **Firebase:** Google-kirjautuminen, Firestore (europe-north1), Hosting
- **Vitest** ja **fast-check** testeihin, **oxlint** ja **Prettier** koodin laatuun
- **pnpm** pakettienhallintaan, Node 22 (`.nvmrc`)

## Rakenne

```text
src/
  core/        Puhdas logiikka ilman Firebase- ja React-riippuvuuksia
    types.ts         Tietomalli (kaikki ajat UTC-millisekunteina)
    time.ts          Helsingin aika, kesäaikasiirtymät ja suomalaiset muotoilut
    availability.ts  Varaukset, suorat siirrot, päällekkäisyydet ja vapaat määrät
    validation.ts    Lomakkeiden tarkistukset
    tags.ts          Laitetunnukset (KAM-03) ja Monista
    __fixtures__/    Suunnitelman esimerkkitilanne testiaineistona
  data/        Firebase ja reaaliaikaiset kuuntelijat (tulossa)
  views/       Näkymät (tulossa)
docs/          Suunnitelma ja tutkimus
```

Periaatteet:

- **Faktat tallennetaan, muu lasketaan.** Päällekkäisyyksiä ja sijainteja ei tallenneta, vaan ne
  johdetaan varauksista `src/core`-logiikalla.
- **Ajat ovat UTC-millisekunteja**, ja ne näytetään aina Helsingin ajassa laitteen aikavyöhykkeestä
  riippumatta.
- **Koodi ja kommentit englanniksi, käyttöliittymä suomeksi.**
- **Tieto tarkistetaan rajalla:** Firestoresta luettu ja sinne kirjoitettu data validoidaan
  skeemoilla tietokerroksessa.

## Kehitys

```bash
pnpm install
```

```bash
pnpm dev
```

```bash
pnpm check
```

`pnpm check` ajaa muotoilun tarkistuksen, lintin, tyyppitarkistuksen ja testit kolmella
aikavyöhykkeellä (UTC, New York, Helsinki). Sama ajetaan GitHub Actionsissa jokaiselle pushille.

Muut komennot: `pnpm test:watch`, `pnpm coverage`, `pnpm build`, `pnpm format`.
