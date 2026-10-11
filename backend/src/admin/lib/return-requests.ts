/**
 * Reklamace a zrušení — sdílené typy a popisky pro administraci.
 *
 * Datový kontrakt: docs/reklamace-a-zruseni.md (§2 model, §4 admin API).
 * Jeden zdroj pravdy pro stránku /reklamace, widget na detailu objednávky a
 * souhrn v Přehledu, aby se barvy badge a názvy stavů nerozešly.
 */

import { formatCzk } from "./workbench";

/** `uprava` = vrácení rozdílu po zákaznické úpravě objednávky (zakládá server). */
export type ReturnKind = "reklamace" | "vraceni" | "odstoupeni" | "uprava";

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

/** Rozsah refundace (§12.3): vybrané položky, celá objednávka, záloha zakázky. */
export type RefundScope = "items" | "all" | "deposit";

/**
 * Řádek košíku vrácení v TĚLE refundace (§13.2) — přesně to, co posílá košík.
 * Server částku počítá sám (item: `unit_total × qty`, component: `unit_share
 * × qty`, shipping: poštovné objednávky jednou, custom: zadaná částka) a
 * ohlídá stropy; z prohlížeče žádná cena nejde.
 */
export type RefundLineInput =
  | { type: "item"; line_item_id: string; quantity: number }
  | { type: "component"; line_item_id: string; product_id: string; quantity: number }
  | { type: "shipping" }
  | { type: "custom"; amount: number; label: string };

export type RefundLineType = RefundLineInput["type"];

/**
 * Řádek tak, jak se VRACÍ v záznamu `refunds[].lines` (server
 * `lib/claims/refund-rules.ts`): se snapshotem názvu (`title` — u custom je
 * to popisek) a ceny (`unit_total`, `amount`). Volné, ať výpis přežije i
 * starší / neúplný záznam; `label` se toleruje pro tvar vstupu.
 */
export type RefundLine = {
  type: RefundLineType;
  line_item_id?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
  quantity?: number | null;
  title?: string | null;
  label?: string | null;
  unit_total?: number | null;
  amount?: number | null;
};

export const REFUND_LINE_TYPE_LABEL: Record<RefundLineType, string> = {
  item: "položka",
  component: "komponenta balíčku",
  shipping: "poštovné",
  custom: "jiná částka",
};

export const isRefundLine = (value: unknown): value is RefundLine => {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return type === "item" || type === "component" || type === "shipping" || type === "custom";
};

/** Jeden řádek refundace do výpisu plateb: „název × N", „poštovné", „jiná částka: …". */
export const formatRefundLine = (line: RefundLine): string => {
  const quantity = asNumber(line.quantity);
  switch (line.type) {
    case "item":
      return `${line.title || "položka"}${quantity > 0 ? ` × ${quantity}` : ""}`;
    case "component":
      return `komponenta: ${line.title || line.product_id || "?"}${quantity > 0 ? ` × ${quantity}` : ""}`;
    case "shipping":
      return line.title || "poštovné";
    case "custom":
      return `jiná částka: ${line.label || line.title || "částka"}`;
    default:
      return "";
  }
};

/**
 * Dobropis k jedné refundaci (§13.3) na záznamu `refunds[].credit_note`.
 * Server posílá snapshot `{ status, number, pdf_url, reason? }` — `skipped`
 * = zkušební režim / bez faktury (důvod v `reason`), `error` = iDoklad odmítl.
 * Tolerují se i pole položky `order.metadata.idoklad_credit_notes[]`
 * (`id`, `amount`, `issued_at`, `refund_id`) bez `status`.
 */
export type RefundCreditNote = {
  status?: "issued" | "exists" | "skipped" | "error" | string | null;
  id?: string | number | null;
  number?: string | null;
  pdf_url?: string | null;
  reason?: string | null;
  amount?: number | null;
  issued_at?: string | null;
  refund_id?: string | null;
};

export const isRefundCreditNote = (value: unknown): value is RefundCreditNote =>
  Boolean(value) && typeof value === "object";

