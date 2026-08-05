import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateReviewsStep } from "./steps/update-review"

export type UpdateReviewInput = {
  id: string
  status: "čeká na schválení" | "schváleno" | "zamítnuto" | "archivováno"
}[]

export const updateReviewWorkflow = createWorkflow(
  "update-review",
  (input: UpdateReviewInput) => {
    const reviews = updateReviewsStep(input)

    return new WorkflowResponse({
      reviews
    }) as unknown as WorkflowResponse<{ reviews: unknown }>
  }
)

