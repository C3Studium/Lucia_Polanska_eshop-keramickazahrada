# Newsletter — jak funguje a jak se používá

Kompletní newsletter v administraci: odběratelé s double opt-in, blokový
editor kampaní s živým náhledem, zkušební e-mail a odeslání všem potvrzeným
odběratelům. Vše v sekci **Newsletter** v levém menu administrace.

## Pro Lucii: jak poslat newsletter

1. **Napsat** — vyplňte *Předmět* (a volitelně *Náhledovou větu*, která se
   v doručené poště zobrazí za předmětem). Obsah skládáte z bloků:
   - **Nadpis** — první nadpis se stane velkým úvodním titulkem e-mailu.
   - **Odstavec** — běžný text; nový řádek zůstane novým řádkem.
   - **Tlačítko** — text + úplná adresa (`https://…`).
   - **Produkt** — vyhledáte produkt, e-mail ukáže fotku, název, cenu
     a odkaz na jeho stránku. Jdou vybrat jen publikované produkty.
   - **Oddělovač** — tenká linka mezi částmi.

   Bloky přesouváte šipkami, mažete košem. Vpravo běží **náhled** — je to
   přesně ten e-mail, který odejde (vykresluje ho server, ne prohlížeč).

2. **Zkušební e-mail** — pošlete si ho na vlastní adresu a zkontrolujte
   v poště. Kampani se tím nic neodečítá.

3. **Odeslat kampaň** — tlačítko ukáže, kolika potvrzeným odběratelům
   e-mail odejde, a chce potvrzení. Odeslanou kampaň nejde vzít zpět.
   Dvojklik ani opakování stejné kampaně nikomu nepošle e-mail dvakrát.

4. **Historie** — každá odeslaná kampaň s datem a počtem příjemců.

V záložce **Odběratelé** je celý seznam se stavem (potvrzený / čeká na
potvrzení / odhlášený), hledáním a tlačítkem **Export CSV** (otevře se
správně i v českém Excelu).

## Jak se lidé přihlašují (double opt-in)

1. Návštěvník vyplní e-mail ve formuláři v patičce e-shopu. Formulář říká,
   k čemu adresu použijeme, a že odběr ještě potvrdí v e-mailu.
2. Backend uloží adresu jako **čeká na potvrzení** a pošle e-mail
   „Potvrďte odběr novinek z ateliéru" s podepsaným odkazem.
3. Kliknutím na **Potvrdit odběr** se zapíše `confirmed_at` a člověk
   přistane na stránce `/newsletter?stav=potvrzeno` na e-shopu.
4. Teprve potvrzená adresa dostává kampaně. Nepotvrzené adresy žádný
   newsletter nikdy nedostanou.

Odhlášení: odkaz v patičce každé kampaně vede na
`GET /newsletter/unsubscribe` (podepsaný token per adresa), nastaví
`unsubscribed_at` a přesměruje na `/newsletter?stav=odhlaseno`. Starý
potvrzovací odkaz **nikdy** nepřebije pozdější odhlášení — kdo se odhlásil,
musí se přihlásit znovu formulářem.

## Právní checklist (zák. č. 480/2004 Sb. + GDPR)

- [x] **Souhlas s dokladem (double opt-in).** Uchováváme kdy se adresa
      přihlásila (`subscribed_at`), odkud (`source`) a kdy potvrdila
      (`confirmed_at`). Kampaně jdou **jen** potvrzeným — jediné místo,
      které o tom rozhoduje, je `backend/src/lib/newsletter-recipients.ts`,
      a používá ho jak rozesílka, tak počet příjemců v potvrzovacím dialogu.
- [x] **Funkční odhlášení v každé kampani.** Odkaz je per příjemce,
      podepsaný HMAC, nikdy neexpiruje. Bez nastaveného
      `BACKEND_PUBLIC_URL` by odkazy nefungovaly — administrace odeslání
      **zablokuje** (s vysvětlením) a server ho nezávisle odmítne.
- [x] **Identifikace odesílatele** v patičce každé kampaně: Lucie Polanská,
      sídlo, IČO (env `SIDLO_ADRESA`, `IDENTIFIKACNI_CISLO`, stejné
      proměnné a stejné výchozí hodnoty jako storefront).
