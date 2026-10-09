/**
 * Reklamace a zrušení — sdílené typy a popisky pro administraci.
 *
 * Datový kontrakt: docs/reklamace-a-zruseni.md (§2 model, §4 admin API).
 * Jeden zdroj pravdy pro stránku /reklamace, widget na detailu objednávky a
 * souhrn v Přehledu, aby se barvy badge a názvy stavů nerozešly.
 */

import { formatCzk } from "./workbench";

export type ReturnKind = "reklamace" | "vraceni" | "odstoupeni";

export type ReturnStatus =
  | "pending"
  | "approved"
  | "received"
  | "resolved"
  | "rejected"
  | "cancelled";

/** Co ROZHODLA majitelka (reklamace); odstoupení/vrácení má vždy `refund`. */
export type ReturnResolution = "repair" | "replace" | "discount" | "refund";

/** Co ŽÁDÁ zákazník — jen u reklamace. */
export type RequestedResolution = "repair" | "replace" | "refund";

export type ReturnRefund = {
  amount: number;
  method: "comgate" | "manual" | string;
  at: string;
  note?: string | null;
};

/**
 * Vybraná položka žádosti (§11.1). `unit_price` / `total` jsou po slevě,
 * s DPH — z objednávky, ne z ceníku. Staré žádosti mají místo toho jen
 * textové `items`.
 */
export type ReturnLineItem = {
  line_item_id: string;
  title: string;
  variant_title?: string | null;
  thumbnail?: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  currency_code?: string | null;
};

/** Příčina poškození — zatím jen „přepravou" (§11.3). */
export type DamageCause = "carrier";

export type ReturnRequest = {
  id: string;
  order_id: string;
  order_display_id: string | number;
  email: string;
  customer_name: string | null;
  kind: ReturnKind | null;
  status: ReturnStatus;
  reason: string;
  items: string | null;
  photos: string[] | null;
  requested_resolution: RequestedResolution | null;
  resolution: ReturnResolution | null;
  resolve_by: string | null;
  withdrawal_deadline: string | null;
  decision_note: string | null;
  decided_at: string | null;
  goods_received_at: string | null;
  goods_tracking: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  refunds: ReturnRefund[] | null;
  refund_amount: number | null;
  refund_method: string | null;
  refunded_at: string | null;
  protocol_url: string | null;
  protocol_number: string | null;
  /** Dopočítané serverem: zachyceno − vráceno (modul i refund_history). */
  captured_total: number;
  refunded_total: number;
  remaining: number;
  /** `false` = zboží k zákazníkovi nikdy neodešlo (odstoupení před odesláním). */
  goods_shipped?: boolean;
  currency_code?: string | null;
  /**
   * §11 — volitelné, starší řádky i starší server je nemají. Bez `line_items`
   * se UI chová jako dřív (textové `items`, výchozí částka = zbývá).
   */
  line_items?: ReturnLineItem[] | null;
  damage_cause?: DamageCause | null;
  /** `min(remaining, Σ line_items.total)` — dopočítané serverem (§11.2). */
  suggested_amount?: number | null;
  created_at: string;
  updated_at?: string | null;
};

export type ReturnRequestListResponse = {
  return_requests: ReturnRequest[];
  count: number;
  limit: number;
  offset: number;
};

export type ReturnRequestCounts = {
  pending: number;
  approved: number;
  received: number;
  resolved: number;
  rejected: number;
  cancelled: number;
  overdue: number;
};

export type RefundResponse = {
  refunded: boolean;
  method: string;
  amount: number;
  remaining: number;
  status: ReturnStatus;
  credit_note?: unknown;
  message: string;
};

export type CancelOrderResponse = {
  cancelled: boolean;
  message: string;
};

export const RETURN_STATUSES: ReturnStatus[] = [
  "pending",
  "approved",
  "received",
  "resolved",
  "rejected",
  "cancelled",
];

export const isReturnStatus = (value: unknown): value is ReturnStatus =>
  typeof value === "string" && (RETURN_STATUSES as string[]).includes(value);

export const isReturnKind = (value: unknown): value is ReturnKind =>
  value === "reklamace" || value === "vraceni" || value === "odstoupeni";

/** Finální stavy — z nich se nikam nejde (§3 kontraktu). */
export const isFinalStatus = (status: ReturnStatus) =>
  status === "resolved" || status === "rejected" || status === "cancelled";

