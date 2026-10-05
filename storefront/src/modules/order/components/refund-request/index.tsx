"use client"

import { useId, useState } from "react"

import { submitReturnRequest } from "@lib/data/return-requests"
import type { GuestRefundContext } from "@lib/data/guest-refund"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

type Kind = "reklamace" | "vraceni" | "odstoupeni"

const KINDS: { value: Kind; label: string; help: string }[] = [
  {
    value: "reklamace",
    label: "Reklamace (vada zboží)",
    help: "Zboží dorazilo vadné nebo poškozené, nebo se vada objevila později.",
  },
  {
    value: "vraceni",
    label: "Vrácení zboží",
    help: "Chci zboží vrátit.",
  },
  {
    value: "odstoupeni",
    label: "Odstoupení od smlouvy do 14 dnů",
    help: "Bez udání důvodu, do 14 dnů od převzetí (§1829).",
  },
]

const REASON_LABEL: Record<Kind, string> = {
  reklamace: "Reklamace (vada zboží)",
  vraceni: "Vrácení zboží",
  odstoupeni: "Odstoupení od smlouvy do 14 dnů",
}

/**
 * Žádost o reklamaci / vrácení / odstoupení k JEDNÉ objednávce — otevřená z
 * e-mailu (token už prokázal vlastnictví, číslo + e-mail nese kontext). Odešle
 * do veřejného intake `/store/return-requests`; majitelka pak rozhodne v adminu.
 *
 * Právo: odstoupení do 14 dnů (§1829) se u zboží na míru NENABÍZÍ (§1837) —
 * když je celá objednávka zakázková, ta volba je zamčená s vysvětlením.
 */
export default function RefundRequest({
  context,
}: {
  context: GuestRefundContext
}) {
  const withdrawalBlocked = context.all_made_to_order
  const [kind, setKind] = useState<Kind>("reklamace")
  const [detail, setDetail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  )
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()

  const send = async () => {
    if (!detail.trim() || state === "sending") return
    setState("sending")
    setError(null)
    // Druh zapisujeme do důvodu, aby ho majitelka viděla všude, kde se žádost
    // zobrazuje (notifikace, admin „Vrácení").
    const reason = `${REASON_LABEL[kind]} — ${detail.trim()}`
    const result = await submitReturnRequest({
      order_display_id: context.order_display_id,
      email: context.email,
      reason,
    })
    if (result.success) {
      setState("sent")
      return
    }
    setState("error")
    setError(result.message ?? null)
  }

  if (state === "sent") {
    return (
      <p className={styles.sent} role="status">
        Máme to. Ozveme se vám e-mailem, jakmile si vaši žádost projdeme.
      </p>
    )
  }

  return (
    <div className={styles.root}>
      <fieldset className={styles.kinds}>
        <legend className={styles.legend}>Co chcete řešit?</legend>
        {KINDS.map((k) => {
          const disabled = k.value === "odstoupeni" && withdrawalBlocked
          return (
            <label
              key={k.value}
              className={`${styles.kind} ${disabled ? styles.kindDisabled : ""}`}
            >
              <input
                type="radio"
                name="refund-kind"
                value={k.value}
                checked={kind === k.value}
                disabled={disabled}
                onChange={() => setKind(k.value)}
              />
              <span className={styles.kindText}>
                <span className={styles.kindLabel}>{k.label}</span>
                <span className={styles.kindHelp}>
                  {disabled
                    ? "Zboží na míru — ze zákona od něj nelze odstoupit (§1837)."
                    : k.help}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      <label htmlFor={fieldId} className={styles.label}>
        Napište nám detail <i>(povinné)</i>
      </label>
      <textarea
        id={fieldId}
        className={styles.input}
        rows={4}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder="Co se stalo, nebo co chcete vrátit — pár slov stačí."
        required
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submit}
          onClick={send}
          disabled={!detail.trim() || state === "sending"}
        >
          {state === "sending" ? "Odesíláme…" : "Odeslat žádost"}
        </button>
      </div>

      <p className={styles.legal}>
        Podrobnosti najdete v{" "}
        <LocalizedClientLink href="/reklamacni-protokol">
          reklamačním řádu
        </LocalizedClientLink>{" "}
        a ve vzoru pro{" "}
        <LocalizedClientLink href="/odstoupeni-od-smlouvy">
          odstoupení od smlouvy
        </LocalizedClientLink>
        .
      </p>
    </div>
  )
}
