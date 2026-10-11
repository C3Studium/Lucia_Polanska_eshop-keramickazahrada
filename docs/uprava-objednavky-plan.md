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

## 3c. Rozhodnuto (Matěj, 11. 10. 2026) — závazné pro implementaci

1. **Do „připravena k odeslání"** (merchant fáze `shipping`): přidat cokoli
   z obchodu, odebrat cokoli, měnit množství, vyměnit variantu. Objednávka
   nesmí zůstat prázdná. **Po** označení: jen výměna varianty za stejnou
   cenu. Po štítku / zásilce: nic.
2. **Mini obchod** uvnitř úpravy: cesta `/order/:id/edit/pridat` (+ token),
   stávající výpis a stránka produktu v režimu výběru („Přidat k objednávce
   #N"), hledání + kategorie. Nenabízí: zakázku, balíčky, poškozené/unikátní
   kusy, vyprodané bez backorderu; u dobírkové objednávky jen `cod_allowed`.
3. **Zamčené řádky:** zakázka (odkaz na chat), balíček, poškozený kus.
4. **Poštovné se přepočítává** stejným pravidlem jako pokladna (zdarma od
   1 000 Kč na výdejnu); souhrn to řekne.
5. **Slevový kód:** přidané řádky za aktuální cenu; pokud Medusa kód na nové
   řádky neuplatní, souhrn napíše „na doplněné kusy se kód nevztahuje".
6. **Peníze:** dráž → zaplatit rozdíl kartou před potvrzením (dnes);
   levněji → žádost v modulu Reklamace a zrušení (refundace + dobropis),
   tlačítko „Vrátit rozdíl" se ruší; dobírka a odběr → vyrovná se při
   předání, částka dobírky se přepočítá.
7. **Smíšená objednávka:** běžné kusy editovat/přidat jde, zakázkový řádek
   zamčený. Čistá zakázka se zálohou: úprava položek se nenabízí (fáze 2).
8. **Limit:** 1 rozpracovaná změna, max 3 potvrzené úpravy, pak „ozvěte se".
9. **UI:** samostatná stránka úpravy (vzor stránka reklamace): stavová lišta,
   položky se stepperem a výměnou v bottom-sheetu, sekce Přidat, Doručení,
   sticky souhrn s jedním tlačítkem. Staré inline UI odstranit.

### 3d. Doplněno (Matěj, 11. 10. 2026 odpoledne) — závazné

10. **Výměna za jiný výrobek** (ne jen variantu téhož): do „připravena
    k odeslání" za libovolný výrobek z mini obchodu (rozdíl ceny se vyrovná
    jako u jiných změn); po zabalení jen za výrobek ve **stejné ceně**.
    Počet kusů řádku zůstává. Platí stejné filtry jako pro přidání
    (zakázka, balíček, poškozený kus, vyprodané, dobírka jen `cod_allowed`).
11. **E-mail zákazníkovi „Objednávka upravena"** po každé uložené úpravě
    (hned, nebo po zaplacení rozdílu): nový obsah, bylo / nově, věta
    o penězích, odkaz na objednávku.

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

## 5. Rozhraní server ↔ storefront (implementace, 11. 10. 2026)

Všechno jede přes **podepsaný token objednávky** (`?token=` / `body.token`),
stejně jako dnes hostovská úprava. Přihlášený zákazník bez tokenu dostane
token z `GET /store/orders/:id/edit` (pole `access_token`, jen vlastníkovi) a
dál jede tokenovou cestou — jedna cesta pro hosta i účet.

### `GET /store/orders/:id/guest-edit?token=` → `OrderEditContext`

