# Úprava objednávky — plán (11. 10. 2026)

Stav: NÁVRH k rozhodnutí. Nic z toho není postavené.

## 1. Jak to funguje dnes (změřeno v kódu)

- **Kde:** stránka objednávky z e-mailu (token) i z účtu → `OrderEdit`
  (`storefront/src/modules/order/components/order-edit/index.tsx`), server
  `POST /store/orders/:id/guest-edit` + `lib/order-edit-rules.ts`,
  režim `lib/order-edit-gate.ts`.
- **Režimy podle fáze:** `full` (Nové / Připravujeme) → výměna varianty,
  odebrání, doplnění; `swap_only` (K odeslání, zabaleno) → jen výměna
  varianty za **stejnou cenu**; `none` (existuje zásilka / štítek, zrušeno)
  → po telefonu.
- **Pravidla:** zakázkový řádek zamčený; objednávka nesmí zůstat prázdná
  (úprava ≠ zrušení); jedna rozpracovaná změna najednou (`pending_change`).
- **Peníze:** karta + dráž = zaplatit rozdíl ComGate PŘED potvrzením;
  karta + levněji = potvrdit a založit „Vrátit rozdíl" (klikne Lucie);
  odběr / dobírka = potvrdit hned, vyrovná se při předání.
- **Doručení:** vlastní sekce (změna výdejny / adresy) — hotovo.
- **Mezery:** UI umí jen *výměnu varianty* a *odebrání* — **doplnění ani
  změna množství v UI není**, přestože server `add` zná. Řádek je jeden
  dropdown; rozdíl ceny je až dole; „Vrátit rozdíl" obchází modul
  reklamací (bez dobropisu).

## 2. Navržená pravidla (co dává smysl pro keramiku)

| Pravidlo | Návrh | Proč |
|---|---|---|
| Prázdná objednávka | **Nikdy.** Poslední kus odebrat nejde; zrušení jen přes Reklamace a zrušení. | Zrušení má vlastní proces (odstoupení, dobropis). |
| Zakázka | Zamčená, odkaz na chat zakázky. | Doplatek, záloha, výroba — nejde to spočítat automaticky. |
| Poškozený kus / unikát (`clearance_*`, 1 ks skladem) | Nejde vyměnit ani přidat jako cíl výměny. | Každý kus je jeden. |
| Balíček | Zamčený jako celek (komponenty se nemění). | Cena balíčku ≠ součet komponent. |
| Množství | **Nové:** +/− u řádku (min 1, max sklad). | Nejčastější reálná změna („ještě jeden hrnek"). |
| Doplnění | **Nové v UI:** přidat kus ze stejné kolekce / „K tomu se hodí", jen skladem. | Server to už umí; zvýší košík místo druhé objednávky. |
| Výměna | Varianta stejného produktu (dnes) + **jiný produkt ve stejné ceně** ze stejné kategorie (volitelně, fáze 2). | Barva/velikost; „místo misky talíř za stejné peníze". |
| Po zabalení | Jen výměna za stejnou cenu (dnes). | Lucie přebalí, peníze se nehnou. |
| Po štítku / předání | Nic. | Dobírka a adresa už jsou u ČP. |
| Karta + dráž | Zaplatit rozdíl hned (dnes). | |
| Karta + levněji | **Změna:** rozdíl jde přes modul reklamací → refundace + dobropis (ne tlačítko „Vrátit rozdíl"). | §45 ZDPH / účetnictví; sjednotit cestu peněz. |
| Dobírka | Rozdíl se promítne do částky dobírky; po štítku zamčeno (dnes). | Částka se razítkuje při podání. |
| Limit | Max 1 rozpracovaná změna (dnes); **nové:** max 3 potvrzené úpravy na objednávku, pak „ozvěte se". | Ochrana před nekonečným překlápěním. |

## 3. UI (storefront)

Místo dropdownu v řádku **samostatná stránka „Upravit objednávku"** (stejný
vzor jako celá stránka reklamace):

1. **Stavová lišta nahoře:** „Upravit můžete, dokud nezačneme balit" /
   „Zabaleno — jen výměna za stejnou cenu" / „Předáno dopravci — po telefonu".
2. **Položky** (tabulka, na mobilu karty): náhled, název, varianta jako chip,
   **stepper množství**, cena; akce *Vyměnit* (bottom-sheet s dlaždicemi
   variant a rozdílem ceny u každé) a *Odebrat* (u posledního kusu vypnuté
   s vysvětlením). Zamčené řádky šedé + důvod + odkaz „Napište nám".
3. **Přidat k objednávce:** 4–6 dlaždic ze stejné kolekce (skladem), vyhledání.
4. **Doručení:** stávající sekce.
5. **Souhrn změn** (sticky dole): původní → nová cena, rozdíl, jedna věta co
   se stane s penězi podle platby, jedno tlačítko „Uložit změny" /
   „Zaplatit rozdíl 240 Kč". Po uložení potvrzení + e-mail (existuje).

## 3b. Doplnění po konzultaci (Matěj, 11. 10. 2026)

**Rozhodnutí:** dokud Lucie neoznačí objednávku „připravena k odeslání"
(fáze K odeslání), může si zákazník **přidat cokoli z obchodu a odebrat
cokoli**, jen nesmí objednávku vyprázdnit. K tomu **mini obchod** uvnitř
úpravy: mini výpis produktů + mini stránka produktu, kde místo „Do košíku"
je „Přidat k objednávce #39".

**Zhodnocení:** dává smysl, mění to jen bod „Doplnění" z §2 (ne jen stejná
kolekce, ale celý katalog). Zbytek pravidel platí dál. Co to s sebou nese:

