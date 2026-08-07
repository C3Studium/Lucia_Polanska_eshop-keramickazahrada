import { Link } from "@react-email/components"
import { brand, Note, P } from "./email-ui"

/**
 * „Než zásilku převezmete" — the one paragraph that decides who pays for a broken pot.
 *
 * ## Why this is in the e-mail and not only in the terms
 *
 * The obligation to inspect the parcel on handover is already in `smluvni-podminky`, written
 * correctly, and read by nobody. It is only useful in the ninety seconds the customer stands
 * in front of the courier — so it goes in the shipment e-mail, which is the last thing they
 * read before that moment, and in the delivered e-mail, where the two-day window is still open.
 *
 * ## The facts, from Česká pošta's own rules
 *
 * - The **recipient** files the claim, not the sender. She cannot do it for them, which is why
 *   this has to be told to the customer rather than handled quietly at the shop's end.
 * - **At handover, or within two working days** of delivery. After that the claim is refused.
 * - Filed at any branch or through ČP's *eReklamace*; proof of value and photographs attached.
 *
 * Which is the whole reason for the warning: a parcel accepted without inspection, discovered
 * broken on day three, is nobody's liability but the customer's. Saying so before it happens
 * is kinder than saying so afterwards.
 */

export const CP_EREKLAMACE_URL = "https://www.ceskaposta.cz/ereklamace"

/** Shown before the parcel arrives — what to do at the door. */
export const CarrierDamageWarning = () => (
  <Note tone="clay">
    Až zásilku převezmete, prosím prohlédněte si obal ještě před podpisem. Je-li
    obal promáčklý, protržený nebo něčím prosakuje, rozbalte zásilku rovnou před
    doručovatelem. Poškození je potřeba nahlásit při převzetí, nejpozději do dvou
    pracovních dnů — potom už reklamaci Česká pošta nepřijme.
  </Note>
)

/** Shown after delivery, while the two-day window is still open. */
export const CarrierDamageClaim = ({
  orderNumber,
  claimUrl,
}: {
  orderNumber?: string | number
  /** Storefront page carrying the claim block and the document. */
  claimUrl?: string
}) => (
  <>
    <P>
      <strong>Dorazila zásilka poškozená?</strong> Reklamaci u České pošty
      podává příjemce — tedy vy — a je na to čas jen{" "}
      <strong>dva pracovní dny</strong> od doručení. Stačí zajít na kteroukoli
      pobočku, nebo ji podat online v{" "}
      <Link href={CP_EREKLAMACE_URL} style={{ color: brand.clay }}>
        eReklamaci České pošty
      </Link>
      . Přiložte fotky poškození a doklad o ceně zboží
      {orderNumber ? ` (objednávka č. ${orderNumber})` : ""}.
    </P>
    {claimUrl && (
      <P>
        Podklady i postup krok za krokem najdete tady:{" "}
        <Link href={claimUrl} style={{ color: brand.clay }}>
          {claimUrl}
        </Link>
      </P>
    )}
    <P>
      Ozvěte se nám prosím i tak — o poškozené zásilce chceme vědět, i když
      reklamaci řeší dopravce.
    </P>
  </>
)
