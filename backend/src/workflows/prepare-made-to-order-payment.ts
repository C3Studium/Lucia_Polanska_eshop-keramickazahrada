import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createPaymentCollectionForCartWorkflow,
  releaseLockStep,
  updatePaymentCollectionStep,
} from "@medusajs/medusa/core-flows"
import { splitChargeNow } from "../lib/deposit-split"
import { getMerchantSettings } from "../lib/merchant-settings"
import {
  MADE_TO_ORDER_MODULE,
} from "../modules/made-to-order"
import MadeToOrderModuleService from "../modules/made-to-order/service"

type PrepareMadeToOrderPaymentInput = {
  cart_id: string
}

type ProductionLineSnapshot = {
  line_item_id: string
  product_id: string
  variant_id: string
  line_total: number
  deposit_percentage: number
  deposit_amount: number
  production_time_min_days: number
  production_time_max_days: number
  specification: string | null
}

type PaymentCalculation = {
  is_made_to_order: boolean
  original_total: number
  payment_amount: number
  currency_code: string
  production_lines: ProductionLineSnapshot[]
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>
    return Number(candidate.value ?? candidate.numeric_ ?? candidate.raw ?? 0)
  }
  return Number(value ?? 0)
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const readSpecification = (metadata: Record<string, unknown> | null | undefined) => {
  const madeToOrder = metadata?.made_to_order
  if (!madeToOrder || typeof madeToOrder !== "object") return null
  const specification = (madeToOrder as Record<string, unknown>).specification
  return typeof specification === "string" && specification.trim()
    ? specification.trim()
    : null
}

