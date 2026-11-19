/**
 * Návod pro zákazníky (19. 11. 2026) — texty k otazníkům „?" v obchodě.
 * GIFy ke klíčům nahrává tools/navod (oblast „store"), backend je vydává
 * na /store/navod/klipy. Chybějící GIF nevadí — zůstane text a kroky.
 *
 * Píše se zákazníkovi: krátce, vlídně, tlačítka přesně podle webu.
 */

export type NavodObchodTema = {
  klic: string
  nazev: string
  proc: string
  kroky: string[]
  klipy: { klic: string; popis: string }[]
}

export const NAVOD_OBCHOD: NavodObchodTema[] = [
  {
    klic: "obchod.ucet",
    nazev: "Účet — registrace a přihlášení",
    proc:
      "Účet není nutný — nakoupit jde i bez něj. S účtem ale uvidíte své objednávky, uložené adresy, oblíbené kousky a kurzy na jednom místě.",
    klipy: [{ klic: "obchod.registrace", popis: "Založit účet" }],
    kroky: [
      "Vpravo nahoře klikněte na ikonu postavičky.",
      "Nemáte účet? Klikněte na „Založte si účet“ a vyplňte jméno, e-mail a heslo.",
      "Potvrďte e-mail odkazem, který vám přijde.",
      "Příště se jen přihlásíte e-mailem a heslem.",
    ],
  },
  {
    klic: "obchod.heslo",
    nazev: "Zapomenuté heslo",
    proc: "Na e-mail vám pošleme odkaz pro nastavení nového hesla. Odkaz platí 15 minut.",
    klipy: [{ klic: "obchod.heslo", popis: "Obnovit heslo" }],
    kroky: [
      "U přihlášení klikněte na „Zapomněli jste heslo?“.",
      "Napište e-mail, se kterým jste se registrovali.",
      "Otevřete odkaz z e-mailu a nastavte nové heslo.",
    ],
  },
  {
    klic: "obchod.adresy",
    nazev: "Uložené adresy",
    proc: "Adresu si uložíte jednou a v pokladně ji pak jen vyberete.",
    klipy: [{ klic: "obchod.adresy", popis: "Přidat adresu" }],
    kroky: [
      "Účet → „Adresy“ → „Přidat adresu“.",
      "Vyplňte a uložte. Výchozí adresa se v pokladně předvyplní sama.",
    ],
  },
  {
    klic: "obchod.objednavky",
    nazev: "Moje objednávky",
    proc:
      "Kde je objednávka, co obsahuje a co s ní jde ještě udělat (upravit, zrušit, reklamovat). Odkaz na objednávku najdete i v každém e-mailu — funguje bez přihlášení.",
    klipy: [{ klic: "obchod.objednavky", popis: "Seznam a detail objednávky" }],
    kroky: [
      "Účet → „Objednávky“ → klik na objednávku.",
      "V detailu je stav, položky, doprava a tlačítka pro další kroky.",
    ],
  },
  {
    klic: "obchod.uprava",
    nazev: "Změnit objednávku",
    proc:
      "Doručovací adresu nebo výdejní místo změníte sami, dokud zásilku nepřipravíme k odeslání. Jiné zboží, jiné provedení nebo kus navíc domluvíme osobně — napíšete, co potřebujete, a ozvu se.",
    klipy: [{ klic: "obchod.uprava", popis: "Změnit adresu, domluvit změnu zboží" }],
    kroky: [
      "Otevřete objednávku odkazem „Upravit objednávku“ z potvrzovacího e-mailu (nebo z účtu).",
      "„Změnit adresu“ — opravíte doručovací adresu nebo výdejnu.",
      "Změna zboží: „Potřebuji změnit objednávku“ — napište, co chcete změnit.",
      "Zrušit celou objednávku jde přes „Reklamace a zrušení“.",
    ],
  },
  {
    klic: "obchod.reklamace",
    nazev: "Reklamace a vrácení",
    proc:
      "Když kousek dorazí poškozený nebo s vadou, napište nám přes formulář u objednávky. Přiložte fotky — vyřídíme to co nejdřív (nejpozději do 30 dní). Každý krok vám přijde e-mailem.",
    klipy: [{ klic: "obchod.reklamace", popis: "Podat reklamaci" }],
    kroky: [
      "Otevřete objednávku → „Reklamace“.",
      "Vyberte, co reklamujete, popište vadu a přiložte fotky.",
      "Vyberte, co chcete (vrácení peněz nebo výměnu) a odešlete.",
    ],
  },
  {
    klic: "obchod.odstoupeni",
    nazev: "Odstoupení od smlouvy (14 dní)",
    proc:
      "Běžné zboží můžete do 14 dnů od převzetí vrátit bez udání důvodu. Neplatí pro zakázky vyrobené na míru. Peníze vrátíme po převzetí zboží zpět.",
    klipy: [{ klic: "obchod.odstoupeni", popis: "Odstoupit online" }],
    kroky: [
      "Otevřete objednávku → „Odstoupit od smlouvy“.",
      "Vyberte kusy, které vracíte, a odešlete formulář.",
      "Zboží pošlete zpět na adresu z e-mailu.",
    ],
  },
  {
    klic: "obchod.doprava",
    nazev: "Doprava — na adresu, Balíkovna, osobně",
    proc:
      "Česká pošta na adresu, do Balíkovny (vyberete si výdejnu na mapě), nebo si kousek vyzvednete osobně v ateliéru v Putimi. Cena dopravy se počítá podle velikosti a křehkosti zásilky.",
    klipy: [{ klic: "obchod.doprava", popis: "Vybrat dopravu a výdejnu" }],
    kroky: [
      "V pokladně v kroku „Doprava“ vyberte způsob.",
      "U Balíkovny klikněte na „Vybrat výdejnu“ a najděte ji podle města nebo PSČ.",
      "Osobní odběr: ozveme se, až bude objednávka připravená.",
    ],
  },
  {
    klic: "obchod.platba",
    nazev: "Platba",
    proc:
      "Kartou nebo bankou online (ComGate), Apple Pay / Google Pay, dobírkou (jen na adresu), nebo při osobním odběru. Platba kartou je zabezpečená bankou — údaje karty k nám nechodí.",
    klipy: [{ klic: "obchod.platba", popis: "Vybrat platbu a zaplatit" }],
    kroky: [
      "V pokladně v kroku „Platba“ vyberte způsob.",
      "„Zaplatit“ vás přesměruje na platební bránu; po zaplacení se vrátíte zpět.",
      "Když platba neprojde, objednávka zůstane — zaplatit jde znovu odkazem z e-mailu.",
    ],
  },
  {
    klic: "obchod.zakazka",
    nazev: "Výrobek na zakázku — zadání",
    proc:
      "Kousek vyrobím až pro vás. V pokladně napíšete, co přesně chcete (barvy, rozměry, text) a můžete přiložit fotky. Platí se záloha, zbytek před odesláním. Zadání vám potvrdím e-mailem.",
    klipy: [{ klic: "obchod.zakazka", popis: "Napsat zadání zakázky" }],
    kroky: [
      "V pokladně u výrobku na zakázku vyplňte zadání — bez něj nejde pokračovat.",
      "Přiložte fotky (místo, inspirace…), pokud pomohou.",
      "Zaplaťte zálohu; o průběhu výroby vám budu psát.",
    ],
  },
  {
    klic: "obchod.poukaz",
    nazev: "Dárkový poukaz",
    proc:
      "Poukaz si nastavíte v košíku: hodnotu, jestli má být vytištěný (pošleme poštou) nebo elektronický (přijde e-mailem), a komu je určen.",
    klipy: [{ klic: "obchod.poukaz", popis: "Nastavit poukaz v košíku" }],
    kroky: [
      "Přidejte poukaz do košíku.",
      "V košíku pod souhrnem vyberte hodnotu a podobu poukazu, případně jméno obdarovaného a věnování.",
      "Pokračujte do pokladny.",
    ],
  },
  {
    klic: "obchod.kurz",
    nazev: "Rezervace kurzu",
    proc:
      "Vyberete termín, počet osob (dospělí, děti) a zaplatíte online nebo na místě. Změnit počet osob nebo termín jde později z odkazu v e-mailu.",
    klipy: [{ klic: "obchod.kurz", popis: "Rezervovat místo" }],
    kroky: [
      "Kurzy → vyberte termín → „Rezervovat“.",
      "Vyplňte počet osob a kontakt.",
      "Zaplaťte online, nebo zvolte platbu na místě.",
    ],
  },
]

export const temaObchodu = (klic: string) => NAVOD_OBCHOD.find((t) => t.klic === klic)
