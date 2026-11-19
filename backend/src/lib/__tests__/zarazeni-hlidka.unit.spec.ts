import { najdiChybyZarazeni } from "../zarazeni-hlidka"

const kategorie = [
  { id: "k_kvet", name: "Květináče", is_active: true, is_internal: false, collection_id: "c_zahrada" },
  { id: "k_osirela", name: "Osiřelá", is_active: true, is_internal: false, collection_id: null },
  { id: "k_vypnuta", name: "Hrnečky", is_active: false, is_internal: false, collection_id: "c_byt" },
]
const kolekce = ["c_zahrada", "c_byt"]
const vyrobek = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  status: "published",
  collection_id: "c_zahrada" as string | null,
  category_ids: ["k_kvet"],
  sales_channel_ids: ["sc"],
  ...extra,
})

describe("hlídka zařazení", () => {
  it("v pořádku = žádná chyba", () => {
    expect(najdiChybyZarazeni({ vyrobky: [vyrobek("ok")], kategorie, kolekce, vazbyNaSmazane: 0 })).toEqual([])
  })

  it("najde výrobek nikde, bez kanálu, v kategorii bez kolekce i ve vypnuté", () => {
    const chyby = najdiChybyZarazeni({
      vyrobky: [
        vyrobek("nikde", { collection_id: null, category_ids: [] }),
        vyrobek("bezkanalu", { sales_channel_ids: [] }),
        vyrobek("osirela", { category_ids: ["k_osirela"] }),
        vyrobek("vypnuta", { category_ids: ["k_vypnuta"] }),
        vyrobek("smazana-kolekce", { collection_id: "c_neni" }),
      ],
      kategorie,
      kolekce,
      vazbyNaSmazane: 3,
    })
    expect(chyby.map((chyba) => chyba.split(" · ")[0]).sort()).toEqual(
      ["bezkanalu", "nikde", "osirela", "smazana-kolekce", "vypnuta", "vazby na smazané kategorie"].sort()
    )
  })

  it("skryté výrobky se nekontrolují — skrytí je rozhodnutí majitelky", () => {
    expect(
      najdiChybyZarazeni({
        vyrobky: [vyrobek("skryty", { status: "draft", collection_id: null, category_ids: [], sales_channel_ids: [] })],
        kategorie,
        kolekce,
        vazbyNaSmazane: 0,
      })
    ).toEqual([])
  })
})
