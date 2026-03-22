"use client"

// Button from Medusa UI removed in favor of local LinkButton

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import s from "./summary.module.scss"

import { motion } from 'framer-motion';
import { useState } from 'react';

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
      <h2 className={s.title}>Souhrn vašeho Košíku</h2>
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
  const [ isActive , setIsActive ] = useState<boolean>(false);
  return (
    <LocalizedClientLink href={href} className={className ?? s.LinkButton}>
      <button 
        className={buttonClassName ?? s.button}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        data-testid={dataTestId}
      >
        <motion.div 
          className={s.slider}
          animate={{top: isActive ? "-100%" : "0%"}}
          transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1]}}
        >
          <div 
            className={s.el}
            style={{ backgroundColor: "var(--darkOlive)" }}
          >
            <PerspectiveText label={text}/>
          </div>
          <div 
            className={s.el}
            style={{ backgroundColor: "var(--bgPrimary)" }}
          >
            <PerspectiveText label={text}/>
          </div>
        </motion.div>
      </button>
    </LocalizedClientLink>
  )
}

function PerspectiveText({label}: {label: string}) {
    return (    
        <div className={s.perspectiveText}>
            <p>{label}</p>
            <p>{label}</p>
        </div>
    )
}