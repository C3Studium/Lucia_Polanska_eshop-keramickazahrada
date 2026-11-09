import fs from "fs"
import path from "path"
import {
  SHOP_TEXT_DEFAULTS,
  SHOP_TEXT_GROUPS,
  SHOP_TEXT_KEYS,
  SHOP_TEXT_META,
  dosadZnacky,
  isShopTextOff,
  pickStoredShopTexts,
  resolveShopTexts,
  resolveVisibleShopTexts,
  sameShopTexts,
  sameShopTextsOff,
  shopTextProblem,
  slozStitek,
} from "../shop-texty"

/**
 * Texty obchodu — katalog vět, které zákazník čte u výrobku, v košíku,
 * v pokladně a na hotové objednávce (9. 11. 2026).
 *
 * Nejdůležitější test je ten poslední: obchod má vlastní kopii výchozích
 * znění pro případ, že se texty nedají načíst, a ta se nesmí rozejít
 * s tímhle katalogem. Je to tentýž postup jako u právních údajů.
 */

describe("katalog", () => {
  it("každý klíč má popisek, nápovědu i výchozí znění", () => {
    for (const key of SHOP_TEXT_KEYS) {
      const meta = SHOP_TEXT_META[key]
      expect(meta).toBeDefined()
      expect(meta.label.length).toBeGreaterThan(2)
      expect(meta.help.length).toBeGreaterThan(20)
      expect(SHOP_TEXT_GROUPS).toContain(meta.group)
      expect(SHOP_TEXT_DEFAULTS[key].length).toBeGreaterThan(5)
    }
  })

  it("výchozí znění se vejde do vlastního limitu a má své značky", () => {
    for (const key of SHOP_TEXT_KEYS) {
      expect(shopTextProblem(key, SHOP_TEXT_DEFAULTS[key])).toBeNull()
    }
  })
})

describe("resolveShopTexts", () => {
  it("bez uloženého nastavení platí výchozí znění", () => {
    expect(resolveShopTexts(undefined)["produkt.cekani"]).toBe(
      SHOP_TEXT_DEFAULTS["produkt.cekani"]
    )
  })

  it("uložené znění přebije výchozí", () => {
    const texty = resolveShopTexts({ "produkt.cekani": "Vyrábím do 14 dnů." })
    expect(texty["produkt.cekani"]).toBe("Vyrábím do 14 dnů.")
    /* Ostatní zůstávají výchozí — zápis jednoho pole nesmí smazat zbytek. */
    expect(texty["kosik.poukaz_vse"]).toBe(SHOP_TEXT_DEFAULTS["kosik.poukaz_vse"])
  })

  it("prázdné znění znamená „větu neukazovat“, ne „vrať výchozí“", () => {
    expect(resolveShopTexts({ "produkt.cekani": "" })["produkt.cekani"]).toBe("")
    expect(resolveShopTexts({ "produkt.cekani": "   " })["produkt.cekani"]).toBe("")
  })

  it("poškozená hodnota nechá výchozí a nevyhodí", () => {
    const texty = resolveShopTexts({ "produkt.cekani": 42, neznamy: "x" })
    expect(texty["produkt.cekani"]).toBe(SHOP_TEXT_DEFAULTS["produkt.cekani"])
  })
})

describe("shopTextProblem", () => {
  it("prázdné pole projde — je to vědomé vypnutí věty", () => {
    expect(shopTextProblem("produkt.cekani", "")).toBeNull()
  })

  it("příliš dlouhý text neprojde", () => {
    const dlouhy = "a".repeat(SHOP_TEXT_META["produkt.cekani"].maxLength + 1)
    expect(shopTextProblem("produkt.cekani", dlouhy)).toMatch(/nejvýš/)
  })

  it("věta o dokončení bez {{dny}} neprojde — zamlčela by lhůtu", () => {
    expect(
      shopTextProblem("zakazka.krok_dokonceni", "Hotovo, až to bude hotové.")
    ).toMatch(/\{\{dny\}\}/)
  })

  it("se značkou projde", () => {
    expect(
      shopTextProblem("zakazka.krok_dokonceni", "Do {{dny}} dnů od zahájení.")
    ).toBeNull()
  })
})

describe("pickStoredShopTexts a sameShopTexts", () => {
  it("bere jen známé klíče se string hodnotou", () => {
    expect(
      pickStoredShopTexts({ "produkt.cekani": "a", vymyslene: "b", "kosik.poukaz_vse": 3 })
    ).toEqual({ "produkt.cekani": "a" })
  })

  it("pozná, že se nic nezměnilo", () => {
    expect(sameShopTexts({}, { "produkt.cekani": SHOP_TEXT_DEFAULTS["produkt.cekani"] })).toBe(
      true
    )
    expect(sameShopTexts({}, { "produkt.cekani": "jiné" })).toBe(false)
  })
})

