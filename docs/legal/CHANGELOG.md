# Právní soulad — co se změnilo a proč

Větev `legal/compliance-2026`, podle `LEGAL_AUDIT.md` (14. 10. 2026). Odkazy na paragrafy:
OZ = zákon č. 89/2012 Sb., ZOS = zákon č. 634/1992 Sb.

## Zakázka = položka objednávky (LEGAL_AUDIT § 0c Z-A — 20. 10. 2026 odpoledne)

- Migrace `Migration20261020180000`: `production_order.line_item_id` (+ `line_title`,
  `line_quantity`, `line_total`, `order_extras_paid`), unikát `(order_id, line_item_id)` místo
  `order_id`; `production_note.production_order_id`. Staré zakázky (NULL) = celá objednávka,
  chovají se jako dřív.
- `initialize-merchant-order` zakládá zakázku pro KAŽDÝ zakázkový řádek (vlastní smluvní záloha,
  diář, žádost o zálohu), event `made-to-order.production-orders-created { order_id,
  production_order_ids }`; potvrzení objednávky nese PDF Potvrzení zakázky pro každou
  (`orders/<order_id>/potvrzeni-zakazky-<line_item_id>.pdf`), obsah per položka.
- Store API: `balance` → `commissions[]` + `totals` (dosavadní pole = první zakázka), `cancellation`
  / `cancel` / `pay-balance` / `notes` s `production_order_id`; zrušení jedné ze dvou zakázek
  neruší objednávku. Admin GET → `production_orders[]`; akce berou `production_order_id`.
- E-maily (zahájení, dokončení, doplatek, zrušení, příplatek, zpráva) per zakázka s názvem položky.
- Storefront: checkbox s názvem u každé zakázkové položky (čas i v metadatech řádku), předsmluvní
  řádek per položka + součet, seznam zakázek v účtu a v potvrzení (každá vlastní panel, zrušení,
  doplatek, konverzace), stav zakázek v seznamu objednávek, přepínač zadání mezi zakázkami.
- **Otevřené:** admin widget „Výroba na zakázku“ ukazuje první zakázku objednávky (data pro
  všechny už posílá); e2e scénář pro dvě zakázky v jedné objednávce (sandbox má jediný
  zakázkový produkt) — pokryto unit testy initialize.

## Povinnosti mimo OP a typy produktů (LEGAL_AUDIT § 0b, § 0c Z-B — 20. 10. 2026 odpoledne)

- **N1 nezávadnost glazur**: stránka `/certifikaty` (seznam protokolů v `lib/certificates.ts`,
  zatím prázdný — protokoly má Lucie), FAQ skupina „Nezávadnost a bezpečnost“, odkaz
  u výrobku s tvrzením; skript `backend/src/scripts/food-claims.ts` (list / strip / restore)
  pro 31 produktů s tvrzením „zdravotně nezávadné“. Tvrzení zatím ponechána (OPEN_QUESTIONS N1).
- **N2 GPSR**: komponenta `safety-notice` na stránce výrobku — kotvení na fasádu, mráz,
  ostré střepy, podle kategorie.
- **N3 elektro**: kategorie Bezdrátové zvonky má 2 produkty (zvonek BZ8-113, krabička) → otázka
  pro Lucii; 8 popisů tlačítek bez mrtvého odkazu na starý e-shop.
- **N5**: OP čl. I už uvádí zápis v živnostenském rejstříku; úřad (MÚ Písek) čeká na potvrzení.
- **Z-B OP pro každý typ produktu**: čl. VI — kus s vadou (bez přeškrtnuté ceny, popsaná vada
  se nereklamuje, vrácení lze) a nový odstavec **Balíčky** (odstoupení i od části, poměrná část
  ceny, vada jednoho kusu); čl. VII — **Zboží na objednávku** (platba předem, lhůta u výrobku /
  30 dnů, vrácení při nedodání, jde vrátit do 14 dnů) a **Hlídání dostupnosti** (jen upozornění);
  čl. VIII — odkaz na částečné vrácení balíčku. Poukaz, kurz, zakázka beze změny.

## Zakázky podle § 0 auditu (20. 10. 2026, větev `legal/deploy-2026-10`)

Pravidla Z1–Z12 z `LEGAL_AUDIT.md` § 0 mají přednost před dřívějším návrhem OP čl. IX.

- **Z2 strop zálohy 50 %** — DB checky (`Migration20261020120000`), validace profilu i přebití u
  provedení (česká hláška), pokladna sevře smluvní procento na 50. `production_order.deposit_percentage`
  nově = SMLUVNÍ záloha z profilu (dřív podíl zaplacený v pokladně, u plné platby 100 %), nový
  `deposit_amount` = smluvní záloha v penězích; pokladna si do `production_lines[]` ukládá
  `contract_deposit_*` dřív, než je přepíše posuvník.
