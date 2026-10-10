import { isClaimKind, isFinalStatus, resolutionLabel } from "./constants"
import {
  canRefund,
  MONEY_EPSILON,
  requestRefunds,
  round2,
  type MoneyRequest,
  type RefundEntry,
} from "./refund-rules"

/**
 * Průběh žádosti podle PŘÍPADU (docs/reklamace-a-zruseni.md §12.2, §12.5) —
 * `planClaimCase` je čistá funkce: ze žádosti, vlajek objednávky, peněz a
 * zakázky spočítá `case`, kroky časové osy a které akce jsou povolené TEĎ.
 * UI jen vykresluje; všechno, co by se dalo rozhodnout v prohlížeči, se
 * rozhoduje tady a dokazuje testem (`__tests__/claims-case`).
 *
 * ## Proč kroky počítá server
 *
 * Stejná žádost o odstoupení vypadá jinak podle toho, zda zboží odešlo, zda
 * bylo něco zaplaceno a zda je v objednávce zakázka. Kdyby tuhle matici měl
 * v hlavě frontend, dřív či později by tvrdil něco jiného než routy. Akce v
 * `actions` proto zrcadlí přesně gating rout: `canRefund` (s `goods_shipped`),
 * pravidla `cancel-order` (až po vyřízení nebo když nezbývá nic zachyceného),
 * zálohu zakázky a stavové přechody.
 *
 * ## Stavy kroků
 *
 * `done` má datum, `current` je jeden (první nehotový u otevřené žádosti),
 * zbytek `upcoming`. Po `resolved` se nehotové kroky označí `skipped` — kromě
 * kroků, které jsou dostupné i po vyřízení (zrušení objednávky / zakázky:
 * refundace zálohy žádost uzavře, zakázka se ruší až potom) — ty zůstávají
 * `upcoming`. Zamítnutí a storno ukončují kteroukoli větev: zbytek `skipped`.
 */

export type ClaimCase =
  | "cancel_unpaid"
  | "cancel_paid_unshipped"
  | "withdrawal_shipped"
  | "return_shipped"
  | "commission_cancel"
  | "claim"
  | "mixed_cancel"

export type ClaimStepState = "done" | "current" | "upcoming" | "skipped"

export type ClaimStep = {
  key: string
  label: string
  state: ClaimStepState
  at: string | null
}

export type ClaimFlags = {
  goods_shipped: boolean
  /** V objednávce je zakázka (čistá i smíšená). */
  is_commission: boolean
  /** Zakázka + běžné položky. */
  is_mixed: boolean
  paid_online: boolean
  pay_later: boolean
  nothing_captured: boolean
}

export type ClaimActions = {
  approve: boolean
  reject: boolean
  received: boolean
  refund_items: boolean
  refund_all: boolean
  refund_deposit: boolean
  resolve: boolean
  cancel_order: boolean
  cancel_production: boolean
  cancel_request: boolean
}

export type ClaimCaseRequest = MoneyRequest & {
  kind?: string | null
  status?: string | null
  resolution?: string | null
  resolution_note?: string | null
  created_at?: unknown
  decided_at?: unknown
  goods_received_at?: unknown
  resolved_at?: unknown
  updated_at?: unknown
}

export type ClaimCaseProduction = {
  stage: string
  deposit_paid: number
  deposit_refunded: number
  deposit_refunded_at?: string | null
  cancelled_at?: string | null
} | null

export type ClaimCaseMoney = {
  captured: number
  refunded: number
  remaining: number
}

export type ClaimCaseOrder = {
  status?: string | null
  canceled_at?: unknown
} | null

export type ClaimCaseItem = {
  is_made_to_order: boolean
  refundable_quantity: number
  refundable_amount: number
}

export type ClaimCaseInput = {
  request: ClaimCaseRequest
  flags: ClaimFlags
  money: ClaimCaseMoney
  production: ClaimCaseProduction
  /** Pro krok „Objednávka zrušena" a akci `cancel_order`. */
  order?: ClaimCaseOrder
  /** Pro `refund_items` (seznam je bez položek → podle gatingu). */
  items?: ClaimCaseItem[] | null
}

export type ClaimCasePlan = {
  case: ClaimCase
  steps: ClaimStep[]
  actions: ClaimActions
}

/** Poznámka, kterou `cancel-production` zapíše při „zálohu nevracet". */
export const DEPOSIT_KEPT_NOTE_PREFIX = "Záloha ponechána"

const iso = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const latestAt = (refunds: RefundEntry[]): string | null =>
  refunds.reduce<string | null>((latest, refund) => {
    const at = iso(refund.at)
    if (!at) return latest
    return !latest || at > latest ? at : latest
  }, null)

const isWithdrawalKind = (kind: unknown): boolean =>
  kind === "odstoupeni" || kind === "vraceni"

/**
 * Který případ to je (§12.5). Reklamace (a neznámý druh ze starých řádků) je
 * vždy `claim`; u odstoupení/vrácení rozhoduje zakázka, odeslání a peníze.
 */
