"use client"

import { convertToLocale } from "@lib/util/money"
import { PLATCE_DPH } from "@lib/util/dph"
import styles from "./style.module.scss"
import { pickupPointLabel } from "@lib/util/pickup-point"
import { isPackagingLine } from "@lib/util/packaging"
import { packagingFor } from "@modules/common/components/packaging-line"

/**
 * What the customer is about to pay for, in one block: the objects, where they are going,
 * and the total including VAT. This is the "let me check everything once more" moment.
 *
 * `deposit` = zakázka: kolik se platí TEĎ a kolik po dokončení. „Celkem" je
 * cena celé objednávky, ale brána vezme jen zálohu — předsmluvní informace
 * musí říct obojí (§ 1820 OZ), jinak „Celkem" vypadá jako to, co se strhne.
 */
export default function OrderRecap({
  cart,
  deposit,
}: {
  cart: any
  deposit?: { now: number; later: number } | null
}) {
  const currency_code = cart?.currency_code ?? "czk"
  const money = (amount?: number | null) =>
    convertToLocale({ amount: amount ?? 0, currency_code })

  const address = cart?.shipping_address
  const shippingMethod = cart?.shipping_methods?.at(-1)
  const pickupPoint = pickupPointLabel(cart?.metadata as Record<string, unknown>)

  return (
    <div className={styles.recap}>
      <section className={styles.recapBlock} aria-labelledby="recap-items">
        <h3 id="recap-items">Co objednáváte</h3>
        <ul className={styles.itemList}>
          {/* Ceník vpravo (Matěj 12. 10.): „1× cena výrobku", pod tím
              „Balné 1× cena", čára a součet obojího. */}
          {((cart?.items ?? []) as any[])
            .filter((item: any) => !isPackagingLine(item) || !(cart?.items ?? []).some((other: any) => !isPackagingLine(other) && packagingFor(cart?.items as any[], other) === item))
            .map((item: any) => {
              const pack = packagingFor(cart?.items as any[], item) as any
              const packTotal = pack ? Number(pack.unit_price ?? 0) * Number(pack.quantity ?? 0) : 0
              return (
                <li key={item.id}>
                  <span className={styles.itemTitle}>
                    {item.product_title ?? item.title}
                    {item.variant_title ? ` · ${item.variant_title}` : ""}
                  </span>
                  <span className={styles.itemPrices}>
                    <span className={styles.itemLine}>
                      <span className={styles.itemQuantity}>{item.quantity}×</span>{" "}
                      {money(item.unit_price)}
                    </span>
                    {pack && (
                      <span className={`${styles.itemLine} ${styles.itemPackaging}`} data-testid="packaging-note">
                        Balné <span className={styles.itemQuantity}>{pack.quantity}×</span>{" "}
                        {money(pack.unit_price)}
                      </span>
                    )}
                    <span className={styles.itemTotal}>{money(Number(item.total ?? 0) + packTotal)}</span>
                  </span>
                </li>
              )
            })}
        </ul>
      </section>

      <div className={styles.recapColumns}>
        <section className={styles.recapBlock} aria-labelledby="recap-delivery">
          <h3 id="recap-delivery">Doručení</h3>
          {address ? (
            <p className={styles.recapText}>
              {address.first_name} {address.last_name}
              <br />
              {address.address_1}
              <br />
              {address.postal_code} {address.city}
              <br />
              {address.country_code?.toUpperCase()}
            </p>
          ) : (
            <p className={styles.recapText}>Adresu jste zatím nevyplnili.</p>
          )}
          {shippingMethod && (
            <p className={styles.recapNote}>
              {/* `amount`, ne `total`: výběr polí v `retrieveCart` u dopravy
                  `total` nevrací, takže se tu cena vykreslovala jako „0,-" —
                  vedle řádku „Doprava 90,-" o dva bloky níž. */}
              {shippingMethod.name} ·{" "}
              {money(shippingMethod.total ?? shippingMethod.amount)}
            </p>
          )}
        </section>

        <section className={styles.recapBlock} aria-labelledby="recap-total">
          {/* „Cena", ne „Platba": způsob platby má vlastní řádek
              v předsmluvních informacích pod rekapitulací. */}
          <h3 id="recap-total">Cena</h3>
          <dl className={styles.totals}>
            <div>
              <dt>Mezisoučet</dt>
              {/* Ne `subtotal`: do toho Medusa počítá i dopravu, takže sloupec
                  vycházel jako „363 + 90 = 363".

                  A ne `item_total`: ten je až PO odečtení akcí, takže se sleva
                  o řádek níž započítala podruhé — naměřeno na košíku s 28%
                  akcí: 2 419 − 941 = 2 419. `item_subtotal` je týž součet před
                  akcemi, tedy ta částka, od které se sleva odečítá. */}
              <dd>{money(cart?.item_subtotal)}</dd>
            </div>
            {Boolean(cart?.item_discount_total) && (
              <div>
                <dt>Sleva</dt>
                {/* Sleva na ZBOŽÍ. `discount_total` nese i tu dopravní, jenže
                    řádek Doprava pod tím ukazuje cenu po slevě — odečetlo by
                    se to dvakrát. Doprava zdarma se tedy neukáže jako sleva,
                    ale jako nula u dopravy, což je totéž a čitelnější. */}
                <dd>−{money(cart?.item_discount_total)}</dd>
              </div>
            )}
            <div>
              <dt>Doprava</dt>
              <dd>{money(cart?.shipping_total)}</dd>
            </div>
            <div className={styles.totalRow}>
              <dt>Celkem</dt>
              <dd>{money(cart?.total)}</dd>
            </div>
          </dl>
          {deposit && (
            <p className={styles.depositNote} data-testid="recap-deposit">
              {deposit.later > 0 ? (
                <>
                  Teď zaplatíte zálohu <strong>{money(deposit.now)}</strong> ·
                  zbytek {money(deposit.later)} po dokončení zakázky.
                </>
              ) : (
                <>
                  Teď zaplatíte celou částku <strong>{money(deposit.now)}</strong>.
                </>
              )}
            </p>
          )}
          {/* Jen pro plátce DPH — viz `lib/util/dph.ts`. Bez daně by ta věta
              tvrdila, že v ceně nějaká je. */}
          {PLATCE_DPH && (
            <p className={styles.vatNote}>
              Včetně DPH {money(cart?.tax_total)}. Tolik zaplatíte.
            </p>
          )}
        </section>
      </div>

      {/* The pickup point is the single detail most often lost between checkout and the
          confirmation; showing it here is the customer's last chance to catch a wrong one.
          Full-width section pod řádkem Doručení/Platba, oddělená stejnou horní linkou jako
          ostatní sekce souhrnu — ne stěsnaná v úzkém levém sloupci Doručení. */}
      {pickupPoint && (
        <p className={styles.pickupPoint}>
          <span>Výdejní místo</span>
          {pickupPoint}
        </p>
      )}
    </div>
  )
}
