"use client"

import { XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OrderDetails from "@modules/order/components/order-details"
import OrderSummary from "@modules/order/components/order-summary"
import ShippingDetails from "@modules/order/components/shipping-details"
import React, { useState } from "react"
import s from "./styles/order-details.module.scss"
import BgImage from "@modules/account/components/BgImage"
import { useFormStatus } from "react-dom"
import { motion } from "framer-motion"

type OrderDetailsTemplateProps = {
  order: HttpTypes.StoreOrder
}

const OrderDetailsTemplate: React.FC<OrderDetailsTemplateProps> = ({
  order,
}) => {
  return (
    <main className={s.root}>
      <div className={s.content} data-testid="order-details-page-wrapper">
        <div className={s.header}>
          <h1 className={s.title}>Detaily objednávky</h1>
          <ClickButton
            href="/account/orders"
            text="Zpět na přehled"
            className={s.backLink}
            data-testid="back-to-overview-button"
          />
        </div>
        <div className={s.container} data-testid="order-details-container">
          <OrderDetails order={order} showStatus />
          <Items order={order} />
          <ShippingDetails order={order} />
          <OrderSummary order={order} />
          <Help />
        </div>
      </div>
      <BgImage src="/assets/img/img/2.jpg" />
    </main>
  )
}

export default OrderDetailsTemplate



function PerspectiveText({label, className, textColor, component}: {label: string; className?: string; textColor?: string, component?: React.ReactNode}) {
  return (    
    <div className={s.perspectiveText}>
        <p 
          className={className}
          style={{
            color: textColor,
          }}
        >
          {label}
          {component}
        </p>
        <p 
          className={className}
          style={{
            color: textColor,
          }}
        >
          {label}
          {component}
        </p>
    </div>
  )
}

type ClickButtonProps = {
  text: string;
  onClickAction?: () => void | Promise<void>;
  ClickAction?: () => void | Promise<void>; // backward compatibility
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  "data-testid"?: string;
  href: string;
}

// Base animated button used across the site. Can act as a submit button in forms.
function ClickButton({ onClickAction, ClickAction, href, disabled = false, text, type = "button", className, "data-testid": dataTestId }: ClickButtonProps) {
  const [ isActive , setIsActive ] = useState<boolean>(false);
  const { pending } = useFormStatus();
  const isSubmitting = type === "submit" ? pending : false;
  const isDisabled = disabled || isSubmitting;
  const handleClick = onClickAction ?? ClickAction;

  return (
    <LocalizedClientLink href={href} className={className ? `${s.ClickButton} ${className}` : s.ClickButton}>
      <button
        type={type}
        className={s.button}
        onClick={handleClick}
        disabled={isDisabled}
        aria-busy={isDisabled || undefined}
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
            <PerspectiveText label={text} component={<XMark />} />
          </div>
          <div
            className={s.el}
            style={{ backgroundColor: "var(--bgBlack)" }}
          >
            <PerspectiveText label={text} component={<XMark />} />
          </div>
        </motion.div>
      </button>
    </LocalizedClientLink>
  )
}
