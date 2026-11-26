/** Finnish texts of the Kalustotaulu view (plan section 3, wireframe 3.3). */
export const t = {
  title: 'Kalustotaulu',
  boardLabel: 'Kalustotaulu: kalusto päivittäin',
  equipmentColumn: 'Kalusto',
  today: 'Tänään',
  todayMarker: 'tänään',
  previous: (days: number) => (days === 7 ? 'Edellinen viikko' : 'Edelliset 2 viikkoa'),
  next: (days: number) => (days === 7 ? 'Seuraava viikko' : 'Seuraavat 2 viikkoa'),
  category: 'Kategoria',
  allCategories: 'Kaikki',
  search: 'Haku',
  searchPlaceholder: 'Tunnus tai nimi',
  noItems: 'Kalustoa ei ole vielä lisätty.',
  addItems: 'Lisää kalustoa Kalusto-sivulla',
  noMatches: 'Hakuehdoilla ei löytynyt kalustoa.',
  shown: (n: number) => (n === 1 ? '1 rivi' : `${n} riviä`),
  weekRange: (from: number, to: number) => (from === to ? `vk ${from}` : `vk ${from}–${to}`),

  pieces: (n: number) => `${n} kpl`,

  // Bars and cells
  tentativePrefix: 'alust.',
  late: 'Palauttamatta',
  lateLabel: (gig: string) => `Palauttamatta: ${gig}`,
  condition: { huollossa: 'Huollossa', rikki: 'Rikki' },
  conditionUntil: (label: string, until: string) => `${label}, takaisin ${until}`,
  unknownGig: 'Tuntematon keikka',
  overlap: 'Päällekkäin',
  warning: 'Varoitus',
  soldOut: 'Ei vapaana',
  free: (free: number, capacity: number) => `${free}/${capacity}`,
  freeAria: (day: string, free: number, capacity: number) =>
    `${day}: vapaana vähintään ${free}/${capacity}`,
  barAria: (parts: { label: string; status: string; range: string; transfer: boolean }) =>
    `${parts.label}, ${parts.status}${parts.transfer ? ', suora siirto' : ''}: ${parts.range}`,
  status: {
    confirmed: 'vahvistettu',
    tentative: 'alustava',
    condition: 'pois käytöstä',
    late: 'palauttamatta',
  },
  untilFurtherNotice: 'toistaiseksi',
  markAria: (label: string, range: string) => `${label}: ${range}`,

  // Legend
  legendTitle: 'Selite',
  legend: {
    confirmed: 'vahvistettu',
    tentative: 'alustava',
    condition: 'huollossa tai rikki',
    late: 'palauttamatta',
    overlap: 'päällekkäin (vahvistetut)',
    warning: 'varoitus (alustava mukana)',
    transfer: 'suora siirto',
    quantityExample: '28/40',
    quantity: 'luku = vapaana / omistettu (pienin arvo päivän aikana)',
  },
} as const