```ts
type OrderEditContext = {
  editable: boolean               // mode !== "none" && !limit_reached
  mode: "full" | "swap_only" | "none"
  swap_only: boolean              // = mode === "swap_only" (zpětná kompatibilita)
  reason: string | null           // proč nejde (none / limit / čistá zakázka)
  items_editable: boolean         // false u čisté zakázky (§3c.7)
  can_add: boolean                // mode === "full" && items_editable
  payment: "card" | "pickup" | "dobirka"
  currency_code: string
  order: { id: string; display_id: number; item_total: number;
           shipping_total: number; total: number }
  delivery: OrderDeliveryContext  // beze změny
  items: Array<{
    id: string; title: string; product_title: string | null
    variant_title: string | null; thumbnail: string | null
    product_id: string | null; product_handle: string | null
    variant_id: string | null
    quantity: number; unit_price: number; total: number
    lock: null | "made_to_order" | "bundle" | "clearance"
    lock_reason: string | null    // česká věta pro šedý řádek
    is_made_to_order: boolean     // zpětná kompatibilita
    max_quantity: number          // strop stepperu (sklad / 99)
    variants: Array<{ id: string; title: string | null;
                      price_czk: number | null; available: boolean }>
  }>
  pending_change: { id: string; awaiting_payment: boolean } | null
  edits: { confirmed: number; limit: number; remaining: number }
}
```

### `POST /store/orders/:id/guest-edit` body `{ token, actions, dry_run? }`

```ts
type EditAction =
  | { type: "swap"; item_id: string; variant_id: string }   // varianta téhož produktu
  | { type: "remove"; item_id: string }
  | { type: "set_quantity"; item_id: string; quantity: number } // 1–99
  | { type: "add"; variant_id: string; quantity: number }       // 1–20
// max 1 akce na řádek, max 30 akcí

type EditPreview = {
  item_total_before: number; item_total_after: number
  shipping_before: number;  shipping_after: number
  total_before: number;     total_after: number
  difference: number                       // total_after − total_before
  settlement: { kind: "none" | "collect" | "refund_due"; amount: number }
  money_sentence: string                   // co se stane s penězi, česky
  shipping_note: string | null             // „Poštovné 90 Kč → 0 Kč." / null
  promo_note: string | null                // „Slevový kód … se na doplněné kusy nevztahuje."
}
```

- `dry_run: true` → `{ status: "preview", preview }` — nic se neuloží
  (úprava se v Meduse založí, spočítá a hned zahodí). UI ho volá s debounce
  po každé změně; jen jeden požadavek najednou.
- jinak → `{ status: "awaiting_payment", preview, payment_url, message }`
  (karta + dráž) nebo `{ status: "confirmed", preview, message,
  claim_request_id: string | null }` (levněji na kartu → založená žádost).
- chyba pravidla = HTTP 400/403 s českou `message`.

### `DELETE /store/orders/:id/guest-edit?token=` — zruší čekající změnu.

### `GET /store/orders/:id/guest-edit/catalog?token=` → mini obchod

```ts
{ can_add: boolean; reason: string | null
  payment: "card" | "pickup" | "dobirka"
  allowed: Record<string /* product_id */, string[] /* variant_id */> }
```

Jen produkty a varianty, které jde přidat: bez zakázky (výrobní profil),
balíčků, poškozených kusů, vyprodaných bez backorderu; u dobírky jen
`cod_allowed`. Storefront si produkty načte běžným výpisem a ukáže jen ty
z `allowed` (server je soudce i při POST).

### Výměna za jiný výrobek (§3d.10)

- `POST … { type: "swap", item_id, variant_id }` — `variant_id` smí být
  i z jiného výrobku. Mode `full`: jakýkoli z nabídky výměny, rozdíl se
  vyrovná podle matice. Mode `swap_only`: server přijme jen rozdíl 0.
- `GET /store/orders/:id/guest-edit/catalog?token=&swap=<item_id>` → nabídka
  pro výměnu konkrétního řádku:

```ts
{ can_add: boolean             // jde teď vybírat (add i swap)
  reason: string | null
  payment: "card" | "pickup" | "dobirka"
  purpose: "add" | "swap"
  same_price_only: boolean     // swap po zabalení → jen stejná cena
  item: { id: string; title: string; quantity: number; unit_price: number } | null
  allowed: Record<string, string[]> }
```

  U výměny: bez vlastní varianty řádku, jen varianty skladem aspoň na počet
  kusů řádku; při `same_price_only` jen varianty s cenou = `item.unit_price`.
  Bez `swap` se chová jako dřív (`purpose: "add"`, v `swap_only` prázdné).

## Otevřené body (zjištěno při implementaci)