- [x] **Důvod doručení**: „Tento e-mail dostáváte, protože jste se
      přihlásili k odběru novinek na keramickazahrada.cz…" — v každé
      kampani, nejde vypnout.
- [x] **Odhlášení se respektuje**: rozesílka filtruje `unsubscribed_at`,
      potvrzovací odkaz odhlášení nepřebije, záznam se nemaže (aby „byla
      tahle adresa někdy přihlášená?" mělo poctivou odpověď).
- [x] Tři povinné náležitosti e-mailu hlídá unit test
      (`backend/src/modules/resend/__tests__/newsletter-blocks-email.unit.spec.tsx`) —
      kdyby je někdo ze šablony omylem odstranil, spadne build.

**Stávající odběratelé (před nasazením):** migrace jim doplnila
`confirmed_at = subscribed_at` — přihlásili se formulářem se souhlasovou
větou v době single opt-in, jejich dokladem souhlasu je samotné přihlášení.
Odhlášení zůstali nepotvrzení. Noví odběratelé už musí kliknout.

## Technická mapa

| Co | Kde |
| --- | --- |
| Model odběratele + kampaně | `backend/src/modules/newsletter/models/` |
| Migrace (confirmed_at, newsletter_campaign) | `backend/src/modules/newsletter/migrations/Migration20260818090000.ts` |
| Podepsané odkazy (confirm + unsubscribe) | `backend/src/lib/newsletter-link.ts` |
| Kdo smí dostat kampaň | `backend/src/lib/newsletter-recipients.ts` |
| Bloky: schéma + sanitizace | `backend/src/lib/newsletter-blocks.ts` |
| Rozesílka (idempotentní, stránkovaná) | `backend/src/lib/newsletter-campaign.ts` |
| Přihlášení (pending + confirm mail) | `backend/src/api/store/newsletter/route.ts` |
| Potvrzení / odhlášení (veřejné GET) | `backend/src/api/newsletter/confirm/`, `…/unsubscribe/` |
| Admin API (subscribers, preview, test, campaigns) | `backend/src/api/admin/newsletter/` |
| Admin stránka | `backend/src/admin/routes/newsletter/page.tsx` |
| E-mail z bloků + právní patička | `backend/src/modules/resend/emails/newsletter-blocks.tsx` (deleguje na něj `promotional.tsx`) |
| Potvrzovací e-mail | `backend/src/modules/resend/emails/newsletter-signup.tsx` (varianta s `confirmLink`) |
| Landing page potvrzení/odhlášení | `storefront/src/app/[countryCode]/(main)/newsletter/page.tsx` |

Šablony v Resend providerovi se nepřidávaly: blokové kampaně jezdí na
registrovaném klíči `promotional` (šablona sama pozná `blocks` a předá je
blokovému rendereru), potvrzovací e-mail na klíči `newsletter-signup`
(varianta s `confirmLink`).

Idempotence: kampaň má klíč `blocks:{den}:{hash obsahu}` — opakovaný pokus
či dvojklik nikomu nepošle druhý e-mail; stejný text poslaný jiný den je
nová kampaň. Zkušební e-maily mají v klíči timestamp, aby šly posílat
opakovaně.

## Potřebné proměnné prostředí

| Proměnná | K čemu | Bez ní |
| --- | --- | --- |
| `BACKEND_PUBLIC_URL` (nebo `MEDUSA_BACKEND_URL`) | potvrzovací a odhlašovací odkazy | odeslání kampaní je zablokované; potvrzovací e-maily se neposílají |
| `STOREFRONT_PUBLIC_URL` | odkazy na produkty a landing page | odkazy v e-mailu se vynechají, potvrzení skončí na textové stránce backendu |
| `SIDLO_ADRESA`, `IDENTIFIKACNI_CISLO` | identifikace odesílatele v patičce | použijí se registrované výchozí hodnoty (Putim 229, IČO 03441482) |
| `JWT_SECRET` / `COOKIE_SECRET` | podpis odkazů | server bez nich vůbec nenastartuje |
