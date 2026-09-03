# CMSTODO — co dofixnout v příští verzi valecms

Nálezy z napojování úvodní stránky (`@c3studium/valecms@0.1.47`). Každý je změřený, ne
odhadnutý; u každého je popsaný projev, příčina a návrh opravy.

Měřeno takhle: rodičovský dokument na `/studio/preview`, do něj vložený `<iframe src="/cz?edit=1">`
(tím projde `isEditFrame()`), proscrollovat rám a spočítat `document.querySelectorAll("[data-cms-field]")`.

---

## 1. Zapnutí režimu editace nepřekreslí potomky z App Routeru

**Priorita: vysoká.** Tohle je ten hlavní; bez obcházky nejdou upravit celé sekce.

**Projev.** Anotace se objeví jen u komponentů, které se překreslí z vlastního důvodu
(`useInView`, vlastní stav, hodnoty ze scrollu). „Klidný" klientský komponent zůstane bez
`data-cms-*` napořád. Nehlásí to nic — v editoru to vypadá, že text je natvrdo v kódu.

**Změřeno.** Před obcházkou 16 anotovaných prvků, všechny z komponentů s vlastním
překreslením; šest z karuselu chybělo. Po vynuceném jednom překreslení 22.

**Příčina.** `src/edit/arm.js` u sebe říká:

> *it re-renders `_app`, which creates a fresh `<Component>` element, which re-renders the page
> and with it every annotated element*

To platí v Pages Routeru, kde `_app` opravdu vyrábí `<Component {...pageProps} />` znovu.
**V App Routeru ne:** obal, který hook volá, dostává potomky jako prop `children` a ti přišli
ze serverové komponenty jako hotové elementy. Když se obal překreslí, React porovná tytéž
objekty, nenajde rozdíl a překreslování v té větvi ukončí. `editable()` tam proto natrvalo
vrací hodnotu z prvního renderu, kdy byl příznak ještě `false`.

**Návrh.** Udělat příznak odebíratelný a vystavit hook, například `useEditMode()` nad
`useSyncExternalStore`. Odběr ze store překreslení vynutí i tehdy, když React větev jinak
přeskočí — na rozdíl od modulové proměnné. Kontext by fungoval taky (propagace kontextu
bailout obchází), ale `editable()` je obyčejná funkce, ne hook, takže odebírat musí komponent.

**Obcházka u nás.** `storefront/src/lib/hooks/use-edit-rerender.ts` — jedno překreslení přes
`requestAnimationFrame` (efekty potomků běží dřív než efekty rodičů, takže obyčejný `useEffect`
se ptá ještě před zapnutím). Volá se v `Carousel`, `Collections` a `Courses`. Až bude oprava
v balíčku, tenhle hook i ta tři volání můžou pryč.

---

## 2. Anotovaný prvek pod `pointer-events: none` nejde chytit — a nikdo to neřekne

**Priorita: střední.**

**Projev.** Anotace v DOMu je, ale překryv na ni nereaguje. Nerozeznatelné od „není napojené".

**Příčina.** Sekce, které leží přes fotku, si obal obsahu vypínají `pointer-events: none` a
výjimku dávají jen `a, button`. Texty (`h2`, `em`, `p`, `span`) a u tlačítek i obal, na kterém
anotace sedí, tak zůstanou netrefitelné. U nás to potkalo celou sekci Kurzy.

Má to ještě druhou půlku, kterou stojí za to znát: událost nezmizí, ale **propadne na to, co
leží pod textem**. U nás to byla podkladová fotka, a `<img>` je ve výchozím stavu tažitelný —
tah myší přes nadpis tedy začal nativní přetažení obrázku. Zvenčí to vypadá jako „text je
mrtvý", uvnitř jsou to dvě různé věci: nechytá se, a navíc někdo jiný chytá místo něj.

**Návrh.** Buď ať překryv sám nastavuje `pointer-events: auto` na prvky, které chytá, nebo ať
je aspoň umí nahlásit — `doctor` by mohl projít `[data-cms-field]` a vypsat ty, které mají
spočtené `pointer-events: none` nebo nulovou plochu. Tichá porucha je tu horší než ta samotná
příčina.

**Obcházka u nás.** Globální pravidlo v `storefront/src/styles/globals.scss`:

```scss
[data-cms-field] { pointer-events: auto; }
```

Bezpečné, protože atribut vzniká výhradně v režimu editace — na veřejném webu nemá na co platit.
Po opravě: 46 anotovaných prvků, z toho 0 s `pointer-events: none`.

---

## 3. `docId()` nezná `klic`, takže dokumenty tlačítek nemají záložní identitu

**Priorita: nízká** (v opravdovém editoru to nejspíš nevadí), ale je to nevysvětlený rozdíl
mezi dvěma typy.

