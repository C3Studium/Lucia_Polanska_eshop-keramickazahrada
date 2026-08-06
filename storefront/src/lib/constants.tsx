import React from "react"
import { CreditCard } from "@medusajs/icons"

import GooglePay from "@modules/common/icons/google-pay"
import ApplePay from "@modules/common/icons/apple-pay"
import BankTransfer from "@modules/common/icons/bank-transfer"
import Ideal from "@modules/common/icons/ideal"
import Bancontact from "@modules/common/icons/bancontact"

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
/**
 * Osobní odběr — pay when you collect. Not dobírka: no carrier is involved and nothing is
 * collected on delivery. The provider authorizes and never captures, so the order must never be
 * presented as paid (§5.3).
 */
/*
 * The composite id is `pp_<service identifier>_<registration id>`, and the service renamed its
 * identifier to `osobni-odber` — so the live provider is `pp_osobni-odber_pickup`. This pointed
 * at the pre-rename `pp_pickup_pickup`, which the backend still lists but no module answers:
 * opening a session on it returns 500. The costs of naming the dead one were all silent — the
 * working provider had no entry in `paymentInfoMap` so its tile showed a raw id as its title,
 * `isPickupPayment` did not recognise it so the "never offer this for a carrier shipment" rule
 * (§5.3) never fired, and the tile that *did* read „Zaplatíte při vyzvednutí" was the broken one.
 */
export const PICKUP_PAYMENT_PROVIDER = "pp_osobni-odber_pickup"

/** Left behind by the rename. Recognised so the rules still apply to it, but never offered. */
export const RETIRED_PAYMENT_PROVIDERS = ["pp_pickup_pickup"]

export const PICKUP_FULFILLMENT_PROVIDER = "pickup_osobni-odber"

export const isRetiredPayment = (providerId?: string) =>
  !!providerId && RETIRED_PAYMENT_PROVIDERS.includes(providerId)

export const isPickupPayment = (providerId?: string) =>
  providerId === PICKUP_PAYMENT_PROVIDER || isRetiredPayment(providerId)

export const isPickupFulfillment = (providerId?: string) =>
  providerId === PICKUP_FULFILLMENT_PROVIDER

export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  [PICKUP_PAYMENT_PROVIDER]: {
    title: "Zaplatíte při vyzvednutí",
    icon: <CreditCard />,
  },
  // Kept mapped so the retired id can never surface as a raw provider string.
  pp_pickup_pickup: {
    title: "Zaplatíte při vyzvednutí",
    icon: <CreditCard />,
  },
  pp_system_default: {
    title: "Testovací platba",
    icon: <CreditCard />,
  },
  pp_comgate_comgate: {
    title: "Comgate",
    icon: <CreditCard />
  },
  pp_comgate_card: {
    title: "Platba kartou",
    icon: <CreditCard />
  },
  pp_comgate_bank: {
    title: "Bankovní převod",
    icon: <BankTransfer />
  },
  pp_comgate_applepay: {
    title: "Apple Pay",
    icon: <ApplePay />
  },
  pp_comgate_googlepay: {
    title: "Google Pay",
    icon: <GooglePay />
  },
  // Add more payment providers here
  // NOTE: here you can add any custom payment provider that you want to use
}

export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

export const isComgate = (providerId?: string) => {
  return providerId?.startsWith("pp_comgate") || providerId === "comgate"
}

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]
