import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { sendCustomerEmail } from "../../../lib/customer-email"
import {
  newsletterUnsubscribeUrl,
  normalizeEmail,
} from "../../../lib/newsletter-link"
import { NEWSLETTER_MODULE } from "../../../modules/newsletter"
import type NewsletterModuleService from "../../../modules/newsletter/service"
import { PostStoreNewsletterSchema } from "./validators"

type PostStoreNewsletter = z.infer<typeof PostStoreNewsletterSchema>

/**
 * The footer form: „Zůstaňte blízko ateliéru."
 *
 * Upsert by address. A brand-new address gets a row; an address that
 * unsubscribed earlier gets its `unsubscribed_at` cleared. Both get the
 * welcome e-mail. An address that is already subscribed gets nothing — and
 * the response is `{ ok: true }` in every case, so the endpoint cannot be
 * used to probe which addresses are on the list.
 *
 * The welcome e-mail is keyed per address *per day* (`nl-signup:{email}:{date}`),
 * so a double-click or an impatient resubmit cannot double the inbox, while a
 * genuine re-subscribe months later is still greeted.
 */
export async function POST(req: MedusaRequest<PostStoreNewsletter>, res: MedusaResponse) {
  const body = (req.validatedBody || req.body) as PostStoreNewsletter
  const rawEmail = typeof body?.email === "string" ? body.email : ""
  const email = normalizeEmail(rawEmail)

  // Belt and braces beside the middleware validator: this route must never
  // store an unusable address.
  if (!z.string().email().safeParse(email).success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A valid e-mail address is required."
    )
  }

  const newsletter = req.scope.resolve<NewsletterModuleService>(
    NEWSLETTER_MODULE
  )

  const [existing] = await newsletter.listNewsletterSubscribers(
    { email } as never
  )

  let shouldWelcome = false

  if (!existing) {
    await newsletter.createNewsletterSubscribers({
      email,
      source: "storefront",
      subscribed_at: new Date(),
      unsubscribed_at: null,
    } as never)
    shouldWelcome = true
  } else if (existing.unsubscribed_at) {
    await newsletter.updateNewsletterSubscribers({
      id: existing.id,
      subscribed_at: new Date(),
      unsubscribed_at: null,
    } as never)
    shouldWelcome = true
  }

  if (shouldWelcome) {
    const unsubscribeLink = newsletterUnsubscribeUrl(email)
    if (!unsubscribeLink) {
      // Without BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL the template falls back
      // to its own placeholder link — say so where somebody will read it.
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          "[newsletter] BACKEND_PUBLIC_URL/MEDUSA_BACKEND_URL není nastaveno — uvítací e-mail odejde bez funkčního odhlašovacího odkazu."
        )
    }
    const day = new Date().toISOString().slice(0, 10)

    await sendCustomerEmail(req.scope, {
      template: "newsletter-signup",
      to: email,
      key: `nl-signup:${email}:${day}`,
      data: {
        // The template's only other prop is `customerName`; a footer form
        // knows no name, and the template's own greeting covers that.
        ...(unsubscribeLink ? { unsubscribeLink } : {}),
      },
    })
  }

  res.json({ ok: true })
}
