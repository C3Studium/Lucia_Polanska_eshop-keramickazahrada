import { Metadata } from "next"

import LegalDocument from "@modules/legal/LegalDocument"
import { sections } from "./data"

export const metadata: Metadata = {
  title: "Obchodní podmínky",
  description:
    "Pravidla nákupu mezi vámi a ateliérem Lucie Polanské — uzavření smlouvy, cena a platba, doprava, odstoupení od smlouvy a reklamace.",
}

const supplements = {
  "cena-a-platba": (
    <>
      <p>
        Společně s kupní cenou je kupující povinen zaplatit prodávajícímu také
        náklady spojené s balením a dodáním zboží ve smluvené výši. Není-li
        uvedeno výslovně jinak, rozumí se dále kupní cenou i náklady spojené s
        dodáním zboží.
      </p>
      <p>
        Prodávající nepožaduje od kupujícího zálohu či jinou obdobnou platbu.
        Tímto není dotčeno ustanovení čl. IV. odst. 6 obchodních podmínek ohledně
        povinnosti uhradit kupní cenu zboží předem. Netýká se výroby zboží na
        zakázku.
      </p>
      <p>
        V případě platby v hotovosti či v případě platby na dobírku je kupní cena
        splatná při převzetí zboží. V případě bezhotovostní platby je kupní cena
        splatná do 14 dnů od uzavření kupní smlouvy.
      </p>
      <p>
        V případě bezhotovostní platby je kupující povinen uhrazovat kupní cenu
        zboží společně s uvedením variabilního symbolu platby. V případě
        bezhotovostní platby je závazek kupujícího uhradit kupní cenu splněn
        okamžikem připsání příslušné částky na účet prodávajícího.
      </p>
      <p>
        Prodávající je oprávněn, zejména v případě, že ze strany kupujícího
        nedojde k dodatečnému potvrzení objednávky (čl. III. odst. 6), požadovat
        uhrazení celé kupní ceny ještě před odesláním zboží kupujícímu.
        Ustanovení § 2119 odst. 1 občanského zákoníku se nepoužije.
      </p>
      <p>
        Případné slevy z ceny zboží poskytnuté prodávajícím kupujícímu nelze
        vzájemně kombinovat.
      </p>
      <p>
        Je-li to v obchodním styku obvyklé nebo je-li tak stanoveno obecně
        závaznými právními předpisy, vystaví prodávající ohledně plateb
        prováděných na základě kupní smlouvy kupujícímu daňový doklad – fakturu.
        Prodávající je plátcem daně z přidané hodnoty. Daňový doklad – fakturu
        vystaví prodávající kupujícímu po uhrazení ceny zboží a zašle jej v
        elektronické podobě na elektronickou adresu kupujícího.
      </p>
    </>
  ),
  odstoupeni: (
    <>
      <p>
        Nejedná-li se o případ uvedený v čl. V. odst. 1 či o jiný případ, kdy
        nelze od kupní smlouvy odstoupit, má kupující v souladu s ustanovením §
        1829 odst. 1 občanského zákoníku právo od kupní smlouvy odstoupit, a to
        do čtrnácti (14) dnů od převzetí zboží, přičemž v případě, že předmětem
        kupní smlouvy je několik druhů zboží nebo dodání několika částí, běží
        tato lhůta ode dne převzetí poslední dodávky zboží. Odstoupení od kupní
        smlouvy musí být prodávajícímu odesláno ve lhůtě uvedené v předchozí
        větě.
      </p>
      <p>
        Odstoupení od kupní smlouvy může kupující zasílat přímo na adresu sídla
        prodávajícího. Pro doručování odstoupení od smlouvy platí ustanovení čl.
        11 těchto obchodních podmínek.
      </p>
      <p>
        V případě odstoupení od kupní smlouvy dle čl. V. odst. 2 obchodních
        podmínek se kupní smlouva od počátku ruší. Zboží musí být prodávajícímu
        vráceno do čtrnácti (14) dnů od odstoupení od smlouvy prodávajícímu.
      </p>
      <p>
        V případě odstoupení od smlouvy dle čl. V. odst. 2 obchodních podmínek
        vrátí prodávající peněžní prostředky přijaté od kupujícího do čtrnácti
        (14) dnů od odstoupení od kupní smlouvy kupujícím, a to buď peněžní
        poukázkou, nebo bezhotovostně na kupujícím uvedený účet. Náklady spojené
        s vrácením zboží si kupující hradí sám. Odstoupí-li kupující od kupní
        smlouvy, prodávající není povinen vrátit přijaté peněžní prostředky
        kupujícímu dříve, než mu kupující zboží vrátí nebo prokáže, že zboží
        prodávajícímu odeslal.
      </p>
      <p>
        Nárok na úhradu škody vzniklé na zboží je prodávající oprávněn
        jednostranně započíst proti nároku kupujícího na vrácení kupní ceny.
      </p>
      <p>
        Do doby převzetí zboží kupujícím je prodávající oprávněn kdykoliv od
        kupní smlouvy odstoupit. V takovém případě vrátí prodávající kupujícímu
        kupní cenu bez zbytečného odkladu, a to bezhotovostně na účet určený
        kupujícím.
      </p>
    </>
  ),
  "prava-z-vadneho-plneni": (
    <>
      <p>
        Ustanovení uvedená v čl. VII. odst. 2 obchodních podmínek se nepoužijí u
        zboží prodávaného za nižší cenu na vadu, pro kterou byla nižší cena
        ujednána, na opotřebení zboží způsobené jeho obvyklým užíváním, u
        použitého zboží na vadu odpovídající míře používání nebo opotřebení,
        kterou zboží mělo při převzetí kupujícím, nebo vyplývá-li to z povahy
        zboží.
      </p>
      <p>
        Projeví-li se vada v průběhu šesti měsíců od převzetí, má se za to, že
        zboží bylo vadné již při převzetí.
      </p>
      <p>
        Práva z vadného plnění uplatňuje kupující u prodávajícího na adrese jeho
        provozovny, v níž je přijetí reklamace možné s ohledem na sortiment
        prodávaného zboží, případně i v sídle nebo místě podnikání. Za okamžik
        uplatnění reklamace se považuje okamžik, kdy prodávající obdržel od
        kupujícího reklamované zboží.
      </p>
      <p>
        Další práva a povinnosti stran související s odpovědností prodávajícího
        za vady může upravit reklamační řád prodávajícího.
      </p>
    </>
  ),
}

export default function Page() {
  return (
    <LegalDocument
      code="01"
      eyebrow="Pravidla nákupu"
      title="Obchodní podmínky"
      accent="Bez drobného písma."
      description="Jak to mezi námi funguje — od objednávky přes platbu a dopravu až po vrácení zboží."
      updated="Platné od 1. 1. 2015"
      sections={sections}
      supplements={supplements}
    />
  )
}
