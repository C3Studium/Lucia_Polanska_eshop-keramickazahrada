import { managedInventoryItemIds } from "../require-stockable-cart"

/**
 * Čistá část pojistky „prodej bez skladu musí jít dokončit": z košíku vytáhne
 * skladové položky variant, které hlídají stav a potřebují tedy úroveň zásoby.
 */
describe("managedInventoryItemIds", () => {
  it("vrátí skladové položky variant, které hlídají stav", () => {
    const cart = {
      items: [
        {
          variant: {
            manage_inventory: true,
            inventory_items: [{ inventory_item_id: "iitem_1" }],
          },
        },
      ],
    }
    expect(managedInventoryItemIds(cart)).toEqual(["iitem_1"])
  })

  it("přeskočí variantu, která stav nehlídá — žádnou rezervaci nezakládá", () => {
    const cart = {
      items: [
        {
          variant: {
            manage_inventory: false,
            inventory_items: [{ inventory_item_id: "iitem_skip" }],
          },
        },
      ],
    }
    expect(managedInventoryItemIds(cart)).toEqual([])
  })

  it("stejná skladová položka z více položek košíku se vrátí jen jednou", () => {
    const cart = {
      items: [
        {
          variant: {
            manage_inventory: true,
            inventory_items: [
              { inventory_item_id: "iitem_1" },
              { inventory_item_id: "iitem_2" },
            ],
          },
        },
        {
          variant: {
            manage_inventory: true,
            inventory_items: [{ inventory_item_id: "iitem_1" }],
          },
        },
      ],
    }
    expect(managedInventoryItemIds(cart).sort()).toEqual(["iitem_1", "iitem_2"])
  })

  it("prázdný, chybějící nebo rozbitý košík nic nepokazí", () => {
    expect(managedInventoryItemIds(undefined)).toEqual([])
    expect(managedInventoryItemIds({})).toEqual([])
    expect(managedInventoryItemIds({ items: [{ variant: null }] })).toEqual([])
    expect(
      managedInventoryItemIds({
        items: [{ variant: { manage_inventory: true, inventory_items: [] } }],
      })
    ).toEqual([])
  })
})