**Projev.** Anotace na tlačítku (`editable(cta, "label")`) nevznikne, když dokument nenese `id`.

**Příčina.** `docId()` zkouší `id / _id / docId / key / slug`. Bloky `siteCopy` proto fungují i
bez `id`, protože nesou `key` — ale dokumenty typu `tlacitko` nesou `klic` a ten v seznamu
není. `id` připojuje až čtení konceptů, tedy po přihlášení do Studia.

**Návrh.** Buď doplnit `klic` do seznamu záloh, nebo někam napsat, že tenhle typ se bez
konceptového čtení anotovat nedá. Teď to vypadá jako nahodilé chování.

---

## 4. FAQ je vlastní typ `qna` — hotovo u nás; zbývá jedna vychytávka pro balíček

**Stav: vyřešeno na straně webu.** Otázky jsou dokumenty vlastního typu `qna`
(valecms.types.ts): jedna otázka = jeden dokument, ve Studiu vlastní sekce „Dotazy",
na stránce popup s celým formulářem přes `editableDoc`. Kategorie je pole `kategorie`
(jméno čipu), pořadí pole `poradi`. Mezistav s bloky `dotazy.kategorie-*` je
archivovaný.

Kategorie mají od druhého kola vlastní typ `qnaKategorie` (název + pořadí): zakládají
a řadí se ve své sekci Studia, čipy filtru vznikají z nich a otázka se ke kategorii
hlásí polem `kategorie` (jméno, slovo od slova). Jméno bez založené kategorie čip
stejně vytvoří — za seřazenými — aby otázka nikdy nezmizela.

Co by pomohlo v balíčku:

- **Pole typu „odkaz na dokument".** Vazba otázka→kategorie je dnes jménem, takže
  přejmenování kategorie osiří její otázky a překlep („Kurzy " s mezerou) potichu
  vyrobí čip navíc. `options.list` je statický, select z cizích dokumentů nejde;
  reference (nebo aspoň select plněný dotazem) by tuhle třídu chyb zavřela.
- **Vnořený výpis v obsahu** — „kategorie a pod ní její otázky" jako strom v jedné
  sekci. Dnes jsou to dvě sekce vedle sebe (Kategorie dotazů, Dotazy) a k otázkám
  kategorie se jde přes podtitulek v seznamu.
- Drobnost, na kterou se přišlo cestou: `defineType` bere `preview` jako FUNKCI
  `(doc) => ({title, subtitle})`, zatímco `siteCopy.js` v balíčku má tvar
  s `prepare(doc)`. Jeden z těch dvou tvarů je asi pozůstatek — sjednotit,
  ať se nový typ nepíše podle špatného vzoru.

---

## 6. `accent` má strop šesti položek — pro bloky „textů kolem" je to těsné

**Priorita: střední.** `siteCopy.accent` má `rule.max(6)` (a popis mluví o třech
popiscích — historicky). Bloky, které nesou texty celé sekce (lišty, obočí, popisky
fotek, texty tlačítek), na strop narážejí: dva už ho přelezly a Studio by je odmítlo
uložit; srazili jsme je zpět („kapitol", „Obsah" a číslo „05" se vrátily do kódu).
Návrh: zvednout na ~12, nebo dát blokům druhé pole krátkých textů. Souvisí i strop
čtyř polí na řádku `items` — štítky kroků výroby („Myšlenka · Funkce") kvůli němu
zůstaly v kódu, pátý sloupec by je pustil do CMS.

---

## 7. Pád „useAuth must be used inside `<AuthProvider>`" po přidání typu za běhu

**Nejspíš ne chyba balíčku, ale past dev režimu — do dokumentace balíčku by ale
patřila.** Typ přidaný do `cms.types`/`valecms.types` za běžícího dev serveru
rozdvojí modulový graf: HMR přehodnotí větev s registry typů, zatímco otevřené
Studio drží starší instanci `StudioProvider.jsx`. Kontext z jedné kopie a hook
z druhé se nepotkají a první pohled, který se po té změně vykreslí (u nás
Obsah → Dotazy), spadne přesně touhle hláškou.

Řešení: po přidání/změně TYPU restartovat dev server a tvrdě obnovit záložku
Studia. V produkci se to stát nemůže — build je jeden. Návrh: zmínit v README
balíčku u deklarace typů; případně v dev režimu detekovat dvě instance
`AuthContext` a napsat srozumitelnější chybu.

---

## 5. Drobnost: `readerFor` je v deklaracích `(): unknown`

Tvar se musí dopisovat na straně volajícího (`storefront/src/lib/data/site-copy.ts` u toho má
poznámku). Čtečka vrací pole těl dokumentů — stálo by za to to říct i v typech.
