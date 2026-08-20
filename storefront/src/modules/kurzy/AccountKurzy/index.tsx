"use client"

import { motion } from "framer-motion"

import type { MyCourseReservation } from "@lib/data/courses"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import {
  AccountPageReveal,
  AccountSectionReveal,
} from "@modules/account/components/account-page-reveal"
import {
  accountListItemVariants,
  accountListVariants,
} from "@modules/account/motion"

import s from "./styles.module.scss"

/**
 * „Kurzy" in the customer dashboard — every reservation the account can see
 * (their own, plus guest bookings made with the same e-mail), newest term
 * first. Follows the reviews/orders template shapes so the dashboard reads
 * as one product.
 */

const formatPrague = (value: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

const czk = (value: number): string =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)

const people = (count: number): string =>
  `${count} ${count === 1 ? "osoba" : count < 5 ? "osoby" : "osob"}`

const stateFor = (
  reservation: MyCourseReservation
): { label: string; tone: "ok" | "wait" | "muted" } => {
  if (reservation.term.status === "cancelled") {
    return { label: "Termín zrušen", tone: "muted" }
  }
  if (reservation.status === "cancelled") {
    return { label: "Zrušená rezervace", tone: "muted" }
  }
  if (reservation.payment_status === "paid") {
    return { label: "Zaplaceno kartou", tone: "ok" }
  }
  if (reservation.payment_method === "on_site") {
    return { label: "Platba na místě", tone: "ok" }
  }
  return { label: "Čeká na platbu", tone: "wait" }
}

export default function AccountKurzy({
  reservations,
}: {
  reservations: MyCourseReservation[]
}) {
  return (
    <AccountPageReveal className={s.root} data-testid="kurzy-page-wrapper">
      <AccountSectionReveal className={s.header}>
        <p>Váš účet · kurzy</p>
        <div className={s.heading}>
          <h1>
            Vaše
            <em>kurzy.</em>
          </h1>
          <span>
            {String(reservations.length).padStart(2, "0")}{" "}
            {reservations.length === 1
              ? "rezervace"
              : reservations.length < 5
                ? "rezervace"
                : "rezervací"}
          </span>
        </div>
        <p className={s.description}>
          Rezervovaná místa v ateliéru — termín, počet lidí a stav platby na
          jednom místě.
        </p>
      </AccountSectionReveal>

      <AccountSectionReveal className={s.body}>
        {!reservations.length ? (
          <div className={s.empty}>
            <div>
              <span>Zatím tu nic není</span>
              <p>
                Vypsané termíny kurzů najdete na stránce Kurzy — rezervace
                zabere minutu.
              </p>
            </div>
            <PremiumActionLink
              href="/kurzy"
              text="Vybrat termín"
              className={s.action}
            />
          </div>
        ) : (
          <motion.ul
            className={s.list}
            variants={accountListVariants}
            initial="hidden"
            animate="visible"
          >
            {reservations.map((reservation, index) => {
              const state = stateFor(reservation)
              return (
                <motion.li
                  key={reservation.id}
                  className={s.card}
                  variants={accountListItemVariants}
                  data-tone={state.tone}
                >
                  <LocalizedClientLink
                    href={`/kurzy/rezervace/${reservation.id}?token=${reservation.token}`}
                  >
                    <span className={s.cardIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className={s.cardCopy}>
                      <span className={s.cardDate}>
                        {formatPrague(reservation.term.starts_at)}
                      </span>
                      <h2>{reservation.term.title}</h2>
                      <p>
                        {reservation.term.location} ·{" "}
                        {people(reservation.party_size)}
                      </p>
                    </div>
                    <div className={s.cardMeta}>
                      <span className={s.cardState}>{state.label}</span>
                      <strong>{czk(reservation.total_price)}</strong>
                      <i aria-hidden="true">↗</i>
                    </div>
                  </LocalizedClientLink>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </AccountSectionReveal>
    </AccountPageReveal>
  )
}