- **Doprava zdarma v pokladně dnes není nastavená.** Žádná doprava nemá
  cenové pravidlo `item_total` a není ani automatická sleva na dopravu
  (ověřeno přes admin API 11. 10.): Balíkovna 90 Kč, pošta na adresu 150 Kč
  vždy. Stránka Doprava a platba přitom slibuje zdarma od 1 000 Kč. Přepočet
  poštovného v úpravě používá stejná cenová pravidla jako pokladna, takže
  dnes poštovné zůstane stejné a začne se měnit, až Lucie pravidlo nastaví.
- **„Vrátit rozdíl" v Objednávky+** zapisuje i zrušení zakázky se zálohou
  (`made-to-order … actions`). Úprava objednávky ho už nepoužívá; tlačítko
  zůstává jen pro tyto starší případy.
- **E-mail zákazníkovi o úpravě** neexistuje (plán §3 to mylně tvrdil);
  zákazník vidí potvrzení na stránce. Není v kontraktu — k rozhodnutí.

### Storefront (11. 10. 2026)

- **Výměna + změna počtu na jednom řádku najednou nejde.** Kontrakt dovoluje
  1 akci na řádek, takže UI to nenabídne: s rozpracovanou výměnou je stepper
  řádku zamčený (s vysvětlením) a výměna nahradí rozpracovanou změnu počtu
  (sheet to předem řekne). Šlo by to složit jako `remove` + `add` nové
  varianty — to ale mění význam (add jen z `allowed`, cena a slevový kód
  jako nový řádek), proto ne bez rozhodnutí.
- **Přihlášený zákazník:** odkaz „Upravit objednávku" v účtu vede na
  `/order/:id/edit` bez tokenu; stránka si `access_token` vyzvedne
  (`GET …/edit`) a přesměruje na `?token=`. Token tím stojí v adrese stejně
  jako v odkazu z e-mailu (stránky úpravy mají `noindex`).
- **Mini obchod filtruje `allowed` na storefrontu po načtení celého
  katalogu** (`listStoreCatalogue` → `onlyProductIds`, dnes 3 dotazy po 100
  kusech, stejná cesta jako řazení podle ceny). Id se do query Medusy
  neposílají kvůli délce adresy. Při výrazně větším katalogu zvážit
  stránkování na serveru.
- **Cena přidaného kusu v seznamu „Přidat"** je snímek z chvíle výběru
  (jen popisek); Bylo / Bude / Rozdíl je vždy ze serveru (`dry_run`).
- **Sticky souhrn** potřebuje, aby stavová stránka (`OrderStateShell`)
  ořezávala přes `overflow: clip` místo `hidden` — změněno pro všechny
  stavové stránky (vizuálně beze změny). Prohlížeče bez `clip` (Safari < 16)
  souhrn jen nepřilepí.
