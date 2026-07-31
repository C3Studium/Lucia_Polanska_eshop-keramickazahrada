import {
  createStep,
  StepResponse,
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { COMGATE_MERCHANT, COMGATE_SECRET } from "../lib/constants";
import {
  COMGATE_API_URL,
  createComgateAuthorization,
} from "../modules/comgate/utils";

const getUrlStep = createStep("get-payment-url", async () => {
  try {
    const payload = {
      test: 1,
      price: 1000,
      curr: "CZK",
      label: "Product 123",
      refId: "order445566",
      method: "ALL",
      email: "platce@email.com",
      fullName: "Jan Novák",
      delivery: "HOME_DELIVERY",
      category: "PHYSICAL_GOODS_ONLY",
    };

    const headers = {
      Authorization: createComgateAuthorization(
        COMGATE_MERCHANT,
        COMGATE_SECRET
      ),
      "Content-Type": "application/json",
    };

    const response = await fetch(`${COMGATE_API_URL}/payment.json`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    console.log("Comgate API raw response:", text);
    if (!response.ok) {
      throw new Error(`Chyba Comgate API: ${response.status} - ${text}`);
    }

    const data = JSON.parse(text);
    console.log("Comgate API response:", data);
    return new StepResponse(data);
  } catch (error) {
    console.error("Comgate API error:", error);
    throw error;
  }
});

const GetPaymentUrlWorkflow = createWorkflow("get-payment-url-workflow", () => {
  const result = getUrlStep();
  // Výsledná data jsou v result.value
  console.log("Výsledek kroku getUrlStep:", result.value);
  return new WorkflowResponse({
    url: result.value?.redirect || null,
    data: result.value, // zde budou všechna data z Comgate
  });
});

export default GetPaymentUrlWorkflow;