- **Z3 zahájení výroby = e-mail** — „Začít výrobu“ pošle synchronně `production-started`
  („Vaše zakázka je ve výrobě“: datum a čas, věta o nevratné záloze, lhůta); čas a ID zprávy
  v `production_start_notified_at` / `production_start_email_id`; když e-mail neodejde, fáze se
  vrátí a majitelka vidí chybu. Starý `order-processing` už zákazníkovi nechodí.
- **Z4/Z5/Z7 zrušení** — čistý plán `lib/made-to-order/cancellation.ts`; zákazník ruší v účtu nebo
  z potvrzení objednávky (`GET/POST /store/made-to-order/:id/cancellation|cancel`, vlastník nebo
  podepsaný token): před e-mailem Z3 vše zpět, po něm záloha propadá a zbytek se vrací. Žádost
  nového druhu `zruseni_zakazky` vyřídí server sám (refund ComGate/převod, dobropis, protokol
  `ZAK-…`), zákazník dostane `commission-cancelled`, majitelka zvonek. Zrušení majitelkou
  zapisuje `cancelled_by: seller`; v Reklamacích u „zálohu nevracet“ je upozornění Z7.
- **Z6 doplatek** — úloha `watch-production-deadlines`: 30 dnů po výzvě a po prokazatelné
  připomínce zruší jako po zahájení výroby (záloha propadá) a dá vědět oběma stranám; bez
  připomínky jen upozorní majitelku.
- **Z8/Z9/Z12 texty** — OP čl. IX přepsaný (zahájení e-mailem, záloha, zrušení z obou stran,
  doplatek, schválení podoby = ujednaná vlastnost § 2161 odst. 1 písm. a) s připomenutím,
  výrobní lhůta od zahájení + nový kus bez příplatku, vady bez čísel, Potvrzení zakázky);
  FAQ, stránka Výroba a zdroj Reklamačního řádu sladěny (vydá se s novou verzí).
- **Z10 pokladna** — checkbox „Beru na vědomí, že výrobek vyrobený podle mého zadání nelze
  vrátit ve 14denní lhůtě a že záloha se po zahájení výroby nevrací.“, předsmluvní informace
  o záloze (% i Kč, teď platíte X), lhůtě od zahájení a zrušení; štítek „Na zakázku · záloha
  N % · výroba do N dnů · nelze vrátit do 14 dnů“ u ceny, na kartě a v košíku; blok „Jak zakázka
  probíhá“ na produktu.
- **Z11 Potvrzení zakázky (PDF)** — generátor pdf-lib podle `potvrzeni-zakazky.html`
  (`lib/potvrzeni-zakazky/*`), deterministické bajty, neměnné uložení v R2
  (`orders/<order_id>/potvrzeni-zakazky.pdf`, jiný obsah = nová verze vedle), příloha
  potvrzovacího e-mailu vedle OP; u objednávky se zakázkou potvrzení čeká na event
  `made-to-order.production-order-created` (konec závodu s `order.placed`). Odkaz v účtu
  i v administraci; `{{vat.note}}` z faktu `vat.status` (dnes prázdný → věta o DPH chybí).
- **Účet** — panel zakázky: stav (čeká / ve výrobě od), smluvní záloha, PDF, „Zrušit zakázku“
  jednokrokově před zahájením, dvoukrokově s částkou po něm.
- Sandbox: scénář `z` v `backend/sandbox/e2e.mjs` (dvě objednávky — zrušení před a po zahájení).

## Nasazení 2. kolo (19.–20. 10. 2026)

Podle `docs/legal/audit/LEGAL_AUDIT-2-kolo-2026-10-18.md`, větev `legal/deploy-2026-10`,
průběh krok za krokem v `docs/legal/01-deploy-log.md`.

- **Segment vypnutý** (19. 10. 21:42): `SEGMENT_WRITE_KEY` smazán z Railway Backend, backend
  znovu nasazený; nasazený `main` do té doby posílal do USA e-mail a jméno zákazníka.
- **Záloha produkční DB** před migracemi (`pg_dump`, ověřená), pak **sloučení PR #15**
  (merge commit `b8133456`, 20. 10. ráno) → nasazení backendu i storefrontu, 5 migrací.
- Skripty: historie cen (792 cen), balné u odeslané #39, poukaz s vlastní částkou 100–10 000 Kč
  (popis bez poštovného 60 Kč, gmailu a pokynu k převodu).
- Proměnné `BACKEND_PUBLIC_URL` (odkaz na odhlášení v e-mailech) a `CMS_CRON_SECRET` (shodný na
  obou službách).
