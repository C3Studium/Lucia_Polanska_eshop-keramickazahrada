# Reklamace a zrušení objednávky — jednotný modul (kontrakt)

Datum: 7. 10. 2026. Nahrazuje roztříštěný stav (tab „Vrácení" v Přehledu + widget +
tři nespojené akce). Zásada č. 1: **peníze se nikdy nevrací automaticky.** Každý
případ jde cestou *žádost → protokol → rozhodnutí majitelky → (zboží zpět) →
refundace → dobropis → potvrzení o vyřízení.*

## 1. Zákonný rámec, který modul vynucuje

| Co | Pravidlo | Kde v modulu |
|---|---|---|
| Odstoupení (zrušení) spotřebitelem | 14 dnů od převzetí, bez důvodu (§1829 OZ) | `can_withdraw` + `withdrawal_deadline` ze serveru |
| Výjimka zakázka | zboží na míru — bez práva odstoupit (§1837 d) | server odmítne `odstoupeni`/`vraceni` u čisté zakázky; majitelka může přesto schválit ručně založenou žádost (dobrá vůle) |
| Potvrzení přijetí odstoupení | textově bez odkladu | e-mail `refund-request` |
| Vrácení peněz | do 14 dnů, **smí počkat na zboží zpět** (§1832/4) | refundace u `odstoupeni`/`vraceni` jen ve stavu `received` (nebo s vědomým `skip_goods_check`) |
| Krácení za opotřebení | §1833 | částečná refundace (částka = rozhodnutí majitelky) |
| Reklamace — protokol při uplatnění | §19/1 ZOS: datum, co, požadovaný způsob, kontakt | PDF při intake, `requested_resolution` povinné u reklamace |
| Reklamace — vyřízení | do 30 dnů, vyrozumět; zamítnutí písemně odůvodnit (§19/3 ZOS) | `resolve_by` 30 d, job hlídá; `decision_note` povinný u zamítnutí; e-mail + protokol s vyřízením |
| Způsob vyřízení reklamace | oprava / výměna / sleva / odstoupení (§2169–2172) | `resolution` ∈ repair, replace, discount, refund |
| Domněnka vady 12 měsíců, 2 roky | §2161/5, §2165 | jen informace (bez gatingu) |
| Dobropis | opravný doklad při refundaci | `issueCreditNoteForOrder` (plná) / upozornění (částečná) — existuje |

## 2. Datový model — `return_request` (modul `return-request`)

Stávající pole zůstávají. **Nové / změněné** (migrace + úprava CHECK constraintu na `status`):

| Pole | Typ | Význam |
|---|---|---|
| `status` | enum | `pending` → `approved` → `received` → `resolved` \| `rejected` \| `cancelled` (viz §3) |
| `requested_resolution` | text null | co ŽÁDÁ zákazník (jen reklamace): `repair` \| `replace` \| `refund` |
| `resolution` | text null | co ROZHODLA majitelka při schválení: reklamace `repair` \| `replace` \| `discount` \| `refund`; odstoupení/vrácení vždy `refund` |
| `goods_received_at` | dateTime null | zboží dorazilo zpět / přijato k opravě |
| `goods_tracking` | text null | číslo zásilky, kterou zákazník poslal zpět (volitelné, zadává zákazník) |
| `resolved_at` | dateTime null | vyřízeno |
| `resolution_note` | text null | text do „potvrzení o vyřízení" |
| `refunds` | json null | pole `{ amount, method: "comgate"\|"manual", at, note? }` — umožňuje částečné a opakované vrácení |
| `refund_amount` | number null | **součet** `refunds` (zůstává kvůli zpětné kompatibilitě) |
| `refunded_at` | dateTime null | poslední refundace |
| `withdrawal_deadline` | dateTime null | snapshot lhůty 14 dnů v okamžiku žádosti (u `odstoupeni`/`vraceni`) |

