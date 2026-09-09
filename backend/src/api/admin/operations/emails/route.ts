import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { jeVyresena, vyreseneKoreny } from "../../../../lib/email-retries"

/**
 * Sent e-mails, newest first, with the ones that failed (WorkflowPlan.md §22).
 *
 * Why this is not the native `GET /admin/notifications`: that route's validator
 * accepts `q`, `id`, `channel` and `to` — and nothing else. There is no way to
 * ask it for "the ones that failed", which is the only question this page
 * exists to answer. The rows themselves are the native notification records,
 * unmodified; this route only filters and flattens them.
 *
 * Nezdařený e-mail, který se pak povedlo odeslat, se mezi nezdařené NEPOČÍTÁ.
 * Doklad o selhání zůstává v databázi (a je vidět v záložce „Všechny" jako
 * „Odesláno později"), ale počítadlo i seznam ho přeskočí — viz `lib/email-retries.ts`.
 */

const asPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

/*
 * Kolik řádků se načte, aby se z nich daly vyřešené odfiltrovat.
 *
 * Filtruje se až po načtení, protože „má někde v řetězci úspěch" není dotaz,
 * který by šel položit notifikačnímu modulu. Při objemech téhle routy (stovky
 * řádků za celou historii) je to v pořádku; kdyby jich mělo být víc, patří to
 * do vlastního SQL, ne do vyššího čísla.
 */
const STROP_FILTRU = 1000

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const notifications = req.scope.resolve(Modules.NOTIFICATION)

  const limit = Math.min(asPositiveInt(req.query.limit, 50), 100)
  const offset = asPositiveInt(req.query.offset, 0)
  const onlyFailures = req.query.status === "failure"

  const filters: Record<string, unknown> = { channel: "email" }
  if (onlyFailures) {
    filters.status = "failure"
  }
  // Every customer e-mail is tagged with its order, so the order page can show
  // exactly what that customer was told (§16, P5-3).
  if (typeof req.query.order_id === "string" && req.query.order_id) {
    filters.resource_id = req.query.order_id
  }

  // Úspěšné pokusy napřed — z nich se pozná, které řetězce jsou vyřešené.
  const uspesne = (await notifications.listNotifications(
    { channel: "email", status: "success" } as never,
    { take: STROP_FILTRU, select: ["id", "original_notification_id"] } as never
  )) as unknown as { id: string; original_notification_id?: string | null }[]
  const koreny = vyreseneKoreny(uspesne)

  let rows: any[]
  let count: number

  if (onlyFailures) {
    // Stránkuje se až po odfiltrování, jinak by stránky měly různý počet řádků.
    const vsechnyNezdarene = (await notifications.listNotifications(
      filters as never,
      { take: STROP_FILTRU, order: { created_at: "DESC" } }
    )) as any[]

    const zbyle = vsechnyNezdarene.filter((row) => !jeVyresena(row, koreny))
    count = zbyle.length
    rows = zbyle.slice(offset, offset + limit)
  } else {
    const [nactene, celkem] = await notifications.listAndCountNotifications(
      filters as never,
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )
    rows = nactene as any[]
    count = celkem
  }

  // Failures are counted separately from the current page so the header can say
  // how many there are even while the „vše" tab is open.
  const vsechnyNezdareneProPocet = (await notifications.listNotifications(
    { channel: "email", status: "failure" } as never,
    { take: STROP_FILTRU, select: ["id", "original_notification_id"] } as never
  )) as unknown as { id: string; original_notification_id?: string | null }[]
  const failureCount = vsechnyNezdareneProPocet.filter(
    (row) => !jeVyresena(row, koreny)
  ).length

  res.status(200).json({
    emails: rows.map((row) => ({
      id: row.id,
      to: row.to,
      template: row.template,
      status: row.status,
      created_at: row.created_at,
      resource_id: row.resource_id,
      resource_type: row.resource_type,
      // Set on a retry, so the page can mark rows that are second attempts.
      original_notification_id: row.original_notification_id ?? null,
      // Nezdařený pokus, který se později povedlo odeslat. Zůstává v seznamu
      // „Všechny" jako doklad, ale nemá se tvářit jako nedoručený e-mail.
      vyreseno: row.status === "failure" && jeVyresena(row, koreny),
      // The subject the merchant-notification template was sent with; customer
      // templates carry their own, so this is often absent.
      subject:
        typeof row.data?.subject === "string" ? row.data.subject : null,
    })),
    count,
    failure_count: failureCount,
    limit,
    offset,
  })
}
