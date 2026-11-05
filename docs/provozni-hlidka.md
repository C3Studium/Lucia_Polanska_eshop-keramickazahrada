# Provozní hlídka a deník

Zavedeno 3. 11. 2026. Odpovídá na dvě otázky, které se do té doby nedaly
zjistit jinak než pohledem do logu na Railway: **proběhlo všechno, co mělo?**
a **co přesně se pokazilo?**

## 0. Proč

Obchod dělá velkou část práce na pozadí: platbu zachytí notifikační URL brány,
fakturu vystaví subscriber, zásilku podá úloha, e-mail odešle poskytovatel.
Když něco z toho tiše vynechá, **nepřijde žádná chyba — jen se něco nestane**.

Objednávka #68 je ten případ. Záloha dorazila, doklad nevznikl, v metadatech
nebylo ani chybové hlášení, a zjistilo se to až za týden. Mezi „funguje" a
„nefunguje" je ticho, a ticho se nedá sledovat.

Dvě věci z toho plynou pro celý návrh:

1. **Zapisuje se úspěch, ne jen selhání.** Den, kdy se nezachytila ani jedna
   platba, žádnou chybu nevyrobí — a přesto je špatně. Na „proběhlo něco?"
   odpoví jen záznam, který vznikne i tehdy, když je všechno v pořádku.
2. **Kontroluje se výsledek, ne dostupnost služby.** Odpověď brány nic neříká
   o tom, že platba doputovala k objednávce: notifikační URL ComGate byla
   nenastavená třikrát a brána přitom odpovídala pokaždé.

## 1. Co kam chodí

| Kdy | Co | Komu |
| --- | --- | --- |
| Hned | Zvonek v administraci ke každé chybě | administrace |
| Každé 4 h (1, 5, 9, 13, 17 h v zimě), **jen když se něco pokazilo** | Souhrn chyb: každá věc jednou, s počtem opakování a podrobnostmi | `dev_notification_email` |
| 21:00 (20:00 UTC) | Provozní souhrn: co se pokazilo od minulého souhrnu + co se stalo + co je zkontrolované | `dev_notification_email` |
| Kdykoli | Stránka **Přehled → Provoz** | administrace |

**Od 4. 11. 2026 nechodí vývojáři žádný e-mail hned.** 3. 11. jich odešlo 42
a vyčerpaly denní limit Resendu (100), který sdílí i potvrzení objednávek.
Každý `notifyMerchant` s `audience: "dev"` proto vytvoří zvonek a e-mail jen
zařadí do fronty (`lib/provozni-hlidka/fronta.ts`, řádky `alarm:ve-fronte`
v deníku). Úloha `send-provozni-alarmy` je každé 4 hodiny pošle jedním
e-mailem; ve 21:00 je vezme s sebou večerní souhrn. Nejvýš tedy šest
vývojářských e-mailů za den. Hned odchází jen to, co má `souhrn: true`
(samotné souhrny a zkušební skript). Když se zařazení do fronty nepovede,
e-mail odejde hned — ztracená chyba je horší než e-mail navíc.

Všechno jde na **vývojářskou** adresu, ne majitelce: rozbitá fakturace ani
vyčerpaný limit e-mailů nejsou práce pro keramičku. Její obchodní souhrn
v 7:05 (`jobs/send-daily-summary.ts`) zůstává beze změny.

Bez nastavené adresy (ani `dev_notification_email` v Nastavení, ani env
`DEV_NOTIFICATION_EMAIL`) se **jen zaloguje a nic neodejde** — podle pravidla
D7 „nikdy nespadnout kvůli chybějící konfiguraci".

## 2. Deník — co se zapisuje

Modul `src/modules/activity-log`, jeden řádek za akci. Sbírá se na čtyřech
místech, schválně ne v jednotlivých funkcích:

| Zdroj | Co vidí |
| --- | --- |
| `lib/provozni-hlidka/sber.ts` (middleware na `/admin/*`, `/store/*`, `/hooks/*`) | Každou změnu a každý spadlý požadavek |
| `subscribers/provoz-events.ts` | Doménové události (platba zachycena, objednávka přijata, zásilka podána…) |
| `lib/provozni-hlidka/uloha.ts` (obal všech 28 úloh) | Že úloha proběhla, nebo spadla — s textem výjimky |
| `api/hooks/provoz/route.ts` + `storefront/src/instrumentation.ts` | Chyby webu |

**Proč jedno místo, a ne zápis v každé funkci:** funkcí jsou stovky, nová by
zápis neměla a za měsíc by deník lhal tím, co v něm NENÍ. Každá akce ale
prochází jedním HTTP požadavkem — uložení produktu, přesun, schválení
reklamace, přihlášení, dokončení košíku. Nová funkce je proto v deníku ode dne,
kdy vznikne, aniž by si na to kdokoli vzpomněl.

### Co se nezapisuje, a to schválně

- **Hesla, tokeny a platební údaje ne.** Těla požadavků se ukládají, ale
  přečištěná (`lib/provozni-hlidka/redakce.ts`): bez těla se u spadlé akce
  dohledává naslepo — „POST /admin/products selhalo 422" neřekne, které pole
  bylo špatně. Čistí se dvakrát: podle názvu pole (`password`, `token`, `cvv`,
  `card`, `signature`…) a podle **tvaru hodnoty**, takže JWT nebo číslo karty
  se skryje i v poli, které se jmenuje nevinně. Tak totiž tajemství uniká:
  nese ho pole, na které si seznam nevzpomněl.
