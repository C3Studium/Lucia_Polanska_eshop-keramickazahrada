import type { MedusaContainer } from "@medusajs/framework/types"
import { MERCHANT_ORDER_MODULE } from "../modules/merchant-order"
import type MerchantOrderModuleService from "../modules/merchant-order/service"

/**
 * Režim editovatelnosti objednávky — sdílený mezi zákaznickou a hostovskou
 * editací (obě routy měly dřív vlastní kopii brány, což se rozchází).
 *
 * - `full`     — Nové / Připravujeme, bez expedice: plná editace (výměna,
 *                odebrání, doplnění, s vyrovnáním peněz podle matice).
 * - `swap_only`— K odeslání (zabalená, ještě NEpředaná dopravci): povolíme JEN
 *                výměnu varianty za STEJNOU cenu. Žádné peníze se nehnou, jen
 *                majitelka přebalí; proto se nenabízí odebrání/doplnění ani
 *                změna ceny. Jakmile vznikne (nestornovaná) zásilka, je konec.
 * - `none`     — vypravené / odeslané / zrušené: po telefonu.
 *
 * Fyzická realita: řádek už zabalený do (nestornované) zásilky nejde nativně
 * editovat, proto existující zásilka vždy znamená `none`.
 */
export type EditMode = "full" | "swap_only" | "none"

export const editabilityMode = async (
  container: MedusaContainer,
  order: any
): Promise<{ mode: EditMode; reason: string | null }> => {
  const hasFulfillment = (order.fulfillments ?? []).some(
    (f: any) => !f?.canceled_at
  )
  if (hasFulfillment) {
    return {
      mode: "none",
      reason: "Část objednávky je už vypravená — úpravy vyřešíme po telefonu.",
    }
  }

  const merchant = container.resolve<MerchantOrderModuleService>(
    MERCHANT_ORDER_MODULE
  )
  const [state] = (await merchant.listMerchantOrderStates({
    order_id: order.id,
  } as never)) as any[]
  const stage = state?.stage ?? "received"

  if (["received", "working"].includes(stage)) {
    return { mode: "full", reason: null }
  }
  if (stage === "shipping") {
    return { mode: "swap_only", reason: null }
  }
  return {
    mode: "none",
    reason: "Objednávka už se chystá na cestu — úpravy vyřešíme po telefonu.",
  }
}

/** Čeština pro poznámku v editoru, když jde jen výměna za stejnou cenu. */
export const SWAP_ONLY_NOTE =
  "Objednávka je připravená k odeslání — vyměnit jde už jen varianta (třeba barva) za STEJNOU cenu. Větší změny vyřešíme po telefonu."
