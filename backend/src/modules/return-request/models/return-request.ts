import { model } from "@medusajs/framework/utils"

/**
 * A customer's request to return something, before any native Medusa return
 * exists (WorkflowPlan.md — returns intake).
 *
 * Today returns are agreed over e-mail; this row is that conversation's front
 * door. It deliberately stores a *snapshot* of the order facts it needs
 * (`order_display_id`, `email`, `customer_name`) so the decision e-mails can be
 * sent from the request alone, without re-deriving who asked.
 *
 * Od 7. 10. 2026 je to zároveň jádro modulu „Reklamace a zrušení"
 * (docs/reklamace-a-zruseni.md): stavy `pending → approved → received →
 * resolved | rejected | cancelled`, požadované vs. rozhodnuté vyřízení,
 * částečné a opakované refundace v `refunds`.
 */
const ReturnRequest = model.define("return_request", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  order_display_id: model.text(),
  email: model.text(),
  customer_name: model.text().nullable(),
  reason: model.text(),
  /**
   * Typovaný druh žádosti: "reklamace" (vada) | "vraceni" | "odstoupeni"
   * (§1829). Dřív byl jen slepený v `reason` textu, takže se podle něj nedalo
   * filtrovat ani počítat lhůta. Nullable kvůli starým řádkům. Text, ne enum,
   * ať netřeba řešit migraci nativního enum typu.
   */
  kind: model.text().nullable(),
  /** The customer's own free-text list of what they want to send back. */
  items: model.json().nullable(),
  /** Fotky vady / zboží (pole URL v úložišti), aby zákazník ukázal, co je špatně. */
  photos: model.json().nullable(),
  /**
   * Zákonná lhůta na vyřízení: reklamace do 30 dnů (§19 ZOS), odstoupení/vrácení
   * vrátit peníze do 14 dnů (§1832). Počítá se z data žádosti; admin podle ní
   * upozorňuje, ať nic nepropadne.
   */
  resolve_by: model.dateTime().nullable(),
  /**
   * Co ŽÁDÁ zákazník — jen u reklamace (§19/1 ZOS chce „požadovaný způsob"
   * v protokolu): "repair" | "replace" | "refund".
   */
  requested_resolution: model.text().nullable(),
  /**
   * Co ROZHODLA majitelka při schválení: u reklamace "repair" | "replace" |
   * "discount" | "refund" (§2169–2172), u odstoupení/vrácení vždy "refund".
   */
  resolution: model.text().nullable(),
  /** Zboží dorazilo zpět / bylo přijato k opravě. */
  goods_received_at: model.dateTime().nullable(),
  /** Číslo zásilky, kterou zákazník poslal zboží zpět (zadává zákazník). */
  goods_tracking: model.text().nullable(),
  /** Vyřízeno (finální stav `resolved`). */
  resolved_at: model.dateTime().nullable(),
  /** Text do „potvrzení o vyřízení" (protokol + e-mail). */
  resolution_note: model.text().nullable(),
  /**
   * Jednotlivé refundace `{ amount, method, at, note? }` — umožňuje částečné a
   * opakované vrácení (krácení za opotřebení §1833, sleva z ceny).
   */
  refunds: model.json().nullable(),
  /** SOUČET `refunds` (hlavní jednotky) — zůstává kvůli zpětné kompatibilitě. */
  refund_amount: model.number().nullable(),
  /** "comgate" (karta) nebo "manual" (hotovost/dobírka/osobní odběr) — poslední. */
  refund_method: model.text().nullable(),
  /** Poslední refundace. */
  refunded_at: model.dateTime().nullable(),
  /**
   * Snapshot 14denní lhůty pro odstoupení (§1829) v okamžiku žádosti —
   * `max(fulfillments.shipped_at) + 14 d`; null = zboží ještě neodešlo.
   */
  withdrawal_deadline: model.dateTime().nullable(),
  /** Reklamační protokol (PDF v úložišti) a jeho číslo — fáze 2. */
  protocol_url: model.text().nullable(),
  protocol_number: model.text().nullable(),
  status: model
    .enum([
      "pending",
      "approved",
      "received",
      "resolved",
      "rejected",
      "cancelled",
    ])
    .index()
    .default("pending"),
  /** Her words on the decision — for a rejection, the customer sees them. */
  decision_note: model.text().nullable(),
  decided_at: model.dateTime().nullable(),
})
  .indexes([
    {
      on: ["order_id"],
    },
  ])

export default ReturnRequest
