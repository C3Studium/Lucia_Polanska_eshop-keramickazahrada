import "server-only"

/**
 * Strop na žádosti o obnovu hesla podle IP žadatele.
 *
 * ## Proč zrovna tady a proč podle IP
 *
 * Backend počítá stejnou věc podle ADRESY, na kterou se posílá — tím se brání
 * zaplavení jedné schránky. Jenže obchod na Medusu volá ze svého serveru,
 * takže backend vidí pořád tutéž IP a robota rozsévajícího po tisíci různých
 * adresách by nezastavil ani jednou. Skutečnou IP člověka vidí jedině tahle
 * strana, a tak jedině tady se dá počítat „kolik toho posílá jeden odesílatel".
 *
 * ## Co tenhle strop NEUMÍ, a proč tu i tak je
 *
 * `x-forwarded-for` si může poslat kdokoli. Proxy před aplikací k němu svoji
 * hodnotu připojuje, takže levý údaj je v zásadě to, co tvrdí klient — proti
 * někomu, kdo ho úmyslně mění, je tenhle strop k ničemu.
 *
 * Zůstává proto jako LEVNÁ vrstva, ne jako obrana: zastaví smyčku ve skriptu
 * a nedopatření, zatímco útok, na kterém záleží — tisíc zpráv do schránky
 * jednoho člověka — drží počítadlo podle adresy na backendu, které obejít
 * nejde. Dvě vrstvy, každá na jiný útok; ani jedna sama nestačí.
 *
 * ## Paměť procesu, ne databáze
 *
 * Počítadla žijí v paměti Node procesu. Restart je vynuluje a druhá instance
 * o nich neví — vědomá výměna: trvalé úložiště by znamenalo Redis, který
 * obchod jinak nepotřebuje, kvůli vrstvě, která je stejně jen orientační.
 * To, co musí přežít restart, leží na backendu.
 *
 * Mapa má strop velikosti, aby se z omezovače nedal udělat žrout paměti:
 * po překročení se vymete, co vypršelo, a když to nestačí, zahodí se
 * nejstarší záznamy. Úklid běží při zápisu, ne na časovači — časovač
 * v serverless prostředí drží proces naživu a nikdo ho nezastaví.
 */

type Pocitadlo = { pocet: number; doKdy: number }

const OKNO_MS = 15 * 60 * 1000
const POKUSU_V_OKNE = 5

/** Kolik různých IP si pamatujeme, než začneme zapomínat. */
const STROP_ZAZNAMU = 5000

const pocitadla = new Map<string, Pocitadlo>()

/* `forEach` místo `for...of`: cíl v tsconfig je pod ES2015, kde se přes Map
   iterovat nedá. Klíče se sbírají a mažou až potom — mazat z mapy během
   jejího vlastního průchodu je past bez ohledu na jazyk. */
const uklid = (ted: number) => {
  const vyprsele: string[] = []
  pocitadla.forEach((zaznam, klic) => {
    if (zaznam.doKdy <= ted) {
      vyprsele.push(klic)
    }
  })
  vyprsele.forEach((klic) => pocitadla.delete(klic))

  /* Když ani po vymetení vypršelých není místo, jde ven nejstarší — Map drží
     pořadí vložení, takže první v průchodu je ten nejdéle nedotčený. */
  const kolikSmazat = pocitadla.size - STROP_ZAZNAMU
  if (kolikSmazat <= 0) {
    return
  }

  const nejstarsi: string[] = []
  pocitadla.forEach((_, klic) => {
    if (nejstarsi.length < kolikSmazat) {
      nejstarsi.push(klic)
    }
  })
  nejstarsi.forEach((klic) => pocitadla.delete(klic))
}

/**
 * Zaznamená pokus a řekne, jestli se ještě vejde do stropu.
 *
 * Okno je pevné, ne klouzavé: `doKdy` se při dalších pokusech nepřepisuje,
 * takže hustým klepáním se nedá odsouvat donekonečna.
 */
export const vejdeSeDoStropu = (klic: string): boolean => {
  const ted = Date.now()

  if (pocitadla.size >= STROP_ZAZNAMU) {
    uklid(ted)
  }

  const ulozene = pocitadla.get(klic)
  const zaznam =
    ulozene && ulozene.doKdy > ted
      ? ulozene
      : { pocet: 0, doKdy: ted + OKNO_MS }

  zaznam.pocet += 1
  pocitadla.set(klic, zaznam)

  return zaznam.pocet <= POKUSU_V_OKNE
}

/**
 * IP žadatele z hlaviček proxy.
 *
 * Bere se LEVÝ údaj z `x-forwarded-for` — ten, který proxy považuje za klienta.
 * Chybí-li hlavičky (lokální vývoj), vrací se pevný klíč: strop pak platí na
 * celý vývojový server dohromady, což je přesně to, co na localhostu chceme.
 */
export const ipZHlavicek = (
  hlavicky: { get(name: string): string | null }
): string => {
  const forwarded = hlavicky.get("x-forwarded-for")
  if (forwarded) {
    const prvni = forwarded.split(",")[0]?.trim()
    if (prvni) return prvni
  }

  return hlavicky.get("x-real-ip")?.trim() || "neznama-ip"
}
