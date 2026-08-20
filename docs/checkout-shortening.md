# Zkrácení nákupních cest (checkout shortening)

Zadání majitelky: „zhodnotit jak to zkrátit SPRÁVNĚ, ne jenom že to dají na
jednu stránku." Nejdřív tedy rozbor — co dnes každý klik kupuje — a teprve pak
odstranění těch kliků, které nekupují nic. Žádný krok nezmizel z dohledu:
všechno zůstává viditelné, editovatelné a dostupné zpět.

## Co který klik kupuje (analýza před úpravou)

Počítá se od stránky výrobku (PDP) s už zvolenou variantou po odeslání
k platbě / potvrzení objednávky. „Pole" = povinná textová pole.

Klasická pokladna (host, karta, ČP na adresu) — **10 kliků + 7 polí**:

| # | Klik | Co kupuje |
|---|------|-----------|
| 1 | Přidat do košíku | výběr zboží |
| 2 | otevřít košík | nic (transport) |
| 3 | Pokračovat k pokladně | nic (transport) |
| 4 | Pokračovat k doručení (po 7 polích) | uložení adresy |
| 5 | výběr dopravy | volba dopravy |
| 6 | Pokračovat k platbě | **nic** — doprava už je uložená |
| 7 | dlaždice platební metody | volba metody |
| 8 | Potvrdit objednávku a zaplatit | přechod na rekapitulaci |
| 9 | souhlas s podmínkami | právní úkon (§1826 ObčZ) — nutný |
| 10 | Zaplatit … | odeslání k bráně — nutný |

Přihlášený zákazník s uloženou adresou — **12 kliků + 0 polí**: stejné jako
host, ale krok adresy znamená otevřít výběr uložených adres (1), vybrat
adresu (1), odeslat formulář (1). Tři kliky, kterými zákazník říká systému
něco, co účet **už ví**. Platební metodu vybírá znovu při každém nákupu.

Expresní pokladna (přímý odkaz) — **6 kliků + 7 polí**: Pokračovat
k doručení (1) → 7 polí + doprava (1) + Pokračovat k platbě (1 — po zvolené
dopravě už nekupuje nic) → souhlas (1) + metoda (1) + Potvrdit a zaplatit (1).
Přihlášenému zákazníkovi vnucovala prázdný formulář — neuměla číst účet.

Znovu dotazované známé informace: adresa a e-mail přihlášeného zákazníka
(klasická i expresní), platební metoda (vždy), výběr jediné nabízené dopravy,
klik „Pokračovat" po dopravě, která žádný další vstup nepotřebuje.

## Co se změnilo

### Expresní pokladna — jeden komponent s animací
`modules/express-checkout/Router` je nově jediný stepper (Krok 1 Výběr →
2 Doručení → 3 Platba): progress lišta s popisky, fajfkami a souhrny
dokončených kroků, jediné animované „jeviště" (směrový slide + crossfade,
výška kontejneru plyne přes `layout`), zpětná navigace klikem na dřívější
krok i odkazem „← Zpět…". URL `?step=…` se udržuje **tiše** přes
`history.replaceState` — refresh i deep-link fungují dál, ale přechody běží
na místě bez navigace. Po mutacích se serverová data obnovují `router.refresh()`.

Auto-postup: jediná nabízená doprava se předvybere sama (Packeta ne — vyskočil
by widget); klik na dopravu při už vyplněné adrese krok rovnou uloží a posune
na platbu. Přihlášenému zákazníkovi se doručovací formulář předvyplní z uložené
adresy (`getExpressPrefillAddress`); hodnoty v košíku mají vždy přednost.

### „Koupit ihned" na stránce výrobku
Sekundární (obrysové) tlačítko vedle „Přidat do košíku" — jen pro přihlášené
s uloženou adresou, ne pro zakázkovou výrobu (ta potřebuje brief a zálohu) ani
sady. Server action `startExpressBuyNow`: naplní expresní košík variantou,
předvyplní výchozí uloženou adresu, předvybere dopravu Česká pošta **na
adresu** (nikdy Balíkovnu ani osobní odběr; respektuje pravidlo křehké/zakázka)
a přistane rovnou na platebním kroku. Každá nesplněná podmínka jen sníží
cílový krok (payment → delivery → selection) — nikdy slepá ulička.

### Klasická pokladna
- **Adresa přihlášeného se sbalí sama**: místo otevřeného formuláře se uložená
  adresa zapíše do košíku akcí `applySavedAddressToCart` (jen když košík ještě
  žádnou nemá — nikdy nic nepřepisuje) a zákazník vidí rovnou souhrnnou kartu
  „Doručit na: … · Upravit". Selhání = normální formulář.
- **Doprava**: jediná dostupná volba se předvybere (viditelná, změnitelná);
  klik na dopravu bez dalšího vstupu (ne Balíkovna/Packeta) rovnou postoupí
  na platbu. Widgetové dopravy dál blokují pokračování bez výdejního místa.
- **Platba**: poslední použitá metoda se pamatuje (localStorage, klíč
  `kz_last_payment_method`) a příště se předvybere — selektor se otevře rovnou
  ve stavu „Vybrali jste… / Potvrdit". Předvýběr se použije jen, když je metoda
  aktuálně v nabídce (dobírka/odběr projdou stejným filtrem jako dřív). Bez
  ComGate a s jedinou další metodou se předvybere ta.

Nezměněno záměrně: rekapitulace se souhlasem (checkbox + zápis
`terms_accepted_at`/`terms_version` před platbou), větve dobírka/odběr,
Balíkovna/Packeta gating, merge zápisy metadat.

## Kliky před / po

| Scénář | Před | Po |
|--------|------|-----|
| Klasická, host, karta | 10 kliků + 7 polí | **9 kliků + 7 polí** |
| Klasická, přihlášený s adresou (opakovaný nákup) | 12 kliků | **7 kliků** (první nákup bez zapamatované platby: 8) |
| Expresní, host | 6 kliků + 7 polí | **5 kliků + 7 polí** (se zapamatovanou platbou 4) |
| Expresní, přihlášený s adresou | 6 kliků + 7 polí | **5 kliků + 0 polí** |
| **PDP → zaplaceno („Koupit ihned")** | — | **4 kliky** (Koupit ihned → souhlas → metoda → zaplatit; se zapamatovanou metodou **3**) |

Rozpis „po" pro klasiku s přihlášením: přidat do košíku, košík, pokladna
(adresa se sbalí sama), volba dopravy (auto-postup), potvrzení zapamatované
platby, souhlas, zaplatit = 7.

## Kde to je v kódu

- `storefront/src/modules/express-checkout/Router/index.tsx` — stepper (Card smazána)
- `storefront/src/modules/express-checkout/Shipping/index.tsx` — prefill, předvýběr, auto-postup
- `storefront/src/modules/express-checkout/Payment/index.tsx` — paměť metody
- `storefront/src/modules/express-checkout/style.module.scss` — progress/stage styly
- `storefront/src/lib/data/express-cart.ts` — `getExpressPrefillAddress`, `startExpressBuyNow`
- `storefront/src/modules/products/ProductPage/product/details/Cta/Add/buy-now/` — tlačítko Koupit ihned
- `storefront/src/lib/data/cart.ts` — `applySavedAddressToCart`
- `storefront/src/modules/checkout/components/addresses/index.tsx` — auto-sbalení adresy
- `storefront/src/modules/checkout/components/shipping/index.tsx` — předvýběr + auto-postup
- `storefront/src/modules/checkout/components/payment/index.tsx` — paměť/předvýběr metody
- `storefront/src/lib/util/payment-preference.ts` — localStorage helper
