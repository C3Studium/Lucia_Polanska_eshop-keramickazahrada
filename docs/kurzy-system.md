# Kurzy — rezervační systém

Kompletní rezervace keramických kurzů: vypsané termíny na webu, rezervace
s platbou kartou (ComGate) nebo na místě, potvrzovací e-maily, faktura
z iDokladu a správa termínů v administraci.

## Co je kde

### Backend

| Co | Kde |
| --- | --- |
| Modul (modely, service, ceny) | `backend/src/modules/course/` |
| Migrace | `backend/src/modules/course/migrations/` (naposledy `Migration20260820110000` — cancel_reason `customer`) |
| Registrace modulu | `backend/medusa-config.js` (blok `./src/modules/course`) |
| Store API | `backend/src/api/store/courses/**` + `backend/src/api/store/customers/me/course-reservations/` |
| Admin API | `backend/src/api/admin/courses/**` |
| Platební odkaz (ComGate) | `backend/src/lib/course-payment.ts` |
| Automatická refundace (ComGate) | `backend/src/lib/course-refund.ts` |
| Čekací listina — notifikace | `backend/src/lib/course-waitlist.ts` |
| Čistá logika jobů (okna, guardy, klíče) | `backend/src/modules/course/lifecycle.ts` |
| Podepsané odkazy na rezervaci | `backend/src/lib/course-reservation-link.ts` |
| iDoklad faktura | `backend/src/lib/course-invoice.ts` |
| E-maily (odesílání) | `backend/src/lib/course-emails.ts` |
| E-maily (šablony) | `backend/src/modules/resend/emails/course-reservation-confirmed.tsx`, `course-term-cancelled.tsx`, `course-payment-expired.tsx`, `course-reminder.tsx`, `course-waitlist-spot.tsx` (registrované v `resend/service.ts`) |
| Subscriber na zaplacení | `backend/src/subscribers/course-payment.ts` |
| Joby (expirace / připomínky / proběhlé) | `backend/src/jobs/expire-course-payments.ts`, `course-reminders.ts`, `finish-course-terms.ts` |
| Admin stránka „Kurzy" | `backend/src/admin/routes/kurzy-sprava/page.tsx` |
| Unit testy cen a kapacity | `backend/src/modules/course/__tests__/pricing.unit.spec.ts` |
| Unit testy expirace/refundací/čekací listiny | `backend/src/modules/course/__tests__/lifecycle.unit.spec.ts`, `backend/src/modules/resend/__tests__/course-lifecycle-emails.unit.spec.tsx` |
| Unit testy samoobsluhy (48h cutoff, atomická změna počtu osob, kalendář) | `backend/src/modules/course/__tests__/self-service.unit.spec.ts`, `party-size-update.unit.spec.ts`, `calendar-math.unit.spec.ts` |
| Middleware (nepovinné přihlášení u create + samoobsluhy) | `backend/src/api/middlewares.ts` (`/store/courses/reservations`, `…/:id/cancel`, `…/:id/edit`) |

### Storefront

| Co | Kde |
| --- | --- |
| Stránka /kurzy (timeline + teaser + modál) | `storefront/src/app/[countryCode]/(main)/kurzy/page.tsx`, `storefront/src/modules/home/Kurzy/` |
| Rezervační teaser (`#rezervace`) | `storefront/src/modules/kurzy/Rezervace/` |
| Rezervační modál (kalendář + stepper + čekací listina) | `storefront/src/modules/kurzy/RezervaceModal/` |
| Kalendářní aritmetika (čistá, testovaná backendovým jestem) | `storefront/src/lib/util/course-calendar.ts` |
| Sdílené formátování (Praha, Kč, plurály) | `storefront/src/modules/kurzy/format.ts` |
| Stránka rezervace (návrat z ComGate, odkaz z e-mailu) | `storefront/src/app/[countryCode]/(main)/kurzy/rezervace/[id]/page.tsx` + `storefront/src/modules/kurzy/RezervaceDetail/` |
| Účet → Kurzy | `storefront/src/app/[countryCode]/(main)/account/@dashboard/kurzy/page.tsx` + `storefront/src/modules/kurzy/AccountKurzy/` (odkaz v `account-nav`) |
| Data vrstva (server actions) | `storefront/src/lib/data/courses.ts` |

