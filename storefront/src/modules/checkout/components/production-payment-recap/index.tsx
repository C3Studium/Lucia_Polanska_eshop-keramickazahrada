import { convertToLocale } from "@lib/util/money"
import type { ProductionPaymentMode } from "@lib/util/made-to-order"

import styles from "./style.module.scss"
import { getTexty } from "@lib/data/texty"

/**
 * Zjednodušená připomínka volby „kolik zaplatit teď" do pravého souhrnu.
 *
 * Rozhodnutí se dělá v kroku Platba (plný widget se slajderem a předvolbami);
 * tady už jen čteme, co je uložené na košíku — kolik se platí hned a kolik
 * zbývá doplatit. Žádné ovládání, aby se tatáž částka neupravovala na dvou
 * místech. Hodnota je z posledního serverového renderu (po změně se košík
 * revaliduje), takže se srovná při přechodu na další krok.
 *
 * Bez zakázky (`has_made_to_order === false`) nevykreslí nic.
 */
export default async function ProductionPaymentRecap({
  mode,
}: {
  mode?: ProductionPaymentMode | null
}) {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = await getTexty()
  if (!mode?.has_made_to_order) {
    return null
  }

  const currency_code = mode.currency_code ?? "czk"
  const money = (amount: number) => convertToLocale({ amount, currency_code })

  // Tatáž logika jako v plném widgetu i v rekapitulaci Přehledu: konce jsou
  // vlastní režimy, custom nese přesnou částku ze slideru.
  const chargeNow =
    mode.mode === "full"
      ? mode.full_amount
      : mode.mode === "custom"
        ? mode.custom?.amount ?? mode.deposit_amount
        : mode.deposit_amount
  const outstanding = Math.max(0, mode.full_amount - chargeNow)

  return (
    <section className={styles.root} data-testid="production-payment-recap">
      <p className={styles.eyebrow}>Zakázková výroba</p>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Zaplatíte teď</span>
          <strong className={styles.now}>{money(chargeNow)}</strong>
        </div>
        {outstanding > 0 && (
          <div className={styles.row}>
            <span className={styles.label}>Zbývá doplatit</span>
            <span className={styles.later}>{money(outstanding)}</span>
          </div>
        )}
      </div>

      <p className={styles.note}>
        {outstanding > 0
          ? texty["zakazka.doplatek_recap"]
          : "Platíte celou částku — pak už nic neřešíte."}
      </p>
    </section>
  )
}
