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