- **Neověřeno živě** — backend v době psaní nebyl nasazený. Otestovat:
  token z e-mailu i z účtu, náhled po každé změně, karta dráž (přesměrování
  na platbu + panel čekající změny + zrušení), karta levněji (odkaz „Stav
  vrácení rozdílu"), dobírka (mini obchod jen `cod_allowed`), zabaleno
  (jen výměna za stejnou cenu), mini obchod → přidat → návrat se souhrnem.

### Backend (11. 10. 2026, při implementaci a živém testu)

- **Medusa po úpravě ruší autorizovanou platbu** (dobírka, osobní odběr) a
  zakládá novou nezaplacenou kolekci bez platby
  (`createOrUpdateOrderPaymentCollectionWorkflow`). Týkalo se i staré úpravy.
  Opraveno: `lib/order-edit/payments.ts` platbu „při převzetí" na novou
  kolekci znovu založí a autorizuje na nový součet (ověřeno, viz Ověřeno).
- **Metadata úpravy Medusa neukládá** (`beginOrderEditOrderWorkflow` bere jen
  `description` / `internal_note` / `created_by`). Stará značka v metadatech
  proto nikdy nefungovala: rozpracovaná úprava, počet úprav ani úklidový job
  `expire-customer-edits`. Značka je teď `description = „Úprava zákazníkem"`.
  Úpravy uložené před touto opravou (#32 v 12:11, #10 v 12:15) se do limitu
  nepočítají.
- **Doběrečné** se ukazovalo jako běžná položka (#39). Teď není mezi
  upravitelnými řádky; v součtech zůstává.
- **Detail fronty** `GET /admin/merchant-orders/:id` vrací `customer_edit:
  null` — značku „Zákazník upravil" nese seznam fronty (karta v
  Objednávky+), kde se zobrazuje. Detail ji nepotřebuje.
- **Smíšená objednávka se zakázkou + zlevnění**: Medusa by snížila doplatek
  zakázky a my bychom rozdíl zároveň vraceli. Doplatek se po úpravě vrací na
  původní částku a běžné kusy se vyrovnají hned. Živě neověřeno — žádná
  testovací smíšená objednávka v plné úpravě není.
- **Výměna za jinou cenu v režimu zabaleno** je odmítnutá kódem (rozdíl z
  náhledu), živě neověřeno — žádný testovací výrobek nemá varianty s různou
  cenou.

## Ověřeno (11. 10. 2026, živě proti produkčnímu backendu, testovací objednávky)

Přes `GET /admin/merchant-orders/:id/self-service` (token) a
`/store/orders/:id/guest-edit`. ComGate v testovacím režimu, iDoklad
agenda „TEST Firma", Česká pošta testovací prostředí.

| Scénář | Objednávka | Výsledek |
|---|---|---|
| Kontext stránky | #32 karta, #27 čistá zakázka, #39 po štítku, #10 odběr | správné režimy; čistá zakázka `items_editable: false` s důvodem; doběrečné skryté |
| Mini obchod | #32 | 262 výrobků; zakázka s profilem (Pán lesa Dub) vynechaná |
| Náhled (dry_run) | #32 | +2 ks = +60 Kč (doplatek kartou); odebrání pítek = −980 Kč (vrácení); ~0,6 s |
| Karta levněji | #32: tyčky 4 → 2 | uloženo, součet 1 190 → 1 130; žádost „uprava" 60 Kč (případ edit_refund, bez kroku na zboží); vrácení 60 Kč přes ComGate test (PAID), dobropis 20260016, žádost sama vyřízena |
| Karta dráž | #32: tyčky 2 → 3 | `awaiting_payment` + odkaz ComGate 30 Kč; stránka hlásí čekající úpravu; další úprava odmítnuta; zrušení smaže změnu i nezaplacenou kolekci 30 Kč |
| Osobní odběr | #10: 1 → 3 → 2 ks | uloženo bez platby; Medusa původní platbu zrušila, oprava založila novou autorizovanou (90, pak 60 Kč); počítadlo úprav 1/3 |
| Dobírka | #40 (nová testovací, Balíkovna pošta Praha 6): 2 → 4 ks | mini obchod jen 9 výrobků s dobírkou (bez poškozeného kusu); výrobek bez dobírky odmítnut; uloženo, dobírka obnovená na 249 Kč; testovací štítek ČP s dobírkou 249 Kč (NB1249245913U); po štítku úprava zamčená |
| Zabaleno | #6 (odběr) posunutý do „K odeslání" | `swap_only`, mini obchod prázdný s důvodem; změna počtu / přidání / odebrání odmítnuty; výměna za stejnou cenu projde (rozdíl 0) |
| Po štítku | #39, #40 | úprava odmítnuta „Část objednávky je už vypravená" |
| Výměna za jiný výrobek | #6 | odmítnuta „jen za jinou variantu téhož výrobku" |
| Objednávky+ | #10, #32, #40 | karta fronty: „Zákazník upravil 2× · naposledy −30 Kč" apod. |

Neověřeno živě: storefront stránky v prohlížeči (agent ověřil typy a SCSS,
ne vykreslení), token z účtu (přesměrování), cesta mini obchod → přidat →
návrat se souhrnem, smíšená objednávka se zakázkou. E-mail po vrácení
rozdílu na #32 odešel (protokol e-mailů), ale s obecným předmětem
„Vrácení vyřízeno — potvrzení" — opraveno na „Rozdíl po úpravě objednávky
jsme vám vrátili" (830cc64). Vykreslení stránek na serveru ověřeno
(store.matejforejt.com: #32 úprava i mini obchod, zabalená #6 bez sekce
Přidat).
