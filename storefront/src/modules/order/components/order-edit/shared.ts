/**
 * Drobnosti sdílené stránkou úpravy, mini obchodem a serverovými stránkami.
 *
 * Schválně obyčejný modul bez „use client": serverová stránka si odsud bere
 * id kotvy konverzace a odkazy. Hodnota importovaná z klientského modulu by na
 * serveru nebyla hodnotou, ale klientskou referencí.
 */

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

const withToken = (path: string, token: string) =>
  `${path}?token=${encodeURIComponent(token)}`

/* Cesty BEZ kódu země — `LocalizedClientLink` ho přidá sám; kde se naviguje
   ručně (`router.push`, `redirect`), přidá ho volající. */
export const editPath = (orderId: string, token: string) =>
  withToken(`/order/${orderId}/edit`, token)

export const pickShopPath = (orderId: string, token: string) =>
  withToken(`/order/${orderId}/edit/pridat`, token)

export const pickProductPath = (orderId: string, token: string, handle: string) =>
  withToken(`/order/${orderId}/edit/pridat/${encodeURIComponent(handle)}`, token)

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
