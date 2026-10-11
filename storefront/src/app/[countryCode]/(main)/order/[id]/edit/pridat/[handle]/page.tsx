import { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getGuestOrderEditCatalog,
  getGuestOrderEditContext,
} from "@lib/data/guest-order-edit"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import OrderPickProduct from "@modules/order/components/order-edit/pick-product"
import {
  editPath,
  pickShopPath,
} from "@modules/order/components/order-edit/shared"
import OrderStateShell from "@modules/order/components/order-state-shell"

type Props = {
  params: Promise<{ id: string; countryCode: string; handle: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = {
  title: "Přidat k objednávce",
  description: "Vyberte provedení a počet kusů.",
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
 * Stránka produktu v režimu výběru (plán §3c bod 2): výběr provedení a počtu
 * jako na běžné stránce produktu, ale jen provedení z `allowed[product_id]`
 * a tlačítko „Přidat k objednávce #N" místo košíku.
 */
export default async function OrderEditPickProductPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const token = searchParams.token
  const [context, catalog] = token
    ? await Promise.all([
        getGuestOrderEditContext(params.id, token),
        getGuestOrderEditCatalog(params.id, token),
      ])
    : [null, null]

  if (!token || !context || !catalog) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker="Přidat k objednávce"
        title="Odkaz nejde otevřít."
        description="Odkaz je neplatný nebo vypršel. Otevřete prosím úpravu objednávky z posledního e-mailu, nebo se nám ozvěte a doplníme to spolu."
        status="pending"
      />
    )
  }

  if (!catalog.can_add || context.pending_change) {
    return (
      <OrderStateShell
        eyebrow="Objednávka · úprava"
        kicker={`Objednávka #${context.order.display_id}`}
        title="Teď přidat nejde."
        description={
          context.pending_change
            ? "K objednávce čeká úprava na zaplacení rozdílu. Dokončete ji, nebo ji na stránce úpravy zrušte — pak můžete přidávat."
            : catalog.reason ??
              context.reason ??
              "K téhle objednávce už nic přidat nejde. Kdybyste něco potřebovali, napište nám na info@keramickazahrada.cz."
        }
        status="pending"
        primary={{ href: editPath(params.id, token), label: "Zpět na úpravu" }}
      />
    )
  }

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
        kicker={`Objednávka #${context.order.display_id}`}
        title="Tenhle kus přidat nejde."
        description="K objednávce jde přidat jen to, co máme k mání a co se s ní dá poslat — zakázky, balíčky a poškozené kusy ne. Vyberte si prosím z nabídky."
        status="pending"
        primary={{
          href: pickShopPath(params.id, token),
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
      orderNumber={context.order.display_id}
      product={product}
      region={region}
      countryCode={params.countryCode}
      allowedVariantIds={allowedVariantIds}
    />
  )
}
