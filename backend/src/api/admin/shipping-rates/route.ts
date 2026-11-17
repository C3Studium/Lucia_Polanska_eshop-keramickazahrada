import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  currentRatesTable,
  ensureShippingSetup,
  listCpOptions,
  writeRates,
} from "../../../lib/shipping-setup"

/**
 * Ceny dopravy podle druhu (Nastavení obchodu › Doprava a platba, 17. 11. 2026).
 *
 * Česká pošta a Balíkovna na adresu: malá / velká zásilka + příplatek za
 * křehké. Balíkovna BOX a dopis s poukazy: jedna cena. Ukládá se do dat
 * voleb dopravy (\`data.rates\`), odkud ji čte výpočet ceny v poskytovateli.
 *
 * Uložení nejdřív dorovná samotné volby (lib/shipping-setup): založí
 * chybějící, odebere starou „Křehké" a přepne je na vypočtenou cenu.
 */

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const options = await listCpOptions(req.scope)
  res.status(200).json({
    rates: currentRatesTable(options),
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      kind: option.data?.id ?? null,
      price_type: option.price_type,
    })),
    // Hotovo = všechny čtyři druhy existují a počítají cenu.
    setup_done:
      ["cp-address", "balikovna-address", "balikovna", "cp-letter"].every((id) =>
        options.some((option) => option.data?.id === id && option.price_type === "calculated")
      ) && !options.some((option) => option.data?.id === "cp-fragile"),
  })
}

const price = z.number().int().min(0).max(5000)
const bodySchema = z.object({
  posta: z.object({ small: price, large: price, fragile: price }),
  balikovna_adresa: z.object({ small: price, large: price, fragile: price }),
  balikovna_box: z.object({ price }),
  dopis: z.object({ price }),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Ceny dopravy musí být celá čísla od 0 do 5000 Kč."
    )
  }
  const setup = await ensureShippingSetup(req.scope)
  const updated = await writeRates(req.scope, parsed.data)
  res.status(200).json({ ok: true, updated, setup })
}
