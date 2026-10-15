import type { LegalDocumentVersion } from "../../types"

/**
 * Odstoupení od smlouvy platné od 15. 10. 2026.
 *
 * Kapitoly `pouceni` a `formular` jsou DOSLOVNÉ znění přílohy nařízení vlády
 * č. 29/2023 Sb. ve znění NV č. 66/2026 Sb., vyplněné podle oddílu
 * „Vyplněno pro Keramickou zahradu" v docs/legal/sources/nv-29-2023-priloha.md:
 *
 * - [1] 14 dnů; [2] varianta b), pro dodávky po částech varianta c) jako druhá
 *   věta s podmínkou; [3] jméno, sídlo, telefon, e-mail;
 * - [4] oba odstavce — tlačítko „Odstoupit od smlouvy" u objednávky v účtu
 *   a v odkazu z potvrzení objednávky i z e-mailu o odeslání (workstream D)
 *   a elektronický formulář v témže místě; mění se jen tyto vyplněné části;
 * - [5] ano; [6] a) 2 s adresou sídla, b) 2, c); [7] se nepoužije.
 *
 * Při úpravě textu NEMĚNIT slova vzoru — jen hodnoty v {{faktech}}. Oslovení
 * „Vám/Váš" s velkým písmenem je ze vzoru, ve zbytku stránky píšeme malým.
 * Odkaz na poznámku je „*)" místo horního indexu „*⁾" z přílohy: písma webu
 * (Sansation, Sentient) znak U+207E nemají a PDF by spadlo do náhradního
 * fontu; „*)" je obvyklá textová podoba téže poznámky.
 *
 * Zbytek stránky je praktický návod; dřívější „Prohlášení, že zboží není
 * zbožím uvedeným v § 1837" je pryč (LEGAL_AUDIT.md §3 — zákazník nemá
 * posuzovat zákonné výjimky).
 */
