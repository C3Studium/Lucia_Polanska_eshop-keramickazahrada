import styles from "./style.module.scss"

/**
 * Výsledky, se kterými se zákazník vrací z platby zakázky přes e-mail —
 * doplatek (§4.6) i záloha nebo celá částka po „Domluvené ceně" (cena po
 * domluvě). Texty jsou proto neutrální: neříkají, o jakou platbu šlo.
 *
 * `paid` / `zruseno` / `ceka` posílá ComGate na stránku objednávky po platbě;
 * `chyba` / `neplatny-odkaz` posílá backendová pay-balance route při chybě.
 */
const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  paid: {
    tone: "ok",
    text: "Platba dorazila, děkuji. Potvrzení vám přijde e-mailem.",
  },
  zruseno: {
    tone: "warn",
    text: "Platba se zrušila a nic se nestrhlo. Zkusit to můžete znovu z odkazu v e-mailu, nebo mi napište.",
  },
  ceka: {
    tone: "warn",
    text: "Platba se ještě zpracovává. Jakmile dorazí, dám vám vědět e-mailem.",
  },
  chyba: {
    tone: "warn",
    text: "Platbu se nepovedlo otevřít. Napište mi prosím, ať to spolu vyřešíme.",
  },
  "neplatny-odkaz": {
    tone: "warn",
    text: "Odkaz na platbu už neplatí. Napište mi prosím a pošlu vám nový.",
  },
}

export default function BalancePaymentNotice({
  outcome,
  inline = false,
}: {
  outcome?: string
  /** Inside OrderStateShell the page already provides the margins. */
  inline?: boolean
}) {
  const message = outcome ? MESSAGES[outcome] : undefined

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