- Studio: 4 pracovní znění obnovená z repa, 37 nových bloků textů, dvě FAQ odpovědi opravené
  i v redakci (#22).
- Produkty: skryté testovací kusy (kytka s vadou „TEST“ a produkt „TEST“), `no_promo` u 6
  poukazů, upozornění na mráz u 2 nádob, text kartičky do balíku.
- **Opraveno navíc:** Zásady na produkci ukazovaly zástupný text `[[DOPLNIT: Twilio Segment…]]`
  — po vypnutí Segmentu odstraněn. Skripty `settle-service-lines` a `legal-voucher-product`
  nešly přes `medusa exec` spustit ostře (CLI odmítá volbu `--apply`) — berou teď `apply`.
- **Nevydáno:** OP, Odstoupení a Zásady zůstávají pracovní — chybí údaje od Lucie (seznam
  v `OPEN_QUESTIONS.md`, oddíl „Stav po nasazení“). Datum účinnosti zůstává `2026-10-15`.
- Otázky pro advokáta: `docs/legal/ADVOKAT.md`.

## Obsah do Studia, údaje do administrace (15. 10. 2026 odpoledne)

Podrobně `docs/cms/00-plan.md`. Mění bod „Jádro“ níž: text dokumentů se smí upravovat ve
Studiu, ale **vydané znění se nemění** (§ 1827 odst. 2 OZ — zákazník ho dostal v PDF).

- **Právní údaje** (`{{…}}`: identita, účet, DPH, záloha, storno kurzů, poukazy, lhůty, odhad
  nákladů vrácení, zpracovatelé) vyplňuje Lucie v administraci obchodu; web, PDF i e-maily
  je čtou odtud. Vydaná znění mají údaje zamrazené v manifestu PDF (`entry.facts`).
- **Znění dokumentů ve Studiu** (typ „Právní dokumenty“): pracovní znění lze upravovat
  a prohlížet v náhledu; vydané znění (PDF zveřejněné v R2) se vykresluje z otisku v repu
  a Studio ho nepustí změnit, smazat ani stáhnout. Platné znění nejde smazat, nové znění
  nemůže platit zpětně, neplatnou značku nejde publikovat.
- **Verze k objednávce se nikdy nenahrazuje jinou** — e-mail i stránka objednávky ukážou
  uložené `terms_version`, i když ho backendový manifest nebo CMS právě nezná (bez PDF,
  s odkazem na stránku znění).
- `pnpm legal:build --check --strict` = kontrola před spuštěním (selže, dokud je platné
  znění nevydané nebo znění existuje jen ve Studiu bez otisku v repu).
- Soubory ke stažení ze Studia u právních stránek a v patičce (oficiální PDF dál z pipeline).
- Redakční texty, které ležely jen v kódu, jsou ve Studiu. Zákonem vázané texty (souhlasy,
  předsmluvní informace, § 1837, § 12a, cookies, dvě FAQ odpovědi o zákonných právech)
  zůstávají v kódu.

## Jádro

- **Právní dokumenty přesunuty z CMS do verzovaného registru v repu**
  (`storefront/src/lib/legal/`). CMS (ValeCMS) přepisoval kapitoly podle pořadí a měl strop
  1000 znaků na kapitolu; nové znění by na webu přebilo staré z CMS a nedalo by se doložit,
  jaké znění platilo pro konkrétní objednávku (§ 1827 odst. 2 OZ, § 1826a OZ). Dokumenty mají
  verzi = datum účinnosti, staré verze zůstávají na vlastní URL.
- Údaje o prodávající na jednom místě (`facts.ts`); chybějící údaje se vykreslují jako
  zvýrazněné `[[DOPLNIT: …]]`, nikdy jako odhad.
- Doslovný přepis vzorového poučení a formuláře pro odstoupení z přílohy NV 29/2023 Sb. ve znění
  NV 66/2026 Sb. (`docs/legal/sources/nv-29-2023-priloha.md`).

## Texty právních dokumentů (WS-A)

- **Obchodní podmínky 2026-10-15** (nové, `/smluvni-podminky`), dosavadní znění z 1. 1. 2015
  zůstává doslovně na `/smluvni-podminky/2015-01-01` (noindex) pro starší objednávky.
  Hlavní změny proti roku 2015 (podle auditu §1–8):
  - prodávající jako podnikající fyzická osoba (ne „obchodní společnost“), údaj o DPH
    `[[DOPLNIT]]` místo neověřeného „je plátcem DPH“;
  - název tlačítka „Objednávka zavazující k platbě“ (§ 1826a odst. 2 OZ) — v roce 2015 bylo
    prázdné „ “; smlouva je archivovaná a přístupná v e-mailu a v účtu (§ 1827 OZ);
  - české právo, ale spotřebitel ze SK neztrácí ochranu práva státu bydliště;
  - platební metody podle skutečnosti — pryč PlatímPak (Equa Bank zanikla 2022), dobírka jen
    CZ na adresu, hotovost při osobním odběru, záloha jen u zakázky; číslo účtu `[[DOPLNIT]]`;
  - § 12a ZOS (předchozí cena = nejnižší za 30 dní), kusy s vadou (§ 2167 OZ);
  - odstoupení: nejlevnější nabízená doprava, vracení stejným platebním prostředkem
    (§ 1832), odpovědnost jen za snížení hodnoty nad rámec seznámení (§ 1833), e-mail
    i online tlačítko jako platná forma (§ 1830, § 1830a), výjimky § 1837 písm. d) a j);
    zrušeno „cena závisí na výchylkách finančního trhu“, „doporučeným dopisem“,
    jednostranný zápočet škody a odstoupení prodávajícího „kdykoliv do převzetí“;
  - přeprava: nebezpečí škody až převzetím (§ 2159 odst. 2), kontrola zásilky jen prosba,
    poškození při přepravě = vada, kterou řeší prodávající (dříve „reklamujte u České pošty
    do 2 pracovních dnů“);
  - vady: 2 roky, domněnka 12 měsíců (dříve 6), pořadí nároků § 2169–2171, reklamace
    uplatněna oznámením (dříve „až obdržením zboží“), 30 dní, potvrzení přijetí (§ 19 ZOS);
  - nové články Výroba na zakázku (podle návrhu z auditu §2), Kurzy, Dárkové poukazy,
    Recenze; ČOI jako subjekt mimosoudního řešení sporů, bez platformy ODR (zrušena
    20. 7. 2025); čl. IX o osobních údajích nahrazen odkazem na Zásady (zrušený zákon
    101/2000 Sb., „souhlas“ jako základ, opt-out obchodních sdělení).
