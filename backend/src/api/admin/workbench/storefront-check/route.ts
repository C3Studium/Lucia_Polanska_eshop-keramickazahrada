import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMerchantSettings } from "../../../../lib/merchant-settings"
import { storefrontBase } from "../../../../lib/storefront-url"

/**
 * Vitrína — walks the customer's path from the backend and reports what
 * blocks a purchase (Matěj, 2026-08-06: „can a customer actually buy?").
 *
 * The admin's blind spot is the outside of the shop: she can publish, price
 * and stock all day and never learn that checkout is impassable. Each check
 * here is one leg of the real path — see it, ship it, pay it — plus the one
 * fact only an env var knew until now: **ComGate test mode**, under which
 * every „payment" succeeds and no money moves.
 *
 * Problems come back as Czech sentences with a place to click, because a
 * warning she cannot act on is just weather.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const problems: { text: string; path: string | null; severity: "warn" | "bad" }[] = []

  // ── 1. Unbuyable published products: no CZK price or no variants ──
  try {
    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "status",
        "variants.id",
        "variants.prices.amount",
        "variants.prices.currency_code",
      ],
      filters: { status: "published" } as never,
      pagination: { take: 500, skip: 0 },
    })
    let unbuyable = 0
    for (const product of products as any[]) {
      const variants = product.variants ?? []
      const priced = variants.some((variant: any) =>
        (variant.prices ?? []).some(
          (price: any) => String(price.currency_code).toLowerCase() === "czk"
        )
      )
      if (!variants.length || !priced) unbuyable += 1
    }
    if (unbuyable > 0) {
      problems.push({
        text: `${unbuyable} zveřejněných produktů nejde koupit (chybí cena v Kč nebo varianty).`,
        path: "/produkty-workbench",
        severity: "bad",
      })
    }
  } catch {
    problems.push({
      text: "Kontrolu produktů se nepodařilo provést.",
      path: null,
      severity: "warn",
    })
  }

  // ── 2. Shipping options exist; pickup has one ──
  try {
    const { data: options } = await query.graph({
      entity: "shipping_option",
      fields: ["id", "name", "provider_id"],
      pagination: { take: 100, skip: 0 },
    })
    if (!(options as any[]).length) {
      problems.push({
        text: "Neexistuje žádná možnost dopravy — objednávku nejde dokončit.",
        path: null,
        severity: "bad",
      })
    } else if (
      !(options as any[]).some((option: any) =>
        String(option.provider_id ?? "").includes("pickup")
      )
    ) {
      problems.push({
        text: "Osobní odběr zatím nemá možnost dopravy (zákazník ho v pokladně neuvidí).",
        path: null,
        severity: "warn",
      })
    }
  } catch {
    problems.push({
      text: "Kontrolu dopravy se nepodařilo provést.",
      path: null,
      severity: "warn",
    })
  }

  // ── 3. The env-var fact: ComGate test mode ──
  const comgateTest = String(process.env.COMGATE_TEST ?? "").toLowerCase()
  if (comgateTest === "true" || comgateTest === "1") {
    problems.push({
      text: "Platby ComGate běží ve ZKUŠEBNÍM režimu — objednávky projdou, ale žádné skutečné peníze nepřijdou.",
      path: null,
      severity: "bad",
    })
  }

  // ── 4. Is the storefront breathing? One ping, 4s budget. ──
  const base = storefrontBase()
  if (base) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const response = await fetch(base, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      })
      clearTimeout(timer)
      if (!response.ok && response.status !== 405) {
        problems.push({
          text: `Obchod na ${base} odpovídá chybou ${response.status}.`,
          path: null,
          severity: "bad",
        })
      }
    } catch {
      problems.push({
        text: "Obchod se nepodařilo načíst — zákazníci ho možná nevidí.",
        path: null,
        severity: "bad",
      })
    }
  }

  const settings = await getMerchantSettings(req.scope).catch(() => null)

  res.status(200).json({
    open: problems.filter((p) => p.severity === "bad").length === 0,
    vacation: Boolean(settings?.vacation_enabled),
    vacation_until: settings?.vacation_until || null,
    problems,
    checked_at: new Date().toISOString(),
  })
}
