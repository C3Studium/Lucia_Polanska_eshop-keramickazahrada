"use client"

import { BundleProduct } from "@lib/data/products"
import type { ExpressPrefillAddress } from "@lib/data/express-cart"
import { withCount } from "@lib/util/plurals"
import { HttpTypes } from "@medusajs/types"
import { CheckCircle } from "@medusajs/icons"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Payment } from "../Payment"
import { Product } from "../Product"
import { Shipping } from "../Shipping"
import styles from "../style.module.scss"
import type { ComgatePaymentMethod } from "@lib/util/comgate"

type ActiveStep = "selection" | "delivery" | "payment"

const STEP_ORDER: ActiveStep[] = ["selection", "delivery", "payment"]

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
  /** Logged-in customer's saved address — the delivery form starts filled. */
  prefillAddress?: ExpressPrefillAddress | null
}

/**
 * The whole express purchase as ONE stepper: a progress rail on top, a single
 * animated stage below it. The URL still carries `?step=…` so refresh and
 * deep-links land on the right step — but it is written silently with
 * `history.replaceState`, never by navigating; the animation runs in place.
 */
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
  prefillAddress,
}: RouterProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  /* Reduced motion: steps swap as instant crossfades instead of sliding. */
  const reduceMotion = useReducedMotion()
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

  /* The step lives in client state; the URL only seeds it (deep-link, refresh)
     and silently follows it. Never above what the data allows. */
  const requestedParam = searchParams.get("step")
  const [requested, setRequested] = useState<ActiveStep>(
    requestedParam === "delivery" || requestedParam === "payment"
      ? requestedParam
      : "selection"
  )
  const [direction, setDirection] = useState(1)

  let active: ActiveStep = requested
  if (!hasSelection) active = "selection"
  else if (active === "payment" && (!hasAddress || !hasShipping)) {
    active = "delivery"
  }

  // Silent URL sync — refresh/deep-links keep working, history stays clean.
  useEffect(() => {
    const suffix = active === "selection" ? "" : `?step=${active}`
    const url = `${basePath}${suffix}`
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.replaceState(null, "", url)
    }
  }, [active, basePath])

  const go = (step: ActiveStep) => {
    if (step === "delivery" && !hasSelection) return
    if (step === "payment" && (!hasAddress || !hasShipping)) return
    setDirection(STEP_ORDER.indexOf(step) >= STEP_ORDER.indexOf(active) ? 1 : -1)
    setRequested(step)
  }

  /* A step finished a mutation: move on AND refetch the server data the next
     step reads (totals, shipping price, ComGate method list). The refresh runs
     in a transition so the stage can show a busy state until the fresh cart
     arrives — otherwise the next panel opens over stale numbers, or (first
     time through) nothing visibly happens until the gates unlock. */
  const [isRefreshing, startRefresh] = useTransition()
  const advance = (step: ActiveStep) => {
    setDirection(1)
    setRequested(step)
    startRefresh(() => router.refresh())
  }

  const selectedTitle =
    cart?.items?.length === 1
      ? cart.items[0].product_title || cart.items[0].title
      : `${withCount(cart?.items?.length || 0, "kus", "kusy", "kusů")} dohromady`

  const steps: {
    id: ActiveStep
    label: string
    done: boolean
    reachable: boolean
    summary?: string
  }[] = [
    {
      id: "selection",
      label: "Výběr",
      done: hasSelection,
      reachable: true,
      summary: hasSelection ? selectedTitle ?? undefined : undefined,
    },
    {
      id: "delivery",
      label: "Doručení",
      done: hasAddress && hasShipping,
      reachable: hasSelection,
      summary: hasAddress
        ? `${cart?.shipping_address?.city ?? ""} · ${
            cart?.shipping_methods?.at(-1)?.name || "vyberte dopravu"
          }`
        : undefined,
    },
    {
      id: "payment",
      label: "Platba",
      done: false,
      reachable: hasSelection && hasAddress && hasShipping,
      summary: undefined,
    },
  ]

  const backTarget: { step: ActiveStep; label: string } | null =
    active === "delivery"
      ? { step: "selection", label: "Zpět na výběr" }
      : active === "payment"
        ? { step: "delivery", label: "Zpět na doručení" }
        : null

  return (
    <>
      <motion.header
        className={styles.intro}
        initial={reduceMotion ? false : "hidden"}
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
        {steps.map((step, index) => (
          <button
            type="button"
            key={step.id}
            className={styles.progressStep}
            data-active={active === step.id}
            data-done={step.done}
            disabled={!step.reachable}
            aria-current={active === step.id ? "step" : undefined}
            onClick={() => go(step.id)}
          >
            <span className={styles.progressLabel}>
              {String(index + 1).padStart(2, "0")} {step.label}
              {step.done && (
                <CheckCircle className={styles.progressDone} aria-hidden="true" />
              )}
            </span>
            {step.summary && active !== step.id && (
              <span className={styles.progressSummary}>{step.summary}</span>
            )}
            {active === step.id && (
              <motion.span
                className={styles.progressIndicator}
                layoutId="express-progress-indicator"
                transition={reduceMotion ? instantTransition : indicatorTransition}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </nav>

      <motion.main
        className={styles.stage}
        layout
        transition={reduceMotion ? instantLayoutTransition : stageTransition}
        data-busy={isRefreshing || undefined}
        aria-busy={isRefreshing || undefined}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.section
            key={active}
            className={styles.stepPanel}
            custom={direction}
            variants={reduceMotion ? reducedPanelVariants : panelVariants}
            initial="enter"
            animate="center"
            exit="exit"
            aria-label={steps.find((step) => step.id === active)?.label}
          >
            {backTarget && (
              <button
                type="button"
                className={styles.stepBack}
                onClick={() => go(backTarget.step)}
              >
                ← {backTarget.label}
              </button>
            )}

            {active === "selection" && (
              <Product
                product={product}
                bundle={bundle}
                region={region}
                countryCode={countryCode}
                onContinueAction={() => advance("delivery")}
              />
            )}

            {active === "delivery" && cart && (
              <Shipping
                cart={cart}
                region={region}
                countryCode={countryCode}
                shippingMethods={shippingMethods}
                packetaApiKey={packetaApiKey}
                packetaShippingMethodId={packetaShippingMethodId}
                prefillAddress={prefillAddress}
                onContinueAction={() => advance("payment")}
              />
            )}

            {active === "payment" && cart && (
              <Payment
                cart={cart}
                paymentMethods={paymentMethods}
                comgateMethods={comgateMethods}
                countryCode={countryCode}
                handle={handle}
              />
            )}
          </motion.section>
        </AnimatePresence>
      </motion.main>

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
/* Entrance rises measured against the 1080px-tall design window and written in
   vh, so a 660px laptop gets a shorter rise instead of the same 20px shove:
   8/1080 = .74vh · 20/1080 = 1.85vh · 10/1080 = .93vh. Both ends of every
   interpolation carry the same unit — a bare 0 would be 0px and make framer
   mix two different value types. */
const variants2 = {
            hidden: { opacity: 0, y: "0.74vh" },
            visible: {
              opacity: 1,
              y: "0vh",
              transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
            },
          }
const variants3 = {
            hidden: { opacity: 0, y: "1.85vh" },
            visible: {
              opacity: 1,
              y: "0vh",
              transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
            },
          }
const variants4 = {
            hidden: { opacity: 0, y: "0.93vh" },
            visible: {
              opacity: 1,
              y: "0vh",
              transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
            },
          }

/* The stage: one panel at a time, sliding in the direction of travel while the
   container's height follows — the same easing family the flow already uses. */
/* The slide is PANEL-relative, not window-relative: the stage sits inside the
   frame, so a vw path would over-travel on a wide monitor while the panel it
   moves stays the same size. Measured stage width 562px, so the old fixed
   travel converts as 40/562 = 7.1% in and 30/562 = 5.3% out — identical today,
   and it keeps pace on its own once the frame grows with the ≥1921 ramp. */
const PANEL_ENTER_PCT = 7.1
const PANEL_EXIT_PCT = 5.3

const panelVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: `${dir * PANEL_ENTER_PCT}%` }),
  center: {
    opacity: 1,
    x: "0%",
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: `${dir * -PANEL_EXIT_PCT}%`,
    transition: { duration: 0.32, ease: [0.76, 0, 0.24, 1] },
  }),
}
const stageTransition = { layout: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
const indicatorTransition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }

/* Reduced-motion variants: same states, no travel — a brief crossfade only. */
const reducedPanelVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}
const instantTransition = { duration: 0 }
const instantLayoutTransition = { layout: { duration: 0 } }
