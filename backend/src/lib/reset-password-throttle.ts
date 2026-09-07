import { createHash } from "crypto"

import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Kolikrát smí jedna adresa požádat o odkaz na nové heslo.
 *
 * ## Proč to musí být tady
 *
 * `/auth/customer/emailpass/reset-password` je nepřihlášený endpoint, který
 * na cizí příkaz odesílá e-mail. Bez omezení z něj je nástroj na dvě věci:
 * zaplavit cizí schránku (stačí cyklus s adresou oběti) a projíst kredit
 * u odesílatele pošty, který se platí za zprávu.
 *
 * Obchod volá tenhle endpoint ze svého serveru, takže backend vidí pořád
 * jednu IP — omezovat se tu proto dá jen podle ADRESY, na kterou se posílá.
 * Omezení podle IP žadatele patří na druhou stranu, do serverové akce
 * obchodu, která skutečnou IP člověka vidí (`lib/util/reset-throttle.ts`).
 * Každá půlka chytá jiný útok: tahle zaplavení jedné schránky, ta druhá
 * jednoho robota rozsévajícího přes tisíc adres.
 *
 * ## Dvě okna, ne jedno
 *
 * Krátké okno drží člověka, který klikl třikrát po sobě, protože mu e-mail
 * nedorazil hned. Denní strop je proti pomalému kapání, které by se do
 * patnáctiminutových oken vešlo donekonečna: 3 za 15 minut je 288 zpráv
 * denně, 10 za den je 10.
 *
 * ## Adresy se ukládají jako otisk
 *
 * V klíči je SHA-256, ne adresa. Počítadla leží v cache (v produkci Redis),
 * což je jiný systém s jinou životností než databáze; seznam e-mailů, které
 * kdy někdo zkusil obnovit, tam nemá co dělat. Na počítání otisk stačí.
 *
 * ## Selhává otevřeně
 *
 * Když cache neodpoví, požadavek projde. Rozbité Redis nesmí být důvod, proč
 * se zákazník nedostane ke svému účtu — omezovač je ochrana proti zneužití,
 * ne součást přihlášení. Do logu jde varování.
 *
 * ## Odmítnutí nic neprozradí
 *
 * Vrací 429 s obecným textem, stejným pro existující i neexistující účet.
 * Obchod si ho překládá na tutéž větu jako úspěch, takže se z odpovědi nedá
 * vyčíst, kdo u nás účet má — jen v logu je vidět, že se něco děje.
 */

/** Krátké okno: kolik pokusů a za jak dlouho. */
const KRATKE_OKNO_MS = 15 * 60 * 1000
const KRATKE_OKNO_POKUSU = 3

/** Denní strop. */
const DENNI_OKNO_MS = 24 * 60 * 60 * 1000
const DENNI_POKUSU = 10

type Pocitadlo = { pocet: number; doKdy: number }

const otisk = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32)

/**
 * Zvýší počítadlo v jednom okně a řekne, jestli se pokus ještě vejde.
 *
 * TTL se počítá do konce okna, ne na jeho celou délku — jinak by každý další
 * pokus okno posunul a při dostatečně hustém klepání by nevypršelo nikdy.
 */
const zapocitat = async (
  cache: any,
  klic: string,
  oknoMs: number,
  limit: number
): Promise<boolean> => {
  const ted = Date.now()
  const ulozene = (await cache.get(klic)) as Pocitadlo | null | undefined

  const platne =
    ulozene && typeof ulozene.doKdy === "number" && ulozene.doKdy > ted
      ? ulozene
      : { pocet: 0, doKdy: ted + oknoMs }

  platne.pocet += 1

  await cache.set(klic, platne, Math.ceil((platne.doKdy - ted) / 1000))

  return platne.pocet <= limit
}

export function throttleResetPassword() {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

    const identifier = (req.body as { identifier?: unknown } | undefined)
      ?.identifier

    /* Bez adresy není co počítat — a je to stejně požadavek, který Medusa
       sama odmítne jako neplatný. */
    if (typeof identifier !== "string" || !identifier.trim()) {
      return next()
    }

    let vejdeSe = true

    try {
      const cache = req.scope.resolve(Modules.CACHE)
      const id = otisk(identifier)

      /* Obě okna se počítají VŽDY, i když první z nich už odmítlo. Kdyby se
         druhé přeskočilo, dal by se denní strop obejít tím, že útočník klepe
         rychle: krátké okno by odmítalo, denní by se nehnulo z místa. */
      const kratke = await zapocitat(
        cache,
        `pwreset:15m:${id}`,
        KRATKE_OKNO_MS,
        KRATKE_OKNO_POKUSU
      )
      const denni = await zapocitat(
        cache,
        `pwreset:24h:${id}`,
        DENNI_OKNO_MS,
        DENNI_POKUSU
      )

      vejdeSe = kratke && denni
    } catch (chyba: any) {
      logger.warn(
        `[obnova hesla] omezovač neběží, pouštím dál: ${chyba?.message ?? chyba}`
      )
      return next()
    }

    if (!vejdeSe) {
      logger.warn(
        `[obnova hesla] příliš mnoho žádostí pro otisk ${otisk(identifier)} — odmítnuto`
      )

      return res.status(429).json({
        message:
          "Příliš mnoho žádostí o obnovu hesla. Zkuste to prosím za chvíli.",
      })
    }

    return next()
  }
}
