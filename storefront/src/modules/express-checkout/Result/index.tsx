"use client"

import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { motion, useReducedMotion } from "framer-motion"
import Image from "next/image"
import { useRouter } from "next/navigation"
import styles from "./style.module.scss"

type ResultStatus = "success" | "pending" | "canceled" | "failed"

const copy: Record<
  ResultStatus,
  { eyebrow: string; title: string; accent: string; description: string; mark: string }
> = {
  success: {
    eyebrow: "Objednávka potvrzena",
    title: "Děkujeme.",
    accent: "Máme to.",
    description:
      "Potvrzení jsme poslali na váš e-mail. Jakmile to v ateliéru připravíme, dáme vám vědět.",
    mark: "✓",
  },
  pending: {
    eyebrow: "Platbu ověřujeme",
    title: "Ještě",
    accent: "malý okamžik.",
    description:
      "Platební brána nám zatím nedala vědět, jak to dopadlo. Objednávku držíme a napíšeme vám, jakmile to budeme vědět.",
    mark: "…",
  },
  canceled: {
    eyebrow: "Platba byla zrušena",
    title: "Nic se",
    accent: "neztratilo.",
    description:
      "Objednávka není zaplacená. Můžete se vrátit zpátky a zvolit jiný způsob platby.",
    mark: "×",
  },
  failed: {
    eyebrow: "Objednávka se nedokončila",
    title: "Zkusme to",
    accent: "ještě jednou.",
    description:
      "Platbu ani objednávku se nepovedlo potvrdit. Nic jsme vám nestrhli.",
    mark: "!",
  },
}

export default function ExpressResult({
  status,
  countryCode,
  productHandle,
  order,
}: {
  status: ResultStatus
  countryCode: string
  productHandle?: string
  order?: HttpTypes.StoreOrder
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const content = copy[status]
  const retryPath = productHandle
    ? `/${countryCode}/express-checkout/${productHandle}?step=payment`
    : `/${countryCode}/store`

  return (
    <main className={styles.root} data-status={status}>
      <motion.div
        className={styles.mark}
        initial={reduceMotion ? false : initial}
        animate={animate}
        transition={transition}
      >
        <span />
        <span />
        <span />
        <strong>{content.mark}</strong>
      </motion.div>

      <motion.div
        className={styles.copy}
        initial={reduceMotion ? false : initial2}
        animate={animate2}
        transition={transition2}
      >
        <span className={styles.eyebrow}>{content.eyebrow}</span>
        <h1>
          {content.title}
          <em>{content.accent}</em>
        </h1>
        <p>{content.description}</p>
      </motion.div>

      {order && (
        <motion.section
          className={styles.receipt}
          initial={reduceMotion ? false : initial3}
          animate={animate2}
          transition={transition3}
        >
          <div className={styles.receiptHeader}>
            <span>Objednávka #{order.display_id}</span>
            <span>
              {new Intl.DateTimeFormat("cs-CZ").format(
                new Date(order.created_at)
              )}
            </span>
          </div>
          {order.items?.map((item) => (
            <div className={styles.item} key={item.id}>
              <Image
                src={item.thumbnail || "/assets/img/horizontal_prop.png"}
                alt=""
                width={54}
                height={54}
              />
              <div>
                <strong>{item.product_title || item.title}</strong>
                <small>{item.quantity} ks</small>
              </div>
              <span>
                {convertToLocale({
                  amount: item.total || item.unit_price * item.quantity,
                  currency_code: order.currency_code,
                })}
              </span>
            </div>
          ))}
          <div className={styles.receiptTotal}>
            <span>Celkem</span>
            <strong>
              {convertToLocale({
                amount: order.total,
                currency_code: order.currency_code,
              })}
            </strong>
          </div>
        </motion.section>
      )}

      <div className={styles.actions}>
        {status === "success" ? (
          <PremiumActionButton
            text="Zpět do obchodu"
            onClickAction={() => router.push(`/${countryCode}/store`)}
            className={styles.action}
          />
        ) : (
          <PremiumActionButton
            text={status === "pending" ? "Zpět do obchodu" : "Zkusit znovu"}
            onClickAction={() =>
              router.push(
                status === "pending" ? `/${countryCode}/store` : retryPath
              )
            }
            className={styles.action}
          />
        )}
        <button
          type="button"
          className={styles.secondary}
          onClick={() => router.push(`/${countryCode}`)}
        >
          Zpět na hlavní stránku
        </button>
      </div>
    </main>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { scale: .7, opacity: 0 }
const animate = { scale: 1, opacity: 1 }
const transition = { duration: .7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const initial2 = { opacity: 0, y: 20 }
const animate2 = { opacity: 1, y: 0 }
const transition2 = { duration: .7, delay: .12, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
const initial3 = { opacity: 0, y: 18 }
const transition3 = { duration: .65, delay: .24, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
