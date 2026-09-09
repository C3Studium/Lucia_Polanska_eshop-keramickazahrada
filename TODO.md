# TODO — nápady, které nejsou před spuštěním potřeba

Co MUSÍ být hotové před produkcí, je v `FINISHINGTODOLIST.md`. Sem patří věci,
o kterých padlo rozhodnutí „ano, dává to smysl, ale ne teď" — ať se na ně
nezapomene a ať se u nich nemusí znovu vymýšlet, co vlastně obnášejí.

## Načtení firmy z ARES podle IČO

**Stav:** odloženo (2026-09-08). Firemní nákup funguje i bez toho.

**Co to je.** Když zákazník v pokladně zaškrtne „Nakupuji na firmu" a vyplní
IČO, došlo by se pro zbytek do registru ARES (Ministerstvo financí) a
předvyplnily by se název firmy, adresa sídla a DIČ. Na českých e-shopech je to
běžné a šetří to tři pole i překlepy v názvu, které pak nesedí na faktuře.

**Proč to zatím není.** Je to volání cizí služby, a s ním všechno, co k tomu
patří: časový limit, chování při výpadku registru, omezení počtu dotazů,
a rozhodnutí, jestli se načtená adresa smí přepsat ručně (musí — sídlo a
doručovací adresa nejsou totéž). To je samostatný kus práce, ne přívažek.

**Co už je hotové a na co to navazuje.**

- Zaškrtávátko a pole Název firmy / IČO / DIČ:
  `storefront/src/modules/checkout/components/shipping-address/index.tsx`
- Ověření IČO včetně kontrolní číslice (modulo 11) a tvaru DIČ, sdílené
  klientem i serverem: `storefront/src/lib/util/firma.ts`
- Uložení do metadat košíku (`firma_ico`, `firma_dic`) v `setAddresses`:
  `storefront/src/lib/data/cart.ts` — pozor, adresa v Meduse metadata
  nepodporuje a tiše je zahodí, proto košík
- Předání na fakturu jako `IdentificationNumber` / `VatIdentificationNumber`:
  `backend/src/modules/idoklad/utils.ts`

**Až se do toho půjde.** Endpoint je
`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}`,
je veřejný a bez klíče. Volat ho ze **serveru**, ne z prohlížeče — jinak to
znamená CORS a odhalený vzorec dotazů. Přirozené místo je serverová akce
vedle `setAddresses`; ověření IČO se dá pustit dřív, takže se na registr
chodí jen s číslem, které projde kontrolní číslicí.

**Co to nesmí udělat.** Zablokovat objednávku, když ARES neodpoví. Předvyplnění
je pohodlí; když registr mlčí, člověk vyplní název sám a jde dál.

## Kurzy: platba na místě se nikde nepotvrdí

**Stav:** zjištěno 2026-09-09 při čtení kódu, nerozhodnuto.

**Co to je.** `payment_status` má tři hodnoty — `pending`, `paid`, `on_site`.
`on_site` je koncová: nastaví se při založení rezervace a **nic ji nikdy
nepřeklopí**. Jediné místo v celém kódu, které píše `paid`, je subscriber na
`payment.captured` (`backend/src/subscribers/course-payment.ts:117,146`), a ten
se u platby na místě z podstaty nespustí.

**Proč to vadí.** V adminu ani v datech není rozdíl mezi „přišel a zaplatil"
a „nepřišel vůbec". Po sezóně se nedá zpětně zjistit, kdo kurz opravdu
zaplatil, a nedá se z toho udělat podklad pro účetnictví.

**Co by to obnášelo.** Buď čtvrtá hodnota (`collected`) plus tlačítko
v `backend/src/admin/routes/kurzy-sprava/page.tsx` u řádku rezervace, nebo
sloupec `collected_at`. Druhé je menší zásah: nemění se enum ani migrace
kontrolních podmínek, jen se přidá časové razítko a jedna admin routa.

**Co to nesmí udělat.** Blokovat cokoli v rezervačním toku. Je to evidence
po kurzu, ne podmínka účasti.

## Kurzy: ztracený callback z ComGate nic nedožene

**Stav:** zjištěno 2026-09-09. **Patří spíš do `FINISHINGTODOLIST.md`** —
je to jediná z těchhle tří věcí, která umí vzít peníze a nedat místo.

