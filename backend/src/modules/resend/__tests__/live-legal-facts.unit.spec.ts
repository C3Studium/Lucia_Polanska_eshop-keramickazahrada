/**
 * Loader právních údajů pro patičku e-mailů. Skutečný kořenový kontejner
 * a nastavení obchodu tu nejsou — test hlídá jen to, na čem záleží:
 * e-mail dostane údaje z nastavení, a když nejdou přečíst (nebo se čtení
 * zasekne), dostane `null` a odejde se zálohou. Nikdy nevyhodí.
 */

const mockContainer = { resolve: jest.fn() }
const mockGetLegalFacts = jest.fn()

jest.mock("@medusajs/framework", () => ({ container: mockContainer }))
jest.mock("../../../lib/merchant-settings", () => ({
  getLegalFacts: (...args: unknown[]) => mockGetLegalFacts(...args),
}))

import { loadEmailLegalFacts } from "../live-legal-facts"

describe("loadEmailLegalFacts", () => {
  beforeEach(() => {
    jest.useRealTimers()
    mockGetLegalFacts.mockReset()
  })

  it("reads the facts through the application's root container", async () => {
    const facts = { "seller.name": "Lucie Polanská", "mto.deposit": "40 %" }
    mockGetLegalFacts.mockResolvedValue({ facts, updated_at: null, source: "settings" })

    await expect(loadEmailLegalFacts()).resolves.toBe(facts)
    expect(mockGetLegalFacts).toHaveBeenCalledWith(mockContainer)
  })

  it("returns null when the settings are unreadable — the footer uses the manifest", async () => {
    mockGetLegalFacts.mockResolvedValue({ facts: {}, updated_at: null, source: "defaults" })
    await expect(loadEmailLegalFacts()).resolves.toBeNull()

    mockGetLegalFacts.mockRejectedValue(new Error("Could not resolve 'store'"))
    await expect(loadEmailLegalFacts()).resolves.toBeNull()
  })

  it("does not hold the e-mail longer than a few seconds", async () => {
    jest.useFakeTimers()
    mockGetLegalFacts.mockReturnValue(new Promise(() => undefined))

    const pending = loadEmailLegalFacts()
    await jest.advanceTimersByTimeAsync(3000)
    await expect(pending).resolves.toBeNull()
  })
})
