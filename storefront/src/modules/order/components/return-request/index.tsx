"use client"

import { useId, useState } from "react"

import { submitReturnRequest } from "@lib/data/return-requests"

import styles from "./style.module.scss"

type Props = {
  orderId: string
  email: string
  customerName?: string
}

/**
 * „Vrátit zboží" — the storefront side of the backend's returns flow, which until now had no
 * surface at all: a customer had no way to start one.
 *
 * The form asks only for the reason. Everything else the backend needs it already knows from
 * the order, and a longer form is a reason not to finish it.
 */
export default function ReturnRequest({ orderId, email, customerName }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()

  const send = async () => {
    if (!reason.trim() || state === "sending") return

    setState("sending")
    setError(null)

    const result = await submitReturnRequest({
      order_id: orderId,
      email,
      reason,
      customer_name: customerName,
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
        Žádost jsme přijali. Ozveme se vám e-mailem, jakmile ji projdeme.
      </p>
    )
  }

  if (!isOpen) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)}>
        Vrátit zboží
      </button>
    )
  }

  return (
    <div className={styles.root}>
      <label htmlFor={fieldId} className={styles.label}>
        Proč zboží vracíte? <i>(povinné)</i>
      </label>
      <textarea
        id={fieldId}
        className={styles.input}
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Napište prosím krátce, co se stalo."
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
          disabled={!reason.trim() || state === "sending"}
        >
          {state === "sending" ? "Odesíláme…" : "Odeslat žádost"}
        </button>
        <button type="button" className={styles.cancel} onClick={() => setIsOpen(false)}>
          Zpět
        </button>
      </div>
    </div>
  )
}