- **Reklamační řád** (nová stránka `/reklamacni-rad`), **Reklamační protokol** s formulářem
  (pryč „Formulář ještě dokončujeme“), **Odstoupení od smlouvy** s doslovným poučením
  a formulářem podle NV 29/2023 Sb. ve znění NV 66/2026 Sb. (pryč prohlášení „zboží není
  zbožím uvedeným v § 1837“), **Zásady ochrany osobních údajů** podle tabulky auditu
  (účely, základy, doby, příjemci, ÚOOÚ), **Cookies** bez rozporů a s tabulkou ze soupisu,
  **Doprava a platba** s ceníkem načítaným z backendu (`GET /store/legal/shipping-prices`)
  místo dvou ručně psaných a navzájem odporujících ceníků.
- Právní FAQ (zakázka, kurzy, poukazy, poškozená zásilka) jako pevná sekce pod otázkami
  z CMS; podmínky kurzů na stránce Kurzy.
- Právní stránky odebrané ze Studia (ValeCMS) — jejich znění je v repu.

## Checkout a objednávka (WS-B)

- Tlačítko „Objednávka zavazující k platbě“ na všech cestách (ComGate, dobírka, osobní
  odběr, testovací platba, rychlý nákup); kurzy „Rezervace zavazující k platbě“. Krok
  Platba měl tlačítko „Potvrdit objednávku a zaplatit“, které objednávku neodesílalo —
  nově „Pokračovat ke shrnutí“ (§ 1826a odst. 2 OZ).
- Předsmluvní informace v posledním kroku (§ 1820, § 1826 OZ): platba, dodací lhůta,
  poučení o odstoupení / výjimce, prodávající, odkazy na dokumenty; u zakázky záloha
  vs. zbytek (dřív „Celkem“ neodpovídalo účtované záloze).
- Souhlas s OP a poučením (nezaškrtnutý) + u zakázky povinné potvrzení vyloučení
  odstoupení (§ 1837 písm. d), § 1820 odst. 1 písm. j) OZ). Verze dokumentů se zapisují na
  serveru do `cart.metadata` → `order.metadata` (`terms_version`, `terms_accepted_at`,
  `withdrawal_info_version`, `privacy_version`, `made_to_order_ack_*`), backend dopíše
  serverový čas `terms_recorded_at`; admin widget „Souhlas s podmínkami“.
- Štítek „Na zakázku — nelze vrátit do 14 dnů“ u ceny a upozornění u přidání do košíku.
- Kurzy: souhlas s OP, poučení § 1837 písm. j) OZ se storno podmínkami, nepovinný souhlas
  s fotografiemi; souhlasy uložené u rezervace (`consents`), backend je vyžaduje.
