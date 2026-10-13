import { Modules } from "@medusajs/framework/utils"
import { paymentStatusFromProvider } from "../payment-provider-status"

const containerWith = (paymentModule: unknown) =>
  ({
    resolve: (key: string) => {
      if (key === Modules.PAYMENT) {
        return paymentModule
      }
      // Kontejner aplikace poskytovatele nezná — přesně to dřív padalo.
      throw new Error(`Could not resolve '${key}'.`)
    },
  }) as any

describe("paymentStatusFromProvider", () => {
  it("asks the payment module's own provider service, not the app container", async () => {
    const getStatus = jest.fn().mockResolvedValue({ status: "captured", data: { x: 1 } })
    const container = containerWith({ paymentProviderService_: { getStatus } })

    const result = await paymentStatusFromProvider(container, {
      provider_id: "pp_comgate_comgate",
      data: { transId: "ABC" },
    })

    expect(result).toEqual({ status: "captured", data: { x: 1 } })
    expect(getStatus).toHaveBeenCalledWith("pp_comgate_comgate", {
      data: { transId: "ABC" },
    })
  })

  it("accepts a provider id stored without the pp_ prefix and missing data", async () => {
    const getStatus = jest.fn().mockResolvedValue({ status: "pending" })
    const container = containerWith({ paymentProviderService_: { getStatus } })

    await paymentStatusFromProvider(container, { provider_id: "comgate_comgate" })

    expect(getStatus).toHaveBeenCalledWith("pp_comgate_comgate", { data: {} })
  })

  it("fails loudly when the module stops exposing its providers", async () => {
    const container = containerWith({})

    await expect(
      paymentStatusFromProvider(container, { provider_id: "pp_comgate_comgate" })
    ).rejects.toThrow("Platební modul nevystavuje")
  })
})
