"use client"

import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { motion } from "framer-motion"
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
    accent: "Objekt je váš.",
    description:
      "Potvrzení jsme poslali na váš e-mail. Jakmile výběr připravíme v ateliéru, dáme vám vědět.",
    mark: "✓",
  },
  pending: {
    eyebrow: "Platbu ověřujeme",
    title: "Ještě",
    accent: "malý okamžik.",
    description:
      "Platební brána nám zatím neposlala konečný výsledek. Objednávku držíme a stav potvrdíme e-mailem.",
    mark: "…",
  },
  canceled: {
    eyebrow: "Platba byla zrušena",
    title: "Nic se",
    accent: "neztratilo.",
    description:
      "Objednávka nebyla zaplacena. Můžete se vrátit k výběru a zvolit jiný způsob platby.",
    mark: "×",
  },
  failed: {
    eyebrow: "Objednávka se nedokončila",
    title: "Zkusme to",
    accent: "ještě jednou.",
    description:
      "Platbu nebo vytvoření objednávky se nepodařilo potvrdit. Nic jsme vám nenaúčtovali.",
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
  const content = copy[status]
  const retryPath = productHandle
    ? `/${countryCode}/express-checkout/${productHandle}?step=payment`
    : `/${countryCode}/store`

  return (
    <main className={styles.root} data-status={status}>
      <motion.div
        className={styles.mark}
        initial={{ scale: .7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: .7, ease: [0.22, 1, 0.36, 1] }}
      >
        <span />
        <span />
        <span />
        <strong>{content.mark}</strong>
      </motion.div>

      <motion.div
        className={styles.copy}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .7, delay: .12, ease: [0.22, 1, 0.36, 1] }}
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
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .65, delay: .24, ease: [0.22, 1, 0.36, 1] }}
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
            text="Pokračovat v obchodě"
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