const calculateMadeToOrderPaymentStep = createStep(
  "calculate-made-to-order-cart-payment",
  async ({ cart_id }: PrepareMadeToOrderPaymentInput, { container }) => {
    const query = container.resolve("query")
    const service = container.resolve<MadeToOrderModuleService>(
      MADE_TO_ORDER_MODULE
    )

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "total",
        // Poštovné — u zakázky je MIMO zálohu, doplatí se až před odesláním.
        "shipping_total",
        "currency_code",
        "metadata",
        "items.id",
        "items.product_id",
        "items.variant_id",
        "items.quantity",
        "items.unit_price",
        "items.total",
        // Nezlevněný řádek (před akčními úpravami) — záloha se počítá z NĚJ,
        // aby sleva padla celá na doplatek, ne na zálohu (přání majitelky).
        "items.subtotal",
        "items.metadata",
      ],
      filters: { id: cart_id },
    })
    const cart = carts[0]

    if (!cart) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Košík nebyl nalezen.")
    }

    const items = Array.isArray(cart.items) ? cart.items : []

    // The customer's choice at checkout. Per cart rather than per product: a
    // cart can mix a commission with ordinary stock, and „pay everything now"
    // is one decision about the whole basket. „custom" carries the slider
    // position — the charge-now total the customer picked — which is
    // re-validated below against today's cart, not trusted.
    const cartMetadata = cart.metadata as Record<string, unknown> | null
    const paymentMode = cartMetadata?.production_payment_mode
    const payFullRequested = paymentMode === "full"
    const customRequested =
      paymentMode === "custom" &&
      toNumber(cartMetadata?.production_payment_amount) > 0
    const productIds = [...new Set(items.map((item: any) => item.product_id).filter(Boolean))]
    const variantIds = [...new Set(items.map((item: any) => item.variant_id).filter(Boolean))]
    const [productProfiles, variantProfiles] = await Promise.all([
      productIds.length
        ? service.listProductProductionProfiles({ product_id: productIds })
        : [],
      variantIds.length
        ? service.listVariantProductionProfiles({ variant_id: variantIds })
        : [],
    ])

    const profilesByProduct = new Map<string, any>(
      productProfiles.map(
        (profile: any): [string, any] => [profile.product_id, profile]
      )
    )
    const profilesByVariant = new Map<string, any>(
      variantProfiles.map(
        (profile: any): [string, any] => [profile.variant_id, profile]
      )
    )

    const productionLines: ProductionLineSnapshot[] = []
    // Strop „zaplatit teď" pro každý řádek (souběžně s productionLines). Plná
    // platba není jiné procento zálohy — je to posun na strop; poštovné pak
    // padá na doplatek. Řádek, který plnou platbu předem zakazuje, má strop =
    // podlaha. Vše po proudu (outstanding produkční objednávky, ship gate, bar
    // Zakázky) čte `agreed_total − paid`, takže plná platba dosedne jako
    // „zaplaceno" bez větve kdekoli jinde.
    const ceilings: number[] = []
    let productionLinesTotal = 0

    for (const item of items) {
      const profile: any = profilesByProduct.get(item.product_id)
      if (!profile?.enabled) continue

      const override: any = profilesByVariant.get(item.variant_id)

      const depositPercentage = Math.min(
        100,
        Math.max(
          1,
          toNumber(
            override?.deposit_percentage_override ??
              profile.default_deposit_percentage ??
              25
          )
        )
      )
      const lineTotal = toNumber(
        item.total ?? toNumber(item.unit_price) * toNumber(item.quantity)
      )
      // Základ pro zálohu je NEZLEVNĚNÁ cena řádku; sleva tak zůstane celá
      // v doplatku. Fallback na zlevněný řádek, kdyby subtotal chyběl.
      const lineBase = toNumber(
        item.subtotal ?? item.total ?? toNumber(item.unit_price) * toNumber(item.quantity)
      )
      const specification = readSpecification(item.metadata)

      if (profile.specification_required && !specification) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Doplňte prosím krátký popis požadovaného provedení."
        )
      }

      // Záloha z původní ceny, ale nikdy víc, než kolik řádek po slevě stojí.
      const depositAmount = roundMoney(
        Math.min((lineBase * depositPercentage) / 100, lineTotal)
      )
      productionLinesTotal += lineTotal
      ceilings.push(
        profile.allow_full_prepayment === false ? depositAmount : lineTotal
      )
      productionLines.push({
        line_item_id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        line_total: lineTotal,
        deposit_percentage: depositPercentage,
        deposit_amount: depositAmount,
        production_time_min_days: toNumber(
          override?.production_time_min_days_override ??
            profile.production_time_min_days
        ),
        production_time_max_days: toNumber(
          override?.production_time_max_days_override ??
            profile.production_time_max_days
        ),
        specification,
      })
    }

    // Dovolená: while the shop is closed, NEW commissions are refused here —
    // at the money step, server-side — with the return date in the message.
    // Stock items still sell; only work she cannot start is paused.
    if (productionLines.length) {
      const settings = await getMerchantSettings(container).catch(() => null)
      if (settings?.vacation_enabled) {
        const until = settings.vacation_until
          ? ` Zakázky přijímáme znovu po ${settings.vacation_until
              .split("-")
              .reverse()
              .join(". ")}.`
          : ""
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Výroba na zakázku má právě přestávku.${until}`
        )
      }
    }

    const originalTotal = toNumber(cart.total)
    // Poštovné je mimo zálohu: záloha je jen za zboží, poštovné padá do
    // doplatku (outstanding = agreed_total − paid to sedne samo, agreed_total
    // zůstává celý košík). U osobního odběru je nula.
    const shippingNow = roundMoney(Math.max(0, toNumber((cart as any).shipping_total)))
    let paymentAmount = originalTotal

    if (productionLines.length) {
      // Zboží mimo zakázku se platí vždy celé a hned, ale BEZ poštovného.
      const goodsNonProductionNow = roundMoney(
        originalTotal - productionLinesTotal - shippingNow
      )
      const splitLines = productionLines.map((line, index) => ({
        floor: line.deposit_amount,
        ceiling: ceilings[index],
      }))
      const floorSum = splitLines.reduce((sum, line) => sum + line.floor, 0)
      const ceilingSum = splitLines.reduce((sum, line) => sum + line.ceiling, 0)
      // „Jen zálohu" bez poštovného … „zaplatit vše" vč. poštovného.
      const minimum = roundMoney(goodsNonProductionNow + floorSum)
      const maximum = roundMoney(goodsNonProductionNow + ceilingSum + shippingNow)

      // Kolik zaplatit teď: celé (posuv na strop + poštovné), posuvník (uložená
      // částka — sevře se do [minimum, maximum]), nebo jen záloha. Rozpad je
      // stejná funkce, jakou kreslí checkout, takže se zobrazené a účtované
      // číslo nemůžou rozejít. Sevření, ne odmítnutí: košík se mohl od volby
      // změnit a shodit celou platbu kvůli zastaralému posuvníku nikomu nepomůže
      // — podlaha drží, a to je pravidlo, na kterém záleží.
      const target = payFullRequested
        ? maximum
        : customRequested
          ? toNumber(cartMetadata?.production_payment_amount)
          : minimum

      const breakdown = splitChargeNow(
        splitLines,
        shippingNow,
        goodsNonProductionNow,
        target
      )
      paymentAmount = breakdown.chargeNow
      breakdown.productionAmounts.forEach((amount, index) => {
        const line = productionLines[index]
        line.deposit_amount = amount
        line.deposit_percentage = line.line_total
          ? roundMoney((amount / line.line_total) * 100)
          : line.deposit_percentage
      })
    }

    if (paymentAmount < 0 || !Number.isFinite(paymentAmount)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Zálohu pro tento košík se nepodařilo vypočítat."
      )
    }

    return new StepResponse<PaymentCalculation>({
      is_made_to_order: productionLines.length > 0,
      original_total: originalTotal,
      payment_amount: paymentAmount,
      currency_code: String(cart.currency_code || "czk").toLowerCase(),
      production_lines: productionLines,
    })
  }
)

export const prepareMadeToOrderPaymentWorkflow = createWorkflow(
  "prepare-made-to-order-payment",
  (input: PrepareMadeToOrderPaymentInput) => {
    const lockKey = transform(input, ({ cart_id }) => `mto-payment:${cart_id}`)
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 60 })

    const calculation = calculateMadeToOrderPaymentStep(input)
    const paymentCollection = createPaymentCollectionForCartWorkflow.runAsStep({
      input: { cart_id: input.cart_id },
    })

    const updateInput = transform(
      { calculation, paymentCollection },
      ({ calculation, paymentCollection }) => ({
        selector: { id: paymentCollection.id },
        update: {
          amount: calculation.payment_amount,
          metadata: {
            ...(paymentCollection.metadata || {}),
            made_to_order: calculation.is_made_to_order,
            original_cart_total: calculation.original_total,
            checkout_payment_amount: calculation.payment_amount,
            production_lines: calculation.production_lines,
          },
        },
      })
    )
    updatePaymentCollectionStep(updateInput)
    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(
      transform(
        { calculation, paymentCollection },
        ({ calculation, paymentCollection }) => ({
          ...calculation,
          payment_collection_id: paymentCollection.id,
        })
      )
    )
  }
)
