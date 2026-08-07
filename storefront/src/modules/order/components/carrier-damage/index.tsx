import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

/**
 * Poškozená zásilka — what to do, and the window it has to happen in.
 *
 * ## Why the customer is told rather than the shop handling it
 *
 * Under Česká pošta's rules the **recipient** files a transport claim, not the sender. She
 * physically cannot do it on their behalf. So the only useful thing the shop can do is tell
 * them clearly, early, and while the clock is still running:
 *
 * - inspect the packaging **before signing**, and open it in front of the courier if anything
 *   looks wrong;
 * - report damage at handover or **within two working days** — after that ČP refuses the claim;
 * - file at any branch or through *eReklamace*, with photographs and proof of value.
 *
 * A parcel accepted without inspection and found broken on day three is nobody's liability but
 * the customer's. Saying so before it happens is kinder than saying so afterwards, which is
 * why this sits on the order rather than only in the terms.
 *
 * ## Shown for carrier deliveries only
 *
 * Osobní odběr has no courier to inspect in front of and no carrier to claim against. Showing
 * it there would be noise, and noise is how the warning stops being read on the orders where
 * it matters.
 */

export const CP_EREKLAMACE_URL = "https://www.ceskaposta.cz/ereklamace"

type Props = {
  orderNumber?: string | number
  /** False for Osobní odběr — no carrier, no claim. */
  isCarrierDelivery: boolean
  /** `pending` before dispatch (warn), `delivered` after (how to claim). */
  stage?: "pending" | "delivered"
}

export default function CarrierDamageNotice({
  orderNumber,
  isCarrierDelivery,
  stage = "pending",
}: Props) {
  if (!isCarrierDelivery) {
    return null
  }

  return (
    <section className={styles.root} aria-labelledby="carrier-damage-heading">
      <p className={styles.eyebrow}>Převzetí zásilky</p>
      <h3 className={styles.heading} id="carrier-damage-heading">
        {stage === "delivered"
          ? "Dorazila zásilka poškozená?"
          : "Než zásilku převezmete"}
      </h3>

      {stage === "pending" ? (
        <p className={styles.lede}>
          Prohlédněte si prosím obal ještě před podpisem. Je-li promáčklý,
          protržený nebo něčím prosakuje, rozbalte zásilku rovnou před
          doručovatelem. Keramika se rozbije tiše — zvenku bývá krabice v pořádku.
        </p>
      ) : (
        <p className={styles.lede}>
          Reklamaci u dopravce podává příjemce, tedy vy — my ji za vás bohužel
          podat nemůžeme. Máte na ni dva pracovní dny od doručení.
        </p>
      )}

      <ol className={styles.steps}>
        <li>
          <strong>Vyfoťte</strong> obal i obsah, ještě než cokoli vybalíte dál.
        </li>
        <li>
          <strong>Nahlaste to do dvou pracovních dnů</strong> — na kterékoli
          pobočce České pošty, nebo online v{" "}
          <a href={CP_EREKLAMACE_URL} target="_blank" rel="noreferrer">
            eReklamaci
          </a>
          . Po této lhůtě už Česká pošta reklamaci nepřijme.
        </li>
        <li>
          <strong>Přiložte doklad o ceně</strong> zboží
          {orderNumber ? ` a číslo objednávky ${orderNumber}` : ""}.
        </li>
        <li>
          <strong>Dejte vědět i nám.</strong> O poškozené zásilce chceme vědět,
          i když ji řeší dopravce.
        </li>
      </ol>

      {/* TODO: add the document — the prefilled claim form goes here once it exists.
          Kept visible rather than hidden behind a flag so it cannot be forgotten. */}
      <div className={styles.document}>
        <p className={styles.documentLabel}>Formulář k reklamaci</p>
        <p className={styles.documentNote}>
          {/* TODO: add the document (PDF) and replace this note with the download link. */}
          Dokument sem doplníme — do té doby použijte formulář přímo na pobočce
          nebo v eReklamaci České pošty.
        </p>
      </div>

      <p className={styles.more}>
        Podrobný postup a vaše práva najdete v{" "}
        <LocalizedClientLink href="/reklamacni-protokol">
          reklamačním řádu
        </LocalizedClientLink>
        .
      </p>
    </section>
  )
}
