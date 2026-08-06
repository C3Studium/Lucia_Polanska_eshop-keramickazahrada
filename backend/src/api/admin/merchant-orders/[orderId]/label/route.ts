import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * The carrier label for an order's parcel, as a downloadable PDF.
 *
 * ## Where a label actually comes from
 *
 * Not from us. A Česká pošta label carries a barcode that ČP issued when the
 * parcel was booked; printing something that merely *looks* like one produces a
 * parcel the post office will refuse, after she has taped it shut. So this
 * route never generates a label — it returns the one the carrier gave us.
 *
 * `createFulfillment` stores those in the fulfilment's `labels` (and the
 * provider can serve more through `getFulfillmentDocuments`). While the shop
 * runs in record-only mode there are none, and this route says so plainly
 * rather than returning an empty PDF.
 *
 * ## What this means today
 *
 * Until the ČP B2B account exists (P4-2, `docs/TODO-carrier-account.md`) this
 * always answers „no label yet, book the parcel in the ČP portal". The moment
 * credentials land and the provider starts returning labels, the same button
 * starts downloading real ones — no further wiring.
 */

type LabelResponse = {
  available: boolean
  reason?: string
  labels: Array<{ url: string; tracking_number: string | null }>
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "items.id",
      "items.title",
      "items.quantity",
      "items.metadata",
      "fulfillments.id",
      "fulfillments.canceled_at",
      "fulfillments.data",
      "fulfillments.labels.url",
      "fulfillments.labels.tracking_number",
    ],
    filters: { id: req.params.orderId },
  })

  const order = orders[0] as any

  // ?parcel=stock|zakazka — a mixed order ships as TWO parcels when she
  // wants: the stock items now, the commission when the kiln says so. The
  // split is by the line-item marker the checkout writes; each variant gets
  // its own podací lístek. Default (no param) = everything in one.
  const parcel =
    req.query.parcel === "stock" || req.query.parcel === "zakazka"
      ? req.query.parcel
      : "all"
  const isCommissionItem = (item: any) =>
    Boolean((item?.metadata as any)?.made_to_order)
  const parcelItems = (order?.items ?? []).filter((item: any) =>
    parcel === "all"
      ? true
      : parcel === "zakazka"
        ? isCommissionItem(item)
        : !isCommissionItem(item)
  )

  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Objednávka nebyla nalezena."
    )
  }

  if (parcel !== "all" && !parcelItems.length) {
    res.status(200).json({
      available: false,
      reason:
        parcel === "zakazka"
          ? "V objednávce žádná zakázka není — stačí jeden lístek."
          : "V objednávce nejsou skladové položky — stačí jeden lístek.",
      labels: [],
    } as LabelResponse)
    return
  }

  // The ČP nAPI credentials gate everything real. Named plainly so the
  // button can exist today and start working the day the account does.
  if (!process.env.BALIKOVNA_API_TOKEN || !process.env.BALIKOVNA_API_SECRET) {
    res.status(200).json({
      available: false,
      reason:
        "Podací lístek zatím nejde vytvořit — čekáme na přístupy k České poště (B2B účet). Jakmile budou, tlačítko začne fungovat samo.",
      labels: [],
      parcel,
      items: parcelItems.map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
      })),
    } as never)
    return
  }

  const fulfillment = (order.fulfillments || []).find(
    (item: any) => !item?.canceled_at
  )

  if (!fulfillment) {
    const body: LabelResponse = {
      available: false,
      reason:
        "Zásilka ještě není připravená. Nejdřív ji připravte k odeslání, štítek bude až potom.",
      labels: [],
    }
    res.status(200).json(body)
    return
  }

  const labels = (fulfillment.labels || [])
    .filter((label: any) => label?.url)
    .map((label: any) => ({
      url: label.url,
      tracking_number: label.tracking_number ?? null,
    }))

  if (!labels.length) {
    const recordOnly = fulfillment?.data?.mode === "manual"

    const body: LabelResponse = {
      available: false,
      reason: recordOnly
        ? "Zásilka zatím není podaná u České pošty, takže štítek neexistuje. Podejte ji v portálu České pošty — jakmile bude e-shop napojený, štítek se stáhne odsud."
        : "Dopravce zatím štítek nevrátil. Zkuste to prosím za chvíli.",
      labels: [],
    }
    res.status(200).json(body)
    return
  }

  const body: LabelResponse = { available: true, labels }
  res.status(200).json(body)
}
