"use client"

import { BundleProduct } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "../Card"
import { Payment } from "../Payment"
import { Product } from "../Product"
import { Shipping } from "../Shipping"
import styles from "../style.module.scss"
import type { ComgatePaymentMethod } from "@lib/util/comgate"

type ActiveStep = "selection" | "delivery" | "payment"

type RouterProps = {
  product: HttpTypes.StoreProduct
  bundle?: BundleProduct
  cart: HttpTypes.StoreCart | null
  region: HttpTypes.StoreRegion
  shippingMethods: HttpTypes.StoreCartShippingOption[]
  paymentMethods: HttpTypes.StorePaymentProvider[]
  comgateMethods: ComgatePaymentMethod[]
  handle: string
  countryCode: string
  packetaApiKey?: string
  packetaShippingMethodId?: string
}

export const Router = ({
  product,
  bundle,
  cart,
  region,
  shippingMethods,
  paymentMethods,
  comgateMethods,
  handle,
  countryCode,
  packetaApiKey,
  packetaShippingMethodId,
}: RouterProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = `/${countryCode}/express-checkout/${handle}`
  const bundleProductIds = new Set(
    bundle?.items.map((item) => item.product.id) || []
  )
  const matchesProduct = !!cart?.items?.some(
    (item) => item.product_handle === handle || item.product_id === product.id
  )
  const matchesBundle =
    !!bundle &&
    !!cart?.items?.length &&
    cart.items.every((item) => bundleProductIds.has(item.product_id!))
  const hasSelection =
    !!cart?.items?.length && (matchesProduct || matchesBundle)
  const hasAddress = !!cart?.shipping_address && !!cart?.email
  const hasShipping = !!cart?.shipping_methods?.length

  const requested = searchParams.get("step")
  let active: ActiveStep =
    requested === "delivery" || requested === "payment"
      ? requested
      : "selection"

  if (!hasSelection) active = "selection"
  else if (active === "payment" && (!hasAddress || !hasShipping)) {
    active = "delivery"
  }

  const go = (step: ActiveStep) => {
    if (step === "delivery" && !hasSelection) return
    if (step === "payment" && (!hasAddress || !hasShipping)) return
    const suffix = step === "selection" ? "" : `?step=${step}`
    router.push(`${basePath}${suffix}`, { scroll: false })
  }

  const advance = (step: ActiveStep) => {
    go(step)
    router.refresh()
  }

  const selectedTitle =
    cart?.items?.length === 1
      ? cart.items[0].product_title || cart.items[0].title
      : `${cart?.items?.length || 0} kusů dohromady`

  return (
    <>
      <motion.header
        className={styles.intro}
        initial="hidden"
        animate="visible"
        variants={variants}
      >
        <motion.div
          className={styles.introLine}
          variants={variants2}
        >
          Rychlý nákup · {countryCode.toUpperCase()}
        </motion.div>
        <motion.h1
          variants={variants3}
        >
          Rychlý nákup.
          <em>Bez zbytečného klikání.</em>
        </motion.h1>
        <motion.p
          variants={variants4}
        >
          Vyberete provedení, doručení a bezpečně zaplatíte. Tři kroky
          a je to.
        </motion.p>
      </motion.header>

      <nav className={styles.progress} aria-label="Postup rychlého nákupu">
        <span data-active={active === "selection"}>01 Výběr</span>
        <span data-active={active === "delivery"}>02 Doručení</span>
        <span data-active={active === "payment"}>03 Platba</span>
      </nav>

      <main>
        <Card
          step="01"
          title="Co kupujete"
          isActive={active === "selection"}
          isDone={hasSelection}
          summary={hasSelection ? selectedTitle : undefined}
          onOpenAction={() => go("selection")}
        >
          <Product
            product={product}
            bundle={bundle}
            region={region}
            countryCode={countryCode}
            onContinueAction={() => advance("delivery")}
          />
        </Card>

        <Card
          step="02"
          title="Doručení"
          isActive={active === "delivery"}
          isDone={hasAddress && hasShipping}
          summary={
            hasAddress
              ? `${cart?.shipping_address?.city} · ${
                  cart?.shipping_methods?.at(-1)?.name || "vyberte dopravu"
                }`
              : undefined
          }
          onOpenAction={() => go("delivery")}
        >
          {cart && (
            <Shipping
              cart={cart}
              region={region}
              countryCode={countryCode}
              shippingMethods={shippingMethods}
              packetaApiKey={packetaApiKey}
              packetaShippingMethodId={packetaShippingMethodId}
              onContinueAction={() => advance("payment")}
            />
          )}
        </Card>

        <Card
          step="03"
          title="Platba"
          isActive={active === "payment"}
          isDone={false}
          summary="Bezpečné dokončení objednávky"
          onOpenAction={() => go("payment")}
        >
          {cart && (
            <Payment
              cart={cart}
              paymentMethods={paymentMethods}
              comgateMethods={comgateMethods}
              countryCode={countryCode}
              handle={handle}
            />
          )}
        </Card>
      </main>

      <footer className={styles.trust}>
        <span>Bezpečná platba</span>
        <span>Pečlivé balení</span>
        <span>Poradíme z ateliéru</span>
      </footer>
    </>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const variants = {
          hidden: {},
          visible: { transition: { staggerChildren: 0.09 } },
        }
const variants2 = {
            hidden: { opacity: 0, y: 8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
            },
          }
const variants3 = {
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
            },
          }
const variants4 = {
            hidden: { opacity: 0, y: 10 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
            },
          }
