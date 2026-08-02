import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { BUNDLED_PRODUCT_MODULE } from "../../modules/bundled-product"
import BundledProductModuleService from "../../modules/bundled-product/service"
import type { BundleDefinitionItem } from "./validate-bundle-definition"

type ReplaceBundleItemsInput = {
  bundle_id: string
  items: BundleDefinitionItem[]
}

type ItemSnapshot = {
  id: string
  quantity: number
  display_order: number
  variant_mode: "customer_selects" | "fixed_variant"
  product_id: string
  fixed_variant_id: string | null
}

const productLink = (itemId: string, productId: string) => ({
  [BUNDLED_PRODUCT_MODULE]: { bundle_item_id: itemId },
  [Modules.PRODUCT]: { product_id: productId },
})

const variantLink = (itemId: string, variantId: string) => ({
  [BUNDLED_PRODUCT_MODULE]: { bundle_item_id: itemId },
  [Modules.PRODUCT]: { product_variant_id: variantId },
})

async function restoreSnapshot(
  service: BundledProductModuleService,
  remoteLink: any,
  previous: ItemSnapshot[]
) {
  if (!previous.length) {
    return
  }
  await (service as any).restoreBundleItems(previous.map((item) => item.id))
  const links = previous.flatMap((item) => [
    productLink(item.id, item.product_id),
    ...(item.fixed_variant_id ? [variantLink(item.id, item.fixed_variant_id)] : []),
  ])
  if (links.length) {
    await remoteLink.create(links)
  }
}

export const replaceBundleItemsStep = createStep(
  "replace-bundle-items",
  async (input: ReplaceBundleItemsInput, { container }) => {
    const service: BundledProductModuleService = container.resolve(
      BUNDLED_PRODUCT_MODULE
    )
    const remoteLink = container.resolve("remoteLink") as any
    const query = container.resolve("query")
    const { data } = await query.graph({
      entity: "bundle",
      fields: [
        "id",
        "items.*",
        "items.product.id",
        "items.product_variant.id",
      ],
      filters: { id: input.bundle_id },
    })

    const previous: ItemSnapshot[] = (data[0]?.items ?? []).map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      display_order: item.display_order,
      variant_mode: item.variant_mode,
      product_id: item.product?.id,
      fixed_variant_id: item.product_variant?.id ?? null,
    }))
    const previousLinks = previous.flatMap((item) => [
      productLink(item.id, item.product_id),
      ...(item.fixed_variant_id ? [variantLink(item.id, item.fixed_variant_id)] : []),
    ])

    let created: any[] = []
    let createdLinks: any[] = []
    try {
      if (previousLinks.length) {
        await remoteLink.delete(previousLinks)
      }
      if (previous.length) {
        await service.deleteBundleItems(previous.map((item) => item.id))
      }

      created = await service.createBundleItems(
        input.items.map((item, index) => ({
          bundle_id: input.bundle_id,
          quantity: item.quantity,
          display_order: item.display_order ?? index,
          variant_mode: item.variant_mode ?? "customer_selects",
        }))
      )
      createdLinks = created.flatMap((record, index) => {
        const item = input.items[index]
        return [
          productLink(record.id, item.product_id),
          ...(item.variant_mode === "fixed_variant" && item.fixed_variant_id
            ? [variantLink(record.id, item.fixed_variant_id)]
            : []),
        ]
      })
      if (createdLinks.length) {
        await remoteLink.create(createdLinks)
      }
    } catch (error) {
      if (createdLinks.length) {
        await remoteLink.delete(createdLinks).catch(() => undefined)
      }
      if (created.length) {
        await service.deleteBundleItems(created.map((item) => item.id), {
          hardDelete: true,
        } as any).catch(() => undefined)
      }
      await restoreSnapshot(service, remoteLink, previous).catch(() => undefined)
      throw error
    }

    return new StepResponse(created, {
      previous,
      created_ids: created.map((item) => item.id),
      created_links: createdLinks,
    })
  },
  async (state, { container }) => {
    if (!state) {
      return
    }
    const service: BundledProductModuleService = container.resolve(
      BUNDLED_PRODUCT_MODULE
    )
    const remoteLink = container.resolve("remoteLink") as any
    if (state.created_links.length) {
      await remoteLink.delete(state.created_links)
    }
    if (state.created_ids.length) {
      await service.deleteBundleItems(state.created_ids, { hardDelete: true } as any)
    }
    await restoreSnapshot(service, remoteLink, state.previous)
  }
)