export const classifyClaimCase = (
  request: Pick<ClaimCaseRequest, "kind">,
  flags: ClaimFlags
): ClaimCase => {
  if (!isWithdrawalKind(request.kind)) return "claim"
  if (flags.is_mixed) return "mixed_cancel"
  if (flags.is_commission) return "commission_cancel"
  if (flags.goods_shipped) {
    return request.kind === "vraceni" ? "return_shipped" : "withdrawal_shipped"
  }
  return flags.nothing_captured ? "cancel_unpaid" : "cancel_paid_unshipped"
}

type StepDraft = {
  key: string
  label: string
  done: boolean
  at: string | null
  /** Krok se v této větvi nekoná (např. zboží u slevy zůstává u zákazníka). */
  skipped?: boolean
  /** Dostupný i po vyřízení žádosti — po `resolved` zůstává `upcoming`. */
  optional?: boolean
}

const finalizeSteps = (drafts: StepDraft[], status: string): ClaimStep[] => {
  const dead = status === "rejected" || status === "cancelled"
  const resolved = status === "resolved"
  let currentTaken = false
  return drafts.map((draft) => {
    const base = { key: draft.key, label: draft.label }
    if (draft.done) return { ...base, state: "done" as const, at: draft.at }
    if (draft.skipped || dead) return { ...base, state: "skipped" as const, at: null }
    if (resolved) {
      return { ...base, state: draft.optional ? ("upcoming" as const) : ("skipped" as const), at: null }
    }
    if (!currentTaken) {
      currentTaken = true
      return { ...base, state: "current" as const, at: null }
    }
    return { ...base, state: "upcoming" as const, at: null }
  })
}

