/**
 * Drobnosti sdílené stránkou úpravy, mini obchodem a serverovými stránkami.
 *
 * Schválně obyčejný modul bez „use client": serverová stránka si odsud bere
 * id kotvy konverzace a odkazy. Hodnota importovaná z klientského modulu by na
 * serveru nebyla hodnotou, ale klientskou referencí.
 */

/**
 * Úprava POLOŽEK zákazníkem — počet kusů, výměna provedení, odebrání,
 * přidání a výměna za jiný výrobek přes mini obchod (`/order/:id/edit/pridat`).
 *
 * 12. 10. 2026, Matěj: VYPNUTO. Změny zboží se domlouvají osobně — stránka
 * úpravy nabízí jen změnu doručovací adresy / výdejny a tlačítko „Potřebuji
 * změnit objednávku" (kontaktní formulář v režimu změny objednávky, Lucie
 * zavolá nebo odepíše). „Bylo to dost práce, takže se to nebude odstraňovat,
 * jen vykomentuje."
 *
 * Proč vypínač, a ne blokový komentář: celý editor (`index.tsx`, `item-row`,
 * `swap-sheet`, `edit-summary`, `pick-*`) i stránky mini obchodu zůstávají
 * beze změny a dál procházejí typovou kontrolou — kód tak nezestárne potichu
 * (zakomentovaný JSX by se s prvním přejmenováním typu rozbil a nikdo by si
 * toho nevšiml) a zapnutí zpátky je změna tohohle jednoho řádku. S `false`
 * stránka úpravy vykreslí `OrderChangeOptions` místo `OrderEditor` a stránky
 * mini obchodu přesměrují zpátky na úpravu. Backend (`lib/order-edit`,
 * `guest-edit`, `guest-edit/catalog`) zůstává, jen ho storefront nevolá.
 *
 * Typ `boolean` (ne literál `false`) schválně — jinak by TypeScript větve
 * za vypínačem zúžil na `never` a přestal je kontrolovat.
 */
export const ORDER_ITEM_EDITING_ENABLED: boolean = false

const czkFormat = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
})

export const czk = (value: number) => czkFormat.format(value)

/** Rozdíl se znaménkem — „+240 Kč" / „−90 Kč" / „0 Kč". */
export const signedCzk = (value: number) =>
  value > 0 ? `+${czk(value)}` : value < 0 ? `−${czk(-value)}` : czk(0)

/** Obal konverzace zakázky na stránce úpravy — zamčený zakázkový řádek ji
    odsud otevře. */
export const ORDER_EDIT_CONVERSATION_ID = "konverzace-zakazky"

/** `?token=…` a u výměny za jiný výrobek (§3d.10) ještě `&swap=<item_id>` —
    mini obchod podle něj pozná, že nevybírá kus navíc, ale náhradu řádku. */
const withToken = (path: string, token: string, swapItemId?: string) =>
  `${path}?token=${encodeURIComponent(token)}${
    swapItemId ? `&swap=${encodeURIComponent(swapItemId)}` : ""
  }`

/* Cesty BEZ kódu země — `LocalizedClientLink` ho přidá sám; kde se naviguje
   ručně (`router.push`, `redirect`), přidá ho volající. */
export const editPath = (orderId: string, token: string) =>
  withToken(`/order/${orderId}/edit`, token)

export const pickShopPath = (orderId: string, token: string, swapItemId?: string) =>
  withToken(`/order/${orderId}/edit/pridat`, token, swapItemId)

export const pickProductPath = (
  orderId: string,
  token: string,
  handle: string,
  swapItemId?: string
) =>
  withToken(
    `/order/${orderId}/edit/pridat/${encodeURIComponent(handle)}`,
    token,
    swapItemId
  )

export const refundPath = (orderId: string, token: string) =>
  withToken(`/order/${orderId}/refund`, token)

export const claimsPath = (orderId: string, token: string) =>
  withToken(`/order/${orderId}/claims`, token)

/** „Zbývá 1 úprava" / „Zbývají 2 úpravy" / „Zbývá 5 úprav". */
export const remainingEditsLabel = (remaining: number) => {
  if (remaining === 1) return "Zbývá 1 úprava"
  if (remaining >= 2 && remaining <= 4) return `Zbývají ${remaining} úpravy`
  return `Zbývá ${remaining} úprav`
}

/** „1 položka" / „2 položky" / „5 položek". */
export const itemsLabel = (count: number) => {
  if (count === 1) return "1 položka"
  if (count >= 2 && count <= 4) return `${count} položky`
  return `${count} položek`
}