const odstoupeni: LegalDocumentVersion = {
  slug: "odstoupeni-od-smlouvy",
  title: "Odstoupení od smlouvy",
  version: "2026-10-15",
  summary:
    "Na vrácení zboží máte 14 dní od převzetí. Jak na to — online, e-mailem nebo dopisem — a vzorový formulář.",
  pdf: true,
  sections: [
    {
      id: "jak-odstoupit",
      title: "Jak odstoupit",
      blocks: [
        {
          type: "p",
          text: "Nakoupili jste jako spotřebitel a zboží vám nesedí? Od smlouvy můžete odstoupit **do 14 dnů od převzetí zboží**, bez udání důvodu. Stačí nám dát vědět jakýmkoli jednoznačným způsobem:",
        },
        {
          type: "ul",
          items: [
            "**online** tlačítkem „Odstoupit od smlouvy“ u objednávky ([postup níže](/odstoupeni-od-smlouvy#online)),",
            "**e-mailem** na {{seller.email}} — napište číslo objednávky a co vracíte,",
            "**dopisem** na {{seller.name}}, {{seller.address}}.",
          ],
        },
        {
          type: "p",
          text: "Můžete použít [vzorový formulář](/odstoupeni-od-smlouvy#formular), ale nemusíte. Lhůta je zachována, když odstoupení odešlete před jejím koncem.",
        },
      ],
    },
    {
      id: "online",
      title: "Odstoupení online",
      blocks: [
        {
          type: "ol",
          items: [
            "Přihlaste se a v účtu otevřete **Objednávky** a vyberte objednávku. Nakupovali jste bez účtu? Použijte odkaz **„Odstoupit od smlouvy“** v potvrzení objednávky nebo v e-mailu o jejím odeslání — odstoupit můžete i dřív, než objednávku odešleme.",
            "Klikněte na **„Odstoupit od smlouvy“**. Formulář je předvyplněný údaji z objednávky — zkontrolujte je a vyberte, čeho se odstoupení týká.",
            "Odeslání potvrďte tlačítkem **„Potvrdit odstoupení od smlouvy“**.",
            "Hned vám přijde e-mail s potvrzením — co jste odeslali, datum a čas odeslání.",
          ],
        },
        {
          type: "p",
          text: "Tlačítko najdete u objednávky po celou dobu lhůty pro odstoupení.",
        },
      ],
    },
    {
      id: "pouceni",
      title: "Poučení o právu na odstoupení od smlouvy",
      blocks: [
        {
          type: "p",
          text: "Znění podle vzoru v příloze nařízení vlády č. 29/2023 Sb., ve znění nařízení vlády č. 66/2026 Sb.",
        },
        {
          type: "box",
          blocks: [
            { type: "p", text: "**Právo odstoupit od smlouvy**" },
            {
              type: "p",
              text: "Do 14 dnů máte právo odstoupit od této smlouvy bez udání důvodu.",
            },
            {
              type: "p",
              text: "Lhůta pro odstoupení od smlouvy končí uplynutím 14 dnů ode dne následujícího po dni, kdy Vy nebo Vámi určená třetí osoba (jiná než dopravce) převezmete zboží.",
            },
            {
              type: "p",
              text: "V případě smlouvy, jejímž předmětem je dodávka více kusů zboží, které jsou dodávány samostatně: Lhůta pro odstoupení od smlouvy končí uplynutím 14 dnů ode dne následujícího po dni, kdy Vy nebo Vámi určená třetí osoba (jiná než dopravce) převezmete poslední kus zboží.",
            },
            {
              type: "p",
              text: "Odstoupit od této smlouvy můžete jakýmkoli jednoznačným prohlášením adresovaným {{seller.name}}, {{seller.address}}, tel. {{seller.phone}}, e-mail {{seller.email}} (například dopisem zaslaným prostřednictvím provozovatele poštovních služeb nebo prostřednictvím elektronické pošty). Můžete použít přiložený vzorový formulář pro odstoupení od smlouvy, není to však Vaší povinností.",
            },
            {
              type: "p",
              text: "Můžete rovněž odstoupit od smlouvy online na stránce objednávky ve svém zákaznickém účtu na {{seller.web}} (v části Objednávky tlačítko „Odstoupit od smlouvy“ u dané objednávky), nebo přes odkaz „Odstoupit od smlouvy“ v potvrzení objednávky nebo v e-mailu o jejím odeslání. Využijete-li této možnosti, bez zbytečného odkladu Vám potvrdíme přijetí prohlášení o odstoupení od smlouvy v textové podobě (například prostřednictvím elektronické pošty), včetně jeho obsahu a data a času jeho odeslání.",
            },
            {
              type: "p",
              text: "Na naší internetové stránce {{seller.webUrl}} (na stránce objednávky v zákaznickém účtu nebo po otevření odkazu z potvrzení objednávky nebo z e-mailu o jejím odeslání) můžete rovněž elektronicky vyplnit a odeslat formulář pro odstoupení od smlouvy nebo jakékoliv jiné jednoznačné prohlášení. Využijete-li této možnosti, obratem Vám potvrdíme jeho přijetí v textové podobě (například prostřednictvím elektronické pošty).",
            },
            {
              type: "p",
              text: "Aby byla dodržena lhůta pro odstoupení od této smlouvy, postačuje odeslat odstoupení od smlouvy před uplynutím příslušné lhůty.",
            },
            { type: "p", text: "**Důsledky odstoupení od smlouvy**" },
            {
              type: "p",
              text: "Pokud odstoupíte od této smlouvy, vrátíme Vám bez zbytečného odkladu, nejpozději do 14 dnů ode dne, kdy nám došlo Vaše odstoupení od smlouvy, všechny peněžní prostředky, které jsme od Vás na základě smlouvy přijali, včetně nákladů na dodání (kromě dodatečných nákladů vzniklých v důsledku Vámi zvoleného způsobu dodání, který je jiný než námi nabízený nejlevnější způsob dodání). Pro vrácení peněžních prostředků použijeme stejný platební prostředek, který jste použil(a) pro provedení počáteční transakce, pokud jste výslovně neurčil(a) jinak. V žádném případě Vám tím nevzniknou další náklady. Přijaté peněžní prostředky můžeme vrátit až po obdržení vráceného zboží nebo až prokážete, že jste zboží odeslal(a) zpět, podle toho, co nastane dříve.",
            },
            {
              type: "p",
              text: "Zboží bez zbytečného odkladu, nejpozději do 14 dnů ode dne, kdy došlo k odstoupení od této smlouvy, zašlete zpět nebo je předejte na adrese {{seller.name}}, {{seller.address}}. Lhůta se považuje za zachovanou, pokud nám zboží odešlete zpět před uplynutím 14 dnů.",
            },
            { type: "p", text: "Ponesete přímé náklady spojené s vrácením zboží." },
            {
              type: "p",
              text: "Odpovídáte pouze za snížení hodnoty zboží, které vzniklo v důsledku nakládání s tímto zbožím jinak, než je nutné k obeznámení se s povahou, vlastnostmi a funkčností zboží.",
            },
          ],
        },
      ],
    },
    {
      id: "formular",
      title: "Vzorový formulář pro odstoupení od smlouvy",
      blocks: [
        {
          type: "p",
          text: "(vyplňte tento formulář a pošlete jej zpět pouze v případě, že chcete odstoupit od smlouvy)",
        },
        {
          type: "form",
          title: "Odstoupení od smlouvy",
          fields: [
            {
              label: "Adresát",
              value: "{{seller.name}}, {{seller.address}}, {{seller.email}}",
            },
            {
              label:
                "Oznamuji/oznamujeme*), že tímto odstupuji/odstupujeme*) od smlouvy o koupi tohoto zboží*)/o poskytnutí těchto služeb*)",
            },
            { label: "Datum objednání*)/datum obdržení*)" },
            { label: "Jméno a příjmení spotřebitele/spotřebitelů" },
            { label: "Adresa spotřebitele/spotřebitelů" },
            { label: "Datum" },
            {
              label:
                "Podpis spotřebitele/spotřebitelů (pouze pokud je tento formulář zasílán na listině)",
            },
          ],
          note: "*) Nehodící se škrtněte nebo údaje doplňte.",
        },
        {
          type: "p",
          text: "Pomůže nám, když připíšete číslo objednávky a — platili-li jste na dobírku nebo v hotovosti — číslo účtu pro vrácení peněz. Povinné to není.",
        },
      ],
    },
    {
      id: "vraceni-zbozi",
      title: "Jak zboží vrátit",
      blocks: [
        {
          type: "p",
          text: "Zboží pošlete nebo přineste do 14 dnů od odstoupení na adresu {{seller.name}}, {{seller.address}}. Stačí ho v této lhůtě odeslat.",
        },
        {
          type: "ul",
          items: [
            "Keramiku zabalte pečlivě — nejlépe do původního obalu s výplní, každý kus zvlášť, a pošlete ji jako křehký balík.",
            "Zásilku doporučujeme pojistit. Za poškození při cestě zpět odpovídá ten, kdo zásilku posílá.",
            "Do balíku přiložte číslo objednávky.",
            "Zásilku na dobírku převzít nemůžeme.",
          ],
        },
        {
          type: "p",
          text: "**Náklady na vrácení nesete vy.** Počítejte přibližně s částkou {{withdrawal.returnCostEstimate}}; záleží na velikosti a hmotnosti balíku a na dopravci, kterého zvolíte.",
        },
      ],
    },
    {
      id: "vraceni-penez",
      title: "Vrácení peněz",
      blocks: [
        {
          type: "ul",
          items: [
            "Peníze vrátíme **do 14 dnů** ode dne, kdy nám odstoupení došlo — za zboží, balné i dopravu ve výši nejlevnějšího způsobu dodání, který nabízíme. Zvolili-li jste dražší dopravu, rozdíl nevracíme.",
            "Platili jste kartou, přes Apple Pay, Google Pay nebo online převodem? Peníze se vrátí přes bránu ComGate tam, odkud přišly.",
            "Platili jste na dobírku nebo v hotovosti při odběru? Pošleme je převodem na účet, který nám uvedete — v online formuláři, v e-mailu nebo v dopise.",
            "Peníze můžeme vrátit až poté, co nám zboží dojde, nebo co nám prokážete, že jste ho odeslali — podle toho, co nastane dříve.",
            "Odpovídáte jen za snížení hodnoty zboží, které vzniklo zacházením nad rámec toho, co je nutné k seznámení se s ním. Kdyby k tomu došlo, předem vám to vyčíslíme a zdůvodníme.",
          ],
        },
      ],
    },
    {
      id: "vyjimky",
      title: "Kdy odstoupit nelze — a kdy ano",
      blocks: [
        { type: "p", text: "Odstoupit do 14 dnů **nelze** (§ 1837 občanského zákoníku):" },
        {
          type: "ul",
          items: [
            "u **zboží vyrobeného na zakázku** podle vašeho zadání — číslo domu, jméno, konkrétní motiv, rozměr na míru (písm. d). Pouhý výběr barvy nebo velikosti z nabídky zakázkou není, takový kus vrátit můžete;",
            "u **kurzu s pevným termínem** — místo odstoupení platí storno podmínky ([obchodní podmínky, čl. X](/smluvni-podminky#kurzy)) (písm. j).",
          ],
        },
        { type: "p", text: "Odstoupit **lze** i:" },
        {
          type: "ul",
          items: [
            "u kusů s vadou z kolekce „Poškozené“ a u zlevněného zboží — vrátíme cenu, kterou jste skutečně zaplatili,",
            "u dárkového poukazu, dokud nebyl uplatněn, ani zčásti,",
            "u běžného zboží v objednávce, kde je i zakázka.",
          ],
        },
        {
          type: "p",
          text: "Má-li zboží vadu, nejde o odstoupení, ale o reklamaci — postup najdete v [Reklamačním protokolu](/reklamacni-protokol). Právo odstoupit do 14 dnů nemá podnikatel, který nakupuje pro své podnikání.",
        },
      ],
    },
  ],
}

export default odstoupeni
