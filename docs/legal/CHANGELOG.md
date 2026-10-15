# Právní soulad — co se změnilo a proč

Větev `legal/compliance-2026`, podle `LEGAL_AUDIT.md` (14. 10. 2026). Odkazy na paragrafy:
OZ = zákon č. 89/2012 Sb., ZOS = zákon č. 634/1992 Sb.

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