**Co to je.** Zaplaceno neoznačí návrat prohlížeče z brány, ale až serverový
push od ComGate na `/hooks/payment/pp_comgate_comgate`
(`backend/src/api/hooks/payment/pp_comgate_comgate/route.ts:104`). Ten se
navíc ještě sám doptá stavové API ComGate, takže je to správně navržené.
Jenže **když push nedorazí, neexistuje nic, co by to dopočítalo**: pro kurzy
není žádný dorovnávací job. Made-to-order ho má
(`backend/src/jobs/reconcile-balance-payments.ts`), kurzy ne.

**Jak to dopadne.** Zákazník zaplatí, notifikace se ztratí, po 24 hodinách
hodinový job `backend/src/jobs/expire-course-payments.ts` rezervaci zruší jako
`auto_expired` a pošle e-mail „Platba nedorazila — rezervaci jsme uvolnili".
Peníze zůstanou u nás, místo je pryč a nikdo o tom neví.

**Co s tím.** Nejdřív to nejlevnější: ověřit notifikační URL v portálu ComGate
a poslat si testovací platbu. Teprve pak zvažovat job, který u rezervací se
`payment_status = 'pending'` a existujícím `payment_session_id` doptá stav
před tím, než je expirační job zruší.

**Vedlejší nález.** Kurzům se do ComGate session neposílá `expirationTime`
(`backend/src/lib/course-payment.ts:106-119`), takže odkaz na bránu přežije
naše vlastní 24hodinové pravidlo. Sám o sobě to problém není — zaplatit se
po expiraci dá jen do zrušené rezervace, a to skončí u případu níž.

## Kurzy: platba po zrušení se vrací ručně

**Stav:** zjištěno 2026-09-09, **záměrné** — poznamenáno, aby to nikdo
„neopravil" bez rozmyslu.

**Co to je.** Když peníze dorazí na rezervaci, která už je zrušená (vyhrál
expirační job, nebo se zrušil celý termín), zapíšou se jako `paid` na zrušený
řádek. Faktura ani potvrzení se nepošlou a majitelce přijde *urgentní*
upozornění „peníze je nutné vrátit ručně"
(`backend/src/subscribers/course-payment.ts:113-140`).

**Proč ne automaticky.** Automatický refund by v tomhle případě znamenal
vracet peníze bez toho, aby se kdokoli podíval, proč platba dorazila pozdě.
Stejnou úvahou se řídí i platba přes starý odkaz po změně počtu osob
(`:52-95`).

**Kde to hlídat.** Zvonek v adminu. Jinde se to neprojeví — zákazník vidí
zrušenou rezervaci a e-mail o uvolnění místa.

## Zkoušení funkcí před spuštěním

**Stav:** sepsáno 2026-09-09. Není to nápad na později — je to seznam toho, co
se ještě nikdy nezkusilo celé, od kliknutí po e-mail a fakturu. Patří to spíš
do `FINISHINGTODOLIST.md`; tady to je, protože sem to bylo zadáno.

Odškrtávat po celých cestách, ne po jednotlivých obrazovkách: většina toho, co
se rozbíjí, je předávka mezi dvěma kroky, ne krok sám.

### Co je hotové

- [x] Účet a všechny podstránky — svislé telefony, svislé tablety, ležaté
      tablety i telefony, běžné monitory na šířku
- [x] Recenze, objednávky, seznam přání — vyzkoušené i s obsahem
- [x] Kurzy, Dotazy, O mně, Výroba, domovská stránka — svislé tablety
- [ ] Projít ještě jednou velké monitory (nad 1920 px, kde běží rampa `rem`
      v `globals.scss`) — jestli tam něco nevyroste víc, než má

### Storefront

**Kurzy — celý proces. Nezkoušený vůbec.** Responzivní design se dělal na
ukázkových datech a ta jsou pryč, takže od začátku do konce to zatím nikdo
neprošel. Vypsat si v adminu jeden termín a projít:

- [ ] Rezervace **online**: výběr termínu → údaje → ComGate → návrat na
      `/kurzy/rezervace/{id}?token=…&vysledek=paid`
- [ ] Ověřit, že stav `paid` zapsal **serverový callback**, ne návrat prohlížeče
      (`backend/src/api/hooks/payment/pp_comgate_comgate/route.ts`)
- [ ] Rezervace **na místě** — místo se drží hned, potvrzení odchází ihned
- [ ] Nedokončená platba → po 24 h ji zruší `expire-course-payments`
- [ ] Tlačítko „Zkusit zaplatit znovu" na stránce rezervace
- [ ] Zrušení zákazníkem do 48 h + automatický refund (`refunded_at`)
- [ ] Zrušení jedné rezervace a celého termínu z adminu
- [ ] Změna počtu osob (`.../edit`) a co udělá s cenou a s e-mailem
- [ ] Čekací listina: vyprodaný termín → uvolnění místa → `course-waitlist-spot`
- [ ] Stránka rezervace ve všech stavech: zaplaceno / na místě / čeká na platbu /
      zrušeno zákazníkem / zrušený termín

