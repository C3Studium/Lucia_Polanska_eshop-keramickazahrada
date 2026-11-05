import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

/**
 * Doprava u zakázky s cenou po domluvě — výměna dopravce na hotové objednávce.
 *
 * Kus s cenou po domluvě se objednává na osobní odběr: v pokladně není z čeho
 * spočítat poštovné, dokud se neví, co se bude vyrábět a jak to bude velké.
 * Zákazník si to ale rozmyslí („pošlete mi to") a do té chvíle byla v
 * administraci jen částka poštovného — číslo, které nikam nevede. Objednávka
 * pořád nesla osobní odběr, takže se k ní nedal vyrobit štítek České pošty,
 * nespustilo se sledování zásilky a e-maily mluvily o vyzvednutí v ateliéru.
 *
 * Proto se tu vymění rovnou DOPRAVA objednávky: zvolená možnost (Česká pošta —
 * křehké, Balíkovna, osobní odběr) se zapíše do její metody dopravy i s `data`
 * té možnosti. Z nich ČP pozná službu a „Křehce" (`service_code`, `fragile`),
 * widgety Štítek ČP a Sledování zásilek poznají, že jde o zásilku, a Denní
 * práce přestane nabízet vyzvednutí u pultu.
 *
 * Peníze se tím NEMĚNÍ. U ceny po domluvě je nativní objednávka nulová a
 * všechno — cena, poštovné, balné — se platí přes zakázkovou platební
 * kolekci (`shipping_total` zakázky). Kdyby se poštovné zapsalo i do nativní
 * dopravy, zákazník by ho zaplatil dvakrát.
 */

export type ShippingChoice = {
  id: string
  name: string
  /** Osobní odběr v ateliéru (vlastní provider) — žádný štítek, žádné sledování. */
  personal_pickup: boolean
}

const OPTION_FIELDS = ["id", "name", "data", "provider_id"]

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

/** Osobní odběr má vlastní modul dopravy — pozná se podle provideru. */
export const isPickupOption = (option: { provider_id?: string | null } | null | undefined): boolean =>
  String(option?.provider_id ?? "").includes("pickup")

/**
 * Osobní odběr podle možnosti. Rozhoduje provider; když ho volající nedodá,
 * platí příznak z dat možnosti — tiše napsat „zásilka" by bylo horší.
 */
const jeOdber = (option: {
  provider_id?: string | null
  data?: Record<string, unknown> | null
}): boolean =>
  option?.provider_id
    ? isPickupOption(option)
    : (option?.data as Record<string, unknown> | null)?.personal_pickup === true

/**
 * Data, která se zapíšou metodě dopravy.
 *
 * Základ je `data` zvolené možnosti — z nich Česká pošta pozná službu. Dva
 * příznaky se ale dopisují VŽDY, i když vyjdou `false`, a to je na téhle
 * funkci to podstatné:
 *
 * **Medusa `data` metody dopravy SLUČUJE, nepřepisuje.** Co nová data
 * nejmenují, zůstane po těch starých. Objednávka s cenou po domluvě přitom
 * vzniká na osobní odběr (`personal_pickup: true`), a když majitelka vybrala
 * Českou poštu, příznak odběru na metodě přežil: Denní práce dál nabízela
 * „Připraveno k vyzvednutí", štítek ČP ani sledování zásilky se neukázaly
 * a e-maily mluvily o pultu. Změřeno 3. 11. 2026 na objednávce #69 — metoda
 * „Česká Pošta - Křehké" a v datech `personal_pickup: true`, který v datech
 * TÉ možnosti vůbec není.
 *
 * Proto se oba nepovinné příznaky píšou natvrdo:
 *
 * - `personal_pickup` — jinak přežije odběr pod zásilkou (a naopak),
 * - `fragile` — možnost „Česká Pošta - Křehké" má v datech obyčejnou zásilku
 *   na adresu (`cp-address`) bez příznaku, takže by se křehký balík podal
 *   jako každý jiný; u keramiky je „Křehce" celý důvod, proč ta možnost je.
 *   Balíkovna si `fragile` zahodí sama — službu „Křehce" tam číselník ČP
 *   nepřipouští (modules/ceskaPostaFulfillment).
 *
 * Ostatní klíče (`id`, `name`, `service_code`) mají data možností vyplněné
 * všechny, takže je slučování přepíše samo.
 */
export const methodDataFor = (option: {
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}): Record<string, unknown> => {
  const data = { ...((option?.data ?? {}) as Record<string, unknown>) }
  data.fragile = fold(String(option?.name ?? "")).includes("krehk")
  data.personal_pickup = jeOdber(option)
  return data
}

export const loadShippingOption = async (
  container: MedusaContainer,
  shippingOptionId: string
): Promise<any> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "shipping_option",
    fields: OPTION_FIELDS,
    filters: { id: shippingOptionId } as never,
  })
  const option = (data as any[])[0]
  if (!option) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Zvolená doprava neexistuje — načtěte stránku znovu."
    )
  }
  return option
}

/**
 * Zapíše zvolenou dopravu do objednávky. Vrací, co se nastavilo (nebo že se
 * nic měnit nemuselo), ať to volající umí říct do hlášky.
 */
export const applyShippingChoice = async (
  container: MedusaContainer,
  { orderId, shippingOptionId }: { orderId: string; shippingOptionId: string }
): Promise<{ changed: boolean; choice: ShippingChoice }> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const option = await loadShippingOption(container, shippingOptionId)
  const choice: ShippingChoice = {
    id: String(option.id),
    name: String(option.name ?? "Doprava"),
    personal_pickup: isPickupOption(option),
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "shipping_methods.id", "shipping_methods.shipping_option_id"],
    filters: { id: orderId },
  })
  const order = (orders as any[])[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }

  const methods = (order.shipping_methods ?? []) as any[]
  const orderModule = container.resolve(Modules.ORDER) as any

  if (!methods.length) {
    /*
     * Objednávka úplně bez dopravy (elektronický poukaz, starší zakázka).
     * Částka zůstává nula — platí se přes zakázkovou kolekci.
     */
    await orderModule.createOrderShippingMethods({
      order_id: orderId,
      name: choice.name,
      shipping_option_id: choice.id,
      amount: 0,
      data: methodDataFor(option),
    })
    return { changed: true, choice }
  }

  if (methods.length === 1 && methods[0]?.shipping_option_id === choice.id) {
    return { changed: false, choice }
  }

  /*
   * Víc metod najednou objednávka z téhle pokladny nemá; kdyby přece, přepíše
   * se první a ostatní by si odporovaly — radši to odmítnout nahlas.
   */
  if (methods.length > 1) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Objednávka má víc způsobů dopravy — tohle za vás neumím rozhodnout."
    )
  }

  await orderModule.updateOrderShippingMethods({
    id: methods[0].id,
    name: choice.name,
    shipping_option_id: choice.id,
    // `data` nese službu ČP a „Křehce" — bez nich by se zásilka podala jako
    // obyčejný balík na adresu (modules/ceskaPostaFulfillment).
    data: methodDataFor(option),
  })

  return { changed: true, choice }
}
