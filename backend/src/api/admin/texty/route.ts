import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getMerchantSettings,
  setMerchantSettings,
  type MerchantSettings,
} from "../../../lib/merchant-settings"
import {
  pickStoredShopTextsOff,
  resolveShopTexts,
  type StoredShopTexts,
  type StoredShopTextsOff,
} from "../../../lib/shop-texty"

/**
 * Texty obchodu pro administraci (stránka „Právní věci a texty" → Texty).
 *
 * Vrací, co formulář potřebuje: znění (`texty` — i u vypnutých vět, aby se
 * daly zapnout zpátky beze ztráty), které jsou vypnuté (`vypnute`), které
 * mají vlastní znění (`ulozene`) a adresu obchodu pro odkazy „Podívat se".
 *
 * Zápis je částečný: posílají se jen změněná pole. Ověřuje ho
 * `setMerchantSettings` proti jedinému katalogu v `lib/shop-texty.ts`, takže
 * tahle routa nemůže rozšířit, co se dá uložit.
 */
const storefrontUrl = (): string =>
  (
    process.env.STOREFRONT_PUBLIC_URL ||
    process.env.MEDUSA_STOREFRONT_URL ||
    ""
  ).replace(/\/+$/, "")

const odpoved = (settings: MerchantSettings) => ({
  texty: resolveShopTexts(settings.shop_texts),
  ulozene: (settings.shop_texts ?? {}) as StoredShopTexts,
  vypnute: pickStoredShopTextsOff(settings.shop_texts_off) as StoredShopTextsOff,
  updated_at: settings.shop_texts_updated_at || null,
  storefront_url: storefrontUrl(),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).json(odpoved(await getMerchantSettings(req.scope)))
}

export const POST = async (
  req: MedusaRequest<Record<string, unknown>>,
  res: MedusaResponse
) => {
  const texty = req.body?.texty as Record<string, unknown> | undefined
  const vypnute = req.body?.vypnute as Record<string, unknown> | undefined

  const settings = await setMerchantSettings(req.scope, {
    ...(texty ? { shop_texts: texty as never } : {}),
    ...(vypnute ? { shop_texts_off: vypnute as never } : {}),
  })

  res.status(200).json(odpoved(settings))
}
