import {
  balikovnaPointIdFrom,
  isBalikovnaBoxSubtype,
  resolveBalikovnaPointSubtype,
  type FetchLike,
} from "../balikovna-point"

const apiReturning = (body: unknown, ok = true) => {
  const calls: string[] = []
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url)
    return { ok, json: async () => body }
  }
  return { fetchImpl, calls }
}

describe("isBalikovnaBoxSubtype — boxy, kde se dobírka platí jen předem online", () => {
  it("BOX i BBOX jsou box, ostatní ne", () => {
    expect(isBalikovnaBoxSubtype("BOX")).toBe(true)
    expect(isBalikovnaBoxSubtype("box")).toBe(true)
    expect(isBalikovnaBoxSubtype("BBOX")).toBe(true)
    expect(isBalikovnaBoxSubtype("POSTA")).toBe(false)
    expect(isBalikovnaBoxSubtype("PARTNER")).toBe(false)
    expect(isBalikovnaBoxSubtype("DEPO")).toBe(false)
    expect(isBalikovnaBoxSubtype("")).toBe(false)
    expect(isBalikovnaBoxSubtype(null)).toBe(false)
  })
})

describe("balikovnaPointIdFrom — id pro API widgetu", () => {
  it("bere uložené id, jinak B + PSČ výdejny", () => {
    expect(balikovnaPointIdFrom({ balikovna_point_id: "B16908" })).toBe("B16908")
    expect(balikovnaPointIdFrom({ balikovna_point_id: "12345", balikovna_point_zip: "16908" })).toBe("B16908")
    expect(balikovnaPointIdFrom({ balikovna_point_zip: "169 08" })).toBe("B16908")
    expect(balikovnaPointIdFrom({})).toBeNull()
    expect(balikovnaPointIdFrom(null)).toBeNull()
  })
})

describe("resolveBalikovnaPointSubtype", () => {
  it("uložený typ má přednost a API se nevolá", async () => {
    const { fetchImpl, calls } = apiReturning({ subtype: "POSTA" })
    await expect(
      resolveBalikovnaPointSubtype({ balikovna_point_subtype: "box", balikovna_point_id: "B16908" }, fetchImpl)
    ).resolves.toBe("BOX")
    expect(calls).toHaveLength(0)
  })

  it("bez uloženého typu ho dohledá v API widgetu (starší košík)", async () => {
    const { fetchImpl, calls } = apiReturning({ id: "B16908", subtype: "BOX" })
    await expect(
      resolveBalikovnaPointSubtype({ balikovna_point_id: "B16908" }, fetchImpl)
    ).resolves.toBe("BOX")
    expect(calls).toEqual(["https://b2c.cpost.cz/locations/api/points/B16908"])
  })

  it("chyba API nebo neznámý bod = neznámý typ (null), nikdy výjimka", async () => {
    await expect(
      resolveBalikovnaPointSubtype({ balikovna_point_id: "B1" }, apiReturning({ error: "err_not_found" }, false).fetchImpl)
    ).resolves.toBeNull()
    const throwing: FetchLike = async () => {
      throw new Error("timeout")
    }
    await expect(resolveBalikovnaPointSubtype({ balikovna_point_id: "B16908" }, throwing)).resolves.toBeNull()
    await expect(resolveBalikovnaPointSubtype({}, throwing)).resolves.toBeNull()
  })
})
