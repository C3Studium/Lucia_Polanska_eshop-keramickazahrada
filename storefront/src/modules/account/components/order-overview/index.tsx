"use client"

import { useState } from "react"
import { motion } from 'framer-motion';

import OrderCard from "../order-card"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import s from "./style.module.scss"

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
  if (orders?.length) {
    return (
      <div className={s.root}>
        {orders.map((o) => (
          <div key={o.id} className={s.itemWrap}>
            <OrderCard order={o} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={s.empty} data-testid="no-orders-container">
      <div className={s.emptyContent}>
        <h2 className={s.title}>Nic tu nemáte...</h2>
        <p className={s.desc}>
          Zatím nemáte žádné objednávky, pojďme to změnit {":)"}
        </p>
      </div>
      <div className={s.ctaWrap}>
        <LinkButton 
          text="Pokračovat v nakupování" 
          href="/" 
        />
      </div>
    </div>
  )
}

export default OrderOverview


type LinkButtonProps = {
    text: string;
    href: string; 
}

// This is base button for every button animation inside the website.

function LinkButton({ text, href } : LinkButtonProps) {
    const [ isActive , setIsActive ] = useState<boolean>(false);
    return (
        <LocalizedClientLink href={href} className={s.LinkButton}>
            <button 
                className={s.button}
                onMouseEnter={() => setIsActive(true)}
                onMouseLeave={() => setIsActive(false)}
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
