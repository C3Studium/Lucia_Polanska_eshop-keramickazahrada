import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { getNotificationAddresses, notifyMerchant } from "./notify"

/**
 * Zkušební e-maily na adresy z Nastavení obchodu › E-maily obchodu — jeden
 * na e-mail obchodu (majitelka), jeden vývojáři. Skutečnou cestou
 * (`notifyMerchant` → šablona `merchant-notification` → Resend), takže zkouší
 * routing i klíč Resendu běžícího backendu (21. 11. 2026, výměna účtu Resend).
 *
 * **Nikdy nejde zákazníkovi:** jediní příjemci jsou ty dvě adresy z nastavení
 * (prázdné spadne na `OWNER/DEV_NOTIFICATION_EMAIL`), nic jiného se nečte.
 *
 * Klíč nese čas: provozní zprávy se dedupují, zkouška se musí dát spustit
 * víckrát. Vývojářská jde se `souhrn: true`, jinak by čekala ve frontě
 * na souhrn chyb po 4 hodinách.
 */

export type ZkusebniVysledek = {
  adresa: string | null
  /** Co udělal `notifyMerchant` (sent / no-recipient / …). */
  odeslani: string
  /** Stav doručení z tabulky oznámení (success / failure / pending), když je. */
  stav: string | null
  /** Id zprávy v Resendu — důkaz, že ji Resend přijal. */
  resend_id: string | null
}

const stavDoruceni = async (
  container: MedusaContainer,
  klic: string
): Promise<{ stav: string | null; resend_id: string | null }> => {
  try {
    const notifications: any = container.resolve(Modules.NOTIFICATION)
    const [row] = await notifications.listNotifications(
      { idempotency_key: `${klic}:email` },
      { take: 1 }
    )
    return { stav: row?.status ?? null, resend_id: row?.external_id ?? null }
  } catch {
    return { stav: null, resend_id: null }
  }
}

export const posliZkusebniEmaily = async (
  container: MedusaContainer
): Promise<{ obchod: ZkusebniVysledek; vyvojar: ZkusebniVysledek }> => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const kdy = new Date().toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })
  const adresy = await getNotificationAddresses(container)

  const klicObchod = `test-provoz-owner:${stamp}`
  const obchod = await notifyMerchant(container, {
    key: klicObchod,
    title: "Zkušební zpráva — e-maily obchodu fungují",
    description: `Dobrý den, tohle je jen zkouška: ověřujeme, že vám provozní zprávy z obchodu (nová objednávka, zakázka, doplatek, souhrny) dorazí na tuhle adresu. Nic se nestalo a nic nemusíte dělat. Odesláno ${kdy}.`,
    audience: "owner",
    email: true,
  })

  const klicVyvojar = `test-provoz-dev:${stamp}`
  const vyvojar = await notifyMerchant(container, {
    key: klicVyvojar,
    title: "Zkušební zpráva — vývojářská hlídka",
    description: `Kontrola routingu: tahle zpráva míří na vývojářskou adresu (nezdařené e-maily, chyby dopravce, technický souhrn). Odesláno ${kdy}.`,
    audience: "dev",
    email: true,
    souhrn: true,
  })

  return {
    obchod: {
      adresa: (adresy.owner ?? "").trim() || null,
      odeslani: obchod.email,
      ...(await stavDoruceni(container, klicObchod)),
    },
    vyvojar: {
      adresa: (adresy.dev ?? "").trim() || null,
      odeslani: vyvojar.email,
      ...(await stavDoruceni(container, klicVyvojar)),
    },
  }
}
