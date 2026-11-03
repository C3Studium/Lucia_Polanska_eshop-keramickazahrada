import type { VysledekKontroly } from "./typy"

/**
 * Texty hlídky — čisté skládání, bez containeru (3. 11. 2026).
 *
 * Oddělené od kontrol schválně: na obsahu alarmu záleží nejvíc a zároveň
 * se nejhůř zkouší naživo. Tady se dá na jedné větě ověřit, že alarm nese
 * čísla objednávek a text výjimky, a že souhrn nikdy netvrdí „vše funguje"
 * nad rozbitou kontrolou.
 */

/**
 * Den v Praze jako `YYYY-MM-DD`. Švédský formát proto, že `sv-SE` dává
 * přesně ISO tvar — a den musí být pražský, jinak by se alarm po
 * jedenácté v noci duploval do dalšího dne.
 */
export const denPrahy = (kdy: Date): string =>
  kdy.toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" })

const casPrahy = (kdy: Date): string =>
  kdy.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

/**
 * Klíč alarmu nese den, takže jedna rozbitá věc píše JEDNOU DENNĚ, ne
 * každých patnáct minut. Resend dává 100 e-mailů denně — hlídka, která
 * při jedné chybě pošle 96 e-mailů, vyčerpá limit a obchod pak nemůže
 * napsat zákazníkovi.
 */
export const klicAlarmu = (klic: string, kdy: Date): string =>
  `mn:hlidka-${klic}:${denPrahy(kdy)}`

/** Souhrn chodí jednou za den — klíč to drží i přes restart služby. */
export const klicSouhrnu = (kdy: Date): string =>
  `mn:hlidkasouhrn:${denPrahy(kdy)}`

export const rozdel = (vysledky: VysledekKontroly[]) => ({
  chyby: vysledky.filter((v) => v.stav === "chyba"),
  nenastaveno: vysledky.filter((v) => v.stav === "nenastaveno"),
  vporadku: vysledky.filter((v) => v.stav === "ok"),
})

/** „1 věc nefunguje" · „2 věci nefungují" · „5 věcí nefunguje". */
export const vecNefunguje = (pocet: number): string => {
  if (pocet === 1) return "1 věc nefunguje"
  if (pocet >= 2 && pocet <= 4) return `${pocet} věci nefungují`
  return `${pocet} věcí nefunguje`
}

const DO_CHATU =
  "Tenhle e-mail můžete celý vložit do chatu s Claudem — jsou v něm " +
  "všechna čísla, podle kterých se to dá dohledat."

export const predmetAlarmu = (vysledek: VysledekKontroly): string =>
  `Nefunguje: ${vysledek.nazev}`

/**
 * Alarm nese tři věci: co se kontrolovalo, co je špatně a přesné
 * podrobnosti. Nikdy neodkazuje „podívejte se do logu serveru" — k logu
 * se od telefonu nikdo nedostane, a právě tehdy alarm přijde.
 */
export const textAlarmu = (vysledek: VysledekKontroly, kdy: Date): string => {
  const radky = [
    `Kontrola: ${vysledek.nazev}`,
    `Kdy: ${casPrahy(kdy)}`,
    "",
    "Co je špatně:",
    vysledek.zprava,
  ]

  if (vysledek.detail?.length) {
    radky.push("", "Podrobnosti:")
    for (const polozka of vysledek.detail) {
      radky.push(`· ${polozka}`)
    }
  }

  radky.push(
    "",
    "Dokud to trvá, tenhle e-mail přijde jednou denně — ne každou čtvrthodinu.",
    DO_CHATU
  )

  return radky.join("\n")
}

export const predmetSouhrnu = (
  vysledky: VysledekKontroly[],
  kdy: Date
): string => {
  const { chyby } = rozdel(vysledky)
  const den = new Date(kdy).toLocaleDateString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
  return chyby.length
    ? `Provozní souhrn ${den} — ${vecNefunguje(chyby.length)}`
    : `Provozní souhrn ${den} — všechno funguje`
}

/**
 * Denní souhrn. Když něco nefunguje, řekne to i tady — souhrn, který
 * tvrdí „vše v pořádku" nad rozbitou fakturací, je horší než žádný,
 * protože učí člověka ho nečíst.
 */
export const textSouhrnu = (
  vysledky: VysledekKontroly[],
  kdy: Date
): string => {
  const { chyby, nenastaveno, vporadku } = rozdel(vysledky)
  const radky: string[] = []

  if (chyby.length) {
    radky.push(
      `Pozor: ${vecNefunguje(chyby.length)}. Podrobný e-mail ke každé ` +
        "z nich už odešel samostatně.",
      ""
    )
    for (const chyba of chyby) {
      radky.push(`✗ ${chyba.nazev} — ${chyba.zprava}`)
      for (const polozka of chyba.detail ?? []) {
        radky.push(`    · ${polozka}`)
      }
    }
    radky.push("")
  } else {
    radky.push("Dnes neselhalo nic. Co je zkontrolované:", "")
  }

  for (const ok of vporadku) {
    radky.push(`✓ ${ok.nazev} — ${ok.zprava}`)
  }

  if (nenastaveno.length) {
    radky.push("", "Nekontroluje se (chybí nastavení):")
    for (const polozka of nenastaveno) {
      radky.push(`– ${polozka.nazev} — ${polozka.zprava}`)
    }
  }

  radky.push(
    "",
    chyby.length
      ? DO_CHATU
      : "Kdyby něco selhalo, přijde e-mail hned — tenhle souhrn na to nečeká."
  )

  return radky.join("\n")
}
