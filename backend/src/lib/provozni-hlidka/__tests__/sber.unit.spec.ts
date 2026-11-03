import { zapisovacProvozu } from "../sber"

/**
 * Sběr z HTTP. Pravidlo „čtení se zapisuje jen při skutečné poruše" je
 * zrádné dvakrát: když se obrátí, deník se zahltí prohlížením administrace
 * a to podstatné se v něm utopí; když se zpřísní, zmizí z něj pády stránek.
 *
 * Testuje se přes `createActivityEvents` na podstrčeném modulu — tudy vede
 * jediná cesta zápisu, takže co se tu neobjeví, se nezapíše.
 */

type Zapsane = Record<string, unknown>

const prostredi = () => {
  const zapsane: Zapsane[] = []
  const scope = {
    resolve: (klic: string) => {
      if (klic === "activityLog") {
        return {
          createActivityEvents: async (data: Zapsane) => {
            zapsane.push(data)
          },
        }
      }
      return { warn: () => {}, info: () => {} }
    },
  }
  return { zapsane, scope }
}

/** Projde middlewarem a vyvolá `finish`, jako by odpověď odešla. */
const projdi = async (
  metoda: string,
  url: string,
  statusCode: number,
  telo?: Record<string, unknown>
): Promise<Zapsane[]> => {
  const { zapsane, scope } = prostredi()
  const posluchaci: Array<() => void> = []

  const req = {
    method: metoda,
    originalUrl: url,
    headers: {},
    scope,
    ...(telo ? { body: telo } : {}),
  } as never
  const res = {
    statusCode,
    on: (jmeno: string, posluchac: () => void) => {
      if (jmeno === "finish") posluchaci.push(posluchac)
    },
  } as never

  let dalSePustil = false
  zapisovacProvozu()(req, res, (() => {
    dalSePustil = true
  }) as never)

  expect(dalSePustil).toBe(true)

  for (const posluchac of posluchaci) posluchac()
  /* Zápis je záměrně bez čekání (nesmí zdržet odpověď) — jeden tik stačí. */
  await Promise.resolve()
  await Promise.resolve()

  return zapsane
}

describe("sběr provozu z HTTP", () => {
  it("úspěšné čtení se nezapisuje", async () => {
    expect(await projdi("GET", "/admin/products", 200)).toHaveLength(0)
  })

  it("nenalezené ani nepřihlášené čtení není porucha", async () => {
    expect(await projdi("GET", "/admin/products/prod_1", 404)).toHaveLength(0)
    expect(await projdi("GET", "/store/customers/me", 401)).toHaveLength(0)
  })

  it("spadlé čtení porucha je", async () => {
    const zapsane = await projdi("GET", "/store/products", 500)
    expect(zapsane).toHaveLength(1)
    expect(zapsane[0]).toMatchObject({ status: "chyba" })
  })

  it("každá změna se zapisuje, i když projde", async () => {
    const zapsane = await projdi("POST", "/admin/products", 201)
    expect(zapsane).toHaveLength(1)
    expect(zapsane[0]).toMatchObject({
      kind: "admin",
      action: "POST /admin/products",
      status: "ok",
    })
  })

  it("odmítnutá změna se zapisuje jako chyba se stavovým kódem", async () => {
    const zapsane = await projdi("POST", "/store/carts/cart_01JABCDEF12345", 422)
    expect(zapsane[0]).toMatchObject({
      kind: "obchod",
      action: "POST /store/carts/:id",
      status: "chyba",
    })
    expect((zapsane[0].detail as Record<string, unknown>).stav).toBe(422)
  })

  it("tělo se zapíše, ale bez hesel a platebních údajů", async () => {
    const zapsane = await projdi("POST", "/store/customers", 201, {
      email: "jana@example.com",
      password: "velmiTajne123",
      card: "4111111111111117",
    })

    const jako = JSON.stringify(zapsane[0])
    /* Bez těla se u spadlé akce dohledává naslepo — proto tam je. */
    expect(jako).toContain("jana@example.com")
    /* A proto, co v něm nesmí být, být nesmí ani náhodou. */
    expect(jako).not.toContain("velmiTajne123")
    expect(jako).not.toContain("4111111111111117")
  })

  it("vlastní stránka Provoz se nezapisuje, aby deník nehlásil sám sebe", async () => {
    expect(await projdi("GET", "/admin/operations/provoz", 500)).toHaveLength(0)
  })
})
