import { Metadata } from "next"
import { notFound } from "next/navigation"

import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { resolvePickAccess } from "@modules/order/components/order-edit/pick-access"
import OrderPickProduct from "@modules/order/components/order-edit/pick-product"
import {
  editPath,
  pickShopPath,
} from "@modules/order/components/order-edit/shared"
import OrderStateShell from "@modules/order/components/order-state-shell"

type Props = {
  params: Promise<{ id: string; countryCode: string; handle: string }>
  searchParams: Promise<{ token?: string; swap?: string }>
}

export const metadata: Metadata = {
  title: "Výběr do objednávky",
  description: "Vyberte provedení.",
  robots: { index: false, follow: false },
}

/** Handle přichází z adresy; kdyby byl ještě zakódovaný, rozbalit — a když
    to nejde (osamělé „%"), nechat, jak je. */
const decodeHandle = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Stránka produktu v režimu výběru (plán §3c bod 2, §3d bod 10): výběr
 * provedení jako na běžné stránce produktu, ale jen provedení z
 * `allowed[product_id]`. Bez `swap` počet kusů a „Přidat k objednávce #N",
 * se `swap=<item_id>` „Vyměnit za tento výrobek" s počtem kusů řádku.
 */
export default async function OrderEditPickProductPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const access = await resolvePickAccess(
    params.id,
    searchParams.token,
    searchParams.swap
  )
  if (!access.ok) return access.view
  const { catalog, swap, token } = access

  const region = await getRegion(params.countryCode)
  if (!region) notFound()

  // Stejná pole jako běžná stránka produktu (ceny, sklad, backorder,
  // metadata variant pro fotky provedení) — jen bez balíčku, ten do úpravy
  // nejde.
  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: {
      handle: decodeHandle(params.handle),
      fields:
        "*variants.calculated_price, +variants.inventory_quantity, +variants.allow_backorder, +variants.metadata, +metadata, +tags",
    },
  })
    .then(({ response }) => response.products[0])
    .catch(() => undefined)

  const allowedVariantIds = product ? catalog.allowed[product.id] ?? [] : []

  if (!product || allowedVariantIds.length === 0) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker={`Objednávka #${access.orderNumber}`}
        title={swap ? "Za tenhle výrobek vyměnit nejde." : "Tenhle kus přidat nejde."}
        description={
          swap
            ? "Výměna jde jen za výrobek, který máme na celý počet kusů — po zabalení navíc jen ve stejné ceně. Zakázky, balíčky a poškozené kusy ne. Vyberte si prosím z nabídky."
            : "K objednávce jde přidat jen to, co máme k mání a co se s ní dá poslat — zakázky, balíčky a poškozené kusy ne. Vyberte si prosím z nabídky."
        }
        status="pending"
        primary={{
          href: pickShopPath(params.id, token, swap?.itemId),
          label: "Zpět do výběru",
        }}
        secondary={{ href: editPath(params.id, token), label: "Zpět na úpravu" }}
      />
    )
  }

  return (
    <OrderPickProduct
      orderId={params.id}
      token={token}
      orderNumber={access.orderNumber}
      swap={swap}
      product={product}
      region={region}
      countryCode={params.countryCode}
      allowedVariantIds={allowedVariantIds}
    />
  )
}