/** Dobropis existuje (vystaven teď, nebo už byl) — má číslo / PDF. */
export const creditNoteIssued = (note: RefundCreditNote | null | undefined): boolean =>
  Boolean(note) &&
  (note!.status === "issued" ||
    note!.status === "exists" ||
    (!note!.status && Boolean(note!.number || note!.pdf_url)));

export type ReturnRefund = {
  id?: string | null;
  amount: number;
  method: "comgate" | "manual" | string;
  at: string;
  note?: string | null;
  /** §12.3 — za které položky se vracelo (starší záznamy; nové mají `lines`). */
  items?: RefundItemRef[] | null;
  scope?: RefundScope | string | null;
  /** §13.2 — řádky košíku vrácení. */
  lines?: RefundLine[] | null;
  /** §13.4 — potvrzení ComGate (`provider: "comgate"`) / ruční (`"manual"`). */
  provider?: "comgate" | "manual" | string | null;
  /** refId = idempotency klíč u ComGate. */
  provider_ref?: string | null;
  provider_confirmed_at?: string | null;
  provider_test?: boolean | null;
  /** `refundedAmountMinor` z relace ComGate po refundu — součet vráceného. */
  provider_refunded_total?: number | null;
  provider_status?: string | null;
  /**
   * §13.3 — dobropis (snapshot se `status`); starší tvar: `null` +
   * `credit_note_skipped_reason` = zkušební režim.
   */
  credit_note?: RefundCreditNote | null;
  credit_note_skipped_reason?: string | null;
};

/** Položka v těle refundace i v záznamu `refunds[].items`. */
export type RefundItemRef = {
  line_item_id: string;
  quantity: number;
  title?: string | null;
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

/**
 * Příčina poškození (§11.3, §13.7): `"carrier"` = poškozeno přepravou,
 * `"damaged"` = poškozený kus (viditelné poškození); `null` = vada /
 * nefunkčnost. U obou příčin jsou fotky povinné.
 */
export type DamageCause = "carrier" | "damaged";

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
  credit_note?: RefundCreditNote | unknown;
  message: string;
  scope?: RefundScope | string | null;
  lines?: RefundLine[] | null;
};

export type CancelOrderResponse = {
  cancelled: boolean;
  message: string;
};

/** `POST /admin/return-requests/:id/cancel-production` (§12.4). */
export type CancelProductionResponse = {
  cancelled?: boolean;
  message?: string;
};

/* ------------------------------------------------ detail stránky (§12.2) ---- */

/**
 * Případ, podle kterého server skládá kroky průběhu (§12.5). Počítá se na
 * serveru (`planClaimCase`), UI jen vykresluje popisek a kroky.
 */
export type ClaimCase =
  | "cancel_unpaid"
  | "cancel_paid_unshipped"
  | "withdrawal_shipped"
  | "return_shipped"
  | "commission_cancel"
  | "claim"
  | "mixed_cancel"
  | "edit_refund";

export type ClaimStepState = "done" | "current" | "upcoming" | "skipped";

export type ClaimStep = {
  key: string;
  label: string;
  state: ClaimStepState;
  at?: string | null;
};

export type ClaimDetailOrder = {
  id: string;
  display_id: string | number;
  status?: string | null;
  email?: string | null;
  customer_name?: string | null;
  currency_code?: string | null;
  total?: number | null;
  subtotal?: number | null;
  shipping_total?: number | null;
  created_at?: string | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  shipping_method?: { name?: string | null; is_pickup?: boolean | null } | null;
};

/**
 * Komponenta balíčku (§13.5) — položka s `product.metadata.is_bundle` se
 * rozepíše po komponentách. `quantity` je kusů NA JEDEN balíček; `unit_share`
 * poměrná cena za kus komponenty (Σ komponent × quantity = `unit_total`
 * balíčku). `refundable_quantity` je v kusech komponenty za celou položku.
 */
export type ClaimItemComponent = {
  product_id: string;
  variant_id?: string | null;
  title: string;
  thumbnail?: string | null;
  quantity: number;
  unit_share: number;
  refunded_quantity?: number | null;
  refundable_quantity?: number | null;
};

/**
 * Položka objednávky na stránce žádosti. `unit_total` = `item.total /
 * quantity` (po slevě, s DPH). `refundable_quantity` už odečítá dřívější
 * refundace po položkách; `refundable_amount` je u zakázkové položky navíc
 * omezené tím, co je skutečně zaplaceno (záloha).
 */