- **Jména a e-maily uživatelů administrace ne.** U `actor` je jen `user:<id>`.
- **Čtení (GET) ne, dokud neselže 5xx.** 401 a 404 na čtení je běžný provoz
  prohlížeče (vypršelá relace, zahozená záložka), ne porucha. Bez tohohle
  pravidla by devět desetin deníku bylo prohlížení administrace.

Identifikátory v cestě se nahrazují `:id`, aby se dalo počítat „kolikrát dnes
se ukládal produkt" — bez toho má každý produkt vlastní akci a souhrn je
seznam náhodných řetězců.

Deník si drží **30 dní**; úklid jede na konci denního souhrnu. Je to pozorovací
záznam, ne doklad.

## 3. Kontroly

`lib/provozni-hlidka/kontroly.ts`, běh každých 15 minut
(`jobs/watch-provoz.ts`). Každá se ptá na výsledek a všechny jsou jen čtení —
hlídka nikdy nic nespravuje sama.

| Kontrola | Co hledá | Proč právě to |
| --- | --- | --- |
| Databáze a dotazy | Odpovídá dotazová vrstva | Bez ní nic z ostatního neplatí |
| Obchod (web) | `/api/healthcheck` | Spadlý web se jinak pozná tím, že někdo zavolá |
| Platby | Autorizováno a přes 2 h nezachyceno | Podpis nenastavené notifikační URL ComGate (3× se stalo) |
| Faktury v iDokladu | Zaplaceno bez dokladu (30 min), nebo `idoklad_invoice_error` | Přesně #68 |
| E-maily zákazníkům | Nezdařené za 24 h | Zákazník ani obchod to sami nepoznají |
| Denní limit e-mailů | Spotřebováno z 100/den, hlásí na 80 % | Nad limitem Resend odmítá a neodejde ani potvrzení objednávky |
| Odeslání zásilek | Zaplaceno a 2 dny neodesláno | Zapomenutá zásilka |
| Skladové úrovně | Položka bez úrovně | Prodej takové varianty padal na 404 při dokončení košíku |
| Provozní deník | Zapsal se za 24 h aspoň jeden řádek | Hlídka bez deníku tvrdí „nic neselhalo", i kdyby nic nejelo |

Výjimka z jedné kontroly je taky nález (`spustKontroly` ji zabalí do `chyba`
s textem výjimky): jedna rozbitá kontrola nesmí zhasnout ostatní.

Stav `nenastaveno` **není chyba** — hlídka nemá budit kvůli tomu, že v prostředí
něco není vyplněné. Do souhrnu to patří, do alarmu ne; jinak se lidé naučí
alarmy ignorovat.

## 4. Kdy alarm přijde a kdy ne

**Každá nová chyba je v souhrnu zvlášť.** Klíč alarmu nese *podpis konkrétní
chyby* — akci, důvod a čeho se to týká (`alarm.ts`, `podpisChyby`). Když
ráno selže faktura u #68 a odpoledne u #71, jsou to dva klíče a dva řádky
souhrnu (a dva zvonky).

První verze měla v klíči jen kontrolu a den, a tím **druhou chybu spolkla**;
byla to právě ta, o které se nevědělo. Na tomhle se neustupuje.

**Tatáž chyba je jeden řádek s počtem.** Opakování téhož nálezu se v souhrnu
sloučí („×16, poprvé 9:15, naposledy 12:45"): dvacáté hlášení o jedné
rozbité věci není informace, ale že trvá, informace je. V podpisu se
zahazují jen čísla o čtyřech a víc číslicích (trvání v ms, časová razítka);
**stavové kódy se nechávají**, protože 500 od brány je jiná porucha než 401.
Dřív se zahazovala všechna čísla a obě chyby se slily — přišel na to test.

**Okno začíná koncem minulého souhrnu**, ne podle hodin (značka
`alarm:souhrn-odeslan` nese `detail.do`). Když úloha jednou nepoběží
(nasazení, restart), další souhrn pokryje i zmeškanou dobu. Bez vývojářské
adresy se okno neuzavírá a chyby počkají (nejvýš týden zpátky). Souhrn
vypíše celých prvních 25 věcí, zbytek jen názvem; dřívější denní strop 40
alarmů odpadl, protože vývojářských e-mailů je nejvýš šest za den.

**V předmětu alarmu je cizí služba**, je-li ve hře: „Nefunguje: Platby —
ComGate". Rozdíl mezi ComGate a Českou poštou je rozdíl mezi dvěma úplně
jinými odpoledni (`sluzba.ts`); v souhrnu je to název řádku.

## 5. Co hlídka nepozná

- **Tiché selhání uvnitř úlohy**, která skončí bez výjimky, ale nic neudělá.
  Na to jsou kontroly výsledku — obal úlohy odpovídá jen na „proběhla?".
- **Chyby v prohlížeči zákazníka** (JS na klientu). Hlásí se jen serverové
  chyby požadavků z `onRequestError`.
- **Jestli je výsledek správný.** Hlídka pozná, že faktura vznikla, ne že je
  na ní správná částka.

## 6. Prostředí

| Proměnná | Služba | Bez ní |
| --- | --- | --- |
| `dev_notification_email` (Nastavení) nebo `DEV_NOTIFICATION_EMAIL` | backend | Nic neodejde, jen se loguje |
| `ADMIN_BRIDGE_SECRET` | **obě** | Chyby webu se nehlásí (příjem odmítá vše) |
| `MEDUSA_BACKEND_URL` | obchod | Chyby webu se nehlásí |
| `STOREFRONT_PUBLIC_URL` / `MEDUSA_STOREFRONT_URL` | backend | Kontrola webu je `nenastaveno` |
