# AGENTS.md

## Testování v prohlížeči na tomhle PC (tools/pc-devices)

Most k prohlížeči na tomhle počítači přes Chrome DevTools Protocol. Má stejné příkazy a API jako
`valecms devices` pro iPhone (níž), jen běží na jiném portu. Je postavený tak, aby se dal přenést
do valecms jako druhý cíl. Panel je na http://localhost:4601. Prohlížeč se pouští s **vlastním
profilem** (`~/.valecms/pc-browser`) a bez škrcení na pozadí. Bere se Chrome, když tu je, jinak Edge.
Jiný prohlížeč jde nastavit proměnnou `VALECMS_BROWSER`.

```sh
node tools/pc-devices/cli.mjs --url=https://dev.keramickazahrada.cz/cz --no-open   # na pozadí
node tools/pc-devices/cli.mjs status        # prohlížeč, viewport, fps, frekvence monitoru, shadery
node tools/pc-devices/cli.mjs stop          # ukončí most i prohlížeč, který pustil
```

Příkazy jako u iPhonu: `status` · `tabs` · `use` · `open URL` · `reload` · `shot` ·
`eval "kód"` (await i holý objekt jako v konzoli) · `tap X Y` (skutečné kliknutí myší) ·
`scroll DY` (skutečné kolečko, projde přes Lenis) · `type` · `key Enter` · `layers [N]` ·
`log [--types=slow,long,webgl,error,crash]` · `preview off|on`.

Jen na PC: `move X1 Y1 X2 Y2 [--ms=]` / `move --circle` (myš v reálném čase, kvůli shaderům) ·
`trace idle|scroll|move|load [--s=3]` (náklady hlavního vlákna a kdo vyvolal přepočet stylů) ·
`profile …` (nejdražší funkce JS) · `cpu N` · `viewport W H [DPR] | reset` · `gpu`.

- **Monitor je 144 Hz** (5120×1440, RTX 3080). Zásek se proto počítá proti skutečné délce snímku, tedy cokoli nad ~17 ms, ne až nad 34 ms jako na 60 Hz.
- **Okno je na obrazovce majitele.** Když měříš, majitel na okno nesahá. Když testuje on, příkazy neposílej. Když se na okno nikdo nedívá, náhled v panelu nech vypnutý.
- **Arc nejde.** Drží jedinou instanci a vlastní profil ignoruje, takže nový proces se jen předá běžícímu Arcu a ladicí port se neotevře. Šlo by to jen po úplném zavření Arcu, a pak nad skutečným profilem majitele s přihlášeními. Jádro je stejné jako u Edge, měření by vyšla stejně.

## Testování na skutečném iPhonu (valecms devices)

Most z tohoto PC do Safari na iPhonu přes USB (Google `ios-webkit-debug-proxy`). Panel na
http://localhost:4600 ukazuje stav stránky, scroll, výšku spodní lišty Safari, fps, zaseknutí
po sekcích, chyby konzole a událost „crash“. Agent dostane totéž jako příkazy.

Zatím není na npm, spouští se ze zdroje (Node 22+):

```sh
D=C:/Users/ADMIN/Documents/GitHub/valecms-devices/bin/valecms.mjs
node $D devices <příkaz>
```

Až bude v projektu nainstalovaná verze valecms s `devices`, totéž dělá `npx valecms devices <příkaz>`.

### Spuštění

1. **Telefon:** připojený USB kabelem, odemčený, „Důvěřovat tomuto počítači“. V Nastavení → Safari → Pokročilé zapnout Web Inspector. Safari je v popředí a má otevřenou jen potřebnou záložku.
2. **Jeden debugger:** k záložce Safari se může připojit jen jeden. Když běží Inspect.dev, nejdřív `inspect stop`.
3. **Produkční build do sítě:** dev režim je na posuzování výkonu moc pomalý. Build musí jít do vlastní složky, protože ve storefrontu běží `next dev` na :8000 a :8099 a ty přepisují `.next`. Port 3000 patří jinému projektu. IP adresu PC vypíše `ipconfig` (zatím `192.168.1.31`). Node 24.4.1 má ve firewallu povolené příchozí spojení.
   ```sh
   cd storefront
   NEXT_DIST_DIR=.next-ios NEXT_PUBLIC_BASE_URL=http://192.168.1.31:4700 node scripts/run-next-with-storefront-env.js build
   NEXT_DIST_DIR=.next-ios NEXT_PUBLIC_BASE_URL=http://192.168.1.31:4700 node scripts/run-next-with-storefront-env.js start -H 0.0.0.0 -p 4700
   ```
4. **Most na pozadí:** spustit `node $D devices --no-open --yes`. Pak `node $D devices status` musí ukázat iPhone a stránku.
5. **Otevřít web na telefonu:** `node $D devices open http://192.168.1.31:4700/cz`
6. **Úklid:** zastavit most i server. `.next-ios` smazat a vrátit `storefront/tsconfig.json`, do kterého build zapíše novou složku, a scss soubory, kterým přepíše konce řádků.

### Příkazy (když most běží)

`status` · `tabs` · `use N|text` · `open URL` · `reload` · `shot [soubor.png]` ·
`eval "js"` (funguje `await`; vracet řetězec, např. `JSON.stringify({...})` — holý objektový
literál Safari neprojde) · `tap X Y` · `scroll DY` | `scroll --to=Y` · `type "text"` ·
`log [--after=N] [--types=slow,bar,error,crash] [--clear]` · `layers [N]` (paměť GPU vrstev
s důvody od WebKitu) · `preview off|on` · `help`

### Pravidla

- **Živý náhled nechat vypnutý.** Za každý snímek zastaví stránku na telefonu asi na 0,1 s. Ve výchozím stavu je vypnutý. Musí zůstat vypnutý, když testuje majitel rukou nebo když se měří plynulost. Jinak animace při scrollu blikají a 3D se zadrhává. Na jednotlivé obrázky používat `shot`.
- **`scroll` a `eval` nehýbou spodní lištou Safari.** Kvůli chybám lišty je potřeba požádat majitele, ať scrolluje prstem, a pak číst `log`.
- **„Web Page Crashed“ na iPhonu je skoro vždy paměť.** Zkontrolovat `layers`. Každá 3D transformace, `will-change`, CSS nebo WAAPI animace a `preserve-3d` uvnitř velkého nebo zvětšeného obsahu se stane GPU vrstvou v plném rozlišení. iOS záložku zabije při několika stech MB.
- **iOS 26:** spodní lišta Safari se animuje asi 30 snímků a v každém z nich vyvolá `resize`. `documentElement.clientHeight` zůstává stejné, `window.innerHeight` se mění. Rozložení ani časování scrollu se proto nikdy nesmí odvozovat z `innerHeight` ani z `dvh`.
- **Měřit jen na produkčním buildu.** Když testuje majitel rukou, most zastavit.
- **Na dotyku neběží žádný shader** (`data-fx="reduced"`, důvod `touch`). Kapalinu, hero shader ani karusel Kurzů na iPhonu neuvidíš, jen jejich statické fotky.
- **Git Bash přepisuje cesty začínající `/`.** Argument `/cz` se změní na `C:/Program Files/Git/cz`, proto příkazy s cestou pouštět s `MSYS_NO_PATHCONV=1`.
