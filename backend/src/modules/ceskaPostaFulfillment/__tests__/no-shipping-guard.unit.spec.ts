import CeskaPostaFulfillmentService from "../service"

/**
 * Plnění bez dopravy (balné, doběrečné) se České poště nikdy nepodává —
 * Medusa volá providera u každého plnění, a podání u ČP je nevratné.
 */
describe("pojistka: plnění bez dopravy nejde na Českou poštu", () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const service = new CeskaPostaFulfillmentService({ logger } as any)
  const podej = jest
    .spyOn(service as any, "podejZasilku")
    .mockResolvedValue({ data: { mode: "api" }, labels: [] })

  beforeEach(() => podej.mockClear())

  it("requires_shipping=false → žádné podání, záznam bez dopravce", async () => {
    const result = await service.createFulfillment(
      { service_code: "DR" },
      [{ title: "Balné", quantity: 1 } as any],
      { id: "order_1", display_id: 49 } as any,
      { requires_shipping: false } as any
    )
    expect(podej).not.toHaveBeenCalled()
    expect(result.labels).toEqual([])
    expect(result.data).toMatchObject({ mode: "manual", no_shipping: true })
  })

  it("plnění se zbožím pojistka nezastaví (bez přístupů jde jako záznam, s nimi by se podalo)", async () => {
    const result = await service.createFulfillment(
      { service_code: "DR" },
      [{ title: "Pítko", quantity: 1 } as any],
      { id: "order_1", display_id: 49 } as any,
      { requires_shipping: true } as any
    )
    // V testu nejsou BALIKOVNA_API_* → záznam bez napojení, ale NE `no_shipping`.
    expect((result.data as any).no_shipping).toBeUndefined()
  })
})