export type ClaimDetailItem = {
  line_item_id: string;
  title: string;
  variant_title?: string | null;
  thumbnail?: string | null;
  quantity: number;
  unit_total: number;
  line_total: number;
  is_made_to_order?: boolean | null;
  refunded_quantity?: number | null;
  refundable_quantity?: number | null;
  refundable_amount?: number | null;
  /**
   * Kolik kusů této položky zákazník vybral v žádosti. Jen nápověda (badge
   * „v žádosti N ks") — nic se nepředvybírá (§13.2).
   */
  selected_in_claim?: number | null;
  /** §13.5 — balíček rozepsaný po komponentách (jen když server posílá). */
  is_bundle?: boolean | null;
  components?: ClaimItemComponent[] | null;
};

export type ClaimMoney = {
  captured: number;
  refunded: number;
  remaining: number;
  refunds?: ReturnRefund[] | null;
};

/** §13.2 — poštovné objednávky: vrací se nejvýš jednou (`shipping_refunded`). */
export type ClaimShipping = {
  total: number;
  refunded: number;
  refundable: number;
  /** `false` = reklamace: poštovné se nevrací, jen cena výrobků. */
  allowed?: boolean;
};

/** Náhled „Vrátit vše" — přesně to, co server pošle se `scope: "all"`. */
export type ClaimRefundAll = {
  amount: number;
  lines: RefundLine[];
  /** Reklamace: jen reklamované výrobky, bez poštovného. */
  products_only: boolean;
  problem?: string | null;
};

/** Účet pro vrácení převodem (objednávka neplacená kartou). */
export type ClaimRefundAccount = {
  needed: boolean;
  display: string | null;
  iban: string | null;
};

export type ClaimProduction = {
  id: string;
  stage?: string | null;
  agreed_total?: number | null;
  surcharge?: number | null;
  deposit_paid?: number | null;
  balance_paid?: number | null;
  outstanding?: number | null;
  /** Server posílá `true`, nebo (starší tvar) vrácenou částku. */
  deposit_refunded?: boolean | number | null;
  balance_request_status?: string | null;
};

export type ClaimFlags = {
  goods_shipped?: boolean | null;
  is_commission?: boolean | null;
  is_mixed?: boolean | null;
  paid_online?: boolean | null;
  pay_later?: boolean | null;
  nothing_captured?: boolean | null;
};

/** Co server povolí TEĎ — stránka kreslí tlačítka jen podle těchto hodnot. */
export type ClaimActions = {
  approve?: boolean;
  reject?: boolean;
  received?: boolean;
  refund_items?: boolean;
  refund_all?: boolean;
  refund_deposit?: boolean;
  resolve?: boolean;
  cancel_order?: boolean;
  cancel_production?: boolean;
  cancel_request?: boolean;
};

/**
 * `GET /admin/return-requests/:id/detail`. Vše mimo `request` je volitelné —
 * stránka musí fungovat i proti serveru, který část payloadu ještě neposílá
 * (kroky a akce si pak dopočítá z žádosti, viz `fallbackSteps` / `deriveActions`).
 */