- Dárkový poukaz s vlastní částkou (cena se propíše do košíku, validace na serveru) místo
  „poukazu za 1 Kč a převodu libovolné částky“ (§ 1820, § 1826a OZ).
- Košík ukazuje dopravu „od X“ v měně košíku (i EUR/SK) místo „0“.

## PDF a e-maily (WS-C)

- PDF všech dokumentů (`pnpm legal:build`, Playwright → A4, vložené fonty s diakritikou,
  kontrola textové vrstvy), verzované podle data účinnosti; `pnpm legal:upload` do R2
  s pevným klíčem, bez duplikací, pracovní znění s `[[DOPLNIT]]` se nenahrávají.
- Potvrzení objednávky nese v příloze OP ve verzi platné pro objednávku a poučení
  s formulářem (§ 1827 odst. 2 OZ: potvrzení smlouvy včetně obchodních podmínek
  v textové podobě) + sekci „Smlouva a poučení“; pracovní PDF se nepřikládají.
- Patička e-mailů s identitou prodávající; patička webu s Reklamačním řádem i protokolem
  a sekcí „Ke stažení (PDF)“.

## Odstoupení online a reklamace (WS-D)

- § 1830a OZ (připraveno dopředu): tlačítko „Odstoupit od smlouvy“ v účtu, na potvrzení
  objednávky, v e-mailu potvrzení, odeslání i doručení (podepsaný odkaz pro hosty);
  dvoukrokový formulář (předvyplnění → kontrola → „Potvrdit odstoupení od smlouvy“);
  e-mail s obsahem, datem a časem odeslání (pokyn [4] přílohy NV 29/2023 Sb.).
- Lhůta 14 dnů od **převzetí** (dřív od odeslání), posun na pracovní den (§ 607 OZ).
- Zakázka vyloučená po položkách (dřív jen když byla zakázkou celá objednávka).
- Reklamace: potvrzení s datem a časem uplatnění a lhůtou 30 dnů od uplatnění (§ 19 ZOS).
- Všechny texty o přepravním poškození přepsané: zákazník hlásí nám, dopravce řešíme my
  (ruší rozhodnutí z 12. 10. 2026, podle kterého reklamoval u České pošty příjemce).

## Opravy mimo audit („zjevně právně špatně“)

- **Segment:** analytická událost objednávky posílala do Segmentu (USA) e-mail a jméno
  zákazníka, o čemž Zásady mlčely → posílá se jen číslo, částka a položky (čl. 5 odst. 1
  písm. c) GDPR). Zda Segment vůbec používat, je v OPEN_QUESTIONS.
- **Recenze** se štítkem „ověřený nákup“ u všech (viz WS-F).
- **Mapa Google** bez souhlasu (viz WS-E).
- Výchozí adresa pro vrácení zboží na jméno prodávající, ne na název obchodu.

## Cookies a analytika (WS-E)

- Lišta souhlasu: „Přijmout vše“, „Odmítnout vše“ a „Nastavení“ jsou stejně výrazné tlačítky,
  nic není předem zapnuté (§ 89 odst. 3 zákona č. 127/2005 Sb., opt-in). Dřívější „Přijmout jen
  důležité“ ve skutečnosti zapínalo i preferenční cookies → verze souhlasu zvýšena na 2, každý
  návštěvník se rozhodne znovu.
- Lišta je připojená jednou v kořenovém layoutu → odkaz „Nastavení cookies“ v patičce funguje
  i v pokladně (dřív tam nedělal nic).
- Google Analytics: dřív se nenačítaly vůbec, ač stránka Cookies tvrdila opak. Nově připravené
  tak, aby se načetly jen s `NEXT_PUBLIC_GA_MEASUREMENT_ID` a souhlasem: Consent Mode v2
  s výchozím `denied`, skript `gtag.js` až po souhlasu, při odvolání `ga-disable` a smazání `_ga*`.
- Mapa Google v kontaktním okně se načte až po kliknutí (nebo s marketingovým souhlasem) —
  dřív stahovala obsah a cookies Googlu bez souhlasu.
- Soupis cookies (`cookies-inventory.ts`) ověřený proti kódu, vč. třetích stran (Zásilkovna,
  Balíkovna, ComGate, Google).

## Poptávka zakázky (WS-G)

- Formulář na stránce Výroba (audit §2 a §6: odkaz „Zakázková tvorba“ vedl jen na popis procesu):
  popis, rozměry, motiv, fotky místa, termín, kontakt; povinný nezaškrtnutý souhlas s OP
  (čl. Výroba na zakázku), informace o zpracování údajů, poučení o § 1837 písm. d) OZ a o tom,
  že smlouva vzniká až potvrzením nabídky / zaplacením zálohy.
