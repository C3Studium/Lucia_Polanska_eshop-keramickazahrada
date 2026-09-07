import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { najdiOsireleUcty, spravUcet, type Oprava } from "../lib/orphaned-auth"

/**
 * Účty, u kterých přihlášení existuje a zákazník k němu chybí — z terminálu.
 *
 * Totéž, co ukazuje Přehled v administraci; hledání i opravy jsou jeden kód
 * v `lib/orphaned-auth.ts`, aby se ty dvě cesty nemohly rozejít. Skript je tu
 * pro chvíli, kdy se do administrace nedá nebo je potřeba projet všechno naráz.
 *
 * ## Použití
 *
 *   npx medusa exec ./src/scripts/repair-auth-identity.js
 *     — vypíše všechny nálezy, nic nemění
 *
 *   npx medusa exec ./src/scripts/repair-auth-identity.js -- --email=nekdo@example.com
 *     — jen jeden účet
 *
 *   npx medusa exec ./src/scripts/repair-auth-identity.js -- --email=… --oprava=obnovit
 *     — provede opravu; volby: obnovit | prepojit | uvolnit
 *
 * Oddělovač `--` je nutný: Medusa registruje příkaz jako `exec [file] [args..]`
 * bez `unknown-options-as-args`, takže by yargs přepínače odmítl. Kdyby to
 * prostředí přesto snědlo, čtou se i REPAIR_EMAIL a REPAIR_OPRAVA.
 *
 * Bez `--oprava` skript **nikdy nic nezapíše**. Která oprava je ta správná,
 * závisí na tom, proč se zákazník mazal — u omylu obnovit, u žádosti o výmaz
 * údajů naopak uvolnit e-mail. To vědět nemůže, a proto se neptá jen tak.
 */
export default async function repairAuthIdentity({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const prepinace = [...(args ?? []), ...process.argv.slice(2)]
  const hodnota = (jmeno: string) => {
    const nalez = prepinace.find((a) => a.startsWith(`--${jmeno}=`))
    return nalez ? nalez.slice(jmeno.length + 3) : undefined
  }

  const email = (hodnota("email") ?? process.env.REPAIR_EMAIL ?? "")
    .trim()
    .toLowerCase()
  const oprava = (hodnota("oprava") ?? process.env.REPAIR_OPRAVA ?? "").trim()

  const vsechny = await najdiOsireleUcty(container)
  const nalezy = email ? vsechny.filter((u) => u.email === email) : vsechny

  if (!nalezy.length) {
    logger.info(
      email
        ? `[osiřelé účty] u ${email} je všechno v pořádku.`
        : "[osiřelé účty] nic k řešení — každé přihlášení má svého zákazníka."
    )
    return
  }

  logger.info(`[osiřelé účty] nálezů: ${nalezy.length}`)
  for (const u of nalezy) {
    const co =
      u.stav === "mekce-smazany"
        ? "zákazník je MĚKCE SMAZANÝ → --oprava=obnovit (vrátí i adresy a objednávky)"
        : u.stav === "jiny-zakaznik"
          ? `pod stejným e-mailem je jiný zákazník ${u.nahradniId} → --oprava=prepojit`
          : "zákazník v databázi NENÍ → --oprava=uvolnit (e-mail se uvolní, heslo zanikne)"

    logger.info(`  ${u.email}  (${u.identityId} → ${u.customerId})`)
    logger.info(`    ${co}`)
  }

  if (!oprava) {
    logger.info("[osiřelé účty] nic jsem nezměnil. Opravu vyberte přes --oprava=…")
    return
  }

  if (!["obnovit", "prepojit", "uvolnit"].includes(oprava)) {
    logger.error(`[osiřelé účty] neznámá oprava „${oprava}". Volby: obnovit | prepojit | uvolnit`)
    return
  }

  /* Hromadná oprava jen s výslovným e-mailem. Projet jedním příkazem všechny
     nálezy a všem udělat totéž je přesně ten krok, po kterém se u jednoho
     z nich zjistí, že se měl řešit jinak. */
  if (!email) {
    logger.error("[osiřelé účty] opravovat jde po jednom — doplňte --email=…")
    return
  }

  for (const u of nalezy) {
    logger.info(`[osiřelé účty] ${await spravUcet(container, u.identityId, oprava as Oprava)}`)
  }
}