describe("vypínače", () => {
  it("vypnutá věta přijde do obchodu prázdná, ale znění zůstává uložené", () => {
    const ulozene = { "produkt.cekani": "Vyrábím do 14 dnů." }
    const vypnute = { "produkt.cekani": true }

    /* Co vidí zákazník: nic. */
    expect(resolveVisibleShopTexts(ulozene, vypnute)["produkt.cekani"]).toBe("")
    /* Co vidí formulář: pořád to, co napsala — zapnutím se to vrátí. */
    expect(resolveShopTexts(ulozene)["produkt.cekani"]).toBe("Vyrábím do 14 dnů.")
  })

  it("zapnutá věta prochází beze změny", () => {
    expect(
      resolveVisibleShopTexts({}, { "produkt.cekani": false })["produkt.cekani"]
    ).toBe(SHOP_TEXT_DEFAULTS["produkt.cekani"])
  })

  it("poškozené vypínače nic neshodí", () => {
    expect(
      resolveVisibleShopTexts({}, { "produkt.cekani": "ano", vymyslene: true })[
        "produkt.cekani"
      ]
    ).toBe(SHOP_TEXT_DEFAULTS["produkt.cekani"])
  })

  it("isShopTextOff odpovídá na jednu větu", () => {
    expect(isShopTextOff({ "kosik.poukaz_vse": true }, "kosik.poukaz_vse")).toBe(true)
    expect(isShopTextOff({}, "kosik.poukaz_vse")).toBe(false)
  })

  it("sameShopTextsOff pozná změnu", () => {
    expect(sameShopTextsOff({}, { "produkt.cekani": false })).toBe(true)
    expect(sameShopTextsOff({}, { "produkt.cekani": true })).toBe(false)
  })
})

describe("slozStitek", () => {
  it("vynechá prázdné části, ať nezbydou dvě tečky za sebou", () => {
    expect(
      slozStitek(SHOP_TEXT_DEFAULTS["zakazka.stitek"], { zaloha: "", vyroba: "" })
    ).toBe("Na zakázku · bez 14denní lhůty na vrácení")
  })

  it("se všemi částmi složí celý štítek", () => {
    expect(
      slozStitek(SHOP_TEXT_DEFAULTS["zakazka.stitek"], {
        zaloha: "záloha 25 %",
        vyroba: "výroba do 42 dnů",
      })
    ).toBe("Na zakázku · záloha 25 % · výroba do 42 dnů · bez 14denní lhůty na vrácení")
  })
})

describe("dosadZnacky", () => {
  it("dosadí hodnotu za značku", () => {
    expect(dosadZnacky("Do {{dny}} dnů.", { dny: 60 })).toBe("Do 60 dnů.")
  })

  it("co se nedodá, zůstane vidět — lepší než tichý nesmysl", () => {
    expect(dosadZnacky("Do {{dny}} dnů.", {})).toBe("Do {{dny}} dnů.")
  })
})

/*
 * Záloha obchodu. Storefront má vlastní kopii výchozích znění pro případ, že
 * se texty nedají načíst (`storefront/src/lib/constants/texty.ts`). Když se
 * obě rozejdou, ukáže obchod po výpadku jinou větu než administrace — a to
 * se nepozná jinak než takhle.
 */
describe("záloha ve storefrontu", () => {
  const soubor = path.join(
    __dirname,
    "../../../../storefront/src/lib/constants/texty.ts"
  )

  it("existuje", () => {
    expect(fs.existsSync(soubor)).toBe(true)
  })

  it("má tytéž klíče a tatáž znění jako katalog", () => {
    const zdroj = fs.readFileSync(soubor, "utf8")

    for (const key of SHOP_TEXT_KEYS) {
      expect(zdroj).toContain(`"${key}"`)

      /* Porovnává se znění, ne formátování: z obou stran se stáhnou bílé
         znaky, protože v souboru je text zalomený na víc řádků. */
      const vychozi = SHOP_TEXT_DEFAULTS[key]
      const vSouboru = zdroj.replace(/\s+/g, " ").includes(
        vychozi.replace(/\s+/g, " ")
      )
      expect([key, vSouboru]).toEqual([key, true])
    }
  })

  it("nemá klíč navíc, který katalog nezná", () => {
    const zdroj = fs.readFileSync(soubor, "utf8")
    const bloky = zdroj.split("export const TEXTY_DEFAULTS")[1] ?? ""
    const katalog = bloky.split("} as const")[0] ?? ""
    const klice = [...katalog.matchAll(/^\s*"([a-z_.]+)":/gm)].map((m) => m[1])
    for (const klic of klice) {
      expect(SHOP_TEXT_KEYS).toContain(klic as never)
    }
  })
})