- Backend `POST /store/commission-inquiries` s ochranou proti spamu (honeypot, limity podle
  e-mailu, IP a celkově kvůli dennímu stropu Resendu); e-mail majitelce + potvrzení zákazníkovi
  s verzí OP a časem souhlasu.

## Slevy, recenze, řazení (WS-F)

- **§ 12a ZOS:** nový modul historie cen (hodinový zápis nejnižší ceny dne, základní i akční).
  U zlevněného zboží se ukazuje „Nejnižší cena za 30 dní před slevou“ a procento slevy se počítá
  z ní, ne ze základní ceny. Dokud historie nepokrývá celých 30 dní (prvních 30 dní po nasazení),
  web píše pravdivě „Nejnižší cena před slevou“ s poznámkou; bez reference nezobrazí přeškrtnutou
  cenu vůbec.
- Kusy s vadou (kolekce „Poškozené“): „Cena kusu s uvedenou vadou“ bez přeškrtnuté ceny a procent
  — nejde o slevu, ale o cenu kusu s vadou.
- **§ 5 ZOS (klamavé praktiky):** štítek „Ověřený nákup“ měly dosud **všechny** recenze, i když se
  nic neověřovalo. Nově se ověřuje na serveru (zákazník má nezrušenou objednávku s výrobkem; u
  e-mailové shody jen s ověřeným e-mailem účtu) a štítek mají jen ověřené recenze. U recenzí je
  vysvětlení, jak se ověřují a moderují.
- Řazení „Doporučené“: vysvětlivka podle skutečnosti (pořadí přidání do e-shopu; výsledky hledání
  napřed přímé shody), bez placeného zvýhodnění.
- Nasazení: migrace (`price_history_entry`, `review.verified_purchase` vč. doplnění u starých
  recenzí) a jednou `npx medusa exec ./src/scripts/backfill-price-history.ts`.

## Opravy po kontrole (R2)

Nálezy nezávislé kontroly storefrontu; backend se tu neměnil.

- **FAQ z CMS odporovalo zákonu.** Ve Studiu zůstaly odpovědi „ozvěte se nám do 48 hodin“
  (rozbitá zásilka) a „Nepoužitý výrobek … můžete vrátit do 14 dnů“ — rozbitý kus je vada při
  převzetí bez krátké lhůty (§ 2161 odst. 1, § 2159 odst. 2 OZ) a podmínku „nepoužitý“ zákon
  nezná, spotřebitel odpovídá jen za snížení hodnoty (§ 1829, § 1833 OZ). Nově
  `PINNED_FAQ_ANSWERS` v `lib/legal/faq.ts`: odpověď na tato témata dává vždy kód, otázka,
  kategorie a pořadí zůstávají z CMS. Dokument `qna` nemá stálý klíč (mimo náhled je `id` null),
  páruje se proto normalizované znění otázky + úzké vzory pro přeformulovanou otázku.
  OPEN_QUESTIONS #22 doplněno (text ve Studiu stejně opravit).
- **Záložka „Doprava a vrácení“ u výrobku:** pryč „nebo Zásilkovnou“ (posíláme jen Českou
  poštou — Balíkovna, na adresu, křehký balík — nebo osobní odběr) a vágní „Když něco
  nesedne… domluvíme se“; místo toho zákonné právo vrátit do 14 dnů s odkazem na poučení
  a výjimka pro zakázku (§ 1829, § 1837 písm. d) OZ).
- **Archiv smlouvy v účtu** (OP čl. III a IV, § 1827 OZ): detail objednávky v účtu i potvrzení
  objednávky ukazují „Obchodní podmínky: znění od …“ s odkazem na `/smluvni-podminky/<verze>`
  a u zveřejněného PDF i „PDF“. Verze = `order.metadata.terms_version`, jinak verze platná
  v den objednávky; počítá se na serveru (`lib/legal/order-terms.ts`), registr do prohlížeče
  nejde.
- **§ 12a ZOS:** když reference nejnižší ceny za 30 dní není k dispozici, web už neukazuje
  holý štítek „Sleva“ (byl to sám o sobě údaj o slevě bez předchozí ceny) — jen aktuální cenu
  (stránka výrobku i karta v obchodě).
- **Kus s vadou:** u „Cena kusu s uvedenou vadou“ věta, že i takový kus lze do 14 dnů vrátit,
  jen vadu, kvůli které je levnější, nelze reklamovat (§ 1829, § 2167 písm. a) OZ; audit §3).