| Téma | Návrh |
|---|---|
| Mini obchod = stávající komponenty | Nestavět druhý obchod. Výpis (`modules/store/Shop`) a stránka produktu (`modules/products/ProductPage`) dostanou „režim výběru": skryjí košík, tlačítko hlásí „Přidat k objednávce", výběr varianty a množství zůstává. Vlastní cesta `/order/:id/edit/pridat` (s tokenem), ne modal — kvůli mobilu a tlačítku Zpět. Vyhledávání + kategorie stačí, bez filtrů. |
| Co se v mini obchodě NEnabízí | Zakázka (záloha, brief, výroba — nejde přes úpravu), poškozené/unikátní kusy jen 1 ks (pokud už je v jiné objednávce), balíčky (fáze 2), vyprodané bez backorderu (stejná pravidla jako obchod). |
| Objednávka na dobírku | Přidat jde jen produkt s povolenou dobírkou (jinak by celá objednávka ztratila nárok). Částka dobírky se přepočítá; po štítku zamčeno (dnes). |
| Poštovné | Přepočítat podle stejného pravidla jako pokladna (doprava zdarma od 1 000 Kč na výdejnu): přidáním přes hranici zlevní, odebráním pod hranici se doúčtuje. Souhrn to řekne nahlas. **Rozhodnout:** přepočítávat, nebo zmrazit původní poštovné. |
| Slevový kód | Přidaný kus za aktuální cenu; sleva z kódu se na něj uplatní jen pokud kód platí (Medusa úpravy objednávky slevy na nové řádky automaticky nedávají — ověřit, jinak říct „na doplněné kusy se kód nevztahuje"). |
| Objednávka se zakázkou (smíšená) | Běžné kusy přidat jde, doplatí kartou hned; zakázkový řádek zůstává zamčený. Čistá zakázka se zálohou: fáze 2 (kolekce doplatku). |
| Po „připravena k odeslání" | Jako dosud: jen výměna za stejnou cenu, Lucie přebalí. Po štítku nic. |
| Výměna varianty | Zůstává jako zkratka (odebrat + přidat by bylo totéž, ale pro zabalenou fázi je výměna jediná povolená akce). |

Odhad navíc proti §4: +1 den na režim výběru v obchodě a stránce produktu.

## 4. Kroky implementace

1. Pravidla: `order-edit-rules.ts` — akce `set_quantity`, zámky
   (clearance, balíček), limit úprav; testy.
2. Server: `guest-edit` + `edit` — `set_quantity`, nabídka „přidat"
   (kolekce, skladem), `refund_due` → založit žádost v modulu reklamací.
3. Storefront: nová stránka `/order/:id/edit` (token i účet), komponenty
   položky / sheet výměny / přidat / souhrn; staré inline UI odstranit.
4. Admin: Objednávky+ ukazuje „Zákazník upravil" + rozdíl (ověřit, co už je).
5. Test: karta dráž, karta levněji (dobropis), dobírka, odběr, zabaleno.

Odhad: 2 dny práce agentů + den testů.
