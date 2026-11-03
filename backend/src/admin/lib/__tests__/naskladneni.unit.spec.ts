import {
  odpovidaHledani,
  pocetProduktu,
  precistPocet,
  seradit,
  uProduktu,
  type SkladRadek,
} from "../naskladneni";

const radek = (patch: Partial<SkladRadek>): SkladRadek => ({
  variant_id: "v",
  variant_title: null,
  product_id: "p",
  product_title: null,
  sku: null,
  inventory_item_id: "i",
  stocked: 0,
  reserved: 0,
  available: 0,
  threshold: 2,
  has_custom_threshold: false,
  waiting_customers: 0,
  wishlist_count: 0,
  ...patch,
});

describe("odpovidaHledani", () => {
  const hrnek = radek({ product_title: "Hrnek Luční", variant_title: "Modrá", sku: "HR-01" });

  it("hledá v názvu, provedení i SKU bez ohledu na háčky", () => {
    expect(odpovidaHledani(hrnek, "lucni")).toBe(true);
    expect(odpovidaHledani(hrnek, "MODRA")).toBe(true);
    expect(odpovidaHledani(hrnek, "hr-01")).toBe(true);
  });

  it("víc slov musí sedět všechna", () => {
    expect(odpovidaHledani(hrnek, "hrnek modr")).toBe(true);
    expect(odpovidaHledani(hrnek, "hrnek zelen")).toBe(false);
  });

  it("prázdné hledání pustí všechno", () => {
    expect(odpovidaHledani(hrnek, "  ")).toBe(true);
  });
});

describe("seradit", () => {
  const a = radek({ variant_id: "a", product_title: "Talíř" });
  const b = radek({ variant_id: "b", product_title: "Hrnek", wishlist_count: 2 });
  const c = radek({ variant_id: "c", product_title: "Čajník", waiting_customers: 1 });

  it("podle zájmu: čekající, pak oblíbené, pak abeceda", () => {
    expect(seradit([a, b, c], "zajem").map((r) => r.variant_id)).toEqual(["c", "b", "a"]);
  });

  it("podle abecedy česky (Č hned za C)", () => {
    expect(seradit([a, b, c], "abeceda").map((r) => r.variant_id)).toEqual(["c", "b", "a"]);
  });
});

describe("precistPocet", () => {
  it.each([
    ["", "prazdne"],
    ["0", "prazdne"],
    ["6", "ok"],
    [" 12 ", "ok"],
    ["-2", "chyba"],
    ["1.5", "chyba"],
    ["abc", "chyba"],
    ["100001", "chyba"],
  ])("„%s“ → %s", (text, druh) => {
    expect(precistPocet(text).druh).toBe(druh);
  });
});

describe("souhrn", () => {
  it("skloňuje produkty", () => {
    expect(uProduktu(1)).toBe("u 1 produktu");
    expect(uProduktu(3)).toBe("u 3 produktů");
  });

  it("dvě provedení jednoho produktu počítá jednou", () => {
    expect(
      pocetProduktu([
        radek({ variant_id: "a", product_id: "p1" }),
        radek({ variant_id: "b", product_id: "p1" }),
        radek({ variant_id: "c", product_id: "p2" }),
      ])
    ).toBe(2);
  });
});
