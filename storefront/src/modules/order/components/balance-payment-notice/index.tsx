import styles from "./style.module.scss"

/** The three outcomes the backend redirects with after a balance payment (§4.6). */
const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  paid: { tone: "ok", text: "Doplatek je zaplacený. Děkujeme!" },
  chyba: {
    tone: "warn",
    text: "Platbu se nepodařilo otevřít. Napište nám prosím.",
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
