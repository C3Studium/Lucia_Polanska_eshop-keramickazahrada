import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getMerchantSettings,
  setMerchantSettings,
} from "../../../lib/merchant-settings"
import { resolveShopTexts, type StoredShopTexts } from "../../../lib/shop-texty"

/**
 * Texty obchodu pro administraci (stránka „Právní věci a texty" → Texty).
 *
 * Vrací trojici, kterou formulář potřebuje: co teď platí (`texty`), co je
 * uložené (`ulozene` — podle toho se pozná, které pole majitelka měnila)
 * a adresu obchodu pro odkazy „Podívat se".
 *
 * Zápis je částečný: posílají se jen změněná pole. Ověřuje ho
 * `setMerchantSettings` proti jedinému katalogu v `lib/shop-texty.ts`, takže
 * tahle routa nemůže rozšířit, co se dá uložit, ani kdyby jí přišlo cokoli.
 */
const storefrontUrl = (): string =>
  (
    process.env.STOREFRONT_PUBLIC_URL ||
    process.env.MEDUSA_STOREFRONT_URL ||
    ""
  ).replace(/\/+$/, "")

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const settings = await getMerchantSettings(req.scope)

  res.status(200).json({
    texty: resolveShopTexts(settings.shop_texts),
    ulozene: (settings.shop_texts ?? {}) as StoredShopTexts,
    updated_at: settings.shop_texts_updated_at || null,
    storefront_url: storefrontUrl(),
  })
}

export const POST = async (
  req: MedusaRequest<Record<string, unknown>>,
  res: MedusaResponse
) => {
  const texty = (req.body?.texty ?? {}) as Record<string, unknown>
  const settings = await setMerchantSettings(req.scope, {
    shop_texts: texty as never,
  })

  res.status(200).json({
    texty: resolveShopTexts(settings.shop_texts),
    ulozene: (settings.shop_texts ?? {}) as StoredShopTexts,
    updated_at: settings.shop_texts_updated_at || null,
    storefront_url: storefrontUrl(),
  })
}
