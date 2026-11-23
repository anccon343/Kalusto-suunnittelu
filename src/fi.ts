/** Finnish user interface texts. Code and comments are in English; everything shown is here. */
export const fi = {
  appName: 'Roudari',
  loading: 'Ladataan…',
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
    summary: (items: number, gigs: number) => `Kalustoa ${items} kpl, keikkoja ${gigs}.`,
    underConstruction: 'Näkymät ovat rakenteilla.',
  },
  emulators: 'Paikallinen kehitysympäristö (emulaattorit)',
} as const