export type BadgeColor = "grey" | "blue" | "green" | "red" | "orange" | "purple";

export const KIND_META: Record<ReturnKind, { label: string; color: BadgeColor }> = {
  reklamace: { label: "Reklamace", color: "orange" },
  vraceni: { label: "Vrácení", color: "blue" },
  odstoupeni: { label: "Odstoupení §1829", color: "purple" },
};

export const STATUS_META: Record<ReturnStatus, { label: string; color: BadgeColor }> = {
  pending: { label: "Nové", color: "orange" },
  approved: { label: "Schváleno – čeká na zboží", color: "blue" },
  received: { label: "Zboží přijato", color: "purple" },
  resolved: { label: "Vyřízeno", color: "green" },
  rejected: { label: "Zamítnuto", color: "red" },
  cancelled: { label: "Stornováno", color: "grey" },
};

export const RESOLUTION_LABEL: Record<ReturnResolution, string> = {
  repair: "Oprava",
  replace: "Výměna",
  discount: "Sleva z ceny",
  refund: "Vrácení peněz",
};

export const isDamageCause = (value: unknown): value is DamageCause =>
  value === "carrier";

export const DAMAGE_CAUSE_LABEL: Record<DamageCause, string> = {
  carrier: "Poškozeno přepravou",
};

/** Barva badge: červená — poškození se ČP hlásí do 2 pracovních dnů. */
export const DAMAGE_CAUSE_COLOR: Record<DamageCause, BadgeColor> = {
  carrier: "red",
};

/** Jednořádková nápověda k badge; odkaz na formulář ČP šel majitelce e-mailem. */
export const DAMAGE_CAUSE_HINT: Record<DamageCause, string> = {
  carrier:
    "Podejte reklamaci u České pošty (odkaz je v upozornění majitelce) — nejpozději do 2 pracovních dnů od dodání.",
};

/** Součet cen vybraných položek (po slevě, s DPH). */
export const lineItemsTotal = (
  items: ReturnLineItem[] | null | undefined
): number =>
  (items ?? []).reduce((sum, item) => sum + asNumber(item.total), 0);

/** Součet kusů přes vybrané položky. */
export const lineItemsQuantity = (
  items: ReturnLineItem[] | null | undefined
): number =>
  (items ?? []).reduce((sum, item) => sum + asNumber(item.quantity), 0);

/** Jedna položka: „název · varianta · N ks · částka" (§11.5). */
export const formatLineItem = (item: ReturnLineItem): string =>
  [
    item.title,
    item.variant_title && item.variant_title !== "Default variant"
      ? item.variant_title
      : null,
    `${asNumber(item.quantity)} ks`,
    formatCzk(asNumber(item.total)),
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Celý seznam, jedna položka na řádek — do `title` tooltipů, e-mailových
 * náhledů a všude, kde se dřív vypisovalo textové `items`.
 */
export const formatLineItems = (
  items: ReturnLineItem[] | null | undefined
): string => (items ?? []).map(formatLineItem).join("\n");

/**
 * Zbývající dny do zákonné lhůty (reklamace 30 dnů, odstoupení/vrácení 14 dnů)
 * + barva varování. `null`, když lhůta není známá.
 */
export const deadlineInfo = (resolveBy: string | null | undefined) => {
  if (!resolveBy) return null;
  const days = Math.ceil(
    (new Date(resolveBy).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  const overdue = days < 0;
  const label = overdue
    ? `Po lhůtě o ${Math.abs(days)} ${Math.abs(days) === 1 ? "den" : "dní"}`
    : days === 0
      ? "Lhůta je dnes"
      : `Zbývá ${days} ${days === 1 ? "den" : days < 5 ? "dny" : "dní"}`;
  const color: "red" | "orange" | "grey" =
    overdue || days <= 3 ? "red" : days <= 7 ? "orange" : "grey";
  return { days, overdue, label, color };
};

/**
 * Částky můžou přijít jako číslo, řetězec nebo BigNumber tvar `{ value }` —
 * tady se z toho udělá číslo, nebo 0.
 */
export const asNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object" && "value" in value) {
    return asNumber((value as { value: unknown }).value);
  }
  return 0;
};

/** Hluboký odkaz do modulu: otevře správný tab a detail žádosti. */
export const reklamaceLink = (request: Pick<ReturnRequest, "id" | "status">) =>
  `/reklamace?status=${request.status}&id=${encodeURIComponent(request.id)}`;
