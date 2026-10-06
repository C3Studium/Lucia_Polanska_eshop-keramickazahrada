import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { generateCpLabelWorkflow } from "../../../../../workflows/generate-cp-label"
import { notifyMerchant } from "../../../../../lib/notify"

/**
 * Přístupy k ČP jsou KOMPLETNÍ až se všemi šesti údaji — stejná podmínka, jakou
 * má fulfillment provider (`ceskaPostaFulfillment` hasCredentials). Dřív se tu
 * kontroloval jen TOKEN+SECRET, takže tlačítko „Vygenerovat štítek" svítilo,
 * i když chyběl POST_CODE / LOCATION_NUMBER — a podání pak spadlo do režimu
 * „jen záznam" (bez štítku). Teď gate odpovídá realitě podání.
 */
const cpCredentialsReady = (): boolean =>
  Boolean(
    process.env.BALIKOVNA_API_URL &&
      process.env.BALIKOVNA_API_TOKEN &&
      process.env.BALIKOVNA_API_SECRET &&
      process.env.BALIKOVNA_API_CUSTOMER_ID &&
      process.env.BALIKOVNA_API_POST_CODE &&
      process.env.BALIKOVNA_API_LOCATION_NUMBER
  )

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
  labels: Array<{
    url: string
    tracking_number: string | null
    pdf_base64?: string | null
  }>
  /**
   * Kam zásilka jede — u Balíkovny podle manuálu ČP: adresa štítku je
   * „BALÍKOVNA, {ZIP} {NAME}" (PSČ výhradně z pole zip widgetu, ne z adresy).
   * Admin to ukazuje pod tlačítky, aby šlo ověřit celý řetěz checkout →
   * objednávka → štítek i dřív, než existují ČP přístupy.
   */
  destination?: {
    type: "balikovna"
    zip: string | null
    name: string | null
    address: string | null
    address_line: string | null
  } | null
  /** Co je špatně, ale nebrání odpovědi — admin je ukáže oranžově. */
  warnings?: string[]
  /** Jsou nastavené ČP přístupy? Widget podle toho nabídne „Vygenerovat". */
  credentials_ready?: boolean
  /** Trvalý odkaz na PDF štítku v úložišti (MinIO), když už byl vygenerován. */
  label_url?: string | null
  /** Název souboru pro stažení: `Stitek-Jmeno-Prijmeni-0026.pdf`. */
  filename?: string | null
  /** Kdy byl štítek vygenerován (ISO), když byl. */
  generated_at?: string | null
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "metadata",
      "items.id",
      "items.title",
      "items.quantity",
      "items.metadata",
      "shipping_methods.name",
      "fulfillments.id",
      "fulfillments.canceled_at",
      "fulfillments.data",
      "fulfillments.labels.url",
      "fulfillments.labels.tracking_number",
    ],
    filters: { id: req.params.orderId },
  })

  const order = orders[0] as any

  /*
   * Balíkovna context: který checkout zapsal do cart.metadata, to completion
   * přeneslo na objednávku. Jede-li objednávka do Balíkovny a místo chybí,
   * je to přesně ta chyba, kterou má admin UKÁZAT, ne spolknout.
   */
  const viaBalikovna = (order?.shipping_methods ?? []).some((method: any) =>
    fold(String(method?.name ?? "")).includes("balikovna")
  )
  const orderMeta = (order?.metadata ?? {}) as Record<string, unknown>
  const pointZip =
    typeof orderMeta.balikovna_point_zip === "string"
      ? orderMeta.balikovna_point_zip
      : null
  const pointName =
    typeof orderMeta.balikovna_point_name === "string"
      ? orderMeta.balikovna_point_name
      : null
  const destination: LabelResponse["destination"] = viaBalikovna
    ? {
        type: "balikovna",
        zip: pointZip,
        name: pointName,
        address:
          typeof orderMeta.balikovna_point_address === "string"
            ? orderMeta.balikovna_point_address
            : null,
        // Formát štítku dle manuálu ČP — ZIP z widgetu, nikdy z adresy.
        address_line:
          pointZip && pointName ? `BALÍKOVNA, ${pointZip} ${pointName}` : null,
      }
    : null
  const warnings: string[] = []
  if (viaBalikovna && (!pointZip || !pointName)) {
    warnings.push(
      "Objednávka jede do Balíkovny, ale nemá uložené výdejní místo — bez něj štítek nepůjde vystavit. Zkontrolujte, že zákazník místo vybral (metadata objednávky)."
    )
  }

  // Trvalá kopie štítku + stav přístupů — pro widget na detailu objednávky.
  const credentialsReady = cpCredentialsReady()
  const labelUrl =
    typeof orderMeta.cp_label_url === "string" && orderMeta.cp_label_url
      ? orderMeta.cp_label_url
      : null
  const labelFilename =
    typeof orderMeta.cp_label_filename === "string" && orderMeta.cp_label_filename
      ? orderMeta.cp_label_filename
      : null
  const labelGeneratedAt =
    typeof orderMeta.cp_label_generated_at === "string" &&
    orderMeta.cp_label_generated_at
      ? orderMeta.cp_label_generated_at
      : null

  const withContext = (body: LabelResponse): LabelResponse => ({
    ...body,
    destination,
    warnings,
    credentials_ready: credentialsReady,
    label_url: labelUrl,
    filename: labelFilename,
    generated_at: labelGeneratedAt,
  })

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
    res.status(200).json(
      withContext({
        available: false,
        reason:
          parcel === "zakazka"
            ? "V objednávce žádná zakázka není — stačí jeden lístek."
            : "V objednávce nejsou skladové položky — stačí jeden lístek.",
        labels: [],
      })
    )
    return
  }

  // The ČP nAPI credentials gate everything real. Named plainly so the
  // button can exist today and start working the day the account does.
  if (!process.env.BALIKOVNA_API_TOKEN || !process.env.BALIKOVNA_API_SECRET) {
    res.status(200).json({
      ...withContext({
        available: false,
        reason:
          "Podací lístek zatím nejde vytvořit — čekáme na přístupy k České poště (B2B účet). Jakmile budou, tlačítko začne fungovat samo.",
        labels: [],
      }),
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
    res.status(200).json(
      withContext({
        available: false,
        reason:
          "Zásilka ještě není připravená. Nejdřív ji připravte k odeslání, štítek bude až potom.",
        labels: [],
      })
    )
    return
  }

  /*
   * nAPI vrací PDF štítku base64 přímo v odpovědi podání a provider ho ukládá
   * do `fulfillment.data.label_pdf_base64` (label_url zůstává prázdné — žádná
   * URL u dopravce neexistuje). Admin z base64 udělá blob a otevře ho; filtr
   * jen podle URL by skutečně podanou zásilku vydával za „bez štítku".
   */
  const pdfBase64 =
    typeof fulfillment?.data?.label_pdf_base64 === "string" &&
    fulfillment.data.label_pdf_base64
      ? (fulfillment.data.label_pdf_base64 as string)
      : null

  const labels = (fulfillment.labels || [])
    .filter((label: any) => label?.url || pdfBase64)
    .map((label: any, index: number) => ({
      url: label.url || "",
      tracking_number: label.tracking_number ?? null,
      // PDF nese jen první štítek — podání je jedno volání s jedním PDF.
      pdf_base64: index === 0 ? pdfBase64 : null,
    }))

  if (!labels.length) {
    const recordOnly = fulfillment?.data?.mode === "manual"

    res.status(200).json(
      withContext({
        available: false,
        reason: recordOnly
          ? "Zásilka zatím není podaná u České pošty, takže štítek neexistuje. Podejte ji v portálu České pošty — jakmile bude e-shop napojený, štítek se stáhne odsud."
          : "Dopravce zatím štítek nevrátil. Zkuste to prosím za chvíli.",
        labels: [],
      })
    )
    return
  }

  res.status(200).json(withContext({ available: true, labels }))
}

/**
 * Název souboru štítku: dohledatelný podle zákazníka a čísla objednávky.
 * `Stitek-Jmeno-Prijmeni-0026.pdf` — bez diakritiky a mezer, ať projde všude.
 */
const labelFilenameFor = (order: any): string => {
  const name = [
    order?.shipping_address?.first_name ?? order?.customer?.first_name,
    order?.shipping_address?.last_name ?? order?.customer?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
  const slug = fold(name || "zakaznik")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  const id = order?.display_id ?? String(order?.id ?? "").slice(-6)
  return `Stitek-${slug || "zakaznik"}-${id}.pdf`
}

/**
 * „Vygenerovat štítek" — podá zásilku České poště (vznikne štítek + číslo
 * zásilky) BEZ odeslání, uloží PDF do úložiště a vrátí trvalý odkaz. Objednávka
 * zůstane „K odeslání"; zákazníkovi nic nechodí (to až na „Zásilku jsem předala
 * dopravci"). Viz `generateCpLabelWorkflow`.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  if (!cpCredentialsReady()) {
    res.status(200).json({
      available: false,
      labels: [],
      credentials_ready: false,
      reason:
        "Štítek zatím nejde vytvořit — chybí kompletní přístupy k České poště. " +
        "Potřeba je BALIKOVNA_API_URL, TOKEN, SECRET, CUSTOMER_ID, POST_CODE a " +
        "LOCATION_NUMBER (to se tahá z ČP endpointu podle CONTRACT_NUMBER). " +
        "Jakmile budou nastavené, tlačítko začne fungovat.",
    } as LabelResponse)
    return
  }

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "metadata",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "customer.first_name",
      "customer.last_name",
      "shipping_methods.name",
      "shipping_methods.data",
      "shipping_methods.shipping_option.provider_id",
      "fulfillments.id",
      "fulfillments.canceled_at",
      "fulfillments.shipped_at",
      "fulfillments.data",
    ],
    filters: { id: req.params.orderId },
  })
  const order = orders[0] as any
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Objednávka nebyla nalezena.")
  }

  // Osobní odběr se neposílá — není co podávat.
  const isPersonalPickup = (order.shipping_methods ?? []).some((method: any) => {
    const data = method?.data || {}
    return data.personal_pickup === true || data.service_code === "PICKUP"
  })
  if (isPersonalPickup) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Objednávka je na osobní odběr — žádný štítek se nevystavuje."
    )
  }

  // Jen zásilky České pošty (Balíkovna / Do ruky). Jiní dopravci sem nepatří —
  // štítek by se tím stejně nevygeneroval.
  const viaCp = (order.shipping_methods ?? []).some((method: any) => {
    const provider = String(method?.shipping_option?.provider_id ?? "")
    return (
      provider.includes("ceska-posta") ||
      fold(String(method?.name ?? "")).includes("balikovna") ||
      fold(String(method?.name ?? "")).includes("balik") ||
      fold(String(method?.name ?? "")).includes("posta")
    )
  })
  if (!viaCp) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Tahle objednávka nejede Českou poštou — štítek odsud vytvořit nejde."
    )
  }

  // Podání u ČP (vznikne štítek) bez odeslání. Brána i razítko dobírky jsou
  // uvnitř workflow — případné „nezaplaceno" vyhodí srozumitelnou hlášku sem.
  await generateCpLabelWorkflow(req.scope).run({
    input: {
      order_id: req.params.orderId,
      created_by: (req as any).auth_context?.actor_id ?? null,
    },
  })

  // Po podání načteme štítek z fulfillmentu (base64 od ČP).
  const { data: afterOrders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "metadata",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "customer.first_name",
      "customer.last_name",
      "fulfillments.id",
      "fulfillments.canceled_at",
      "fulfillments.shipped_at",
      "fulfillments.data",
    ],
    filters: { id: req.params.orderId },
  })
  const afterOrder = afterOrders[0] as any
  const fulfillment = (afterOrder?.fulfillments || []).find(
    (item: any) => !item?.canceled_at
  )
  const pdfBase64 =
    typeof fulfillment?.data?.label_pdf_base64 === "string" &&
    fulfillment.data.label_pdf_base64
      ? (fulfillment.data.label_pdf_base64 as string)
      : null
  const trackingNumber =
    typeof fulfillment?.data?.parcel_code === "string"
      ? (fulfillment.data.parcel_code as string)
      : null

  if (!pdfBase64) {
    const recordOnly = fulfillment?.data?.mode === "manual"
    // Konkrétní důvod od brány (když nějaký je) — např. 247 neplatná adresa
    // v testovacím prostředí, 250 chybí e-mail, 261 velikost. Lepší než obecné
    // „zkontrolujte přístupy".
    const carrierError =
      typeof fulfillment?.data?.carrier_error === "string"
        ? (fulfillment.data.carrier_error as string)
        : null
    res.status(200).json({
      available: false,
      labels: [],
      credentials_ready: cpCredentialsReady(),
      reason: recordOnly
        ? carrierError
          ? `Zásilka se podala jen jako záznam — Česká pošta ji nepřijala: ${carrierError}`
          : "Zásilka se podala jen jako záznam (bez napojení na ČP) — štítek nevznikl. " +
            "Nejspíš chybí přístupy (BALIKOVNA_API_POST_CODE / LOCATION_NUMBER). Zkontrolujte ČP přístupy."
        : "Česká pošta zatím štítek nevrátila. Zkuste to prosím za chvíli.",
    } as LabelResponse)
    return
  }

  // Trvalá kopie do úložiště (MinIO) — ČP nemá reprint API, tak ať štítek
  // nezávisí jen na jednom záznamu. Název podle zákazníka a čísla objednávky.
  const filename = labelFilenameFor(afterOrder)
  let labelUrl: string | null = null
  try {
    const fileModule = req.scope.resolve(Modules.FILE)
    const [uploaded] = await fileModule.createFiles([
      {
        filename,
        mimeType: "application/pdf",
        content: pdfBase64,
        access: "public" as const,
      },
    ])
    labelUrl = uploaded?.url ?? null
  } catch {
    // Úložiště je doplněk — i bez něj se štítek stáhne z base64 níž.
  }

  const generatedAt = new Date().toISOString()
  try {
    const orderModule = req.scope.resolve(Modules.ORDER) as any
    await orderModule.updateOrders([
      {
        id: afterOrder.id,
        metadata: {
          ...((afterOrder.metadata ?? {}) as Record<string, unknown>),
          cp_label_url: labelUrl,
          cp_label_filename: filename,
          cp_label_tracking: trackingNumber,
          cp_label_generated_at: generatedAt,
        },
      },
    ])
  } catch {
    // Razítko je jen pro rychlé zobrazení v GET — štítek vracíme tak jako tak.
  }

  // Štítek i majitelce do schránky (adresa z Nastavení → E-maily, jinak env),
  // ať ho má po ruce i mimo administraci. Odkaz na PDF + podací číslo; chyba
  // e-mailu nesmí shodit vrácení štítku. Klíč na den, ať reprint nezahltí.
  try {
    await notifyMerchant(req.scope, {
      key: `mn:cp-label:${afterOrder.id}:${generatedAt.slice(0, 10)}`,
      title: `Štítek České pošty je připravený — objednávka #${
        afterOrder.display_id ?? ""
      }`,
      description: [
        filename,
        trackingNumber ? `podací číslo ${trackingNumber}` : null,
        labelUrl ? `stáhnout: ${labelUrl}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      audience: "owner",
      email: true,
      resource: { id: afterOrder.id, type: "order" },
    }).catch(() => undefined)
  } catch {
    // Upozornění je doplněk — štítek vracíme tak jako tak.
  }

  res.status(200).json({
    available: true,
    credentials_ready: true,
    label_url: labelUrl,
    filename,
    generated_at: generatedAt,
    labels: [
      {
        url: labelUrl ?? "",
        tracking_number: trackingNumber,
        pdf_base64: pdfBase64,
      },
    ],
  } as LabelResponse)
}
