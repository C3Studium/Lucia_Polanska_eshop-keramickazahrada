import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import {
  createSeasonalSelectionStep,
  deleteSeasonalSelectionStep,
  SeasonalSelectionData,
  updateSeasonalSelectionStep,
} from "./steps/manage-seasonal-selection"

export const createSeasonalSelectionWorkflow = createWorkflow(
  "create-seasonal-selection",
  (input: SeasonalSelectionData) => {
    const key = transform({ input }, ({ input }) => `seasonal-selection:create:${input.handle}`)
    acquireLockStep({ key, timeout: 5, ttl: 30 })
    const selection = createSeasonalSelectionStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(selection)
  }
)

export const updateSeasonalSelectionWorkflow = createWorkflow(
  "update-seasonal-selection",
  (input: Partial<SeasonalSelectionData> & { id: string }) => {
    const key = transform({ input }, ({ input }) => `seasonal-selection:${input.id}`)
    acquireLockStep({ key, timeout: 5, ttl: 30 })
    useQueryGraphStep({
      entity: "seasonal_selection",
      fields: ["id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-seasonal-selection" })
    updateSeasonalSelectionStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse({ id: input.id })
  }
)

export const deleteSeasonalSelectionWorkflow = createWorkflow(
  "delete-seasonal-selection",
  ({ id }: { id: string }) => {
    const key = transform({ id }, ({ id }) => `seasonal-selection:${id}`)
    acquireLockStep({ key, timeout: 5, ttl: 30 })
    deleteSeasonalSelectionStep({ id })
    releaseLockStep({ key })
    return new WorkflowResponse({ id, deleted: true })
  }
)
