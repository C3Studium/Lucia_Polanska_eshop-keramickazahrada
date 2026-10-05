import styles from "./style.module.scss"

/**
 * Výsledky, se kterými se zákazník vrací po doplatku (§4.6).
 *
 * `paid` / `zruseno` / `ceka` posílá ComGate na stránku objednávky po platbě;
 * `chyba` / `neplatny-odkaz` posílá backendová pay-balance route při chybě.
 */
const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  paid: {
    tone: "ok",
    text: "Doplatek je zaplacený — objednávka je teď plně uhrazená. Děkujeme!",
  },
  zruseno: {
    tone: "warn",
    text: "Platba doplatku byla zrušená. Zkusit to můžete znovu z e-mailu, nebo nám napište.",
  },
  ceka: {
    tone: "warn",
    text: "Platba doplatku se zpracovává. Jakmile dorazí, dáme vám vědět.",
  },
  chyba: {
    tone: "warn",
    text: "Platbu se nepovedlo otevřít. Napište nám prosím.",
  },
  "neplatny-odkaz": {
    tone: "warn",
    text: "Odkaz na platbu už neplatí. Napište nám prosím.",
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
