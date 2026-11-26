# Roudari

Sisäinen verkkosovellus AV-kaluston hallintaan ja keikkasuunnitteluun: mikä kalusto menee millekin
keikalle ja milloin, missä se on, kuka vastaa ja miten se siirtyy keikalta toiselle.

Suunnitelma: [`docs/SUUNNITELMA.md`](docs/SUUNNITELMA.md). Taustatutkimus: [`docs/tutkimus/`](docs/tutkimus/).

## Tila

| Vaihe                                                       | Tila                            |
| ----------------------------------------------------------- | ------------------------------- |
| Saatavuus- ja päällekkäisyyslaskenta (`src/core`)           | Valmis, testattu                |
| Firebase-säännöt, kirjautuminen ja tietokerros (`src/data`) | Valmis, testattu emulaattorissa |
| Näkymät (`src/views`)                                       | Seuraavaksi                     |

## Tekniikka

- **Vite + React 19 + TypeScript 7** (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Firebase:** Google-kirjautuminen, Firestore (europe-north1), Hosting
- **Vitest** ja **fast-check** testeihin, **oxlint** (tyyppitietoinen) ja **Prettier** koodin laatuun
- **Zod** tiedon tarkistukseen tietokerroksessa
- **Node 24 LTS** (`.nvmrc`, `engines`) ja **pnpm 10**

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
  data/        Firebase: asetukset, Zod-skeemat, kirjoitukset, kuuntelijat, kirjautuminen
  fi.ts        Käyttöliittymän suomenkieliset tekstit
test/          Emulaattoritestit: Firestore-säännöt ja tietokerros
firestore.rules  Tietokannan käyttöoikeussäännöt
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
  Zod-skeemoilla tietokerroksessa.
- **Kerrokset pidetään erillään:** oxlint estää `src/core`-kansiota tuomasta Firebasea, Zodia tai
  Reactia ja `src/views`-kansiota tuomasta Firebasea suoraan.

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
aikavyöhykkeellä (UTC, New York, Helsinki) sekä tarkistaa ydinlogiikan testikattavuuden. Sama
ajetaan GitHub Actionsissa jokaiselle pushille. Komennot toimivat myös Windowsissa.

### Riippuvuudet ja toimitusketju

- pnpm ei asenna alle 3 päivää vanhoja pakettiversioita (`minimumReleaseAge` tiedostossa
  `pnpm-workspace.yaml`), ja Dependabot ehdottaa päivityksiä viikoittain samalla viiveellä.
- GitHub Actions -toiminnot on lukittu commit-tunnisteisiin.
- Väärä Node-versio pysäyttää asennuksen (`engineStrict`).

Muut komennot: `pnpm test:watch`, `pnpm coverage`, `pnpm build`, `pnpm format`.

### Firebase ja emulaattorit

Firebase-projekti on `roudari-97f09` (europe-north1). Paikallinen kehitys ja testit käyttävät
emulaattoreita ja demo-projektia `demo-roudari`, joten ne eivät koskaan koske oikeaan dataan.
Emulaattorit tarvitsevat Javan (21+).

```bash
pnpm test:emulator
```

```bash
pnpm emulators
```

```bash
pnpm dev:emu
```

`pnpm test:emulator` ajaa sääntö- ja tietokerrostestit (myös CI:ssä). Kehitystä varten käynnistä
`pnpm emulators` yhteen terminaaliin ja `pnpm dev:emu` toiseen.

### Julkaisu

Julkaisu on automaattinen: kun `main`-haaraan tulee muutos, GitHub Actions
([`deploy.yml`](.github/workflows/deploy.yml)) ajaa ensin kaikki tarkistukset ja julkaisee sitten
sovelluksen (Firebase Hosting), Firestore-säännöt ja -indeksit projektiin `roudari-97f09`.
Julkaisun voi käynnistää myös käsin Actions-välilehdeltä (Run workflow, haara `main`).

Tunnistautuminen on avaimeton (Workload Identity Federation): pysyviä avaimia tai salaisuuksia
ei ole. Google hyväksyy vain tämän repositorion työnkulun `deploy.yml` ajot `main`-haarasta
GitHub-ympäristössä `production` (push tai käsin käynnistys), ja ne saavat toimia palvelutilinä
`github-deployer`, jolla on vain julkaisuun tarvittavat oikeudet. Sovellus käännetään erillisessä
työssä ilman julkaisuoikeutta; julkaisutyö vain julkaisee valmiin paketin.

Kertaluonteinen asennus:

1. Google Cloud Shellissä skripti
   [`scripts/setup-github-deploy.sh`](scripts/setup-github-deploy.sh) (projektin omistajana).
2. GitHubissa (Settings): ympäristö `production`, johon julkaisu sallitaan vain haarasta `main`,
   sekä `main`-haaran sääntö (ei poistoa eikä force pushia, muutokset pull requestin ja CI:n
   kautta).
