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
import s from "./summary.module.scss"

import { motion } from 'framer-motion';

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className={s.root}>
      <p className={s.eyebrow}>Objednávka</p>
      <h2 className={s.title}>Souhrn košíku</h2>
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      <LinkButton
        text="Pokračovat k pokladně"
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
