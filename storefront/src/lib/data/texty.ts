"use server"

import { TEXTY_DEFAULTS, type ShopTexty } from "@lib/constants/texty"

/**
 * Texty obchodu z backendu (`GET /store/texty`, veřejné).
 *
 * Zdrojem pravdy je administrace → Právní věci a texty → Texty obchodu.
 * Backend vrací vždycky celou sadu — co se nikdy neměnilo, přijde ve výchozím
 * znění —, takže se tady nic nedoplňuje; `TEXTY_DEFAULTS` jsou jen záloha pro
 * selhaný dotaz, aby stránka výrobku nikdy nezůstala bez vět.
 *
 * Minuta cache jako pojistka; po uložení v administraci backend rovnou
 * požádá o obnovu (štítek `shop-texty` + celý web), takže je změna vidět hned.
 */
export async function getTexty(): Promise<ShopTexty> {
  const base =
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  if (!base) return { ...TEXTY_DEFAULTS }

  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    const response = await fetch(`${base.replace(/\/+$/, "")}/store/texty`, {
      headers: pk
        ? { "x-publishable-api-key": pk, "x-publishable-key": pk }
        : {},
      next: { revalidate: 60, tags: ["shop-texty"] },
    })
    if (!response.ok) {
      /* Nahlas: tichá záloha vypadá přesně jako „majitelka nic neměnila". */
      console.error(`[texty] Backend odmítl dotaz: HTTP ${response.status}.`)
      return { ...TEXTY_DEFAULTS }
    }
    const data = (await response.json()) as { texty?: Partial<ShopTexty> }
    return { ...TEXTY_DEFAULTS, ...(data?.texty ?? {}) }
  } catch {
    return { ...TEXTY_DEFAULTS }
  }
}
