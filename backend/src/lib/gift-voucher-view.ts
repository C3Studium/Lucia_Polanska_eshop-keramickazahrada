import { VOUCHER_STATE_LABEL, voucherState } from "../modules/gift-voucher/code"
import { giftVoucherLink, giftVoucherPath } from "./gift-voucher-link"

/**
 * Jak poukaz vidí administrace a jak zákazník — jedno místo, aby se stav
 * a popisky nerozcházely mezi stránkou Poukazy, stránkou poukazu a e-maily.
 */

export const formatVoucherDate = (value: Date | string | null | undefined): string => {
  if (!value) return ""
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export const formatVoucherCzk = (amount: number): string =>
  `${Math.round(Number(amount) || 0).toLocaleString("cs-CZ")} Kč`

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Hotově",
  transfer: "Převodem na účet",
  comgate: "Online platebním odkazem",
  order: "Objednávkou v obchodě",
}

const redemptionView = (r: any) => ({
  id: r.id,
  amount: Number(r.amount),
  order_id: r.order_id ?? null,
  note: r.note ?? null,
  created_at: r.created_at,
  reversed_at: r.reversed_at ?? null,
  reverse_note: r.reverse_note ?? null,
})

export const serializeAdminVoucher = (v: any) => {
  const state = voucherState(v)
  return {
    id: v.id,
    code: v.code,
    kind: v.kind,
    initial_value: Number(v.initial_value),
    balance: Number(v.balance),
    currency_code: v.currency_code,
    valid_until: v.valid_until,
    recipient_name: v.recipient_name ?? null,
    recipient_email: v.recipient_email ?? null,
    dedication: v.dedication ?? null,
    buyer_name: v.buyer_name,
    buyer_email: v.buyer_email ?? null,
    buyer_phone: v.buyer_phone ?? null,
    note: v.note ?? null,
    payment_method: v.payment_method,
    payment_method_label: PAYMENT_METHOD_LABEL[v.payment_method] ?? v.payment_method,
    payment_status: v.payment_status,
    paid_at: v.paid_at ?? null,
    payment_url: v.payment_url ?? null,
    order_id: v.order_id ?? null,
    status: v.status,
    cancelled_at: v.cancelled_at ?? null,
    refunded_at: v.refunded_at ?? null,
    refund_note: v.refund_note ?? null,
    order_line_item_id: v.order_line_item_id ?? null,
    sent_at: v.sent_at ?? null,
    sent_to: v.sent_to ?? null,
    created_at: v.created_at,
    state,
    state_label: VOUCHER_STATE_LABEL[state],
    /** Stránka poukazu (zaplatit / zobrazit / vytisknout) — absolutní, nebo relativní, když chybí adresa obchodu. */
    page_url: giftVoucherLink(v.id) || giftVoucherPath(v.id),
    redemptions: (v.redemptions ?? [])
      .map(redemptionView)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }
}

/**
 * Pro zákazníka: bez interní poznámky, telefonu a kontaktu kupujícího.
 * Kód se ukáže až po zaplacení — nezaplacený poukaz nejde uplatnit,
 * a kód na nezaplacené stránce by se dal opsat a zkusit.
 */
export const serializePublicVoucher = (v: any) => {
  const state = voucherState(v)
  const paid = v.payment_status === "paid"
  return {
    id: v.id,
    code: paid ? v.code : null,
    kind: v.kind,
    initial_value: Number(v.initial_value),
    balance: paid ? Number(v.balance) : Number(v.initial_value),
    currency_code: v.currency_code,
    valid_until: v.valid_until,
    recipient_name: v.recipient_name ?? null,
    dedication: v.dedication ?? null,
    buyer_name: v.buyer_name,
    payment_method: v.payment_method,
    payment_status: v.payment_status,
    /** Smí zákazník zaplatit online z této stránky? */
    can_pay_online: !paid && v.status !== "cancelled" && v.payment_method === "comgate",
    state,
    state_label: VOUCHER_STATE_LABEL[state],
  }
}
