"use client"

// Button from Medusa UI removed in favor of local LinkButton

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  PREMIUM_BUTTON_ACTIVE,
  PREMIUM_BUTTON_REST,
  premiumButtonFillTransition,
  premiumButtonFillVariants,
} from "@modules/common/components/premium-action-button/motion"
import { HttpTypes } from "@medusajs/types"
import type { ShippingFrom } from "../shipping-from"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import s from "./summary.module.scss"

import { motion } from 'framer-motion';

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
  /** Nejlevnější doprava, dokud není zvolená („od …"). */
  shippingFrom?: ShippingFrom | null
  /**
   * Blok `kosik.vypis` — `souhrn.oboci`, `souhrn.nadpis` (široké okno),
   * `souhrn.nadpis-kratky` (telefon), `souhrn.tlacitko`. Částky jsou v kódu.
   */
  copy?: CopyBlock
}

/** Kam pokladna otevře — čte to i lepkavý pruh na telefonu (checkout-bar). */
export function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart, shippingFrom, copy }: SummaryProps) => {
  /* Souhrn se po zapnutí editace sám nepřekreslí. Viz hook. */
  useEditRerender()
  const step = getCheckoutStep(cart)

  return (
    <div className={s.root}>
      {/*
        * Obal, který na širokém okně NEEXISTUJE: `.head` i `.heading` mají
        * `display: contents`, takže se jejich děti skládají do sloupce souhrnu
        * přesně jako dřív. Teprve na svislém telefonu se z něj stane řádek,
        * kde vedle nadpisu sedí slevový kód — souhrn tam byl na výšku delší
        * než výpis, ke kterému patří.
        */}
      <div className={s.head}>
        <div className={s.heading}>
          <p className={s.eyebrow} {...editableItem(copy, "souhrn.oboci")}>
            {itemText(copy, "souhrn.oboci", "Objednávka")}
          </p>
          {/* Dvě znění, přepínaná zobrazením — ne `aria-hidden`: to by na
              telefonu nechalo nadpis bez přístupného textu, protože skryté
              „Kolik to dělá" ze stromu vypadne. Čtečka přečte to, co je vidět.
              Krátké „Souhrn" tu není jen kvůli místu na sebe: vedle nadpisu
              teď stojí slevový kód a jeho rozbalené pole potřebuje šířku. */}
          <h2 className={s.title}>
            <span className={s.titleWide} {...editableItem(copy, "souhrn.nadpis")}>
              {itemText(copy, "souhrn.nadpis", "Kolik to dělá")}
            </span>
            <span className={s.titleNarrow} {...editableItem(copy, "souhrn.nadpis-kratky")}>
              {itemText(copy, "souhrn.nadpis-kratky", "Souhrn")}
            </span>
          </h2>
        </div>
        <div className={s.discountSlot}>
          <DiscountCode cart={cart} />
        </div>
      </div>
      {/* Obal, aby se dal rozpad na svislém tabletu skrýt — tam ho nese
          plovoucí pruh nad spodní lištou (checkout-bar). */}
      <div className={s.totalsSlot}>
        <Divider />
        <CartTotals totals={cart} shippingFrom={shippingFrom} />
      </div>
      {/* Text tlačítka bez anotace v místě — vnitřek si animuje tlačítko samo. */}
      <LinkButton
        text={itemText(copy, "souhrn.tlacitko", "Pokračovat k pokladně")}
        href={"/checkout?step=" + step}
        buttonClassName={s.button}
        dataTestId="checkout-button"
      />
    </div>
  )
}

export default Summary


type LinkButtonProps = {
  text: string;
  href: string;
  className?: string;
  buttonClassName?: string;
  dataTestId?: string;
}

// This is base button for every button animation inside the website.

function LinkButton({ text, href, className, buttonClassName, dataTestId } : LinkButtonProps) {
  return (
    <LocalizedClientLink href={href} className={className ?? s.LinkButton}>
      <motion.button
        className={buttonClassName ?? s.button}
        data-testid={dataTestId}
        initial={PREMIUM_BUTTON_REST}
        animate={PREMIUM_BUTTON_REST}
        whileHover={PREMIUM_BUTTON_ACTIVE}
        whileFocus={PREMIUM_BUTTON_ACTIVE}
        whileTap={whileTap}
      >
        <motion.span
          className={s.indicator}
          variants={premiumButtonFillVariants}
          style={styleObj}
          transition={premiumButtonFillTransition}
        />
        <span className={s.label}>{text}</span>
      </motion.button>
    </LocalizedClientLink>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const whileTap = { scale: .985 }
const styleObj = { originX: 0 }
