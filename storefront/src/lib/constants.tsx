import React from "react"
import { CreditCard } from "@medusajs/icons"

import GooglePay from "@modules/common/icons/google-pay"
import ApplePay from "@modules/common/icons/apple-pay"
import BankTransfer from "@modules/common/icons/bank-transfer"
import Ideal from "@modules/common/icons/ideal"
import Bancontact from "@modules/common/icons/bancontact"
import PayPal from "@modules/common/icons/paypal"

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_stripe_stripe: {
    title: "Credit card",
    icon: <CreditCard />,
  },
  "pp_stripe-ideal_stripe": {
    title: "iDeal",
    icon: <Ideal />,
  },
  "pp_stripe-bancontact_stripe": {
    title: "Bancontact",
    icon: <Bancontact />,
  },
  pp_paypal_paypal: {
    title: "PayPal",
    icon: <PayPal />,
  },
  pp_system_default: {
    title: "Manual Payment",
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

// This only checks if it is native stripe for card payments, it ignores the other stripe-based providers
export const isStripe = (providerId?: string) => {
  return providerId?.startsWith("pp_stripe_")
}
export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}
export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

export const isComgate = (providerId?: string) => {
  return providerId?.startsWith("pp_comgate")
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