## Datový model

**course_term** — jeden vypsaný termín: název, místo, `starts_at`
(uloženo v UTC, zobrazuje se vždy v Europe/Prague), délka v minutách,
kapacita, ceny (`price_single`, volitelně `price_two` za osobu pro dvojici,
volitelně `group_min` + `price_group_per_person`), stav
(`draft | published | cancelled | finished`), poznámka.

**course_reservation** — jedna rezervace: termín, volitelně `customer_id`
(přihlášený zákazník), jméno, e-mail, telefon, počet osob, cenové pásmo
(`single | pair | group`), **celková cena spočítaná vždy serverem**, způsob
platby (`online | on_site`), stav platby (`pending | paid | on_site`),
stav (`active | cancelled`) + `cancel_reason`
(`auto_expired | manual | term_cancelled | customer`), `refunded_at` (razítko úspěšné
automatické refundace — nikdy nevracet dvakrát), zdroj (`web | manual`),
poznámka majitelky, platební identifikátory (collection/session/transakce
ComGate) a fakturační údaje z iDokladu.

**course_waitlist** — čekací listina plného termínu: jméno, e-mail, počet
osob, `notified_at` (jedno „uvolnilo se místo" na záznam, nikdy víc).
Migrace `Migration20260819110000`.

### Ceník — pravidla

- 1 osoba → cena za jednoho.
- 2 osoby → cena za dva **za osobu** (pokud je vyplněná; má přednost před
  skupinovou cenou, i kdyby skupina začínala od 2).
- `group_min` a víc osob → skupinová cena za osobu.
- Cokoliv jiného (3 lidé pod skupinovým prahem, 2 bez ceny za dva) →
  cena za jednoho × počet osob.

Vše počítá `backend/src/modules/course/pricing.ts` — jediné místo s touto
aritmetikou (quote endpoint, vytvoření rezervace i ruční zápis v adminu).
Klient ceny jen zobrazuje.

### Kapacita

Obsazenost = součet `party_size` **nezrušených** rezervací. Vytvoření
rezervace běží v transakci s `SELECT … FOR UPDATE` na řádku termínu
(`CourseModuleService.reserveSeats`), takže dva lidé bojující o poslední
místa se serializují a server přebukování odmítne — česky a s počtem
zbývajících míst.

## Platba kartou (ComGate)

Rezervace nemá objednávku, proto se platí přes **samostatnou payment
collection** + payment session s ComGate providerem — stejná mašinerie jako
doplatky zakázkové výroby (`lib/balance-payment.ts`), jen bez linku na
objednávku. Zvoleno záměrně: webhook `/hooks/payment/pp_comgate_comgate`
akceptuje pouze `refId` ve tvaru `payses_…`, takže platba mimo payment
session by naším vlastním webhookem neprošla.

Tok: create rezervace (pending) → payment session s návratovými URL na
`/kurzy/rezervace/{id}?token=…&vysledek=paid|cancelled|pending` → zákazník
platí u ComGate → ověřená push notifikace → `processPaymentWorkflow`
(authorize + capture) → event `payment.captured` → subscriber
`course-payment.ts` označí rezervaci `paid`, vystaví fakturu (iDoklad,
env-gated, neplátce DPH — jedna položka, hned uhrazená, PDF zrcadlené do
MinIO) a pošle potvrzovací e-mail s odkazem na fakturu. Vše idempotentní —
opakované doručení eventu nic nezdvojí, jen doléčí případný výpadek.

Přerušená platba: stránka rezervace nabízí „Zkusit zaplatit znovu"
(`POST /store/courses/reservations/{id}/pay`, token-gated); zrušená ComGate
transakce dostane novou session, živá se znovu použije.

## E-maily

- `course-reservation-confirmed` — jedna šablona, dvě varianty: `on_site`
  (odchází hned při rezervaci) a `paid` (odchází po připsání platby; slouží
  zároveň jako potvrzení platby, proto neexistuje samostatný
  course-payment-received). Obsahuje kde/kdy/kolik osob/cenu, odkaz na
  rezervaci a případně PDF faktury.
- `course-term-cancelled` — při zrušení termínu všem nezrušeným rezervacím
  s e-mailem; zaplaceným kartou říká, že peníze se už vracejí (proběhla-li
  automatická refundace), jinak ponechává slib ručního vrácení.
- `course-payment-expired` — po 24 h bez platby (hourly job) rezervaci
  uvolníme a zákazníkovi to řekneme s odkazem zpět na /kurzy.
  Klíč `course-expired:{reservation_id}`.
- `course-reservation-cancelled` — při zrušení jedné rezervace (ne celého
  termínu) zákazníkovi s e-mailem; tři varianty peněz: `refunded` (částka se
  už vrací na kartu), `manual_refund` (ozveme se kvůli vrácení), `unpaid`
  (jen zrušení). K tomu hlas podle původce: `cancelledByCustomer` potvrzuje
  zákazníkovo vlastní zrušení („na vaši žádost", bez omluvy za
  nedorozumění). Klíč `course-cancelled:{reservation_id}`.
- Změna počtu osob (samoobsluha) u platby na místě znovu pošle
  `course-reservation-confirmed` s novými čísly pod klíčem
  `course-confirm:updated:{reservation_id}:{party_size}` — opakovaná změna
  se tedy pošle znovu, opakovaný request stejné změny ne. Online-nezaplacené
  rezervace při editaci e-mail nedostávají: jejich směrodatné potvrzení je
  účtenka po zaplacení (a ta už nese nová čísla).
- `course-reminder` — ~3 dny předem (okno now+1d…now+3d — dva dny široké,
  aby jeden vynechaný či opožděný běh žádný termín trvale nepřipravil
  o připomínku; klíč zaručí jen jedno odeslání; denní job): kde,
  kdy, kolik osob, poznámka termínu („co s sebou") a u platby na místě
  částka k zaplacení. Klíč `course-reminder:{reservation_id}`; rezervace
  bez e-mailu se majitelce sečtou do jedné zprávy „obvolejte"
  (`course-reminder-calllist:{term_id}`).
- `course-waitlist-spot` — čekateli, jehož celá skupina se právě vejde;
  místo se nedrží, platí kdo dřív dokončí rezervaci.
  Klíč `course-waitlist:{entry_id}`.

Majitelka dostává notifikaci (zvonek + e-mail) o každé nové rezervaci
(u platby na místě hned, u karty po zaplacení).

## Admin — „Kurzy" v postranním menu

`/app/kurzy-sprava`: záložky Nadcházející / Proběhlé a zrušené.

- **Nový termín / Upravit** — všechna pole včetně cen; kapacitu nejde snížit
  pod už rezervovaná místa; zrušení termínu má vlastní tlačítko.
- **Obsazenost** — pruh X/kapacita (zelená → oranžová → červená).
- **Rezervace** — kdo přijde, kontakty, pásmo + částka, stav platby;
  „Zapsat rezervaci" pro telefonické domluvy (jen jméno + počet + poznámka).
- **Zrušit rezervaci** — uvolní místa (a probudí čekací listinu); u
  zaplacené kartou se hned pokusí o automatickou refundaci přes ComGate
  (payment-modul `refundPayment` — NE `refundPaymentWorkflow`, ten by na
  samostatné kolekci bez objednávky spadl; refunduje se zbývající
  refundovatelná částka, guard `refunded_at` + zámek řádku platby v modulu);
  zákazník s e-mailem dostane `course-reservation-cancelled` s pravdivou
  formulací o penězích; jen když se refundace nepovede,
  toast řekne „vraťte ručně". Zrušené řádky říkají důvod slovy:
  „zrušeno — nezaplaceno (automaticky)" / „zrušeno ručně" / „zrušeno se
  zrušením termínu" / „zrušil zákazník" + stav peněz.
- **Zrušit termín** — potvrzovací dialog s počty; zruší i všechny rezervace
  (`cancel_reason: term_cancelled`), zkusí refundace po jedné (jedna chyba
  nezastaví ostatní), pak rozešle e-maily s pravdivou formulací o penězích
  a vyjmenuje rezervace bez e-mailu i ty k ručnímu vrácení. Čekací listina
  se při zrušení termínu záměrně neobesílá.
- **Čekací listina** — karta termínu ukazuje „Čekají na uvolnění místa: N"
  s rozbalovacím seznamem jmen; poznámka termínu v editaci upozorňuje, že
  ji uvidí účastníci v připomínce.

## Storefront — stránka /kurzy

Pinned timeline má nyní dvě scény: hero a „Pro koho" (krátký popisek + tři
bloky). Poslední dvě scény (děti / dospělí „připravujeme") byly odstraněny
včetně stylů — nahrazují je bloky:

1. **Pro děti a školy** → kontaktní dialog (téma Kurzy)
2. **Pro firmy a spolky** → kontaktní dialog (téma Kurzy)
3. **Pro zájemce** → „Vybrat termín" otevře rezervační **modál**

Pod timeline zůstává kompaktní **teaser** (`#rezervace` — deep link sem
scrolluje): serverově renderovaný SEO text, nejbližší tři termíny jako
karty jen ke čtení a jedno tlačítko „Vybrat termín", které otevírá modál.

### Rezervační modál (`RezervaceModal/`)

Mechanika dle ContactDialogu (portál, focus trap, Esc, backdrop, scroll
lock, návrat fokusu na spouštěč) — zavření uprostřed formuláře (i Escem)
nic neztrácí: vyplněná pole a vybraný termín přežívají v draftu na úrovni
modulu a nové otevření je obnoví (vědomě žádný potvrzovací dialog navíc;
draft se maže po potvrzené rezervaci a při reloadu stránky). Choreografie
dle express-checkout Routeru: progress rail **01 Termín · 02 Údaje · 03 Platba** s fajfkami
hotových kroků, směrové slide/crossfade panely, animovaná výška,
`useReducedMotion` → okamžitý crossfade. Po odeslání následuje stav
**Souhrn** (není čtvrtý krok railu): u platby na místě inline (co, kdy,
kde, kolik osob, cena, co bude dál + odkaz na stav rezervace), u karty
končí práce modálu redirectem na ComGate a souhrn je stávající návratová
stránka rezervace.

- **Krok 1 — Termín**: přepínač „Kalendář / Seznam". Kalendář je český
  měsíční (pondělí první, Europe/Prague, měsíční aritmetika ručně v
  `course-calendar.ts`): dny s termíny nesou tečku (u více termínů počet),
  ‹ › listuje od aktuálního měsíce po poslední s termínem, výběr dne ukáže
  jeho karty termínů pod mřížkou. Mřížka je sada tlačítek s rovingem
  (šipky, Home/End) a plnými aria-labely („úterý 15. září — 1 termín,
  zbývají 3 místa") — vědomě NE `role="grid"`, tlačítka s labely jsou
  jednodušší a robustnější kontrakt. Seznam je původní radio-card vzor.
  Plný termín je dál klikací a otevře mini formulář čekací listiny přímo
  v modálu (stejná pravidla: honeypot, rate limit, tichá deduplikace,
  místo se nedrží).
- **Krok 2 — Údaje**: jméno, e-mail, telefon (autocomplete, 16px inputy),
  počet osob se stepperem, živá cena z quote endpointu (debounce +
  request-id guard). Do kroku 3 pustí jen validní pole; chyby česky u polí.
- **Krok 3 — Platba**: rekapitulace s rozpisem („2 × 800 Kč = 1 600 Kč"),
  volba karta/na místě, honeypot, submit = stávající create server action.
  Chyba kapacity vrací do kroku 1 s čerstvě načtenými termíny a hláškou
  serveru (role=alert).

Přihlášenému zákazníkovi se rezervace připojí k účtu; hosté se v účtu
párují i podle e-mailu. Uvolnění míst hlídá `notifyCourseWaitlist` po
každém zrušení rezervace, expiraci i navýšení kapacity (FIFO, jen celé
skupiny, které se vejdou).

## Samoobsluha zákazníka (zrušení a změna počtu osob)

Obojí do **48 hodin před začátkem** (`COURSE_SELF_SERVICE_CUTOFF_HOURS`
v `lifecycle.ts`); potom obě cesty odmítají s „Do kurzu zbývá méně než
48 hodin — zavolejte mi prosím." a UI akce schová + řekne proč jednou
větou. Autorizace: **HMAC token** (stejný jako stavová stránka) NEBO
přihlášený zákazník, jehož účet rezervaci vlastní (customer_id, u hostů
e-mail účtu — přesně pravidlo účtového seznamu); bez důkazu 404.
Middleware: nepovinné přihlášení na obou routách.

- `POST /store/courses/reservations/:id/cancel` — zrušení je atomický
  podmíněný UPDATE (`cancelReservationByCustomer` — WHERE znovu ověří
  `status='active'` pod zámkem řádku, `RETURNING *`): dvě závodící okna
  provedou právě jedno zrušení (a jeden pokus o refundaci), a o penězích
  se rozhoduje z řádku vráceného tím UPDATE — platba připsaná mezi
  načtením a zrušením tedy refundaci dostane. Nastaví
  `cancelled + cancelled_at + cancel_reason='customer'`, místa se uvolní
  (obsazenost počítá jen nezrušené), probudí čekací listinu, u zaplacené
  karty hned automatická refundace (`refundCourseReservation`, guard
  `refunded_at` — nikdy dvakrát), zákazníkovi
  `course-reservation-cancelled` (varianta peněz + hlas „na vaši
  žádost"), majitelce zvonek + e-mail („peníze vráceny automaticky" /
  „vraťte ručně" / „nebylo zaplaceno").
- `POST /store/courses/reservations/:id/edit` — jen dokud NENÍ zaplaceno
  kartou (`payment_method=on_site`, nebo online-nezaplacená); kapacita se
  znovu ověří pod zámkem řádku termínu
  (`CourseModuleService.updateReservationPartySize` — stejný vzor jako
  `reserveSeats`: lock, přepočet míst bez této rezervace, odmítnutí
  s poctivým zbytkem, cena z uzamčeného řádku). Způsobilost („nezaplaceno
  online") se uvnitř transakce ověří ZNOVU na řádku rezervace zamčeném
  `FOR UPDATE` — platba, kterou subscriber připsal mezi kontrolou v routě
  a zámkem, editaci odmítne místo odtržení zaplacené částky od ceny. Online-nezaplacené
  rezervaci se přitom smaže uložený platební odkaz (nesl starou částku) —
  „Zkusit zaplatit znovu" založí nový na novou cenu. Kdyby zákazník přesto
  zaplatil přes staré, ještě otevřené ComGate okno, subscriber platbu
  pozná podle `course_reservation_id` v metadatech kolekce a hlasitě
  (urgentně) řekne majitelce, že částka nemusí sedět a je třeba ji srovnat
  ručně. Zaplacená karta dostane v UI vysvětlení: „Zaplacenou rezervaci
  upravíte zrušením (peníze vrátíme na kartu) a novou rezervací — nebo mi
  zavolejte."

Storefront: stavová stránka rezervace (`RezervaceDetail`) má „Změnit
počet osob" (inline stepper + uložit) a „Zrušit rezervaci" (inline
potvrzení vyjmenovává důsledky; slib vrácení peněz jen když je pravdivý).
Účet → Kurzy odkazuje na tutéž stránku (token skládá server v
`/store/customers/me/course-reservations`), akce jsou tedy jedny.
Zákazníkovo vlastní zrušení stránka říká jeho hlasem („Rezervaci jste
zrušili" + stav peněz podle `cancel_reason`/`refunded_at` ze store GET).

## Joby (cron)

- `expire-course-payments` (`25 * * * *`) — online rezervace bez platby po
  24 h zruší (`cancel_reason: auto_expired`); zrušení je atomický podmíněný
  UPDATE (`expireUnpaidReservation` — WHERE znovu ověří „nezaplaceno,
  aktivní" pod zámkem řádku, platba došlá o milisekundu dřív vyhrává);
  platba došlá až po zrušení skončí v subscriberu (který si stav po zápisu
  ještě jednou přečte) jako „platba u zrušené rezervace — vraťte ručně".
  Majitelka se o expiracích nenotifikuje (šum), admin je vidí slovy.
- `course-reminders` (`30 7 * * *`) — připomínky 3 dny předem + „obvolejte"
  seznam pro rezervace bez e-mailu.
- `finish-course-terms` (`0 2 * * *`) — vypsané termíny po konci
  (`starts_at` + délka, bez délky samotný začátek) překlopí na `finished`.

## Ověřeno (gates)

- backend: `npm run typecheck` ✓, `npm run test:unit` ✓ (po modálu,
  samoobsluze a checker-hardeningu závodů: 581 testů / 37 suit, vše
  zelené), build se pouští společně na závěr
- storefront: `npx tsc --noEmit` ✓

## Vědomá rozhodnutí

- **Zrušení jedné rezervace zákazníkovi e-mail POSÍLÁ**
  (`course-reservation-cancelled`) — s automatickými refundacemi by peníze
  jinak přicházely zpět bez vysvětlení; toast majitelce říká, že zákazník
  byl obeslán.
- **Refundace nikdy dvakrát** — `refunded_at` + refunduje se jen zbývající
  částka (captured − už vrácené; pád mezi refundací a razítkem se tak při
  opakování doléčí sám) + zámek řádku platby v payment-modulu + provider
  hlídá vlastní součet.
- **Posun data termínu po odeslaných připomínkách** — editace data v adminu
  zobrazí varování, že připomínka s původním datem už mohla odejít a nová
  se sama nepošle; obeslat účastníky musí majitelka.
- **Čekací listina nedrží místa** — e-mail říká „kdo dřív dokončí
  rezervaci"; zrušený termín čekatele neobesílá (nemají rezervaci).
- Sekce rezervací je serverově renderovaná při každém požadavku (žádná
  cache) — obsazenost je tedy vždy čerstvá, ale finální slovo má stejně
  zámek v databázi. Modál si termíny navíc znovu načte při otevření
  a po chybě kapacity.
- **Kalendářní aritmetika se testuje backendovým jestem** — storefront
  nemá unit runner (jen Playwright e2e), a čistý, bezzávislostní modul
  `course-calendar.ts` se dá importovat napřímo; jinak by měsíční
  počty zůstaly bez brány.
- **Editace online-nezaplacené rezervace neposílá e-mail** — potvrzením
  je až účtenka po zaplacení, která nese nová čísla; poslat „potvrzeno"
  na nezaplacenou rezervaci by lhalo o stavu.
- E-mailové šablony mají mock preview (`npm run dev:email` v backendu).
