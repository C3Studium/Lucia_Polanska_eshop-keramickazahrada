"use client"

import { HttpTypes } from "@medusajs/types"
import { motion } from "framer-motion"

import PremiumActionLink from "@modules/common/components/premium-action-link"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import { itemText } from "@lib/util/site-copy"
import type { CopyBlock } from "@lib/util/site-copy"
import { editableItem } from "@modules/common/components/cms-text"
import OrderCard from "../order-card"
import {
  AccountPageReveal,
  AccountSectionReveal,
} from "../account-page-reveal"
import {
  accountListItemVariants,
  accountListVariants,
} from "../../motion"
import s from "./style.module.scss"

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
  /** Blok `ucet.prehled` — texty přehledu (viz OVERVIEW_DEFAULTS). */
  copy?: CopyBlock
}

/**
 * Redakční texty přehledu účtu — výchozí znění položek bloku `ucet.prehled`.
 * Jméno, e-mail, procenta, počty a co v profilu chybí jsou údaje; čísla
 * oddílů a tlačítka zůstávají v kódu.
 */
const OVERVIEW_DEFAULTS = {
  oboci: "Váš účet",
  pozdrav: "Dobrý den,",
  prihlasen: "Jste přihlášeni",
  "profil.popisek": "Vyplněný profil",
  "profil.hotovo": "Máte vyplněné všechno, co potřebujeme.",
  "adresy.text": "Uložené adresy vám příště ušetří vyplňování.",
  "objednavky.nadpis": "Nedávné objednávky",
  "objednavky.prazdne": "Zatím jste u nás nic neobjednali.",
} as const

const Overview = ({ customer, orders, copy }: OverviewProps) => {
  /* Přehled se po zapnutí editace sám nepřekreslí. Viz hook. */
  useEditRerender()
  const text = (label: keyof typeof OVERVIEW_DEFAULTS) =>
    itemText(copy, label, OVERVIEW_DEFAULTS[label])
  const edit = (label: keyof typeof OVERVIEW_DEFAULTS) => editableItem(copy, label)
  const { percentage, incompleteSteps } = getProfileCompletion(customer)
  const addressCount = customer?.addresses?.length || 0
  const recentOrders = orders?.slice(0, 3) || []
  const displayName =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    "váš účet"

  return (
    <AccountPageReveal
      className={s.accountOverviewRoot}
      data-testid="overview-page"
    >
      <AccountSectionReveal className={s.accountOverviewHero}>
        <p className={s.accountOverviewEyebrow} {...edit("oboci")}>
          {text("oboci")}
        </p>
        <div className={s.accountOverviewHeading}>
          {/* Pozdrav v holém spanu jen kvůli anotaci — jméno je údaj. */}
          <h1 data-testid="welcome-message" data-value={customer?.first_name}>
            <span {...edit("pozdrav")}>{text("pozdrav")}</span>
            <em>{displayName}.</em>
          </h1>
          <div className={s.accountOverviewIntro}>
            <span {...edit("prihlasen")}>{text("prihlasen")}</span>
            <p data-testid="customer-email" data-value={customer?.email}>
              {customer?.email}
            </p>
          </div>
        </div>
      </AccountSectionReveal>

      <AccountSectionReveal className={s.accountOverviewStats}>
        <article className={s.accountOverviewStat}>
          <span className={s.accountOverviewIndex}>01 · profil</span>
          <div className={s.accountOverviewStatValue}>
            <strong
              data-testid="customer-profile-completion"
              data-value={percentage}
            >
              {percentage}
              <small>%</small>
            </strong>
            <p {...edit("profil.popisek")}>{text("profil.popisek")}</p>
          </div>
          <div className={s.accountOverviewProgress} aria-hidden="true">
            <motion.i
              initial={initial}
              animate={{ scaleX: percentage / 100 }}
              transition={transition}
            />
          </div>
          {incompleteSteps.length > 0 ? (
            <p className={s.accountOverviewNote}>
              Ještě chybí: {incompleteSteps.map((step) => step.label).join(", ")}.
            </p>
          ) : (
            <p className={s.accountOverviewNote} {...edit("profil.hotovo")}>
              {text("profil.hotovo")}
            </p>
          )}
          <PremiumActionLink
            href="/account/profile"
            text={percentage === 100 ? "Zkontrolovat profil" : "Dokončit profil"}
            className={s.accountOverviewAction}
          />
        </article>

        <article className={s.accountOverviewStat}>
          <span className={s.accountOverviewIndex}>02 · adresy</span>
          <div className={s.accountOverviewStatValue}>
            <strong data-testid="addresses-count" data-value={addressCount}>
              {String(addressCount).padStart(2, "0")}
            </strong>
            <p>{addressCount === 1 ? "Uložená adresa" : "Uložené adresy"}</p>
          </div>
          <p className={s.accountOverviewNote} {...edit("adresy.text")}>
            {text("adresy.text")}
          </p>
          <PremiumActionLink
            href="/account/addresses"
            text={addressCount ? "Spravovat adresy" : "Přidat adresu"}
            className={s.accountOverviewAction}
          />
        </article>
      </AccountSectionReveal>

      <AccountSectionReveal className={s.accountOverviewOrders}>
        <div className={s.accountOverviewSectionHead}>
          <div>
            <span className={s.accountOverviewIndex}>03 · poslední objednávky</span>
            <h2 {...edit("objednavky.nadpis")}>{text("objednavky.nadpis")}</h2>
          </div>
          <span>{String(orders?.length || 0).padStart(2, "0")} celkem</span>
        </div>

        {recentOrders.length ? (
          <motion.div
            className={s.accountOverviewOrderList}
            variants={accountListVariants}
            initial="hidden"
            animate="visible"
            data-testid="orders-wrapper"
          >
            {recentOrders.map((order) => (
              <motion.div
                key={order.id}
                variants={accountListItemVariants}
                data-testid="order-wrapper"
                data-value={order.id}
              >
                <OrderCard order={order} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className={s.accountOverviewEmpty}>
            <p data-testid="no-orders-message" {...edit("objednavky.prazdne")}>
              {text("objednavky.prazdne")}
            </p>
            <PremiumActionLink
              href="/store"
              text="Prohlédnout výrobky"
              className={s.accountOverviewAction}
            />
          </div>
        )}
      </AccountSectionReveal>
    </AccountPageReveal>
  )
}

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
  if (!customer) {
    return { percentage: 0, incompleteSteps: [] }
  }

  const steps = [
    {
      label: "jméno",
      completed: Boolean(customer.first_name?.trim() && customer.last_name?.trim()),
    },
    {
      label: "telefon",
      completed: Boolean(customer.phone?.trim()),
    },
    {
      label: "e-mail",
      completed: Boolean(customer.email?.trim()),
    },
    {
      label: "fakturační adresu",
      completed: Boolean(
        customer.addresses?.some((address) => address.is_default_billing)
      ),
    },
  ]

  return {
    percentage: Math.round(
      (steps.filter((step) => step.completed).length / steps.length) * 100
    ),
    incompleteSteps: steps.filter((step) => !step.completed),
  }
}

export default Overview


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { scaleX: 0 }
const transition = { duration: 1.1, delay: 0.42, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
