/**
 * Shared Finnish user interface texts. Code and comments are in English; everything
 * the user sees is in Finnish. View-specific texts live next to each view in
 * `src/views/<view>/texts.ts`.
 */
export const fi = {
  appName: 'Roudari',
  loading: 'Ladataan…',
  save: 'Tallenna',
  cancel: 'Peruuta',
  close: 'Sulje',
  edit: 'Muokkaa',
  delete: 'Poista',
  add: 'Lisää',
  back: 'Takaisin',
  saved: 'Tallennettu',
  none: '–',
  nav: {
    today: 'Tänään',
    calendar: 'Kalenteri',
    equipment: 'Kalusto',
    board: 'Taulu',
    more: 'Lisää',
    moves: 'Roudaukset',
    settings: 'Asetukset',
    newGig: 'Uusi keikka',
  },
  auth: {
    signIn: 'Kirjaudu Google-tilillä',
    signOut: 'Kirjaudu ulos',
    intro: 'Kaluston hallinta ja keikkasuunnittelu.',
    cancelled: 'Kirjautuminen keskeytettiin.',
    popupBlocked:
      'Selain esti kirjautumisikkunan. Salli ponnahdusikkunat tälle sivulle ja yritä uudelleen.',
    failed: 'Kirjautuminen epäonnistui. Yritä uudelleen.',
    notAllowed: (email: string) =>
      email
        ? `Osoitetta ${email} ei ole listalla. Pyydä joku tiimistä lisäämään se.`
        : 'Google-tililtä ei saatu sähköpostiosoitetta.',
    error: 'Käyttöoikeuden tarkistus epäonnistui. Yritä hetken päästä uudelleen.',
    signedInAs: (name: string) => `Kirjautuneena: ${name}`,
  },
  data: {
    error: 'Tietojen lataus epäonnistui. Päivitä sivu.',
    issues: (n: number) =>
      n === 1
        ? '1 tallenne on virheellinen eikä näy sovelluksessa.'
        : `${n} tallennetta on virheellisiä eivätkä näy sovelluksessa.`,
  },
  errors: {
    conflict: (fields: string) =>
      `Tietoja muutettiin juuri toisaalla (${fields}). Tarkista ja tallenna uudelleen.`,
    notFound: 'Tallennetta ei enää löydy. Se on ehkä poistettu.',
    invalid: 'Tiedoissa on virhe, eikä niitä tallennettu.',
    permission: 'Sinulla ei ole oikeutta tähän tai sääntö esti muutoksen.',
    offline: 'Ei yhteyttä palvelimeen. Tarkista verkkoyhteys ja yritä uudelleen.',
    unknown: 'Jokin meni vikaan. Yritä uudelleen.',
    state: {
      'not-confirmed': 'Lähti voidaan merkitä vain vahvistetulle keikalle.',
      'departed-not-returned':
        'Lähtenyttä keikkaa ei voi perua ennen kuin se on merkitty palautetuksi.',
      'not-deletable': 'Vain alustavan keikan, joka ei ole lähtenyt, voi poistaa. Muut perutaan.',
      'line-missing': 'Riviä ei enää ole keikalla.',
      unreadable: 'Tallenne on virheellinen eikä sitä voi muokata.',
      'invalid-email': 'Sähköpostiosoite ei kelpaa.',
      'already-exists': 'Tämä on jo olemassa.',
      'cannot-remove-self': 'Et voi poistaa itseäsi listalta.',
    },
  },
  emulators: 'Paikallinen kehitysympäristö (emulaattorit)',
  notFoundPage: 'Sivua ei löytynyt.',
} as const