- **Odstoupení — kde je odkaz pro hosty:** dokumenty tvrdily jen „e-mail o odeslání
  objednávky“, odkaz je ale už v potvrzení objednávky a odstoupit jde i před odesláním → „v
  potvrzení objednávky nebo v e-mailu o jejím odeslání“ (Odstoupení — postup online i [4]
  poučení, jen vyplňované části; OP čl. VIII).
- **Obchodní sdělení:** OP čl. XIV tvrdily, že nabídky chodí jen po přihlášení k newsletteru,
  ač obchod posílá žádost o hodnocení a upozornění na zlevnění oblíbeného výrobku. Nově
  popsané obojí, s odkazem na odmítnutí jedním kliknutím v každém takovém e-mailu (backend
  ho doplňuje zvlášť); Zásady uvádějí základ oprávněný zájem podle § 7 odst. 3 zákona
  č. 480/2004 Sb. a že připomenutí opuštěného košíku je dnes vypnuté. Posouzení advokátem
  zůstává (OPEN_QUESTIONS #16d).
- **Vlajky bez CDN:** přepínač země bral vlajky z cdn.jsdelivr.net — IP návštěvníka šla
  třetí straně na každé stránce před jakýmkoli souhlasem. SVG (lipis/flag-icons, MIT) jsou
  nově v `public/assets/flags/`. Jiné načítání z CDN třetích stran před souhlasem
  storefront nemá (fonty jsou vlastní, Google Analytics jen po souhlasu, mapa po kliknutí).
- **Rychlé přidání do košíku** na kartě se u zakázky nenabízí — zadání a potvrzení výjimky
  z odstoupení patří ke kusu na stránce výrobku (§ 1820 odst. 1 písm. j) OZ).
- **Číslo účtu z kódu pryč:** `getMerchantIdentity()` nesl napevno účet, IBAN a SWIFT jako
  výchozí hodnoty a s patičkou se serializovaly do dat každé stránky, ač je nic nečetlo
  a který účet platí, je otevřené (OPEN_QUESTIONS #1). Pole odstraněna.
- **Pomoc u objednávky:** „Reklamace a výměny“ vede na Reklamační řád (dřív na Odstoupení),
  vedle nově „Vrácení do 14 dnů“ na Odstoupení.
- **Newsletter v patičce:** věta u formuláře odkazuje na Zásady ochrany osobních údajů
  (čl. 13 GDPR); text z CMS zůstává editovatelný, odkaz je v kódu.
- **„Ke stažení (PDF)“ v patičce** nabízí jen zveřejněná PDF (absolutní https URL z
  `pnpm legal:upload`); pracovní znění s `[[DOPLNIT]]` se už nenabízí.

## Opravy po testech v sandboxu (R3)

Nálezy z kontroly a z testovacích objednávek v izolovaném sandboxu (`backend/sandbox`).

- **Potvrzení rezervace kurzu bez zástupného textu** (§ 1827 odst. 2 OZ). Dokud
  `COURSE_CANCELLATION_TERMS` (`modules/course/legal.ts`) nese `[[DOPLNIT`, e-mail storno
  podmínky necituje — zůstává poučení o výjimce z odstoupení (§ 1837 písm. j) OZ) a věta, že
  storno podmínky jsou v obchodních podmínkách, čl. X Keramické kurzy, s odkazem. Platí i pro
  opakované odeslání starší notifikace. Nově jde s potvrzením PDF obchodních podmínek té verze,
  se kterou zákazník rezervoval (`consents.terms_version`, jinak verze platná v den rezervace),
  když je PDF zveřejněné (https, ne pracovní znění) a ke stažení (HEAD) — jinak jen odkaz.
  Příloha přes `data.__attachments` jako u objednávky; když ji Resend odmítne, e-mail odejde
  bez ní a místo „v příloze“ ukáže odkaz na PDF.
- **Odmítnutí e-mailů z oprávněného zájmu jedním kliknutím** (§ 7 odst. 3 zákona
  č. 480/2004 Sb., čl. 21 GDPR — slib OP čl. XIV a Zásad). Nový modul `email-optout`
  (tabulka `email_opt_out`: normalizovaný e-mail + druh `review_request` / `price_drop` /
  `abandoned_cart`, unikátní dvojice; migrace `Migration20261015120000`). Podepsaný odkaz
  (`lib/email-optout-link.ts`, HMAC pod účelem `email-optout:<druh>`, nevyprší, token
  newsletteru ani jiného druhu neprojde) vede na top-level `GET /email-optout` (idempotentní)
  a ten přesměruje na `/newsletter?stav=odhlaseno-upozorneni&druh=…` („Hotovo — tyhle e-maily
  (…) vám už posílat nebudeme.“); bez storefrontu odpoví česky rovnou. Prosba o recenzi (job
  i ruční odeslání z adminu — to odmítnutou adresu odmítne i s `force`), upozornění na pokles
  ceny a připomenutí košíku (job je vypnutý, ale pravidlo respektuje) odmítnuté adresy
  přeskakují a nesou v patičce „Nechcete tyto e-maily? Odhlásit je jedním kliknutím“.
  Z upozornění na pokles ceny zmizela věta o vypnutí „v nastavení účtu“ (takové nastavení
  není).
