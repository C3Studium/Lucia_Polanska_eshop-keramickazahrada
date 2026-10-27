import { pickProducts, productKind } from "../studio-preview"
import {
  STUDIO_PREVIEW_ID,
  STUDIO_PREVIEW_PAGES,
  studioPreviewListed,
  studioPreviewPageFor,
  type StudioPreviewData,
} from "../../../../storefront/src/lib/studio-preview/pages"

describe("studio preview — druh výrobku", () => {
  it("poukaz s pevnou hodnotou (metadata.gift_voucher) není běžný výrobek", () => {
    // Past ze sandboxu 27. 10.: „běžný výrobek" ukazoval dárkový poukaz.
    expect(productKind({ metadata: { gift_voucher: true } })).toBe("giftVoucher")
    expect(productKind({ metadata: { gift_voucher: "true" } })).toBe("giftVoucher")
  })

  it("cena po domluvě má přednost před zakázkou", () => {
    expect(productKind({ metadata: { price_on_request: true, made_to_order: true } })).toBe("priceOnRequest")
  })

  it("zakázka podle metadat i podle výrobního profilu", () => {
    expect(productKind({ metadata: { made_to_order: true } })).toBe("madeToOrder")
    expect(productKind({ metadata: {}, hasProductionProfile: true })).toBe("madeToOrder")
  })

  it("kus s vadou, vyprodané, běžné", () => {
    expect(productKind({ metadata: { clearance: true } })).toBe("clearance")
    expect(
      productKind({
        metadata: {},
        variants: [{ manage_inventory: true, allow_backorder: false, inventory: [{ location_levels: [{ stocked_quantity: 0, reserved_quantity: 0 }] }] }],
      })
    ).toBe("soldOut")
    expect(productKind({ metadata: {}, variants: [{ manage_inventory: false }] })).toBe("regular")
  })

  it("pickProducts bere první výrobek od každého druhu", () => {
    const picked = pickProducts([
      { handle: "poukaz", metadata: { gift_voucher: true } },
      { handle: "miska", metadata: {} },
      { handle: "miska-2", metadata: {} },
    ])
    expect(picked.regular).toBe("miska")
    expect(picked.giftVoucher).toBe("poukaz")
    expect(picked.madeToOrder).toBeNull()
  })
})

describe("studio preview — tabulka ukázkových stránek", () => {
  const data: StudioPreviewData = {
    order: { id: "order_1", token: "tok" },
    commissionOrder: null,
    priceOnRequestOrder: null,
    awaitingBalanceOrder: null,
    courseReservation: { id: "res_1", token: "rt" },
    paidVoucher: { id: "gv_1", token: "vt" },
    pendingVoucher: null,
    products: { regular: "miska", madeToOrder: null, priceOnRequest: null, giftVoucher: null, clearance: null, soldOut: null },
    categoryHandle: "objekty",
    collectionHandle: null,
  }

  it("adresy jsou jedinečné a Studio je umí otevřít (bez query)", () => {
    const paths = STUDIO_PREVIEW_PAGES.map((page) => page.path)
    expect(new Set(paths).size).toBe(paths.length)
    for (const path of paths) expect(path).toMatch(/^\/[A-Za-z0-9\-._~/]{0,120}$/)
  })

  it("Košík a Pokladna nejsou v seznamu dvakrát (konfigurace je má)", () => {
    expect(studioPreviewListed.some((page) => page.path === "/cz/cart" || page.path === "/cz/checkout")).toBe(false)
  })

  it("samoobsluha objednávky nese podepsaný token", () => {
    expect(studioPreviewPageFor("/cz/order/ukazka/edit")!.target!(data, "cz")).toBe("/cz/order/order_1/edit?token=tok")
    expect(studioPreviewPageFor("/cz/order/ukazka-platba-ceka/confirmed")!.target!(data, "cz")).toBe(
      "/cz/order/order_1/confirmed?platba=ceka"
    )
    expect(studioPreviewPageFor("/cz/kurzy/rezervace/ukazka")!.target!(data, "cz")).toBe("/cz/kurzy/rezervace/res_1?token=rt")
  })

  it("bez dat vrací null (stránka pak vysvětlí, co chybí)", () => {
    const page = studioPreviewPageFor("/cz/order/ukazka-zakazka/confirmed")!
    expect(page.target!(data, "cz")).toBeNull()
    expect(page.missing).toBeTruthy()
  })

  it("dokončení platby se ukazuje jen s vyhrazeným id", () => {
    const page = studioPreviewPageFor(`/cz/cart/${STUDIO_PREVIEW_ID}/confirmed`)!
    expect(page.target).toBeUndefined()
  })
})