`kind` zůstává `reklamace` \| `vraceni` \| `odstoupeni`. („Zrušení objednávky" ze storefrontu = `odstoupeni`.)

Číslo protokolu: `REK|VRA|ODS-<rok>-<display_id>`; druhá a další žádost na téže objednávce v roce dostane příponu `-2`, `-3` (žádné přepisy PDF).

## 3. Stavy a přechody

```
pending ──approve──▶ approved ──received──▶ received ──refund(do 0)/resolve──▶ resolved
   │                    │                                                  
   │                    └──resolve (oprava/výměna bez peněz, nebo nic se nevrací)──▶ resolved
   └──reject (note povinný)──▶ rejected
(kterýkoli nefinální) ──cancel (note)──▶ cancelled
```
Finální: `resolved`, `rejected`, `cancelled`. Z finálního se nikam nejde.

**Pravidla refundace (jádro):**
- povoleno jen ve stavu `approved` nebo `received`;
- u `odstoupeni`/`vraceni` jen ve stavu `received`, pokud tělo nemá `skip_goods_check: true` (majitelka vědomě — např. zboží nikdy neodešlo); důvod se zapíše do `refunds[].note`;
- u `reklamace` povoleno ve stavu `approved` jen když `resolution ∈ {refund, discount}`, jinak až `received`;
- částka: výchozí = zbývá (zachyceno − dosud vráceno přes modul i `refund_history`), lze zadat nižší; nikdy přes zbývá; částečné a opakované povoleno;
- když zbývá == 0 nebo tělo `mark_resolved: true` → stav `resolved` + e-mail „potvrzení o vyřízení";
- **jediný** e-mail zákazníkovi za refundaci (potlačit duplicitní `payment-refunded` pro refundace z modulu).

**Zrušení objednávky (jen u `odstoupeni`/`vraceni`):** akce `cancel-order` je dostupná **až** když je žádost `resolved` **nebo** na objednávce nezbývá nic zachyceného. Teprve pak `cancelOrderWorkflow` (jeho vlastní refundace je díky tomu no-op) + merchantská fáze `cancelled` + uvolnění skladu. Při selhání nativního zrušení (např. doručená zásilka) alespoň fáze `cancelled` + poznámka.

**Pojistka proti skryté refundaci:** `POST /admin/orders/:id/cancel` (nativní) i „Zrušit zakázku" odmítnou zrušení, dokud má objednávka zachyceno − vráceno > 0, s hláškou „Vrácení peněz vyřiďte v Reklamace a zrušení, pak objednávku zrušte." UI u zakázky přestane tvrdit, že se refundace „nestane sama".

## 4. API

### Store (zákazník, podepsaný token `verifyOrderAccessToken`, middleware `allowUnauthenticated` jako `guest-edit`)
- `GET /store/orders/:id/claims?token=` →
  ```json
  { "can_withdraw": bool, "withdrawal_deadline": iso|null, "withdraw_block_reason": string|null,
    "return_address": string, "return_instructions": string|null,
    "all_made_to_order": bool,
    "requests": [{ "id","kind","status","created_at","resolve_by","requested_resolution","resolution",
                   "protocol_url","refund_amount","refunds":[...],"goods_received_at","goods_tracking",
                   "resolved_at","decision_note" (jen u rejected),"reason" }] }
  ```
  `can_withdraw` = není čistá zakázka ∧ (ještě neodesláno ∨ dnes ≤ withdrawal_deadline) ∧ žádná otevřená žádost. Lhůta = `max(fulfillments.shipped_at)` + 14 d; bez odeslání = bez lhůty (lze odstoupit).
- `POST /store/orders/:id/claims` tělo `{ token, kind, reason, requested_resolution?, photos?: [{filename,mime_type,data}] }` → `{ received: true, id }`. Server vynucuje: §1837 (čistá zakázka → 400 pro `odstoupeni`/`vraceni`), lhůtu 14 d pro `odstoupeni`/`vraceni` (400 po lhůtě), max 1 **otevřená** žádost na objednávku, `requested_resolution` povinné u `reklamace`. Fotky jako dnes (MinIO, max 6). Stávající `POST /store/return-requests` (číslo+e-mail) zůstává funkční jako záložní cesta, ale storefront ho už nepoužívá.
- `POST /store/orders/:id/claims/:claimId/tracking` tělo `{ token, tracking }` → uloží `goods_tracking` (jen ve stavu `approved`).

### Admin
- `GET /admin/return-requests?status=pending|approved|received|resolved|rejected|cancelled|open|all&kind=&q=&limit=&offset=` (`open` = nefinální; `q` hledá v čísle objednávky, e-mailu, jménu). Odpověď `{ return_requests, count, limit, offset }` + ke každé žádosti `captured_total`, `refunded_total`, `remaining` (dopočítané).
- `GET /admin/return-requests/counts` → `{ pending, approved, received, resolved, rejected, cancelled, overdue }` (pro badge v tabech).
- `POST /admin/return-requests/:id/decide` `{ decision: "approve"|"reject", note?, resolution? }` — `approve` u reklamace vyžaduje `resolution`; u odstoupení/vrácení se `resolution = "refund"` doplní; `reject` vyžaduje `note`. Protokol se regeneruje s rozhodnutím. E-mail `return-approved` (text podle `resolution` + adresa pro vrácení z nastavení + lhůta 14/30 podle druhu) nebo `return-rejected` (s odůvodněním + poučení o ČOI).
- `POST /admin/return-requests/:id/received` `{ note? }` → `received`, `goods_received_at`; e-mail `return-received`.
- `POST /admin/return-requests/:id/resolve` `{ note? }` → `resolved` (pro `repair`/`replace`, nebo když se nic nevrací); protokol → „potvrzení o vyřízení"; e-mail `return-resolved`.
- `POST /admin/return-requests/:id/refund` `{ amount?, note?, skip_goods_check?, mark_resolved? }` — pravidla §3; odpověď `{ refunded, method, amount, remaining, status, credit_note, message }`. Opravy: částky přes `toNumber` (BigNumber tvar), `refund_history` se **nepřepíše** dobropisem (čerstvě načíst metadata před patchem), jeden e-mail.
- `POST /admin/return-requests/:id/cancel` `{ note }` → `cancelled` (žádost stažena/stornována); e-mail zákazníkovi není nutný (volitelně).
- `POST /admin/return-requests/:id/cancel-order` → viz §3 „Zrušení objednávky"; odpověď `{ cancelled: bool, message }`.
- Middleware: `POST /admin/orders/:id/cancel` → pojistka z §3.

## 5. Nastavení (merchant-settings)
- `return_address` (víceřádkový text; výchozí dnešní „Keramická zahrada, Putim 229, 397 01 Písek") — nahrazuje 3 natvrdo zapsané adresy (`decide/route.ts`, `vraceni/page.tsx`, `customer-emails.ts`).
- `return_instructions` (text, volitelné; např. „zabalte pečlivě, přiložte číslo objednávky").
- Editace tam, kde se dnes edituje `owner_notification_email`.

## 6. E-maily (šablony `modules/resend/emails`, registrace v `service.ts` + štítek v `prehled/emaily`)
- `refund-request` — předmět a text **podle druhu** („Reklamaci jsme přijali" / „Žádost o vrácení zboží jsme přijali" / „Odstoupení od smlouvy jsme přijali"), odkaz na protokol, lhůta (30 / 14 d), odkaz na stav žádosti ve storefrontu.
- `return-approved` — podle `resolution`; u vrácení zboží adresa + instrukce z nastavení + lhůta; u opravy/výměny co bude následovat.
- `return-rejected` — odůvodnění + ČOI věta; opravit „do 30 dnů od doručení".
- **nové** `return-received` — „zboží k nám dorazilo, kontrolujeme".
- **nové** `return-resolved` — potvrzení o vyřízení (datum, způsob, částka/oprava/výměna; §19/3 ZOS).
- `order-refunded` — ponechat pro refundaci; `payment-refunded` **neposílat** pro refundace z modulu (dedupe přes `refund_history` posledního záznamu s `return_request_id`).
- `order-cancelled` — nesmí slibovat „vrátíme do 3–5 dnů" bezpodmínečně.

## 7. Job `watch-return-deadlines`
Hlídá **všechny nefinální** stavy (`pending`, `approved`, `received`): před lhůtou 3 d upozorní, po lhůtě denně urgentně; po `resolved`/`rejected`/`cancelled` mlčí.

## 8. Admin UI — nový top-level modul
`backend/src/admin/routes/reklamace/page.tsx`, `defineRouteConfig({ label: "Reklamace a zrušení", icon })`.
- Taby s počty: **Nové** (pending) · **Schválené – čeká na zboží** (approved) · **Zboží přijato** (received) · **Vyřízené** (resolved) · **Zamítnuté** (rejected) · Stornované (cancelled). Filtr druhu, hledání.
- Řádek: číslo objednávky, zákazník, druh, požadované vyřízení, stav, lhůta (badge, po lhůtě červeně), zbývá vrátit.
- Detail (drawer/sekce): časová osa (přijato → rozhodnuto → zboží přijato → vyřízeno), důvod, fotky (lightbox), protokol PDF, platby (zachyceno / vráceno / zbývá), číslo vrácené zásilky, poznámky.
- Akce **podle stavu** (jiné se nezobrazují):
  - `pending`: **Schválit** (u reklamace výběr způsobu vyřízení: oprava / výměna / sleva / vrácení peněz) · **Zamítnout** (odůvodnění povinné).
  - `approved`: **Zboží přijato** · **Vrátit peníze** (jen reklamace s `refund`/`discount`; u vrácení zboží skryto, místo toho přepínač „Zboží neodešlo / vracím bez čekání" = `skip_goods_check`) · **Vyřízeno** (oprava/výměna) · Stornovat žádost.
  - `received`: **Vrátit peníze** (částka předvyplněná = zbývá, lze snížit; opakovaně) · **Vyřízeno**.
  - `resolved` + odstoupení/vrácení: **Zrušit objednávku a uvolnit sklad**.
  - finální: jen čtení.
- Tab „Vrácení" v Přehledu → odkaz do modulu (nebo krátký souhrn + odkaz). Widget `order-returns` na detailu objednávky: stav + odkaz do modulu; žádné tlačítko refundace mimo pravidla.
- Zakázka: tlačítko „Zrušit zakázku" + text opravit (viz §3 pojistka).

## 9. Storefront
- Formulář `/order/[id]/refund?token=&kind=`: druh (reklamace / vrácení / odstoupení), **u reklamace povinně „co požadujete" (oprava / výměna / vrácení peněz)**, popis, až 6 fotek; **gating ze serveru** (`can_withdraw`, `withdrawal_deadline`, `withdraw_block_reason` → zakázka §1837 nebo po lhůtě → volba nedostupná s vysvětlením); odeslání přes `POST /store/orders/:id/claims` (token).
- **Stav žádosti pro zákazníka**: na potvrzení objednávky sekce „Reklamace a vrácení" (když existuje žádost) s časovou osou + protokol + pokyny; samostatná stránka `/order/[id]/claims?token=` se vším; u `approved` vrácení pole „číslo zásilky, kterou jsem poslal/a" → `tracking`.
- Účet → detail objednávky: nahradit starý formulář (jen důvod) stejnou komponentou jako výše (druh + fotky + požadované vyřízení).
- Texty: „Zrušit objednávku" = odstoupení od smlouvy (14 dnů); u zakázky tlačítko místo toho vysvětlí §1837 a nabídne reklamaci / kontakt.

## 10. Mimo rozsah (teď)
Kurzy (vlastní refundace rezervací), nativní Medusa returns/claims, per-položkové reklamace (items zůstávají text).

## 11. Rozšíření (9. 10. 2026 večer): položky, poškození přepravou, kategorie

### 11.1 Položky žádosti
Nové sloupce `return_request`: `line_items` jsonb null =
`[{ line_item_id, title, variant_title, thumbnail, quantity, unit_price, total, currency_code }]`
(`unit_price`/`total` **po slevě, s DPH** — z objednávky: `per_unit = item.total / item.quantity`,
`total = per_unit × quantity`), `damage_cause` text null (`"carrier"` = poškozeno
přepravou). Stará textová `items` zůstává jako záloha pro staré řádky.

Store `POST /store/orders/:id/claims` navíc: `items?: [{ id, quantity }]` — u
**reklamace povinné** (aspoň jedna položka), u **vrácení** volitelné (bez
položek = vše), u **odstoupení** se ignoruje (celá objednávka). Server ověří,
že id patří objednávce a `quantity ≤ objednané`. `damage_cause?: "carrier"` —
pak jsou **fotky povinné** (≥ 1), jinak 400.

`GET /store/orders/:id/claims` navíc vrací `order_items: [{ id, title,
variant_title, thumbnail, quantity, unit_price, total }]` (pro výběr ve
formuláři) a každá žádost nese `line_items` a `damage_cause`.

### 11.2 Částka refundace
Když má žádost `line_items`, je výchozí částka **cena vybraných položek**:
`suggested_amount = min(remaining, Σ line_items.total)`. Seznam i detail v
adminu ji nesou (`suggested_amount`), panel „Vrátit peníze" ji předvyplní
s popiskem „Cena vybraných položek"; majitelka ji smí změnit do výše
`remaining`. Bez položek zůstává výchozí `remaining`. ComGate dílčí
refundace už umí (§3).

### 11.3 Poškozeno přepravou
`damage_cause === "carrier"` → při založení žádosti navíc `notifyMerchant`
owner **s e-mailem**: „Zásilka #N dorazila poškozená — podejte reklamaci u
České pošty" + číslo zásilky (`cp_label_tracking` / sledování) + odkaz na
formulář ČP (`https://www.ceskaposta.cz/reklamace` — konstanta
`CP_CLAIM_FORM_URL`, ověřit) + připomínka lhůty (poškození hlásit ČP
neprodleně, nejpozději do 2 pracovních dnů od dodání). V adminu badge
„Poškozeno přepravou", v protokolu a e-mailech věta. Pro zákazníka jde dál
běžná reklamace (schválit → zboží zpět → vrátit cenu položek).

### 11.4 Kategorie v Objednávky+
Projekce `/admin/merchant-orders` ke každému řádku přidá `claim` (poslední
žádost k objednávce) = `{ id, kind, status, reason, damage_cause,
refund_amount, remaining, suggested_amount, created_at } | null` a
`cancel_reason` (u fáze `cancelled`: důvod z žádosti o odstoupení, jinak
poznámka z historie fáze). Filtr `?category=cancelled|refunds|claims`:
`cancelled` = fáze cancelled, `refunds` = existuje žádost druhu
vraceni/odstoupeni, `claims` = druhu reklamace. V Objednávky+ tři nové
záložky **Zrušené · Vrácení peněz · Reklamace**; řádek ukazuje druh, stav
žádosti, důvod (zkrácený, celý v titulku), vrácenou částku, badge
„Poškozeno přepravou" a odkaz „Otevřít v Reklamace a zrušení" (deep link
`/reklamace?status=…&id=…`).

### 11.5 E-maily, protokol, stavová stránka
Kde se dnes vypisuje textové `items`, vypisují se přednostně `line_items`
(název · varianta · N ks · částka). Storefront: formulář má výběr položek
(checkbox + počet) a přepínač „Balík dorazil poškozený (přepravou)";
stavová stránka a souhrn na potvrzení ukazují vybrané položky a částku.

## 12. Stránka žádosti (10. 10. 2026): celá objednávka, výběr položek, zakázka, průběh podle případu

### 12.1 Proč
Drawer vpravo ukazoval jen žádost. Majitelka potřebuje vidět **objednávku**
(položky, platby, zakázku) a rozhodovat nad ní: vrátit peníze za vybrané
položky nebo za celou objednávku, u zakázky rozhodnout o záloze, u smíšené
objednávky obojí zvlášť. Průběh (kroky) se liší podle případu.

### 12.2 Detail pro stránku — `GET /admin/return-requests/:id/detail`
```
{
  request: ReturnRequest (+ line_items, damage_cause, suggested_amount, goods_shipped, refunds[]),
  order: { id, display_id, status, email, customer_name, currency_code, total, subtotal, shipping_total,
           created_at, payment_status, fulfillment_status, shipping_method: { name, is_pickup } },
  items: [{ line_item_id, title, variant_title, thumbnail, quantity, unit_total, line_total,
            is_made_to_order, refunded_quantity, refundable_quantity, refundable_amount,
            selected_in_claim: number }],
  money: { captured, refunded, remaining, refunds: [{ amount, method, at, note, items?, scope }] },
  production: null | { id, stage, agreed_total, surcharge, deposit_paid, balance_paid, outstanding,
                       deposit_refunded, balance_request_status },
  flags: { goods_shipped, is_commission, is_mixed, paid_online, pay_later, nothing_captured },
  case: "cancel_unpaid" | "cancel_paid_unshipped" | "withdrawal_shipped" | "return_shipped"
      | "commission_cancel" | "claim" | "mixed_cancel",
  steps: [{ key, label, state: "done" | "current" | "upcoming" | "skipped", at?: string | null }],
  actions: { approve, reject, received, refund_items, refund_all, refund_deposit, resolve,
             cancel_order, cancel_production, cancel_request }  // boolean = povoleno TEĎ
}
```
`unit_total` = `item.total / quantity` (po slevě, s DPH). `refunded_quantity`
= Σ `refunds[].items[]` pro tu položku; `refundable_amount = unit_total ×
refundable_quantity`, u zakázkové položky navíc omezeno tím, co je skutečně
zaplaceno (záloha). Případ `case` + `steps` se počítají na serveru (čistá
funkce `planClaimCase(...)`, testovaná), ať UI jen vykresluje.

### 12.3 Refund po položkách / celek / záloha — `POST /admin/return-requests/:id/refund`
Tělo navíc: `scope?: "items" | "all" | "deposit"`, `items?: [{ line_item_id,
quantity }]`. Pravidla:
- `items`: částka = Σ `unit_total × quantity`, `quantity ≤ refundable_quantity`
  (nelze vrátit tutéž položku dvakrát); položky se uloží do záznamu
  refundace (`refunds[].items`) i do `refund_history`.
- `all`: částka = `remaining` (celá objednávka).
- `deposit`: jen zakázka; částka = zaplacená záloha (snížená o už vrácené);
  zapíše `production.deposit_refunded`; je to rozhodnutí majitelky (zákazník
  na vrácení zálohy u zakázky nemá nárok, §1837 — proto výslovné tlačítko).
- `amount` v těle má přednost jen u `scope: "all"` (dílčí ruční částka).
Gating zůstává (§3 + 11.2 + goods_shipped). Dílčí refundy opakovaně;
`mark_resolved` / automaticky při zbývá 0.

### 12.4 Zakázka
- `cancel_production` (`POST /admin/return-requests/:id/cancel-production`):
  zakázka → stage `cancelled`, výrobní příkaz uzavřen, nativní zrušení
  objednávky JEN když objednávka nemá jiné (běžné) položky; u smíšené
  objednávky se zakázková položka odstraní nativní úpravou objednávky (order
  edit) a objednávka zůstává. Povoleno až když je záloha buď vrácená
  (`deposit_refunded`), nebo majitelka výslovně zvolila „zálohu nevracet"
  (`keep_deposit: true` v těle → zapíše se do žádosti jako `resolution_note`).
- Smíšená objednávka (`is_mixed`): stránka ukazuje dvě části — **Produkty**
  (výběr položek → refund_items) a **Zakázka** (záloha → refund_deposit /
  nevracet → cancel_production). Průběh pak má kroky obou částí.

### 12.5 Průběh podle případu (`case` → `steps`)
- `cancel_unpaid` (odstoupení, nic zachyceno, neodesláno): Přijato → Schváleno → Objednávka zrušena.
- `cancel_paid_unshipped`: Přijato → Schváleno → Peníze vráceny → Objednávka zrušena.
- `withdrawal_shipped` / `return_shipped`: Přijato → Schváleno → Zboží přijato → Peníze vráceny → Vyřízeno (→ Objednávka zrušena, volitelně).
- `commission_cancel` (zakázka): Přijato → Schváleno → Záloha: vrácena / ponechána → Zakázka zrušena.
- `claim` (reklamace): Přijato → Rozhodnuto (způsob) → Zboží přijato → Vyřízeno (oprava/výměna) nebo Peníze vráceny → Vyřízeno.
- `mixed_cancel`: kroky produktové + zakázkové části.
Zamítnuto / Stornováno ukončují kteroukoli větev.

### 12.6 Stránka `routes/reklamace/[id]/page.tsx`
Celá stránka (ne drawer): hlavička (objednávka #, zákazník, druh, stav, lhůta,
odkazy Detail objednávky / Protokol), **Průběh** (steps), **Objednávka**
(tabulka položek s checkboxy + množstvím k vrácení, částka k vrácení, štítek
„zakázka", „už vráceno N ks"; součty), **Platby** (zachyceno / vráceno /
zbývá, seznam refundací s položkami), **Zakázka** (když je: záloha, doplatek,
příplatek, tlačítka Vrátit zálohu / Zálohu nevracet / Zrušit zakázku),
**Žádost** (důvod, fotky lightbox, co zákazník žádá, poškození přepravou),
**Akce** podle `actions`: Schválit (s volbami jako dosud) · Zamítnout ·
Zboží přijato · Vrátit peníze za vybrané položky (částka živě) · Vrátit celou
objednávku · Vrátit zálohu · Vyřízeno · Zrušit objednávku · Zrušit zakázku ·
Stornovat žádost. Seznam v `routes/reklamace/page.tsx` otvírá stránku
(`/reklamace/<id>`), drawer se odstraní; widget na objednávce odkazuje na
stránku. Deep linky `?status=&id=` přesměrují na stránku.

## 13. Doplnění (10. 10. 2026 večer): auto-zrušení, košík vrácení, dobropis za refund, ComGate, balíček, poškození

### 13.1 Nezaplaceno + neodesláno = zrušit hned
Při založení žádosti (`POST /store/orders/:id/claims`, kind `odstoupeni`
nebo `vraceni`) kdy na objednávce **není nic zachyceno** (`nothing_captured`)
a **nic neodešlo** (`goods_shipped=false`): server žádost rovnou schválí
(resolution refund, decision_note „Automaticky — nezaplaceno, neodesláno"),
vyřídí (`resolved`) a zruší objednávku (`cancelOrderNatively` → nativní
zrušení + fáze cancelled + případná zakázka uzavřena). Zákazník dostane jen
e-mail „objednávka zrušena" (`return-approved` s `nothingToReturn`), Lucie
upozornění (bez e-mailu). Odpověď `{ received: true, id, auto_cancelled: true }`;
storefront místo „posoudíme" ukáže „Objednávka je zrušená". Zakázka se
auto-neruší nikdy (§1837 — rozhoduje Lucie).

### 13.2 Košík vrácení — žádná částka automaticky
Nikde se částka nepředvyplňuje; Lucie ji **sestaví**. Refund tělo:
`lines: Array<{ type: "item", line_item_id, quantity }
 | { type: "component", line_item_id, product_id, quantity }
 | { type: "shipping" }
 | { type: "custom", amount, label }>` (+ `note`, `mark_resolved`,
`skip_goods_check`). Server spočítá částku (item: `unit_total × qty`,
component: poměrná cena komponenty balíčku × qty, shipping: `shipping_total`
objednávky **jednou** — sleduje se `shipping_refunded`, custom: zadaná
částka), ověří stropy (položka/komponenta jen jednou, celkem ≤ `remaining`)
a uloží `lines` do záznamu refundace i `refund_history`. `scope: "all"` a
`scope: "deposit"` zůstávají jako VÝSLOVNÁ tlačítka („Vrátit celou
objednávku" = všechny zbývající položky + poštovné, „Vrátit zálohu"); staré
`items`/`amount` tělo se mapuje na `lines`. V panelu „Schválit" je volba
„rovnou vrátit" **vypnutá** (jde zapnout), a znamená celou objednávku.
Detail (`GET …/detail`) navíc: `shipping: { total, refunded, refundable }`.

### 13.3 Dobropis za každou refundaci (§45 ZDPH)
`issueCreditNoteForRefund(container, order, refund)` — iDoklad
`GET /CreditNotes/Default/{invoiceId}` dá návrh s obrácenými položkami; z
něj se ponechají/zkrátí jen položky odpovídající `lines` (item/component:
množství; shipping: řádek dopravy; custom: jeden řádek „Vrácení — {label}"
s cenou vč. DPH a sazbou z původních položek), součet = vrácená částka;
`POST /CreditNotes`, PDF do úložiště. Více dobropisů na objednávku:
`order.metadata.idoklad_credit_notes: [{ refund_id, id, number, pdf_url, amount, issued_at }]`
(stará `idoklad_credit_note_*` pole zůstávají pro plný dobropis jako
alias). Zkušební režim → `skipped` jako u faktur (do zprávy i e-mailu se
napíše, že doklad se vystaví až v ostrém režimu). Dobropis se vystavuje
u reklamace, vrácení i odstoupení — vždy, když se vrací peníze z faktury.
E-mail zákazníkovi (`return-resolved` / `order-refunded`) nese: vrácenou
částku, řádky košíku, způsob (karta ComGate — na účtu do 3–5 pracovních
dnů / ručně), odkaz na dobropis PDF; protokol totéž.

### 13.4 ComGate — potvrzení refundu
ComGate refund je synchronní (`/refund.json`, kód 0 = přijato); **webhook
pro refund ComGate nemá** (notifikace chodí jen ke stavu platby). Potvrzení
= odpověď ComGate: do záznamu refundace se uloží `provider: "comgate"`,
`provider_ref` (refId = idempotency klíč), `provider_confirmed_at`,
`provider_test: boolean` a po refundu se znovu načte `retrieveDetails`
(status zůstává PAID, `refundedAmountMinor` v datech relace = součet
vráceného) — uloží se jako `provider_refunded_total`. Admin u refundace
ukáže „ComGate přijal (ref …, test)". Když ComGate odmítne, nic se nezapíše
(jako dnes). Ruční metoda (`manual`) má `provider: "manual"`.

### 13.5 Balíček po komponentách
Položka s `product.metadata.is_bundle` se v detailu rozepíše:
`components: [{ product_id, variant_id, title, thumbnail, quantity (na jeden
balíček), unit_share, refunded_quantity, refundable_quantity }]` — `unit_share`
= poměrná cena komponenty: aktuální cena varianty komponenty × množství,
přepočtená tak, aby Σ komponent = `unit_total` balíčku. Refund `line.type:
"component"` vrací `unit_share × qty`; sleduje se per komponenta.
Storefront formulář nabízí u balíčku výběr komponent.

### 13.6 Zakázka s ponechanou zálohou
`cancel-production { keep_deposit: true }` u čisté zakázky: výrobní příkaz
cancelled, fáze cancelled, a objednávka se nativně **dokončí**
(`completeOrderWorkflow`) — zůstává zaplacená zálohou, faktura za zálohu platí,
`resolution_note` „Záloha ponechána". Zrušit nativně nejde (workflow by
zálohu vrátil).

### 13.7 Poškozené kusy — fotky povinné
`damage_cause`: `"carrier"` (poškozeno přepravou), **`"damaged"`**
(poškozený kus — viditelné poškození), `null` (vada / nefunguje). Fotky
povinné pro `carrier` i `damaged` (server 400, formulář hlídá). Storefront:
u reklamace výběr „Co se stalo": *Vada nebo nefunkčnost* · *Poškozený kus
(fotky)* · *Balík dorazil poškozený — přepravou (fotky)*. Admin badge
„Poškozený kus" (oranžová) vedle „Poškozeno přepravou" (červená); protokol
„Příčina: poškození".

### 13.x Zrušení zakázky zákazníkem (20. 10. 2026, LEGAL_AUDIT § 0)

Druh žádosti `zruseni_zakazky` je **jen serverový** (`isClaimKind` ho nezná, formulářem se nepodá).
Zakládá ho `lib/made-to-order/customer-cancel.ts` z `POST /store/made-to-order/:orderId/cancel`
(vlastník nebo podepsaný token) a z úlohy Z6 (doplatek nezaplacený 30 dnů po výzvě + připomínce).
Rozhoduje čistý `cancellationPlan` (`lib/made-to-order/cancellation.ts`): před e-mailem „Zakázka je
ve výrobě“ (`production_start_notified_at` null) se vrací vše; po něm propadá smluvní záloha
(`production_order.deposit_amount`, ≤ 50 %) a vrací se zbytek. Tok: žádost `approved` + refund
`refundClaim` (bez e-mailu) → `deposit_refunded` → `cancelProductionForClaim` (čistá zakázka
s ponechanou zálohou se nativně DOKONČÍ, ne zruší — pojistka §13.6) → vyřízeno + protokol `ZAK-…`
→ jeden e-mail `commission-cancelled` + zvonek majitelce. Zápis na zakázce: `cancelled_by`,
`cancellation_phase`, `cancellation_refund_amount`. Když ComGate refund odmítne, žádost zůstává
`approved` pro majitelku a přijde urgentní upozornění.

## 14. Kam peníze odejdou a za co (11. 10. 2026)

Zadání (Matěj): vrácení peněz musí opravdu proběhnout. U reklamace se vrací jen za výrobky, jinak celá objednávka. Nezaplacená objednávka nemá co vracet.

### 14.1 Způsob podle platby

| Platba objednávky | Co udělá „Vrátit peníze" | Co musí udělat majitelka |
|---|---|---|
| Karta / peněženka (ComGate) | Pošle refundaci přes ComGate na tutéž kartu (`refundPaymentWorkflow`) a zapíše potvrzení (§13.4). | Nic. Zákazník má peníze na účtu do 3–5 pracovních dnů. |
| Dobírka, platba při osobním odběru | Zaznamená vrácení (`method: "manual"`), vystaví dobropis a pošle e-mail. | Pošle převod na účet z karty „Vrácení převodem" (účet, IBAN, VS = číslo objednávky). |
| Nic nezaplaceno | Nic: „zbývá" je 0 a tlačítka vrácení se nenabízí. Odstoupení před odesláním objednávku rovnou zruší (§13.1). | Nic. |

Číslo účtu sbírá formulář žádosti (`refund_account`):

- Formulář ho chce u objednávky s nekartovou platbou, když už něco přišlo nebo zboží odešlo (`refundAccountNeeded`).
- Povinné je u odstoupení, vrácení a u reklamace s požadavkem „vrácení peněz". U opravy nebo výměny je nepovinné.
- Kontrola: český účet podle modulo 11 (vyhláška ČNB 169/2011), nebo IBAN podle modulo 97.
- Majitelka může účet v adminu doplnit nebo opravit: `POST /admin/return-requests/:id/refund-account {account}`.

Hláška po vrácení i e-mail zákazníkovi říkají, kam peníze jdou. Když účet chybí, hláška vyzve k jeho doplnění.

### 14.2 Za co se vrací

- **Odstoupení / vrácení:** „Vrátit celou objednávku" = všechny zbývající kusy (cena po slevě) + poštovné. Nikdy víc, než přišlo (seříznutí na zbývá).
- **Reklamace:** jen cena výrobků. Poštovné košík odmítne (`REFUND_SHIPPING_CLAIM`). „Vrátit reklamované výrobky" = reklamované kusy (`selected_in_claim`), u starší žádosti bez výběru všechny zbývající kusy. Náklady na zaslání zpět jdou případně jako ruční částka.
- **Rozdíl z úpravy (`uprava`):** jen rozdíl, viz plán úpravy objednávky.

Jedna funkce `refundAllLines` (lib/claims/refund-lines.ts) počítá řádky pro refundaci se `scope: "all"` i pro náhled `refund_all` v detailu. Tlačítko v adminu tak ukazuje přesně tu částku, kterou server pošle.
