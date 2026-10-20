import type { LegalDocumentVersion } from "../../types"

/**
 * Zásady ochrany osobních údajů platné od 15. 10. 2026.
 *
 * Tabulka účelů vychází z LEGAL_AUDIT.md §8, doplněná o poptávky zakázek
 * (formulář na stránce Výroba, workstream G), fotografie k reklamacím a
 * o e-maily, které backend skutečně posílá (připomenutí košíku — job
 * `send-abandoned-cart-notification`, žádost o hodnocení — `request-reviews`,
 * zlevnění oblíbených — `watch-price-drops`, naskladnění — `check-restock`).
 *
 * Zpracovatelé jsou pojmenovaní podle toho, co kód opravdu používá
 * (backend/medusa-config.js, proměnné prostředí): ComGate, Česká pošta,
 * iDoklad, Resend, Cloudflare R2, Railway, Supabase; Google jen po souhlasu
 * / kliknutí. Smluvní strana a sídlo hostingu, nástroj newsletteru a předání
 * mimo EU jsou zástupné údaje — doplní zadavatel (OPEN_QUESTIONS).
 */
const ochranaOsobnichUdaju: LegalDocumentVersion = {
  slug: "ochrana-osobnich-udaju",
  title: "Ochrana osobních údajů",
  version: "2026-10-15",
  summary:
    "Jaké údaje o vás máme, k čemu je potřebujeme, komu je předáváme, jak dlouho je držíme a co s nimi můžete udělat.",
  pdf: true,
  sections: [
    {
      id: "spravce",
      title: "Kdo vaše údaje zpracovává",
      blocks: [
        {
          type: "p",
          text: "Správcem osobních údajů je {{seller.name}}, podnikající fyzická osoba se sídlem {{seller.address}}, IČO {{seller.ico}} (dále „my“). Provozujeme internetový obchod a ateliér Keramická zahrada na {{seller.web}}.",
        },
        {
          type: "p",
          text: "S čímkoli, co se týká vašich údajů, se na nás obracejte e-mailem na {{seller.email}}, telefonicky na {{seller.phone}} nebo dopisem na adresu sídla.",
        },
        {
          type: "p",
          text: "Pověřence pro ochranu osobních údajů jsme nejmenovali — jako malý ateliér tuto povinnost nemáme.",
        },
        {
          type: "p",
          text: "Údaje zpracováváme podle nařízení Evropského parlamentu a Rady (EU) 2016/679 (dále „GDPR“) a zákona č. 110/2019 Sb., o zpracování osobních údajů.",
        },
      ],
    },
    {
      id: "prehled",
      title: "Co zpracováváme, proč a jak dlouho",
      blocks: [
        {
          type: "table",
          caption: "Přehled zpracování osobních údajů",
          head: ["Účel", "Údaje", "Právní základ", "Jak dlouho", "Příjemci"],
          rows: [
            [
              "Vyřízení objednávky a dodání zboží",
              "jméno a příjmení, doručovací a fakturační adresa, e-mail, telefon, objednané zboží, údaje o platbě a dopravě; u nákupu na firmu IČO a DIČ",
              "plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR)",
              "po dobu trvání smlouvy a práv z ní, nejdéle 4 roky od dodání; doklady podle účetních a daňových předpisů (až 10 let)",
              "platební brána, dopravce, fakturační systém, rozesílání e-mailů, hosting, účetní",
            ],
            [
              "Účetnictví a daně",
              "údaje na fakturách a dobropisech",
              "právní povinnost (písm. c)",
              "po dobu stanovenou účetními a daňovými předpisy (až 10 let)",
              "fakturační systém, účetní",
            ],
            [
              "Zákaznický účet",
              "e-mail, heslo (jen v zašifrované podobě), jméno, adresy, historie objednávek, oblíbené výrobky, rezervace kurzů",
              "plnění smlouvy (písm. b)",
              "do zrušení účtu; účet nepoužívaný 3 roky můžeme po upozornění zrušit",
              "hosting",
            ],
            [
              "Reklamace a odstoupení od smlouvy",
              "údaje z objednávky, popis vady, fotografie, komunikace, číslo účtu pro vrácení peněz",
              "právní povinnost (písm. c) a oprávněný zájem na obhajobě nároků (písm. f)",
              "4 roky od vyřízení",
              "úložiště souborů, rozesílání e-mailů, hosting, platební brána (vrácení peněz), dopravce (vrácení zboží)",
            ],
            [
              "Poptávka zakázky (formulář na stránce Výroba nebo e-mail)",
              "jméno, kontakt, popis, rozměr, motiv, fotografie místa, požadovaný termín",
              "opatření před uzavřením smlouvy na vaši žádost (písm. b)",
              "nevznikne-li zakázka, 1 rok od poslední zprávy",
              "úložiště souborů, rozesílání e-mailů, hosting",
            ],
            [
              "Výroba na zakázku",
              "zadání, fotografie místa a podkladů, schvalovací fotografie, komunikace",
              "plnění smlouvy (písm. b)",
              "4 roky od dodání",
              "úložiště souborů, rozesílání e-mailů, hosting",
            ],
            [
              "Kurzy",
              "jméno, e-mail, telefon, u dětí jméno a věk dítěte, údaje o platbě",
              "plnění smlouvy (písm. b)",
              "1 rok po kurzu; doklady o platbě podle účetních předpisů",
              "platební brána, rozesílání e-mailů, hosting",
            ],
            [
              "Fotografie z kurzů na webu a sociálních sítích",
              "fotografie",
              "souhlas (písm. a); za dítě souhlasí rodič",
              "do odvolání souhlasu",
              "provozovatel sociální sítě, na které fotografii zveřejníme",
            ],
            [
              "Newsletter",
              "e-mail, čas přihlášení a potvrzení, otevření e-mailů a kliknutí na odkazy",
              "souhlas (písm. a), potvrzený kliknutím v e-mailu",
              "do odhlášení",
              "{{privacy.newsletterTool}}",
            ],
            [
              "Připomenutí nedokončeného nákupu (dnes vypnuté)",
              "e-mail zadaný v pokladně, obsah košíku",
              "oprávněný zájem (písm. f) podle § 7 odst. 3 zákona č. 480/2004 Sb.; v připomenutí je odkaz, kterým další jedním kliknutím odmítnete",
              "dnes je neposíláme; zapneme-li je, jen jedno, den po opuštění košíku",
              "rozesílání e-mailů, hosting",
            ],
            [
              "Upozornění na naskladnění výrobku, o které požádáte",
              "e-mail, výrobek",
              "souhlas (písm. a) — vaše žádost o upozornění",
              "do odeslání upozornění nebo do odvolání",
              "rozesílání e-mailů, hosting",
            ],
            [
              "Upozornění na zlevnění výrobku v oblíbených",
              "e-mail, oblíbené výrobky",
              "oprávněný zájem (písm. f) podle § 7 odst. 3 zákona č. 480/2004 Sb. — vlastní obdobné výrobky stávajícím zákazníkům; v každém upozornění je odkaz, kterým další jedním kliknutím odmítnete",
              "dokud máte výrobek v oblíbených, nebo do odmítnutí",
              "rozesílání e-mailů, hosting",
            ],
            [
              "Žádost o hodnocení a recenze",
              "jméno, e-mail, objednávka; u recenze text, hodnocení a zobrazované jméno",
              "žádost: oprávněný zájem (písm. f) podle § 7 odst. 3 zákona č. 480/2004 Sb., v žádosti je odkaz, kterým další jedním kliknutím odmítnete; recenze: oprávněný zájem (písm. f) na zveřejnění recenze, kterou sami napíšete",
              "žádost posíláme jednou po doručení; recenze po dobu zveřejnění",
              "rozesílání e-mailů, hosting",
            ],
            [
              "Dotazy (kontaktní formulář, e-mail, telefon)",
              "jméno, kontakt, obsah zprávy",
              "oprávněný zájem odpovědět vám (písm. f); u dotazu k objednávce plnění smlouvy",
              "1 rok od vyřízení",
              "rozesílání e-mailů, hosting",
            ],
            [
              "Bezpečnost a provoz webu",
              "IP adresa, technické záznamy o přístupu (logy)",
              "oprávněný zájem na zabezpečení obchodu (písm. f)",
              "7 dní; potom je hosting sám smaže",
              "hosting",
            ],
            [
              "Statistiky návštěvnosti (jen pokud je zapneme)",
              "cookies, identifikátor prohlížeče, IP adresa, údaje o procházení webu",
              "souhlas (písm. a) v nastavení cookies",
              "do odvolání souhlasu, nejdéle po dobu uvedenou na stránce Cookies",
              "Google (Google Analytics)",
            ],
          ],
        },
      ],
    },
    {
      id: "pravni-zaklad",
      title: "Na jakém základě údaje zpracováváme",
      blocks: [
        {
          type: "ul",
          items: [
            "**Plnění smlouvy** (čl. 6 odst. 1 písm. b) GDPR) — bez těchto údajů vám objednávku, zakázku ani kurz vyřídit nemůžeme. Patří sem i kroky před uzavřením smlouvy, o které nás sami požádáte (poptávka).",
            "**Právní povinnost** (písm. c) — například vedení účetnictví a vyřizování reklamací.",
            "**Oprávněný zájem** (písm. f) — například ochrana našich nároků, zabezpečení webu nebo e-maily našim zákazníkům podle § 7 odst. 3 zákona č. 480/2004 Sb. (žádost o hodnocení, upozornění na zlevnění výrobku v oblíbených). Proti zpracování na tomto základě můžete kdykoli vznést námitku.",
            "**Souhlas** (písm. a) — newsletter, statistiky návštěvnosti a zveřejnění fotografií. Souhlas je dobrovolný a můžete ho kdykoli odvolat; zpracování před odvoláním tím nepřestává být zákonné.",
          ],
        },
      ],
    },
    {
      id: "prijemci",
      title: "Komu údaje předáváme",
      blocks: [
        {
          type: "p",
          text: "Údaje neprodáváme. Předáváme je jen těm, bez kterých obchod nefunguje, a jen v rozsahu, který potřebují:",
        },
        {
          type: "ul",
          items: [
            "**Comgate a.s.** — platební brána (platby kartou, Apple Pay, Google Pay, online převody a vracení peněz),",
            "**Česká pošta, s.p.** — doručení zásilek a výběr výdejního místa Balíkovny (jméno, adresa nebo výdejní místo, telefon a e-mail kvůli avízu),",
            "**iDoklad** (Seyfor, a. s., Brno) — fakturační systém, ve kterém vystavujeme faktury a dobropisy,",
            "**Resend** (Plus Five Five, Inc., USA) — služba, přes kterou obchod odesílá e-maily (potvrzení objednávek, oznámení o odeslání, odpovědi na reklamace),",
            "**Cloudflare (R2)** — úložiště souborů, například fotografií k reklamacím, zadání zakázek a dokumentů,",
            "**Railway** — provoz aplikace obchodu a databáze,",
            "**Supabase** — provoz obsahu webu (texty a fotografie stránek),",
            "**nástroj na rozesílku newsletteru**: {{privacy.newsletterTool}},",
            "**účetní**, který pro nás vede účetnictví,",
            "**Google** — jen když v okně Kontakt sami kliknutím načtete mapu, a statistiky Google Analytics jen tehdy, pokud je zapneme a vy s nimi souhlasíte.",
          ],
        },
        {
          type: "p",
          text: "Hosting obchodu a sídlo jeho poskytovatelů: {{privacy.hosting}}.",
        },
        {
          type: "p",
          text: "Údaje můžeme předat také orgánům veřejné moci, pokud nám to ukládá zákon.",
        },
      ],
    },
    {
      id: "mezinarodni-prenosy",
      title: "Předávání mimo Evropskou unii",
      blocks: [
        {
          type: "p",
          text: "Někteří poskytovatelé uvedení výše mají sídlo mimo Evropskou unii. Údaje mimo EU/EHP předáváme jen tam, kde je zajištěna odpovídající ochrana — na základě rozhodnutí Evropské komise o odpovídající ochraně, nebo standardních smluvních doložek.",
        },
        {
          type: "p",
          text: "Konkrétně jde o tyto služby:",
        },
        {
          type: "ul",
          items: [
            "**Railway** (Railway Corporation, USA) — aplikace obchodu a databáze běží v datovém centru v Amsterdamu (Nizozemsko). Railway je americká společnost, provozní a technické záznamy proto mohou být zpracovány i v USA. Předání se opírá o rozhodnutí Evropské komise o EU–US Data Privacy Framework, ve kterém je Railway certifikovaná.",
            "**Cloudflare** (Cloudflare, Inc., USA) — soubory leží v úložišti R2 omezeném na Evropskou unii. Obrázky na web doručuje celosvětová síť Cloudflare, takže vaši IP adresu může zpracovat i server mimo EU. Předání se opírá o EU–US Data Privacy Framework, ve kterém je Cloudflare certifikovaná, a o standardní smluvní doložky.",
            "**Resend** (Plus Five Five, Inc., USA) — e-maily odcházejí ze serverů v Irsku, údaje o odeslaných e-mailech a záznamy o jejich doručení ale Resend ukládá v USA. Předání se opírá o EU–US Data Privacy Framework, ve kterém je Resend certifikovaný, a o standardní smluvní doložky.",
            "**Supabase** (Supabase Pte. Ltd., Singapur) — obsah webu je uložen v datovém centru ve Frankfurtu nad Mohanem (Německo). Poskytovatel sídlí v Singapuru, předání se proto opírá o standardní smluvní doložky.",
            "**Google** — mapu v okně Kontakt a případné statistiky Google Analytics poskytuje Google Ireland Limited (Irsko); údaje může zpracovávat i Google LLC v USA, která je v EU–US Data Privacy Framework certifikovaná.",
          ],
        },
        {
          type: "p",
          text: "Ostatní příjemci (Comgate, Česká pošta a Seyfor, který provozuje iDoklad) sídlí v České republice; iDoklad ukládá údaje v Evropské unii.",
        },
      ],
    },
    {
      id: "novinky-e-mailem",
      title: "Newsletter a další e-maily",
      blocks: [
        {
          type: "p",
          text: "Newsletter posíláme jen tomu, kdo se k odběru přihlásí a přihlášení potvrdí kliknutím v e-mailu. Odhlásit se můžete kdykoli odkazem, který je v každém newsletteru. U rozeslaných newsletterů měříme otevření a kliknutí na odkazy, abychom věděli, co vás zajímá; odhlášením toto měření končí.",
        },
        {
          type: "p",
          text: "K objednávce, rezervaci, zakázce nebo reklamaci vám posíláme provozní e-maily — ty jsou součástí plnění smlouvy. Jako našemu zákazníkovi vám kromě nich můžeme poslat jednu žádost o hodnocení zakoupeného výrobku po doručení a upozornění na zlevnění výrobku, který máte v oblíbených. Posíláme je na základě oprávněného zájmu podle § 7 odst. 3 zákona č. 480/2004 Sb., o některých službách informační společnosti — jde o naše vlastní výrobky, obdobné těm, o které jste projevili zájem. V každém takovém e-mailu je odkaz, kterým další jedním kliknutím odmítnete; odmítnout je můžete i e-mailem na {{seller.email}}.",
        },
        {
          type: "p",
          text: "Připomenutí nedokončeného nákupu máme připravené, ale dnes je neposíláme. Kdybychom je zapnuli, platí pro ně totéž: nejvýš jedno připomenutí a v něm odkaz, kterým další jedním kliknutím odmítnete.",
        },
      ],
    },
    {
      id: "cookies-a-analytika",
      title: "Cookies, statistiky a mapy",
      blocks: [
        {
          type: "p",
          text: "Jaké cookies web používá a jak svůj souhlas kdykoli změníte, popisuje stránka [Používání cookies](/cookies). Nezbytné cookies (košík, přihlášení) souhlas nepotřebují; ostatní ukládáme jen s vaším souhlasem.",
        },
        {
          type: "p",
          text: "Statistiky návštěvnosti (Google Analytics) se načtou jen tehdy, pokud je na webu zapneme a vy s nimi v nastavení cookies souhlasíte. Mapa Google v okně Kontakt se načte, až když si ji sami zobrazíte. Mapa výdejních míst Balíkovny v pokladně je služba České pošty a načte se, až když si výdejní místo vybíráte.",
        },
      ],
    },
    {
      id: "prava",
      title: "Vaše práva",
      blocks: [
        { type: "p", text: "Ke svým údajům máte tato práva:" },
        {
          type: "ul",
          items: [
            "**přístup** — dozvědět se, jaké údaje o vás máme, a dostat jejich kopii,",
            "**oprava** — nechat opravit nepřesné nebo doplnit neúplné údaje,",
            "**výmaz** — nechat údaje smazat, pokud už je nepotřebujeme nebo je nesmíme zpracovávat (údaje, které musíme ze zákona uchovat, smazat nemůžeme),",
            "**omezení zpracování** — například po dobu, kdy ověřujeme vaši námitku,",
            "**přenositelnost** — dostat údaje, které jste nám dali, ve strojově čitelné podobě,",
            "**námitka** — proti zpracování na základě oprávněného zájmu; proti zasílání obchodních sdělení vždy,",
            "**odvolání souhlasu** — kdykoli, se stejnou lehkostí, s jakou jste ho dali,",
            "**stížnost u dozorového úřadu** — Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, [uoou.gov.cz](https://uoou.gov.cz).",
          ],
        },
        {
          type: "p",
          text: "Svá práva uplatníte e-mailem na {{seller.email}} nebo dopisem na adresu sídla. Odpovíme bez zbytečného odkladu, nejpozději do 1 měsíce, a zdarma. Zákaznický účet můžete zrušit i sami v jeho nastavení.",
        },
      ],
    },
    {
      id: "povinnost-a-automatizace",
      title: "Musíte nám údaje dát?",
      blocks: [
        {
          type: "p",
          text: "Údaje nutné k objednávce nebo rezervaci (jméno, kontakt, adresa) potřebujeme k uzavření a splnění smlouvy — bez nich ji vyřídit nemůžeme. Všechny souhlasy jsou dobrovolné a na nákup nemají vliv.",
        },
        {
          type: "p",
          text: "Nerozhodujeme o vás automatizovaně a neprovádíme profilování, které by pro vás mělo právní nebo obdobně závažné účinky.",
        },
      ],
    },
    {
      id: "zabezpeceni",
      title: "Jak údaje chráníme",
      blocks: [
        {
          type: "p",
          text: "Spojení s webem je šifrované, hesla ukládáme jen v zašifrované podobě a k údajům mají přístup jen ti, kdo je k vyřízení vaší objednávky potřebují. Údaje o platební kartě zadáváte až v zabezpečené bráně ComGate — my je nevidíme ani neukládáme.",
        },
      ],
    },
    {
      id: "zmeny",
      title: "Změny zásad",
      blocks: [
        {
          type: "p",
          text: "Zásady aktualizujeme, když se změní způsob, jakým s údaji zacházíme. Aktuální znění je vždy na této stránce, s datem účinnosti nahoře. Tyto zásady jsou účinné od 15. 10. 2026.",
        },
      ],
    },
  ],
}

export default ochranaOsobnichUdaju
