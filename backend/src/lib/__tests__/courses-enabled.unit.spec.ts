import { areCoursesEnabled } from "../courses-enabled"
import { getMerchantSettings } from "../merchant-settings"

jest.mock("../merchant-settings", () => ({
  getMerchantSettings: jest.fn(),
}))

const nastaveni = getMerchantSettings as jest.MockedFunction<
  typeof getMerchantSettings
>

/* Scope se jen předává dál — kontrola čte nastavení, nic z kontejneru nebere. */
const scope = {} as never

describe("areCoursesEnabled", () => {
  beforeEach(() => nastaveni.mockReset())

  it("vypne kurzy jen tehdy, když to tak obchod opravdu má uložené", async () => {
    nastaveni.mockResolvedValue({ courses_enabled: false } as never)
    await expect(areCoursesEnabled(scope)).resolves.toBe(false)

    nastaveni.mockResolvedValue({ courses_enabled: true } as never)
    await expect(areCoursesEnabled(scope)).resolves.toBe(true)
  })

  /*
   * Obchod bez uloženého nastavení kurzy nabízí — stejně jako výchozí hodnota
   * v `MERCHANT_SETTINGS_DEFAULTS`. Kdyby chybějící klíč znamenal „vypnuto",
   * starší obchod by po nasazení tiše zavřel rezervace.
   */
  it("bez uložené hodnoty nechává kurzy zapnuté", async () => {
    nastaveni.mockResolvedValue({} as never)
    await expect(areCoursesEnabled(scope)).resolves.toBe(true)
  })

  /*
   * A hlavně: chyba při čtení nastavení není důvod zavřít rezervaci. Výpadek
   * na pozadí by jinak zájemci řekl, že kurzy nejsou, přestože jsou.
   */
  it("při selhání čtení kurzy nevypíná", async () => {
    nastaveni.mockRejectedValue(new Error("databáze neodpovídá"))
    await expect(areCoursesEnabled(scope)).resolves.toBe(true)
  })
})
