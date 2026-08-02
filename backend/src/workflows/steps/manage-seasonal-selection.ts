import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { MERCHANT_CATALOG_MODULE } from "../../modules/merchant-catalog"
import MerchantCatalogModuleService from "../../modules/merchant-catalog/service"

export type SeasonalSelectionItemInput = {
  product_id: string
  display_order?: number
}

export type SeasonalSelectionData = {
  title: string
  handle: string
  description?: string | null
  cover_image_url?: string | null
  mobile_image_url?: string | null
  publication_status?: "draft" | "published" | "archived"
  starts_at?: Date | string | null
  ends_at?: Date | string | null
  linked_price_list_id?: string | null
  items?: SeasonalSelectionItemInput[]
}

type UpdateInput = Partial<SeasonalSelectionData> & { id: string }

async function validateReferences(container: any, input: Partial<SeasonalSelectionData>) {
  const startsAt = input.starts_at ? new Date(input.starts_at) : null
  const endsAt = input.ends_at ? new Date(input.ends_at) : null
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Seasonal selection end must be later than its start."
    )
  }
  const query = container.resolve("query")
  if (input.linked_price_list_id) {
    const { data } = await query.graph({
      entity: "price_list",
      fields: ["id"],
      filters: { id: input.linked_price_list_id },
    })
    if (!data.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Price list was not found.")
    }
  }
  if (input.items) {
    const ids = [...new Set(input.items.map((item) => item.product_id))]
    const { data } = ids.length
      ? await query.graph({ entity: "product", fields: ["id"], filters: { id: ids } })
      : { data: [] }
    if (data.length !== ids.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "One or more seasonal-selection products do not exist."
      )
    }
  }
}

export const createSeasonalSelectionStep = createStep(
  "create-seasonal-selection-records",
  async (input: SeasonalSelectionData, { container }) => {
    await validateReferences(container, input)
    const service: MerchantCatalogModuleService = container.resolve(MERCHANT_CATALOG_MODULE)
    let selection: any
    let itemIds: string[] = []
    try {
      selection = await service.createSeasonalSelections({
        title: input.title,
        handle: input.handle,
        description: input.description ?? null,
        cover_image_url: input.cover_image_url ?? null,
        mobile_image_url: input.mobile_image_url ?? null,
        publication_status: input.publication_status ?? "draft",
        starts_at: input.starts_at ? new Date(input.starts_at) : null,
        ends_at: input.ends_at ? new Date(input.ends_at) : null,
        linked_price_list_id: input.linked_price_list_id ?? null,
      })
      if (input.items?.length) {
        const items = await service.createSeasonalSelectionItems(
          input.items.map((item, index) => ({
            selection_id: selection.id,
            product_id: item.product_id,
            display_order: item.display_order ?? index,
          }))
        )
        itemIds = items.map((item) => item.id)
      }
    } catch (error) {
      if (itemIds.length) {
        await service.deleteSeasonalSelectionItems(itemIds, { hardDelete: true } as any)
          .catch(() => undefined)
      }
      if (selection?.id) {
        await service.deleteSeasonalSelections(selection.id, { hardDelete: true } as any)
          .catch(() => undefined)
      }
      throw error
    }
    return new StepResponse(selection, { selection_id: selection.id, item_ids: itemIds })
  },
  async (state, { container }) => {
    if (!state) return
    const service: MerchantCatalogModuleService = container.resolve(MERCHANT_CATALOG_MODULE)
    if (state.item_ids.length) {
      await service.deleteSeasonalSelectionItems(state.item_ids, { hardDelete: true } as any)
    }
    await service.deleteSeasonalSelections(state.selection_id, { hardDelete: true } as any)
  }
)

export const updateSeasonalSelectionStep = createStep(
  "update-seasonal-selection-records",
  async (input: UpdateInput, { container }) => {
    await validateReferences(container, input)
    const service: MerchantCatalogModuleService = container.resolve(MERCHANT_CATALOG_MODULE)
    const previous = await service.retrieveSeasonalSelection(input.id, { relations: ["items"] })
    const oldItems = (previous.items ?? []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      display_order: item.display_order,
    }))
    const selectionFields = Object.fromEntries(
      Object.entries(input)
        .filter(([key, value]) => !["items"].includes(key) && value !== undefined)
        .map(([key, value]) => [
          key,
          ["starts_at", "ends_at"].includes(key) && value ? new Date(value as any) : value,
        ])
    )
    let createdIds: string[] = []
    try {
      await service.updateSeasonalSelections(selectionFields as any)
      if (input.items !== undefined) {
        if (oldItems.length) {
          await service.deleteSeasonalSelectionItems(oldItems.map((item) => item.id))
        }
        if (input.items.length) {
          const created = await service.createSeasonalSelectionItems(
            input.items.map((item, index) => ({
              selection_id: input.id,
              product_id: item.product_id,
              display_order: item.display_order ?? index,
            }))
          )
          createdIds = created.map((item) => item.id)
        }
      }
    } catch (error) {
      if (createdIds.length) {
        await service.deleteSeasonalSelectionItems(createdIds, { hardDelete: true } as any)
          .catch(() => undefined)
      }
      if (input.items !== undefined && oldItems.length) {
        await (service as any).restoreSeasonalSelectionItems(oldItems.map((item) => item.id))
          .catch(() => undefined)
      }
      throw error
    }
    return new StepResponse(void 0, {
      id: input.id,
      previous,
      old_item_ids: oldItems.map((item) => item.id),
      created_ids: createdIds,
      items_replaced: input.items !== undefined,
    })
  },
  async (state, { container }) => {
    if (!state) return
    const service: MerchantCatalogModuleService = container.resolve(MERCHANT_CATALOG_MODULE)
    if (state.created_ids.length) {
      await service.deleteSeasonalSelectionItems(state.created_ids, { hardDelete: true } as any)
    }
    if (state.items_replaced && state.old_item_ids.length) {
      await (service as any).restoreSeasonalSelectionItems(state.old_item_ids)
    }
    const { items: _items, ...previous } = state.previous as any
    await service.updateSeasonalSelections(previous)
  }
)

export const deleteSeasonalSelectionStep = createStep(
  "delete-seasonal-selection-records",
  async ({ id }: { id: string }, { container }) => {
    const service: MerchantCatalogModuleService = container.resolve(MERCHANT_CATALOG_MODULE)
    const selection = await service.retrieveSeasonalSelection(id, { relations: ["items"] })
    const itemIds = (selection.items ?? []).map((item: any) => item.id)
    if (itemIds.length) await service.deleteSeasonalSelectionItems(itemIds)
    await service.deleteSeasonalSelections(id)
    return new StepResponse(void 0, { id, item_ids: itemIds })
  },
  async (state, { container }) => {
    if (!state) return
    const service: MerchantCatalogModuleService = container.resolve(MERCHANT_CATALOG_MODULE) as any
    await service.restoreSeasonalSelections(state.id)
    if (state.item_ids.length) await service.restoreSeasonalSelectionItems(state.item_ids)
  }
)
