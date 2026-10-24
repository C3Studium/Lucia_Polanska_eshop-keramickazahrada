"use client"

import { useEffect, useRef, useState } from "react"

import type { PublicGiftVoucher } from "@lib/data/gift-vouchers"

import { czk } from "../format"
import { formatVoucherCode } from "@lib/util/gift-voucher-code"
import styles from "./styles.module.scss"

/**
 * Karta zaplaceného poukazu — to, co obdarovaný uvidí a co si vytiskne.
 *
 * Při tisku (viz `@media print` ve stylopisu) zůstane na papíře JEN tahle
 * karta: hlavička, patička webu, text pod kartou i tlačítko „Kopírovat"
 * zmizí. Proto karta sama nese i krátkou větu, kde a jak poukaz uplatnit —
 * papír bez webu kolem musí stačit.
 */
export default function PoukazKarta({ voucher }: { voucher: PublicGiftVoucher }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    },
    []
  )

  const code = voucher.code ?? ""
  const partlyUsed = voucher.balance < voucher.initial_value

  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(code)
      ok = true
    } catch {
      /* Bez schránky (starší prohlížeč, http) — kód zůstává vidět a dá se opsat. */
      ok = false
    }
    setCopied(ok ? "ok" : "fail")
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopied(null), 2500)
  }

  return (
    <article className={styles.card} aria-label="Dárkový poukaz">
      <div className={styles.frame}>
        <header className={styles.head}>
          <span>Dárkový poukaz</span>
          <span aria-hidden="true" className={styles.dot} />
          <span>Keramická zahrada</span>
        </header>

        {voucher.recipient_name ? (
          <p className={styles.recipient}>
            <span>pro</span> {voucher.recipient_name}
          </p>
        ) : null}

        {voucher.dedication ? (
          <blockquote className={styles.dedication}>{voucher.dedication}</blockquote>
        ) : null}

        <p className={styles.value}>{czk(voucher.initial_value)}</p>

        <div className={styles.codeBox}>
          <span className={styles.label}>Kód poukazu</span>
          <strong className={styles.code} translate="no">
            {formatVoucherCode(code)}
          </strong>
          <button type="button" className={styles.copy} onClick={copy}>
            {copied === "ok" ? "Zkopírováno" : "Kopírovat kód"}
          </button>
          <span className={styles.srOnly} role="status">
            {copied === "ok"
              ? "Kód je zkopírovaný."
              : copied === "fail"
                ? "Kód se nepodařilo zkopírovat, opište ho prosím."
                : ""}
          </span>
        </div>

        <dl className={styles.meta}>
          <div>
            <dt>Platí do</dt>
            <dd>{voucher.valid_until_label}</dd>
          </div>
          {partlyUsed ? (
            <div>
              <dt>Zůstatek</dt>
              <dd>
                Zbývá {czk(voucher.balance)} z {czk(voucher.initial_value)}
              </dd>
            </div>
          ) : null}
        </dl>

        <footer className={styles.foot}>
          V obchodě zadejte kód do pole Slevový kód nebo dárkový poukaz
          v košíku, v dílně v Písku stačí poukaz ukázat. Platí na keramiku
          i na zakázky, na kurzy zatím ne. Co neutratíte, zůstane na poukazu.
          <span className={styles.signature}>Lucie Polanská</span>
        </footer>
      </div>
    </article>
  )
}