export type ClaimDetailResponse = {
  request: ReturnRequest;
  order?: ClaimDetailOrder | null;
  items?: ClaimDetailItem[] | null;
  money?: ClaimMoney | null;
  /** §13.2 — bez něj košík řádek „Poštovné" nenabídne. */
  shipping?: ClaimShipping | null;
  refund_all?: ClaimRefundAll | null;
  refund_account?: ClaimRefundAccount | null;
  production?: ClaimProduction | null;
  flags?: ClaimFlags | null;
  case?: ClaimCase | string | null;
  steps?: ClaimStep[] | null;
  actions?: ClaimActions | null;
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
  value === "reklamace" || value === "vraceni" || value === "odstoupeni" || value === "uprava";

/** Finální stavy — z nich se nikam nejde (§3 kontraktu). */
export const isFinalStatus = (status: ReturnStatus) =>
  status === "resolved" || status === "rejected" || status === "cancelled";

export type BadgeColor = "grey" | "blue" | "green" | "red" | "orange" | "purple";

export const KIND_META: Record<ReturnKind, { label: string; color: BadgeColor }> = {
  reklamace: { label: "Reklamace", color: "orange" },
  vraceni: { label: "Vrácení", color: "blue" },
  odstoupeni: { label: "Odstoupení §1829", color: "purple" },
  uprava: { label: "Rozdíl z úpravy", color: "green" },
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

/** Popisek případu (§12.5) do hlavičky stránky žádosti. */
export const CASE_LABEL: Record<ClaimCase, string> = {
  cancel_unpaid: "Zrušení bez platby",
  cancel_paid_unshipped: "Zrušení po zaplacení",
  withdrawal_shipped: "Odstoupení po odeslání",
  return_shipped: "Vrácení zboží",
  commission_cancel: "Zrušení zakázky",
  claim: "Reklamace",
  mixed_cancel: "Smíšená objednávka",
  edit_refund: "Vrácení rozdílu po úpravě objednávky",
};

export const isClaimCase = (value: unknown): value is ClaimCase =>
  typeof value === "string" && value in CASE_LABEL;

/** Popisek rozsahu refundace do seznamu plateb. */
export const REFUND_SCOPE_LABEL: Record<RefundScope, string> = {
  items: "vybrané položky",
  all: "celá objednávka",
  deposit: "záloha zakázky",
};

export const isRefundScope = (value: unknown): value is RefundScope =>
  value === "items" || value === "all" || value === "deposit";

export const isDamageCause = (value: unknown): value is DamageCause =>
  value === "carrier" || value === "damaged";

export const DAMAGE_CAUSE_LABEL: Record<DamageCause, string> = {
  carrier: "Poškozeno přepravou",
  damaged: "Poškozený kus",
};

/**
 * Barva badge: červená u přepravy — poškození se ČP hlásí do 2 pracovních
 * dnů; oranžová u poškozeného kusu — běžná reklamace, jen s fotkami.
 */
export const DAMAGE_CAUSE_COLOR: Record<DamageCause, BadgeColor> = {
  carrier: "red",
  damaged: "orange",
};

/** Barva textu nápovědy — stejná jako badge. */
export const DAMAGE_CAUSE_TEXT_CLASS: Record<DamageCause, string> = {
  carrier: "text-ui-tag-red-text",
  damaged: "text-ui-tag-orange-text",
};

/** Jednořádková nápověda k badge; odkaz na formulář ČP šel majitelce e-mailem. */
export const DAMAGE_CAUSE_HINT: Record<DamageCause, string> = {
  carrier:
    "Podejte reklamaci u České pošty (odkaz je v upozornění majitelce) — nejpozději do 2 pracovních dnů od dodání.",
  damaged:
    "Zákazník hlásí viditelně poškozený kus (fotky přiložené). Dál běžná reklamace: schválit → zboží zpět → vrátit cenu položky.",
};

/**
 * „Co se stalo" — volba z formuláře reklamace (§13.7), i pro `null`
 * (vada / nefunkčnost), ať je v žádosti vždy vidět, co zákazník zvolil.
 */
export const whatHappenedLabel = (cause: unknown): string => {
  if (cause === "carrier") return "Balík dorazil poškozený — přepravou";
  if (cause === "damaged") return "Poškozený kus (viditelné poškození)";
  return "Vada nebo nefunkčnost";
};

/** Zaokrouhlení na haléře — součty košíku i porovnání se „zbývá". */
export const round2 = (value: number) => Math.round(value * 100) / 100;

/** „Zbývá 0" nemá být 0.00000001. */
export const nearlyZero = (value: number) => Math.abs(value) < 0.005;

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

/**
 * Odkaz na stránku žádosti (§12.6). `status` se už nepotřebuje — stránka je
 * samostatná, ne tab + drawer — ale přijímá se, ať staří volající nepadají.
 */
export const reklamaceLink = (
  request: Pick<ReturnRequest, "id"> & Partial<Pick<ReturnRequest, "status">>
) => `/reklamace/${encodeURIComponent(request.id)}`;

/* ------------------------------------------- záložní výpočty pro stránku ---- */

/**
 * Kroky průběhu, když je server ještě neposílá (`steps` chybí). Stejná logika,
 * jakou měla časová osa v drawer: přijato → rozhodnuto → zboží → vyřízeno.
 */
export const fallbackSteps = (request: ReturnRequest): ClaimStep[] => {
  const steps: ClaimStep[] = [
    { key: "received_request", label: "Žádost přijata", at: request.created_at, state: "done" },
  ];

  if (request.status === "pending") {
    steps.push({ key: "decision", label: "Rozhodnutí", at: null, state: "current" });
    steps.push({ key: "goods", label: "Zboží přijato", at: null, state: "upcoming" });
    steps.push({ key: "resolved", label: "Vyřízeno", at: null, state: "upcoming" });
    return steps;
  }
  if (request.status === "rejected") {
    steps.push({ key: "rejected", label: "Zamítnuto", at: request.decided_at, state: "done" });
    return steps;
  }
  if (request.status === "cancelled") {
    if (request.decided_at) {
      steps.push({ key: "approved", label: "Schváleno", at: request.decided_at, state: "done" });
    }
    if (request.goods_received_at) {
      steps.push({ key: "goods", label: "Zboží přijato", at: request.goods_received_at, state: "done" });
    }
    steps.push({ key: "cancelled", label: "Stornováno", at: request.updated_at ?? null, state: "done" });
    return steps;
  }

  steps.push({
    key: "approved",
    label: request.resolution
      ? `Schváleno — ${RESOLUTION_LABEL[request.resolution]}`
      : "Schváleno",
    at: request.decided_at,
    state: "done",
  });
  const needsGoods =
    request.kind !== "reklamace" ||
    request.resolution === "repair" ||
    request.resolution === "replace" ||
    request.resolution === "refund";
  if (request.goods_received_at) {
    steps.push({ key: "goods", label: "Zboží přijato", at: request.goods_received_at, state: "done" });
  } else if (request.status === "approved") {
    steps.push({
      key: "goods",
      label: needsGoods ? "Čeká na zboží" : "Zboží přijato (není třeba)",
      at: null,
      state: needsGoods ? "current" : "skipped",
    });
  } else if (request.status === "resolved") {
    steps.push({ key: "goods", label: "Zboží přijato (přeskočeno)", at: null, state: "skipped" });
  }
  if (request.status === "resolved") {
    steps.push({ key: "resolved", label: "Vyřízeno", at: request.resolved_at, state: "done" });
  } else {
    steps.push({
      key: "resolved",
      label: "Vyřízeno",
      at: null,
      state: request.status === "received" ? "current" : "upcoming",
    });
  }
  return steps;
};

/**
 * Povolené akce, když je server ještě neposílá (`actions` chybí). Opisuje
 * pravidla §3 tak, jak je uměl drawer; server má vždy poslední slovo a
 * odmítnutou akci ohlásí toastem.
 */
export const deriveActions = (
  request: ReturnRequest,
  remaining: number,
  goodsShipped: boolean | null | undefined,
  hasProduction: boolean
): ClaimActions => {
  const isReklamace = request.kind === "reklamace";
  const goodsKind = request.kind === "vraceni" || request.kind === "odstoupeni";
  const moneyResolution =
    request.resolution === "refund" || request.resolution === "discount";
  const workResolution =
    request.resolution === "repair" || request.resolution === "replace";
  const neverShipped = goodsKind && goodsShipped === false;

  switch (request.status) {
    case "pending":
      return { approve: true, reject: true, cancel_request: true };
    case "approved": {
      const canRefund = remaining > 0 && ((isReklamace && moneyResolution) || neverShipped);
      return {
        received: !neverShipped,
        refund_items: canRefund,
        refund_all: canRefund,
        refund_deposit: hasProduction && canRefund,
        resolve: workResolution || (isReklamace && !moneyResolution),
        cancel_order: neverShipped && remaining <= 0,
        cancel_production: hasProduction,
        cancel_request: true,
      };
    }
    case "received":
      return {
        refund_items: remaining > 0,
        refund_all: remaining > 0,
        refund_deposit: hasProduction && remaining > 0,
        resolve: true,
        cancel_production: hasProduction,
        cancel_request: true,
      };
    case "resolved":
      return { cancel_order: goodsKind };
    default:
      return {};
  }
};