- **Potvrzení zakázky ukazuje doplatek i při souběhu.** Potvrzovací e-mail a
  `initialize-merchant-order` běží na `order.placed` souběžně; e-mail se skládal dřív, než
  vznikla produkční objednávka se zálohou, a zakázka za 2 479 Kč se zaplacenou zálohou 679 Kč
  přišla bez „Zbývá doplatit“ a tlačítka Doplatit. Doplatek se teď bez produkční objednávky
  (nebo bez zálohy v ní) bere z platební kolekce pokladny (`original_cart_total` − účtovaná
  částka), jinak z modulu jako dosud (`resolveOrderOutstanding`). Bez čekání a bez nové
  události — běžná objednávka se nemění, dvojí odeslání nehrozí (klíč `order-placed:<id>`).
- **Čistá zakázka v potvrzení objednávky:** „Správa objednávky“ už neříká „Odstoupit od
  smlouvy můžete do 14 dnů…“, když sekce „Smlouva a poučení“ správně uvádí, že odstoupit nejde
  (§ 1837 písm. d) OZ).
- **Způsob platby bez „kartou“:** ComGate bere i převod, Apple Pay a Google Pay. Potvrzení
  objednávky píše „Online platba přes platební bránu ComGate“, odstoupení / reklamace „vrátíme
  je stejnou cestou, jakou jste platili (přes ComGate)“ a e-mail o vrácení peněz „stejnou
  cestou, jakou jste platili (přes ComGate)“.
- **Reklamace ukládá převzetí:** `return_request.takeover_at` se u reklamace doručené
  objednávky plnilo jen u odstoupení / vrácení; teď stejným výpočtem i u reklamace (od převzetí
  běží záruka). Lhůta pro odstoupení a text převzetí do potvrzení se reklamace dál netýkají.
- **Storefront — doběrečné v součtech:** „Výrobky“ v košíku, pokladně, potvrzení i detailu
  objednávky byly mezisoučet minus balné, takže do nich padalo i 39 Kč doběrečného. Nově
  mezisoučet minus balné minus doběrečné a „Doběrečné“ jako vlastní řádek rozpadu.
  „Chybějící výrobek“ v pravém souhrnu pokladny (snímek `e-review-ready`) chyba storefrontu
  nebyla: řádek v DOM je, jen celostránkový snímek Playwrightu znovu spustil animaci
  `itemReveal` a další snímek hned po něm zachytil druhý řádek (zpoždění 60 ms) s nulovou
  průhledností. Změřeno v sandboxu (stejné uzly, žádné nové připojení, obyčejná změna okna
  animaci nespouští); `e2e.mjs` teď snímá s `animations: "disabled"`.
- **Storefront — tečka za „poučení o odstoupení“** v předsmluvních informacích už nevisí
  na samostatném řádku (`dd` je mřížka, souvislá věta je teď v jednom `span`).

## Opravy po druhé kontrole

- **E-mail o zlevnění výrobku v oblíbených (§ 12a ZOS):** přeškrtnutá „předchozí cena“ je
  nově nejnižší cena za 30 dní před snížením z historie cen (dřív poslední zachycená cena),
  s popiskem „nejnižší cena za 30 dní před snížením“. Bez úplné 30denní historie, nebo když
  nová cena není pod 30denním minimem, se snížení neoznamuje.
- Odkaz na odmítnutí e-mailů (recenze, zlevnění, košík) má záložní variantu „napište nám
  na info@…“, když není nastavená adresa backendu — možnost odmítnout musí být v každé zprávě
  (§ 7 odst. 3 zákona č. 480/2004 Sb.).
- Stránky dokumentů nabízejí ke stažení jen zveřejněná PDF (pracovní znění s `[[DOPLNIT]]`
  ne), stejně jako patička a e-maily.
- OP a Odstoupení: kusy s vadou se v obchodě hledají filtrem „Poškozené“ (nebyla to kolekce).
- Texty o vracení peněz („neplatili kartou“, „zpět na kartu“) obecně: „online přes ComGate“,
  „stejnou cestou, jakou jste platili“ — ComGate bere i převod a peněženky.
- Stránka newsletteru čte stav z adresy jen z vlastních klíčů (`?stav=constructor`).
