/**
 * Který nezdařený e-mail už je vyřešený opakovaným odesláním.
 *
 * ## Proč to je potřeba
 *
 * Opakované odeslání (`POST /admin/notifications/:id/retry`) schválně nepřepisuje
 * původní řádek — vyrobí nový, který na ten původní ukazuje přes
 * `original_notification_id`. Původní záznam tak zůstane jako doklad, že se to
 * kdysi nepovedlo, což je při hledání příčiny to nejcennější, co je k mání.
 *
 * Jenže tím pádem se počítadlo „Nezdařené (193)" nikdy nesnížilo, i když ten
 * samý e-mail o vteřinu později v pořádku odešel. Komentář v souhrnu si to
 * dokonce psal jako fakt: „a notification is never resolved". Pro člověka,
 * který se na tu obrazovku dívá, je to lež — e-mail odešel, zákazník ho má.
 *
 * Řešení je proto v ČTENÍ, ne v zápisu: doklad o selhání zůstává v databázi,
 * ale seznam i počítadlo ho přeskočí, jakmile existuje úspěšný pokus téhož
 * řetězce.
 *
 * ## Jak se řetězce poznají
 *
 * Retry ukládá `original_notification_id: source.original_notification_id ?? source.id`,
 * takže i druhý a třetí pokus ukazují na tentýž KOŘEN, ne jeden na druhý.
 * Když se povede kterýkoli pokus, je vyřešený celý řetězec: kořen i všechny
 * jeho nepovedené sourozence.
 */

type RadekNotifikace = {
  id: string
  original_notification_id?: string | null
}

/**
 * Kořeny řetězců, ve kterých někdy něco prošlo.
 *
 * @param uspesne Notifikace se stavem `success`. Kořen je buď to, na co
 *                ukazují, nebo — u prvního pokusu, který prošel hned — ony samy.
 */
export const vyreseneKoreny = (uspesne: RadekNotifikace[]): Set<string> => {
  const koreny = new Set<string>()

  for (const radek of uspesne) {
    koreny.add(radek.original_notification_id ?? radek.id)
    koreny.add(radek.id)
  }

  return koreny
}

/** Je tenhle nezdařený řádek už překonaný pozdějším úspěchem? */
export const jeVyresena = (
  radek: RadekNotifikace,
  koreny: Set<string>
): boolean =>
  koreny.has(radek.id) ||
  Boolean(radek.original_notification_id && koreny.has(radek.original_notification_id))
