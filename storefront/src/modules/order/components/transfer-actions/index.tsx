"use client"

import { acceptTransferRequest, declineTransferRequest } from "@lib/data/orders"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { useState } from "react"
import styles from "../styles/transfer-actions.module.scss"

type TransferStatus = "pending" | "success" | "error"

const TransferActions = ({ id, token }: { id: string; token: string }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    accept: TransferStatus | null
    decline: TransferStatus | null
  }>({
    accept: null,
    decline: null,
  })

  const busy =
    status.accept === "pending" || status.decline === "pending"
  const completed =
    status.accept === "success" || status.decline === "success"

  const acceptTransfer = async () => {
    setStatus({ accept: "pending", decline: null })
    setErrorMessage(null)

    const { success, error } = await acceptTransferRequest(id, token)

    if (error) setErrorMessage(error)
    setStatus({ accept: success ? "success" : "error", decline: null })
  }

  const declineTransfer = async () => {
    setStatus({ accept: null, decline: "pending" })
    setErrorMessage(null)

    const { success, error } = await declineTransferRequest(id, token)

    if (error) setErrorMessage(error)
    setStatus({ accept: null, decline: success ? "success" : "error" })
  }

  return (
    <div className={styles.root} aria-live="polite">
      {completed ? (
        <div className={styles.result}>
          <span>
            {status.accept === "success"
              ? "Převod potvrzen"
              : "Převod odmítnut"}
          </span>
          <strong>
            {status.accept === "success"
              ? "Objednávka je nyní přiřazená k novému majiteli."
              : "Objednávka zůstává beze změny."}
          </strong>
          <p>
            {status.accept === "success"
              ? "Další informace najdete ve svém účtu."
              : "Tato žádost už nevyžaduje žádný další krok."}
          </p>
        </div>
      ) : (
        <div className={styles.actions}>
          <PremiumActionButton
            text={
              status.accept === "pending"
                ? "Převádím objednávku…"
                : "Přijmout převod"
            }
            onClickAction={acceptTransfer}
            disabled={busy}
            active={status.accept === "pending"}
          />
          <PremiumActionButton
            text={
              status.decline === "pending"
                ? "Zamítám žádost…"
                : "Ponechat beze změny"
            }
            onClickAction={declineTransfer}
            disabled={busy}
            active={status.decline === "pending"}
            className={styles.secondary}
          />
        </div>
      )}

      {errorMessage && (
        <div className={styles.error} role="alert">
          <strong>Žádost se nepodařilo zpracovat.</strong>
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  )
}

export default TransferActions
