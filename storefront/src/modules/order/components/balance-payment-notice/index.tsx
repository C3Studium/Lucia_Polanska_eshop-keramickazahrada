"use client"

/*
 * Klientská komponenta (13. 11. 2026): bere znění z useTexty(), což je hook kontextu.
 * Bez téhle direktivy ji serverová stránka potvrzení (order/[id]/confirmed) i návrat
 * ze zrušené platby (payment/[sessionId]/canceled) volaly na serveru a obě od 9. 11.
 * padaly na „Application error": zákazník po zaplacení viděl chybu místo potvrzení.
 */
import { useTexty } from "@lib/context/texty"
import type { ShopTexty } from "@lib/constants/texty"

import styles from "./style.module.scss"

/**
 * Výsledky, se kterými se zákazník vrací z platby zakázky přes e-mail —
 * doplatek (§4.6) i záloha nebo celá částka po „Domluvené ceně" (cena po
 * domluvě). Texty jsou proto neutrální: neříkají, o jakou platbu šlo.
 *
 * `paid` / `zruseno` / `ceka` posílá ComGate na stránku objednávky po platbě;
 * `chyba` / `neplatny-odkaz` posílá backendová pay-balance route při chybě.
 */
/* Znění se bere z administrace, takže to nemůže být konstanta modulu —
   musí vzniknout až ve chvíli, kdy jsou texty po ruce. Chybová hláška
   zůstává v kódu schválně: ta má popisovat příčinu, ne tón obchodu. */
const zpravy = (
  texty: ShopTexty
): Record<string, { tone: "ok" | "warn"; text: string }> => ({
  paid: {
    tone: "ok",
    text: texty["objednavka.doplatek_prisel"],
  },
  zruseno: {
    tone: "warn",
    text: texty["objednavka.doplatek_zrusen"],
  },
  ceka: {
    tone: "warn",
    text: texty["objednavka.doplatek_zpracovava"],
  },
  chyba: {
    tone: "warn",
    text: "Platbu se nepovedlo otevřít. Napište mi prosím, ať to spolu vyřešíme.",
  },
  "neplatny-odkaz": {
    tone: "warn",
    text: texty["objednavka.doplatek_odkaz_neplati"],
  },
})

export default function BalancePaymentNotice({
  outcome,
  inline = false,
}: {
  outcome?: string
  /** Inside OrderStateShell the page already provides the margins. */
  inline?: boolean
}) {
  const texty = useTexty()
  const message = outcome ? zpravy(texty)[outcome] : undefined

  if (!message) {
    return null
  }

  return (
    <p
      className={`${styles.notice} ${inline ? styles.inline : ""} ${
        message.tone === "ok" ? styles.ok : styles.warn
      }`}
      role="status"
    >
      {message.text}
    </p>
  )
}
