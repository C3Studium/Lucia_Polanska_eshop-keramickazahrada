# Sprint 2026-08-14 — stav a rozhodnutí

Master seznam před produkcí žije v kořenovém **`FINISHINGTODOLIST.md`**.
Env vary se řeší přímo v Railway (nastavené), ne tady.

## Postup sprintu (dvě fáze)

1. **Kontrola**: dva modely projedou celý backend a celý storefront —
   `check-backend.md` a `check-storefront.md` (read-only, výstup =
   `report-backend.md` / `report-storefront.md`).
2. **Implementace**: z reportů vzniknou 4 nové prompty pro 4 paralelní modely.
   Cíl: obě strany hotové tak, že zbývá jen vložit API přístupy
   (Balíkovna nAPI + iDoklad) do Railway vars.

Soubory `model-1` … `model-4` z první verze plánu zůstávají jako podklad —
implementační prompty z nich budu čerpat, ale platí až jejich nová verze.

## Rozhodnutí (2026-08-14, Matěj)

1. **Packeta**: zůstává v kódu (opravená), ale NENABÍZÍ se — žádná shipping
   option, dokud klientka nerozhodne.
2. **DPH**: Lucia NENÍ plátce. Všechny texty, checkout i budoucí faktury bez
   DPH (ceny jsou konečné; nikde nesmí zůstat „vč. DPH" / „je plátcem DPH").
3. **Doprava a platba**: stránka generuje blok ze skutečných shipping options
   a jejich aktuálních cen + ke každé možnosti rozsah ceny balení
   (min–max napříč produkty; cena balení per produkt je v DB).
4. **Kurzy**: rezervace pouze poptávkou — na stránku kurzů přijde formulář ve
   stylu webu: jméno, telefon, e-mail, zpráva.
5. **Číslo účtu**: nevyřešeno → hlídá `FINISHINGTODOLIST.md` §3.
6. **iDoklad**: staví se celý, ale až jako POSLEDNÍ změna před launchem
   (přístupy máme) → `FINISHINGTODOLIST.md` §1. Není součástí 4 prompty.

## Domněnky k ověření kontrolními modely (Matěj věří, že hotovo)

- [ ] Osobní odběr: `pp_osobni-odber_pickup` v CZ regionu + shipping option
      0 Kč existuje a funguje
- [ ] Demo produkty (shirts/sweatshirts/pants/merch) smazané z DB
- [ ] „European Warehouse" seed lokace smazaná/deaktivovaná
- [ ] Nativní stránky adminu skryté (viditelné jen Settings) — workbenche je
      plně nahrazují
- [ ] Shipping option `so_01K2JNAER4GEGP0R011HC37PWS` přesměrovaná na provider
      `ceska-posta-fulfillment_balikovna`
