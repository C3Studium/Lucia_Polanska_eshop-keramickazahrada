import { readdirSync, readFileSync } from "fs"
import { join, resolve } from "path"

/**
 * Widgety na detailu objednávky se 3. 11. 2026 sloučily do dvou „Práce
 * s objednávkou" (`order-workspace`, `order-workspace-main`) — Medusa 2.18
 * ignoruje přípony zón `.before` / `.after` a pořadí karet si jinak určit
 * nejde. Panely tím ale přestaly být registrované widgety: soubor zůstane
 * v repu, a přesto ho nikdo nevykreslí, když se zapomene jeden import.
 * Zvenčí to vypadá, že karta z adminu zmizela — a přesně na to se 5. 11. 2026
 * ptala majitelka u štítku České pošty.
 *
 * Pravidlo, které tu drží: každý soubor ve `widgets/` je buď registrovaný
 * widget, nebo ho vykresluje některý registrovaný widget.
 */

const WIDGETS = resolve(__dirname, "..", "widgets")

const soubory = readdirSync(WIDGETS).filter((jmeno) => jmeno.endsWith(".tsx"))
const bezPripony = (soubor: string) => soubor.replace(/\.tsx$/, "")
const obsah = new Map(
  soubory.map((soubor) => [
    bezPripony(soubor),
    readFileSync(join(WIDGETS, soubor), "utf8"),
  ])
)

const registrovane = [...obsah.entries()]
  .filter(([, text]) => text.includes("defineWidgetConfig"))
  .map(([jmeno]) => jmeno)

/** Na které sousedy ve `widgets/` soubor ukazuje importem. */
const importyUvnitr = (text: string): string[] =>
  [...text.matchAll(/from "\.\/([a-z0-9-]+)"/g)]
    .map((nalez) => nalez[1])
    .filter((jmeno) => obsah.has(jmeno))

/** Co se z registrovaných widgetů dá doopravdy dosáhnout. */
const vykreslene = (): Set<string> => {
  const videno = new Set<string>(registrovane)
  const fronta = [...registrovane]
  while (fronta.length) {
    const jmeno = fronta.shift() as string
    for (const dalsi of importyUvnitr(obsah.get(jmeno) ?? "")) {
      if (!videno.has(dalsi)) {
        videno.add(dalsi)
        fronta.push(dalsi)
      }
    }
  }
  return videno
}

describe("widgety adminu", () => {
  it("každý widget někdo vykresluje", () => {
    const osirele = soubory
      .map(bezPripony)
      .filter((jmeno) => !vykreslene().has(jmeno))
    expect(osirele).toEqual([])
  })

  it("registrovaný widget má zónu i výchozí export", () => {
    expect(registrovane.length).toBeGreaterThan(0)
    for (const jmeno of registrovane) {
      const text = obsah.get(jmeno) as string
      expect(text).toMatch(/zone: "/)
      expect(text).toContain("export default")
    }
  })

  /* Štítek ČP: karta, kterou majitelka hledá u každé zásilky. */
  it("štítek České pošty visí na detailu objednávky", () => {
    expect(vykreslene().has("cp-label")).toBe(true)
    // Ne jen import do prázdna — panel se opravdu vykresluje.
    expect(obsah.get("order-workspace")).toContain("<CpLabelPanel order={order} />")
  })

  /*
   * A neschovává se podle fáze objednávky. U odeslané a zrušené bez štítku se
   * od 3. 11. 2026 schovával, aby nestrašil oranžovým „Zatím bez štítku" —
   * tím ale zmizela jediná cesta ke štítku. Jediné „return null" v panelu
   * patří cizímu dopravci a osobnímu odběru, kde opravdu není co podávat.
   */
  it("štítek se neschová podle fáze objednávky", () => {
    const text = obsah.get("cp-label") as string
    expect((text.match(/return null;/g) ?? []).length).toBe(1)
  })
})
