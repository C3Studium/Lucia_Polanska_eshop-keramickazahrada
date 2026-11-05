import {
  nevyrizene,
  pocetVeci,
  predmetFronty,
  seskup,
  textFronty,
  type PolozkaFronty,
} from "../fronta"

/**
 * Fronta vývojářských e-mailů (4. 11. 2026): místo e-mailu ke každé chybě
 * jeden souhrn za 4 hodiny. Hlídá se, že souhrn nic nespolkne (dvě různé
 * chyby = dva řádky) a že opakování téže věci je jeden řádek s počtem.
 */

const t = (iso: string) => new Date(iso)

const polozka = (klic: string, kdy: string, popis?: string): PolozkaFronty => ({
  klic,
  titulek: `Nefunguje: ${klic}`,
  popis: popis ?? null,
  kdy: t(kdy),
})

describe("seskupení fronty", () => {
  it("sloučí opakování téže věci a nechá různé věci zvlášť", () => {
    const skupiny = seskup([
      polozka("faktury-68", "2026-11-04T08:15:00Z", "starý popis"),
      polozka("platby", "2026-11-04T08:30:00Z"),
      polozka("faktury-68", "2026-11-04T09:45:00Z", "nový popis"),
      polozka("faktury-71", "2026-11-04T10:00:00Z"),
    ])

    expect(skupiny.map((s) => [s.klic, s.pocet])).toEqual([
      ["faktury-68", 2],
      ["platby", 1],
      ["faktury-71", 1],
    ])
    /* U opakované chyby je nejnovější popis nejpřesnější. */
    expect(skupiny[0].popis).toBe("nový popis")
    expect(skupiny[0].prvni).toEqual(t("2026-11-04T08:15:00Z"))
    expect(skupiny[0].posledni).toEqual(t("2026-11-04T09:45:00Z"))
  })
})

describe("text souhrnu chyb", () => {
  const od = t("2026-11-04T08:00:00Z")
  const doKdy = t("2026-11-04T12:00:00Z")

  it("vyjmenuje každou věc, počet opakování a popis", () => {
    const skupiny = seskup([
      polozka("faktury-68", "2026-11-04T08:15:00Z", "iDoklad vrátil 400"),
      polozka("faktury-68", "2026-11-04T09:45:00Z", "iDoklad vrátil 400"),
      polozka("platby", "2026-11-04T10:30:00Z", "ComGate neodpovídá"),
    ])
    const text = textFronty(skupiny, od, doKdy)

    expect(text).toContain("2 věci")
    expect(text).toContain("celkem 3 hlášení")
    expect(text).toContain("1. Nefunguje: faktury-68  ×2")
    expect(text).toContain("2. Nefunguje: platby")
    expect(text).toContain("iDoklad vrátil 400")
    expect(text).toContain("ComGate neodpovídá")
    /* Pražský čas, ne UTC. */
    expect(text).toContain("09:00–13:00")
    expect(text).toContain("nejvýš jednou za 4 hodiny")
  })

  it("u spousty věcí vypíše zbytek jen názvem", () => {
    const skupiny = seskup(
      Array.from({ length: 30 }, (_, i) =>
        polozka(`vec-${i}`, `2026-11-04T09:${String(i).padStart(2, "0")}:00Z`, "popis")
      )
    )
    const text = textFronty(skupiny, od, doKdy)
    expect(text).toContain("A dalších 5 věcí")
    expect(text).toContain("· Nefunguje: vec-29")
  })

  it("předmět řekne počet a okno", () => {
    const skupiny = seskup([polozka("platby", "2026-11-04T10:30:00Z")])
    expect(predmetFronty(skupiny, od, doKdy)).toBe(
      "Provoz: 1 věc k řešení (4. 11. 2026 09:00–13:00)"
    )
  })

  it("skloňuje počet věcí", () => {
    expect(pocetVeci(1)).toBe("1 věc")
    expect(pocetVeci(3)).toBe("3 věci")
    expect(pocetVeci(5)).toBe("5 věcí")
  })
})

describe("okno fronty", () => {
  const sluzba = (posledniZnacka: unknown, radky: unknown[]) => {
    const dotazy: unknown[] = []
    return {
      dotazy,
      container: {
        resolve: () => ({
          listActivityEvents: async (filtr: any) => {
            dotazy.push(filtr)
            if (filtr.action === "alarm:souhrn-odeslan") {
              return posledniZnacka ? [posledniZnacka] : []
            }
            return radky
          },
        }),
      } as never,
    }
  }

  it("začíná tam, kde skončil minulý souhrn — zmeškaný běh nic neztratí", async () => {
    const { container, dotazy } = sluzba(
      { created_at: "2026-11-04T04:00:05Z", detail: { do: "2026-11-04T04:00:00Z" } },
      [
        {
          id: "ae_1",
          summary: "Nefunguje: platby",
          created_at: "2026-11-04T06:00:00Z",
          detail: { klic: "mn:x", titulek: "Nefunguje: platby", popis: "p" },
        },
      ]
    )
    const doKdy = t("2026-11-04T12:00:00Z")
    const { od, polozky } = await nevyrizene(container, doKdy)

    expect(od).toEqual(t("2026-11-04T04:00:00Z"))
    expect((dotazy[1] as any).created_at).toEqual({ $gt: od, $lte: doKdy })
    expect(polozky).toEqual([
      { klic: "mn:x", titulek: "Nefunguje: platby", popis: "p", kdy: t("2026-11-04T06:00:00Z") },
    ])
  })

  it("bez minulého souhrnu bere poslední 4 hodiny", async () => {
    const { container } = sluzba(null, [])
    const { od } = await nevyrizene(container, t("2026-11-04T12:00:00Z"))
    expect(od).toEqual(t("2026-11-04T08:00:00Z"))
  })
})
