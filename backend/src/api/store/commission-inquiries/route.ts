import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import {
  buildInquiryCustomerEmail,
  buildInquiryOwnerNotification,
  CommissionInquirySchema,
  consumeAll,
  createWindowLimiter,
  firstIssueMessage,
  isHoneypotFilled,
  preparePhotos,
  sellerContactEmail,
} from "../../../lib/commission-inquiry"
import { sendCustomerEmail } from "../../../lib/customer-email"
import { getLegalFacts } from "../../../lib/merchant-settings"
import { notifyMerchant } from "../../../lib/notify"
import { storefrontBase } from "../../../lib/storefront-url"

/**
 * POST /store/commission-inquiries — poptávka zakázky ze stránky Výroba.
 *
 * Veřejná routa (jen publishable key, jako `/store/contact`). Prohlížeč ji
 * volá PŘÍMO, ne přes server obchodu — jen tak tu `req.ip` je skutečná IP
 * člověka (Medusa má `trust proxy = 1`) a omezovač podle IP má smysl.
 *
 * Pořadí je schválně tohle:
 * 1. honeypot na syrovém těle → tiché 200 (robot se nedozví, že neprošel),
 * 2. schéma + fotky (typ, obsah, velikost) → 400 s českou hláškou,
 * 3. omezovač → 429,
 * 4. teprve potom se sahá na úložiště a posílají e-maily.
 * Nic tedy nenahraje do bucketu ani nepošle e-mail, kdo neprošel kroky 1–3.
 *
 * Záznam poptávky = e-mail majitelce (zvonek + e-mail, Reply-To zákazník)
 * a potvrzení zákazníkovi (šablona `commission-inquiry-received`); obojí
 * i s daty (verze OP, serverový čas souhlasu) leží v tabulce notifikací.
 *
 * Tělo s fotkami potřebuje vyšší limit — viz `api/middlewares.ts`
 * (`/store/commission-inquiries`, `bodyParser.sizeLimit`). Bez něj projde
 * jen poptávka bez fotek (výchozí limit Express je 100 kB) a s fotkami
 * vrátí 413, který formulář přeloží na srozumitelnou hlášku.
 */

const MINUTE = 60 * 1000

/*
 * Tři vrstvy, každá na jiný útok:
 * - podle e-mailu: zaplavení jedné schránky potvrzeními,
 * - podle IP: skript ze stroje, který mění adresy,
 * - celkem za obchod: Resend má strop 100 e-mailů denně a jedna poptávka
 *   stojí dva. Bez celkového stropu by rozprostřený spam dokázal vyčerpat
 *   kvótu a po zbytek dne by neodcházela potvrzení objednávek. Stropy jsou
 *   vysoko nad tím, kolik poptávek ateliér reálně dostává.
 */
const perEmail = createWindowLimiter({ name: "email", windowMs: 10 * MINUTE, limit: 3 })
const perIp = createWindowLimiter({ name: "ip", windowMs: 10 * MINUTE, limit: 3 })
const perHour = createWindowLimiter({ name: "global", windowMs: 60 * MINUTE, limit: 8, maxKeys: 1 })
const perDay = createWindowLimiter({ name: "global", windowMs: 24 * 60 * MINUTE, limit: 20, maxKeys: 1 })

const TOO_MANY =
  "Poptávek přišlo krátce po sobě příliš mnoho. Zkuste to prosím za chvíli, nebo napište rovnou na e-mail."
const BUSY =
  "Poptávek teď chodí nezvykle mnoho, tak jsem příjem na chvíli přibrzdila. Napište mi prosím rovnou na e-mail."
const SEND_FAILED =
  "Poptávku se nepodařilo odeslat. Zkuste to prosím znovu, nebo napište rovnou na e-mail."

const clientIp = (req: MedusaRequest): string => {
  const ip = (req as unknown as { ip?: string }).ip
  return typeof ip === "string" && ip.trim() ? ip.trim() : "unknown"
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = req.body ?? {}

  if (isHoneypotFilled(body)) {
    res.status(200).json({ ok: true })
    return
  }

  const parsed = CommissionInquirySchema.safeParse(body)
  if (!parsed.success) {
    res.status(400).json({ message: firstIssueMessage(parsed.error) })
    return
  }
  const input = parsed.data

  const photos = preparePhotos(input.photos ?? [])
  if (!photos.ok) {
    res.status(400).json({ message: photos.message })
    return
  }

  const now = Date.now()
  const refused = consumeAll(
    [
      [perEmail, input.email.toLowerCase()],
      [perIp, clientIp(req)],
      [perHour, "*"],
      [perDay, "*"],
    ],
    now
  )
  if (refused) {
    logger.warn(`[poptávka] odmítnuto omezovačem (${refused})`)
    res.status(429).json({ message: refused === "global" ? BUSY : TOO_MANY })
    return
  }

  /*
   * Fotky jsou doplněk: když úložiště nepřijme, poptávka odejde i tak
   * a majitelka v e-mailu uvidí, kolik fotek chybí. Ztratit kvůli výpadku
   * R2 celou poptávku by bylo horší.
   */
  let photoUrls: string[] = []
  let photosFailed = 0
  if (photos.files.length) {
    try {
      const fileModule = req.scope.resolve(Modules.FILE)
      const uploaded = await fileModule.createFiles(photos.files)
      photoUrls = (Array.isArray(uploaded) ? uploaded : [uploaded])
        .map((file: { url?: unknown }) => file?.url)
        .filter((url): url is string => typeof url === "string" && url.length > 0)
      photosFailed = Math.max(0, photos.files.length - photoUrls.length)
    } catch (error: any) {
      photosFailed = photos.files.length
      logger.warn(`[poptávka] fotky se nepodařilo uložit: ${error?.message ?? error}`)
    }
  }

  const context = { receivedAt: new Date(now), photoUrls, photosFailed }
  const owner = buildInquiryOwnerNotification(input, context)

  try {
    const outcome = await notifyMerchant(req.scope, {
      key: owner.key,
      title: owner.title,
      description: owner.description,
      audience: "owner",
      email: true,
      replyTo: owner.replyTo,
    })
    if (outcome.email === "no-recipient") {
      logger.warn("[poptávka] e-mail majitelce neodešel — chybí adresa pro oznámení; zůstal jen zvonek.")
    }
  } catch (error: any) {
    // Bez upozornění majitelce poptávka nikam nedošla — zákazník to musí vědět.
    logger.error(`[poptávka] upozornění majitelce selhalo: ${error?.message ?? error}`)
    res.status(502).json({ message: SEND_FAILED })
    return
  }

  // Potvrzení zákazníkovi je až druhé: poptávka už u majitelky je, takže
  // výpadek tady neznamená chybu pro zákazníka — jen se zaloguje.
  try {
    const { facts } = await getLegalFacts(req.scope)
    const customer = buildInquiryCustomerEmail(input, context, {
      storefrontBase: storefrontBase(),
      replyTo: sellerContactEmail(facts["seller.email"]),
    })
    await sendCustomerEmail(req.scope, customer)
  } catch (error: any) {
    logger.warn(`[poptávka] potvrzení zákazníkovi se nepodařilo založit: ${error?.message ?? error}`)
  }

  res.status(200).json({ ok: true, photos: photoUrls.length })
}
