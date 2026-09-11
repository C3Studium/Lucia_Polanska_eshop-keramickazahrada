import { chybejiciUrovne } from "../inventory-levels"

describe("chybejiciUrovne", () => {
  it("vrátí položky, které na lokaci úroveň nemají", () => {
    expect(
      chybejiciUrovne(
        ["iitem_1", "iitem_2", "iitem_3"],
        [{ inventory_item_id: "iitem_2" }]
      )
    ).toEqual(["iitem_1", "iitem_3"])
  })

  it("když mají úroveň všechny, nevrátí nic — tím se nezapisuje", () => {
    expect(
      chybejiciUrovne(
        ["iitem_1", "iitem_2"],
        [{ inventory_item_id: "iitem_1" }, { inventory_item_id: "iitem_2" }]
      )
    ).toEqual([])
  })

  it("zopakované id se doplní jen jednou", () => {
    /* Dvě varianty téhož výrobku můžou v jedné události přijít se stejnou
       skladovou položkou; dvakrát založená úroveň by byla chyba z databáze. */
    expect(chybejiciUrovne(["iitem_1", "iitem_1"], [])).toEqual(["iitem_1"])
  })

  it("prázdné a neplatné vstupy nic nepokazí", () => {
    expect(chybejiciUrovne([], [])).toEqual([])
    expect(chybejiciUrovne(["iitem_1"], [{ inventory_item_id: null }])).toEqual([
      "iitem_1",
    ])
  })
})