**Objednávky**

- [ ] **Editace objednávky zákazníkem** — celá cesta, včetně doplatku
      (`order-edit-payment`) a vypršení (`expire-customer-edits`)
- [ ] Nákup na firmu (IČO/DIČ) až na fakturu
- [ ] Slevový kód: platný / neexistující / prošlý — až po nasazení routy
      `backend/src/api/store/promotions/[code]` (viz níž, pořád netrackovaná)
- [ ] Dobírka a osobní odběr (`dobirkaPayment`, `pickupFulfillment`)

### Backend

**E-maily — 46 šablon v `src/modules/resend/emails/`.** Projít po skupinách a u
každé ověřit, že opravdu odejde, má správný předmět a čitelný obsah:

- [ ] Objednávka podle fází: `order-placed`, `order-processing`,
      `order-shipment`, `order-delivered`, `order-ready-pickup`,
      `order-delayed`, `order-cancelled`, `order-refunded`, `order-review`
- [ ] Platby: `payment-received`, `payment-pending`, `payment-failed`,
      `payment-cancelled`, `payment-refunded`, `refund-request`
- [ ] Kurzy: `course-reservation-confirmed` (varianty *paid* i *on_site*),
      `course-payment-expired`, `course-reservation-cancelled`,
      `course-term-cancelled`, `course-reminder`, `course-waitlist-spot`
- [ ] Účet: `welcome`, `email-verification`, `email-change`, `account-change`,
      `password-reset`, `password-changed`, `sign-in-notification`,
      `account-deleted`, `address-added`
- [ ] Sklad a ceny: `restock`, `price-drop`, `bundle-published`,
      `abandoned-cart`, `newsletter-*`, `promotional`
- [ ] Vratky: `return-approved`, `return-rejected`, `delivery-failed`
- [ ] Majitelce: `merchant-notification`, `merchant-daily-summary`,
      `merchant-weekly-summary`, `invoice-issued`
- [ ] `watch-failed-emails` — co se stane, když Resend odmítne

**iDoklad**

- [ ] Faktura po zaplacení objednávky (`subscribers/idoklad-invoice.ts`)
- [ ] Faktura po zaplacení kurzu (`lib/course-invoice.ts`)
- [ ] Nákup na firmu — `IdentificationNumber` / `VatIdentificationNumber`
- [ ] Odkaz na PDF v e-mailu (`invoice-issued`)
- [ ] Co se stane, když iDoklad neodpoví — objednávka nesmí spadnout

**Doprava**

- [ ] Česká pošta (`modules/ceskaPostaFulfillment`) — štítek, podací číslo,
      předání do e-mailu o odeslání
- [ ] Osobní odběr (`modules/pickupFulfillment`)

**Zvláštní druhy zboží**

- [ ] Zakázková výroba (`made-to-order`, admin `zakazkova-vyroba`) — od
      objednávky přes `watch-production-deadlines` po předání
- [ ] Bundly (`bundled-product`, admin `bundled-products`)
- [ ] Použité/klearance kusy (`retire-sold-out-clearance`,
      `close-finished-sales`, admin `sezonni-vybery`)
- [ ] Hlídač ceny a naskladnění (`price-watch`, `restock`, `check-restock`)

**Plánované úlohy — `src/jobs/`, 17 kusů.** U každé ověřit, že se pustí a co
udělá, když nemá co dělat:

- [ ] `send-daily-summary`, `send-weekly-summary` — souhrny majitelce
- [ ] `course-reminders`, `expire-course-payments`, `finish-course-terms`
- [ ] `request-reviews`, `send-abandoned-cart-notification`
- [ ] `watch-stock-levels`, `watch-price-drops`, `sync-currency-prices`
- [ ] `reconcile-balance-payments` — a jestli něco takového nemají mít i kurzy
      (viz „Kurzy: ztracený callback z ComGate" výš)

**Admin** — projít workbenche, jestli po dnešních zásazích sedí data:
`objednavky`, `kurzy-sprava`, `zakazkova-vyroba`, `sklad-workbench`,
`statistiky-workbench`, `slevy-workbench`, `merchant-orders`, `dokumenty`.
