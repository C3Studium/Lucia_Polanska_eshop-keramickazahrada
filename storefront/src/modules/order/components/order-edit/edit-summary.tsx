"use client"

import type { EditPreview } from "@lib/data/order-edit"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { czk, signedCzk } from "./shared"
import type { PreviewState } from "./use-edit-preview"
import s from "./style.module.scss"

export type EditConfirmation = {
  message: string
  /** Odkaz na stav žádosti o vrácení rozdílu (levněji na kartu). */
  claimsHref: string | null
}

/**
 * Souhrn úpravy — přilepený ke spodku okna, dokud je co ukládat.
 *
 * Všechno, co tu stojí o penězích, je ze serveru (`EditPreview`): Bylo / Bude /
 * Rozdíl, věta o poštovném a slevovém kódu a jedna věta, co se stane
 * s penězi. Klient nic nedopočítává — u objednávky se slevou a poštovným by
 * se jeho odhad s pravdou rozešel. Jedno tlačítko, jehož text říká, co se
 * stane: „Uložit změny", nebo „Zaplatit rozdíl X Kč", když karta a dráž.
 */
export default function EditSummary({
  actionsCount,
  state,
  current,
  last,
  saving,
  submitError,
  atLimit,
  confirmation,
  onSave,
  onDismissConfirmation,
}: {
  actionsCount: number
  state: PreviewState
  /** Náhled přesně pro aktuální návrh — jen s ním jde uložit. */
  current: EditPreview | null
  /** Poslední známý náhled — během přepočtu zašedlý. */
  last: EditPreview | null
  saving: boolean
  submitError: string | null
  atLimit: boolean
  confirmation: EditConfirmation | null
  onSave: () => void
  onDismissConfirmation: () => void
}) {
  if (actionsCount === 0) {
    if (confirmation) {
      return (
        <section className={s.summary} data-active="" data-tone="done" role="status">
          <div className={s.confirmation}>
            <p className={s.confirmationTitle}>Úprava je uložená.</p>
            <p className={s.summaryText}>{confirmation.message}</p>
            <div className={s.confirmationActions}>
              {confirmation.claimsHref && (
                <LocalizedClientLink className={s.pill} href={confirmation.claimsHref}>
                  Stav vrácení rozdílu
                </LocalizedClientLink>
              )}
              <button
                type="button"
                className={s.pill}
                data-tone="quiet"
                onClick={onDismissConfirmation}
              >
                Rozumím
              </button>
            </div>
          </div>
        </section>
      )
    }
    return (
      <section className={s.summary}>
        <p className={s.summaryText}>
          Zatím žádná změna. Upravte počet, vyměňte provedení nebo přidejte kus —
          rozdíl ceny uvidíte tady, ještě než cokoli uložíte.
        </p>
      </section>
    )
  }

  const shown = current ?? last
  const busy = state.status === "waiting"
  const ruleError = state.status === "error" ? state.message : null
  const diff = shown?.difference ?? 0
  const collect = current?.settlement.kind === "collect"

  const label = saving
    ? "Ukládáme…"
    : busy
      ? "Počítáme rozdíl…"
      : collect && current
        ? `Zaplatit rozdíl ${czk(current.settlement.amount)}`
        : "Uložit změny"

  return (
    <section className={s.summary} data-active="" aria-label="Souhrn změn">
      <div className={s.summaryTop}>
        {/* Bez aktuálního náhledu (přepočet, chyba) jsou čísla zašedlá —
            patří k předchozímu stavu návrhu, ne k tomu na obrazovce. */}
        <dl className={s.totals} data-stale={!current || undefined}>
          <div>
            <dt>Bylo</dt>
            <dd>{shown ? czk(shown.total_before) : "…"}</dd>
          </div>
          <div>
            <dt>Bude</dt>
            <dd>{shown ? czk(shown.total_after) : "…"}</dd>
          </div>
          <div data-tone={diff > 0 ? "up" : diff < 0 ? "down" : "same"}>
            <dt>Rozdíl</dt>
            <dd>{shown ? signedCzk(diff) : "…"}</dd>
          </div>
        </dl>
        <button
          type="button"
          className={s.save}
          onClick={onSave}
          disabled={!current || saving || busy}
        >
          {label}
        </button>
      </div>

      <div aria-live="polite" className={s.summaryNotes}>
        {busy && <p className={s.summaryMeta}>Přepočítáváme…</p>}
        {current && (
          <>
            {current.shipping_note && (
              <p className={s.summaryMeta}>{current.shipping_note}</p>
            )}
            {current.promo_note && (
              <p className={s.summaryMeta}>{current.promo_note}</p>
            )}
            {current.money_sentence && (
              <p className={s.summaryText}>{current.money_sentence}</p>
            )}
          </>
        )}
        {atLimit && (
          <p className={s.summaryMeta}>
            Víc než 30 změn najednou uložit nejde — nejdřív uložte tyhle.
          </p>
        )}
      </div>

      {(ruleError || submitError) && (
        <p className={s.summaryError} role="alert">
          {submitError ?? ruleError}
        </p>
      )}
    </section>
  )
}
