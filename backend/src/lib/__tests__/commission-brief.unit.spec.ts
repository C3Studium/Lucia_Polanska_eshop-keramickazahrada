import {
  composePhotos,
  composeSpecification,
  mergeCommissionBrief,
  pieceHasContent,
  readCommissionPieces,
} from "../commission-brief"

describe("readCommissionPieces — zadání po kusech", () => {
  it("staré zadání bez pole patří PRVNÍMU kusu, zbylé jsou prázdné", () => {
    const pieces = readCommissionPieces(
      { made_to_order: { specification: "liška", photos: ["a.jpg"] } },
      2
    )
    expect(pieces).toEqual([
      { specification: "liška", photos: ["a.jpg"] },
      { specification: "", photos: [] },
    ])
  })

  it("starší řádek se zadáním v `note` se taky najde", () => {
    expect(
      readCommissionPieces({ made_to_order: { note: "sova" } }, 1)[0].specification
    ).toBe("sova")
  })

  it("uložené pole se doplní na množství řádku", () => {
    const pieces = readCommissionPieces(
      {
        made_to_order: {
          specification: "složeno",
          pieces: [{ specification: "liška", photos: ["a.jpg"] }],
        },
      },
      3
    )
    expect(pieces).toHaveLength(3)
    expect(pieces[0].specification).toBe("liška")
    // Za koncem pole se zadání prvního kusu NEkopíruje — jinak by „vyplněno"
    // lhalo a brána by pustila kus, který nikdo nepopsal.
    expect(pieces[1]).toEqual({ specification: "", photos: [] })
  })

  it("bez metadat i bez množství vrátí jeden prázdný kus", () => {
    expect(readCommissionPieces(null, 0)).toEqual([
      { specification: "", photos: [] },
    ])
  })
})

describe("složený pohled pro administraci, PDF a e-maily", () => {
  it("jeden kus = holý text", () => {
    expect(composeSpecification([{ specification: "liška", photos: [] }])).toBe(
      "liška"
    )
  })

  it("víc kusů = očíslovaně, prázdné se vynechají", () => {
    expect(
      composeSpecification([
        { specification: "liška", photos: [] },
        { specification: "", photos: [] },
        { specification: "sova", photos: [] },
      ])
    ).toBe("Kus 1: liška\n\nKus 3: sova")
  })

  it("fotky přes kusy v pořadí a bez duplicit", () => {
    expect(
      composePhotos([
        { specification: "", photos: ["a.jpg", "b.jpg"] },
        { specification: "", photos: ["b.jpg", "c.jpg"] },
      ])
    ).toEqual(["a.jpg", "b.jpg", "c.jpg"])
  })

  it("prázdné zadání není vyplněné, fotka sama ano", () => {
    expect(pieceHasContent({ specification: "   ", photos: [] })).toBe(false)
    expect(pieceHasContent({ specification: "", photos: ["a.jpg"] })).toBe(true)
  })
})

describe("mergeCommissionBrief", () => {
  it("uloží druhý kus a první nechá být", () => {
    const current = {
      made_to_order: { specification: "liška", photos: ["a.jpg"] },
    }
    const next = mergeCommissionBrief({
      current,
      quantity: 2,
      piece: 1,
      note: "sova",
      photos: ["b.jpg"],
    })

    expect(next.made_to_order.pieces).toEqual([
      { specification: "liška", photos: ["a.jpg"] },
      { specification: "sova", photos: ["b.jpg"] },
    ])
    expect(next.made_to_order.specification).toBe("Kus 1: liška\n\nKus 2: sova")
    expect(next.made_to_order.photos).toEqual(["a.jpg", "b.jpg"])
  })

  it("jediný kus pole vůbec nezakládá — tvar zůstává jako dřív", () => {
    const next = mergeCommissionBrief({
      current: null,
      quantity: 1,
      note: "liška",
      photos: ["a.jpg"],
    })
    expect(next.made_to_order.pieces).toBeUndefined()
    expect(next.made_to_order).toEqual({
      specification: "liška",
      photos: ["a.jpg"],
    })
  })

  it("poučení Z10 se nese dál", () => {
    const next = mergeCommissionBrief({
      current: { made_to_order: { specification: "x", ack_at: "2026-10-30T10:00:00Z" } },
      quantity: 1,
      note: "y",
      photos: [],
    })
    expect(next.made_to_order.ack_at).toBe("2026-10-30T10:00:00Z")
  })

  it("kus mimo rozsah se srovná na poslední existující", () => {
    const next = mergeCommissionBrief({
      current: null,
      quantity: 2,
      piece: 9,
      note: "sova",
      photos: [],
    })
    expect(next.made_to_order.pieces?.[1].specification).toBe("sova")
  })

  it("prázdné uložení kus vymaže, nenechá starý text", () => {
    const next = mergeCommissionBrief({
      current: { made_to_order: { specification: "liška", photos: ["a.jpg"] } },
      quantity: 1,
      note: "",
      photos: [],
    })
    expect(next.made_to_order.specification).toBe("")
    expect(next.made_to_order.photos).toBeUndefined()
  })
})