export const planClaimCase = (input: ClaimCaseInput): ClaimCasePlan => {
  const { request, flags, money, production } = input
  const order = input.order ?? null
  const status = String(request.status ?? "")
  const kind = request.kind ?? null
  const decided = status !== "pending" && status !== ""
  const refunds = requestRefunds(request)
  const claimCase = classifyClaimCase(request, flags)

  const orderCancelled =
    Boolean(order?.canceled_at) || String(order?.status ?? "") === "canceled"
  const depositPaid = production ? Math.max(0, production.deposit_paid) : 0
  const depositLeft = production
    ? Math.max(0, round2(production.deposit_paid - production.deposit_refunded))
    : 0
  const depositKept =
    String(request.resolution_note ?? "").startsWith(DEPOSIT_KEPT_NOTE_PREFIX) ||
    (production?.stage === "cancelled" && depositLeft > MONEY_EPSILON)

  // --- stavební kameny kroků -------------------------------------------------
  const received: StepDraft = {
    key: "received",
    label: "Přijato",
    done: true,
    at: iso(request.created_at),
  }
  const approved: StepDraft = {
    key: "approved",
    label: "Schváleno",
    done: decided,
    at: iso(request.decided_at),
  }
  const resolutionText = resolutionLabel(request.resolution)
  const decidedStep: StepDraft = {
    key: "decided",
    label: resolutionText ? `Rozhodnuto — ${resolutionText}` : "Rozhodnuto (způsob)",
    done: decided,
    at: iso(request.decided_at),
  }
  const goodsReceived: StepDraft = {
    key: "goods_received",
    label: "Zboží přijato",
    done: Boolean(request.goods_received_at),
    at: iso(request.goods_received_at),
    // Sleva z ceny: zboží zůstává u zákazníka, nic se nevrací.
    skipped: !request.goods_received_at && request.resolution === "discount",
  }
  // Peníze vráceny = něco se vrátilo a už nic nezbývá (nebo je žádost
  // uzavřená — majitelka vědomě vrátila jen část, §1833).
  const refundsSettled =
    refunds.length > 0 && (money.remaining <= MONEY_EPSILON || status === "resolved")
  const refunded: StepDraft = {
    key: "refunded",
    label: "Peníze vráceny",
    done: refundsSettled,
    at: refundsSettled ? latestAt(refunds) : null,
  }
  const resolvedStep: StepDraft = {
    key: "resolved",
    label: "Vyřízeno",
    done: status === "resolved",
    at: iso(request.resolved_at),
  }
  const orderCancelledStep: StepDraft = {
    key: "order_cancelled",
    label: "Objednávka zrušena",
    done: orderCancelled,
    at: iso(order?.canceled_at),
    optional: true,
  }

  const depositRefunds = refunds.filter((refund) => refund.scope === "deposit")
  const depositStep: StepDraft = (() => {
    if (!production || depositPaid <= MONEY_EPSILON) {
      return { key: "deposit", label: "Záloha (nebyla zaplacena)", done: false, at: null, skipped: true }
    }
    if (depositLeft <= MONEY_EPSILON) {
      return {
        key: "deposit",
        label: "Záloha vrácena",
        done: true,
        at: production.deposit_refunded_at ?? latestAt(depositRefunds),
      }
    }
    if (depositKept) {
      return {
        key: "deposit",
        label: "Záloha ponechána",
        done: true,
        at: production.cancelled_at ?? iso(request.resolved_at),
      }
    }
    return { key: "deposit", label: "Záloha: vrácena / ponechána", done: false, at: null }
  })()
  const productionCancelled: StepDraft = {
    key: "production_cancelled",
    label: "Zakázka zrušena",
    done: production?.stage === "cancelled",
    at: production?.cancelled_at ?? null,
    optional: true,
  }

  // --- kroky podle případu (§12.5) ------------------------------------------
  let drafts: StepDraft[]
  switch (claimCase) {
    case "cancel_unpaid":
      drafts = [received, approved, orderCancelledStep]
      break
    case "cancel_paid_unshipped":
      drafts = [received, approved, refunded, orderCancelledStep]
      break
    case "withdrawal_shipped":
    case "return_shipped":
      drafts = [received, approved, goodsReceived, refunded, resolvedStep, orderCancelledStep]
      break
    case "commission_cancel":
      drafts = [received, approved, depositStep, productionCancelled]
      break
    case "mixed_cancel": {
      // Produktová část: peníze za běžné položky = všechno mimo zálohu, která
      // ještě sedí na objednávce (o té rozhoduje zakázková část).
      const productRefunds = refunds.filter((refund) => refund.scope !== "deposit")
      const productsSettled =
        productRefunds.length > 0 &&
        (round2(money.remaining - depositLeft) <= MONEY_EPSILON || status === "resolved")
      const refundedProducts: StepDraft = {
        key: "refunded_items",
        label: "Peníze vráceny za produkty",
        done: productsSettled,
        at: productsSettled ? latestAt(productRefunds) : null,
        // Za produkty nikdy nic nepřišlo (záloha kartou, zbytek dobírkou) →
        // není co vracet.
        skipped:
          !productsSettled &&
          productRefunds.length === 0 &&
          round2(money.captured - depositPaid) <= MONEY_EPSILON,
      }
      drafts = [
        received,
        approved,
        ...(flags.goods_shipped ? [goodsReceived] : []),
        refundedProducts,
        depositStep,
        productionCancelled,
        resolvedStep,
      ]
      break
    }
    case "claim":
    default: {
      const moneyResolution =
        request.resolution === "refund" || request.resolution === "discount"
      const resolvedLabel =
        !moneyResolution && resolutionText ? `Vyřízeno — ${resolutionText}` : "Vyřízeno"
      drafts = [
        received,
        decidedStep,
        goodsReceived,
        ...(moneyResolution || refunds.length ? [refunded] : []),
        { ...resolvedStep, label: resolvedLabel },
      ]
      break
    }
  }

  // Zamítnuto / stornováno ukončují kteroukoli větev.
  if (status === "rejected") {
    drafts = drafts.map((draft) =>
      draft.key === "approved" || draft.key === "decided"
        ? { key: "rejected", label: "Zamítnuto", done: true, at: iso(request.decided_at) }
        : draft
    )
  } else if (status === "cancelled") {
    const lastDone = drafts.reduce((index, draft, i) => (draft.done ? i : index), -1)
    drafts.splice(lastDone + 1, 0, {
      key: "cancelled",
      label: "Žádost stornována",
      done: true,
      at: iso(request.updated_at),
    })
  }

  // --- akce = zrcadlo gatingu rout -------------------------------------------
  const open = !isFinalStatus(status)
  const pending = status === "pending"
  const refundable =
    canRefund(
      { kind, status, resolution: request.resolution ?? null, goods_shipped: flags.goods_shipped },
      {}
    ).allowed && money.remaining > MONEY_EPSILON
  const items = input.items ?? null
  const pureCommission = flags.is_commission && !flags.is_mixed

  const actions: ClaimActions = {
    approve: pending,
    reject: pending,
    // Zboží, které nikdy neodešlo, nemůže „dorazit zpět" (odstoupení před odesláním).
    received: status === "approved" && !(isWithdrawalKind(kind) && !flags.goods_shipped),
    refund_all: refundable,
    refund_items:
      refundable &&
      (items
        ? items.some(
            (item) => item.refundable_quantity > 0 && item.refundable_amount > MONEY_EPSILON
          )
        : true),
    refund_deposit: refundable && Boolean(production) && depositLeft > MONEY_EPSILON,
    resolve: status === "approved" || status === "received",
    // §3: až po vyřízení, nebo když nezbývá nic zachyceného; u čisté zakázky
    // objednávku ruší „Zrušit zakázku" (zálohu lze i ponechat).
    cancel_order:
      isWithdrawalKind(kind) &&
      decided &&
      status !== "rejected" &&
      status !== "cancelled" &&
      (status === "resolved" || money.remaining <= MONEY_EPSILON) &&
      !orderCancelled &&
      !pureCommission,
    // §12.4: po rozhodnutí (i po vyřízení — refundace zálohy žádost uzavře dřív,
    // než se zakázka zruší); zálohu musí mít buď vrácenou, nebo zvolit „nevracet".
    cancel_production:
      Boolean(production) &&
      production?.stage !== "cancelled" &&
      isClaimKind(kind) &&
      (status === "approved" || status === "received" || status === "resolved"),
    cancel_request: open,
  }

  return { case: claimCase, steps: finalizeSteps(drafts, status), actions }
}
