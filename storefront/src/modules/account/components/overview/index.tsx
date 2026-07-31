"use client"

import { HttpTypes } from "@medusajs/types"
import { motion } from "framer-motion"

import PremiumActionLink from "@modules/common/components/premium-action-link"
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
}

const Overview = ({ customer, orders }: OverviewProps) => {
  const { percentage, incompleteSteps } = getProfileCompletion(customer)
  const addressCount = customer?.addresses?.length || 0
  const recentOrders = orders?.slice(0, 3) || []
  const displayName =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    "váš archiv"

  return (
    <AccountPageReveal
      className={s.accountOverviewRoot}
      data-testid="overview-page"
    >
      <AccountSectionReveal className={s.accountOverviewHero}>
        <p className={s.accountOverviewEyebrow}>Soukromý archiv · přehled</p>
        <div className={s.accountOverviewHeading}>
          <h1 data-testid="welcome-message" data-value={customer?.first_name}>
            Dobrý den,
            <em>{displayName}.</em>
          </h1>
          <div className={s.accountOverviewIntro}>
            <span>Přihlášený archiv</span>
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
            <p>Profil dokončen</p>
          </div>
          <div className={s.accountOverviewProgress} aria-hidden="true">
            <motion.i
              initial={{ scaleX: 0 }}
              animate={{ scaleX: percentage / 100 }}
              transition={{ duration: 1.1, delay: 0.42, ease: [0.76, 0, 0.24, 1] }}
            />
          </div>
          {incompleteSteps.length > 0 ? (
            <p className={s.accountOverviewNote}>
              Zbývá doplnit: {incompleteSteps.map((step) => step.label).join(", ")}.
            </p>
          ) : (
            <p className={s.accountOverviewNote}>Všechny základní údaje jsou připravené.</p>
          )}
          <PremiumActionLink
            href="/account/profile"
            text={percentage === 100 ? "Zkontrolovat profil" : "Dokončit profil"}
            className={s.accountOverviewAction}
          />
        </article>

        <article className={s.accountOverviewStat}>
          <span className={s.accountOverviewIndex}>02 · doručení</span>
          <div className={s.accountOverviewStatValue}>
            <strong data-testid="addresses-count" data-value={addressCount}>
              {String(addressCount).padStart(2, "0")}
            </strong>
            <p>{addressCount === 1 ? "Uložená adresa" : "Uložené adresy"}</p>
          </div>
          <p className={s.accountOverviewNote}>
            Oblíbená místa doručení budete mít při příštím výběru po ruce.
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
            <span className={s.accountOverviewIndex}>03 · poslední záznamy</span>
            <h2>Nedávné objednávky</h2>
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
            <p data-testid="no-orders-message">
              V archivu zatím není žádná objednávka.
            </p>
            <PremiumActionLink
              href="/store"
              text="Objevit objekty"
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
