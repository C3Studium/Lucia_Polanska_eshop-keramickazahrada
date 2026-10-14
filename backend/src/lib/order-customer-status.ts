/**
 * Stav objednávky pro zákazníka — jedna věta, která říká, co je s objednávkou
 * TEĎ pravda.
 *
 * Dřív stránka objednávky ukazovala jen fázi Denní práce (a hostovi, bez
 * přihlášení, nic → záložní „Přijato"), takže odeslaná, vyzvednutá nebo
 * reklamovaná objednávka pořád hlásila „Přijato" (#50, 14. 10. 2026). Tady se
 * skládá ze všeho, co o objednávce víme, v pořadí podle toho, co zákazníka
 * zajímá víc:
 *
 *   1. otevřená reklamace / vrácení / odstoupení
 *   2. zrušená objednávka
 *   3. vyřízená reklamace / vrácení (případně vrácené peníze)
 *   4. doručeno / vyzvednuto
 *   5. odesláno
 *   6. zakázka ve výrobě (zadání → výroba → doplatek)
 *   7. běžný postup Denní práce (přijato → připravujeme → k odeslání)
 *
 * Čistá funkce; data dodá `/store/orders/:id/progress`.
 */

export type CustomerStatusClaim = {
  kind?: string | null
  status?: string | null
  refund_amount?: number | string | null
  resolution?: string | null
  created_at?: string | Date | null
}

export type CustomerStatusInput = {
  canceled: boolean
  merchantStage: string | null
  production: { stage: string; outstanding: number } | null
  pickup: boolean
  shipped: boolean
  delivered: boolean
  /** Všechny peníze vráceny (refundace ≥ zaplaceno). */
  fullyRefunded: boolean
  claims: CustomerStatusClaim[]
}

export type CustomerStatus = {
  /** Strojový klíč pro storefront (barva, ikonka) — slovo je v `label`. */
  key: string
  label: string
  /** Krátké vysvětlení pod stavem, nebo null. */
  detail: string | null
}

const OPEN_CLAIM = ["pending", "approved", "received"]

const claimNoun = (kind?: string | null) =>
  kind === "odstoupeni" ? "Odstoupení" : kind === "vraceni" ? "Vrácení" : "Reklamace"

const openClaimStatus = (claim: CustomerStatusClaim): CustomerStatus => {
  const noun = claimNoun(claim.kind)
  const isReklamace = (claim.kind ?? "reklamace") === "reklamace"
  switch (claim.status) {
    case "approved":
      return {
        key: "claim_approved",
        label: isReklamace ? "Reklamace uznána" : `${noun} schváleno`,
        detail: isReklamace
          ? "Vyřizujeme ji — podrobnosti a další postup najdete u žádosti níž."
          : "Čekáme na vrácené zboží. Adresu a postup najdete u žádosti níž.",
      }
    case "received":
      return {
        key: "claim_received",
        label: "Zboží máme zpět",
        detail: isReklamace ? "Reklamaci dokončujeme." : "Vracíme peníze.",
      }
    default:
      return {
        key: "claim_pending",
        label: isReklamace ? "Reklamaci posuzujeme" : `${noun} přijato`,
        detail: "Žádost máme a brzy se ozveme.",
      }
  }
}

const resolvedClaimStatus = (claim: CustomerStatusClaim): CustomerStatus => {
  const refunded = Number(claim.refund_amount ?? 0) > 0.005
  if ((claim.kind ?? "reklamace") === "reklamace") {
    return {
      key: "claim_resolved",
      label: "Reklamace vyřízena",
      detail: refunded ? "Peníze jsme vrátili." : null,
    }
  }
  return {
    key: "returned",
    label: refunded ? "Vráceno — peníze vráceny" : "Vráceno",
    detail: null,
  }
}

const PRODUCTION_LABELS: Record<string, CustomerStatus> = {
  specification_pending: {
    key: "production_specification",
    label: "Posuzujeme zadání",
    detail: "Projdeme, co si představujete, a potvrdíme zakázku e-mailem.",
  },
  confirmed: {
    key: "production_confirmed",
    label: "Zadání potvrzeno",
    detail: "Do výroby se pustíme brzy — dáme vědět.",
  },
  in_production: {
    key: "production_in_progress",
    label: "Ve výrobě",
    detail: "Zakázka vzniká v ateliéru.",
  },
  awaiting_balance: {
    key: "production_awaiting_balance",
    label: "Hotovo — čeká na doplatek",
    detail: "Po doplacení zakázku zabalíme a pošleme.",
  },
}

export const customerOrderStatus = (input: CustomerStatusInput): CustomerStatus => {
  const claims = [...input.claims].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )

  // 1 — co se právě řeší
  const open = claims.find((claim) => OPEN_CLAIM.includes(String(claim.status)))
  if (open) return openClaimStatus(open)

  // 2 — zrušeno
  if (input.canceled || input.merchantStage === "cancelled") {
    return {
      key: "canceled",
      label: "Zrušeno",
      detail: input.fullyRefunded ? "Peníze jsme vrátili." : null,
    }
  }

  // 3 — vyřízená reklamace / vrácení (nejnovější vyřízená žádost)
  const resolved = claims.find((claim) => claim.status === "resolved")
  if (resolved) return resolvedClaimStatus(resolved)
  if (input.fullyRefunded) {
    return { key: "refunded", label: "Peníze vráceny", detail: null }
  }

  // 4–5 — u zákazníka / na cestě
  if (input.delivered) {
    return input.pickup
      ? { key: "picked_up", label: "Vyzvednuto", detail: null }
      : { key: "delivered", label: "Doručeno", detail: null }
  }
  if (input.shipped || input.merchantStage === "shipped") {
    return input.pickup
      ? { key: "picked_up", label: "Vyzvednuto", detail: null }
      : { key: "shipped", label: "Odesláno", detail: "Zásilka je na cestě." }
  }

  // 6 — zakázka ve výrobě
  const production = input.production ? PRODUCTION_LABELS[input.production.stage] : null
  if (production) return production

  // 7 — běžný postup
  switch (input.merchantStage) {
    case "shipping":
      return input.pickup
        ? { key: "ready_pickup", label: "Připraveno k vyzvednutí", detail: "Můžete si pro objednávku přijít." }
        : { key: "ready", label: "Chystáme k odeslání", detail: "Zabaleno, čeká na předání dopravci." }
    case "working":
      return { key: "working", label: "Připravujeme", detail: null }
    case "payment_problem":
      return { key: "payment_pending", label: "Čeká na platbu", detail: null }
    default:
      return { key: "received", label: "Přijato", detail: null }
  }
}
