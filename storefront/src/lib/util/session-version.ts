/*
 * Verze obchodu, jak ji vidí prohlížeč.
 *
 * Problém, který tohle řeší: prohlížeč si mezi návštěvami drží stav — co
 * bylo v `localStorage`, co v `sessionStorage`, jaké má jmenovky serverové
 * cache. Když vyjde nová verze obchodu, ten stav zůstane a patří k verzi,
 * která už neběží. Odtud „musím dát Ctrl+Shift+R, jinak to nefunguje".
 *
 * Otisk `NEXT_PUBLIC_BUILD_STAMP` vyrábí `scripts/build-stamp.js` a Next ho
 * zapéká do balíku při sestavení. Prohlížeč si ho uloží; když se při další
 * návštěvě neshoduje, uklidí po předchozí verzi sám.
 *
 * Co se **nemaže**: `_medusa_cart_id` a `_medusa_jwt`. Obojí je httpOnly,
 * tedy mimo dosah skriptu, a hlavně: `retrieveCart` i `retrieveCustomer`
 * si s neplatnou hodnotou poradí samy (vrátí `null`, resp. obnoví token).
 * Mazat je při každém nasazení by znamenalo vzít zákazníkovi rozdělaný
 * košík a odhlásit ho — cena za nic.
 */

/** Otisk verze zapečený do balíku. Prázdný, pokud se stavělo mimo náš skript. */
export const BUILD_STAMP = process.env.NEXT_PUBLIC_BUILD_STAMP || ""

/** Kde má prohlížeč uloženo, ke které verzi jeho stav patří. */
export const STAMP_KEY = "kz:build-stamp"

/** Pojistka proti smyčce znovunačtení, viz `SessionVersionWatch`. */
export const RELOAD_GUARD_KEY = "kz:build-stamp-reloaded"

export const VERSION_ENDPOINT = "/api/version"

/*
 * Košík žije na serveru za httpOnly cookie, takže na něj skript nedosáhne.
 * Úklid v prohlížeči proto jen poznamená, že verze přeskočila, a hlídka
 * si o převod řekne endpointu níž. Klíč je v `sessionStorage`, aby se
 * o převod řeklo jednou za záložku a samo to zmizelo s koncem relace.
 *
 * Vzkaz se nechává i tehdy, když prohlížeč žádný otisk uložený neměl —
 * jinak by první nasazení téhle úpravy neopravilo nic. Otisk chybí i tomu,
 * kdo sem chodí od začátku a jen ho zatím nemá kam uložit; košík přitom
 * může být prošlý stejně jako komukoli jinému. Nový návštěvník tím zaplatí
 * jeden dotaz, který hned odpoví „žádný košík".
 */
export const CART_PENDING_KEY = "kz:cart-version-pending"

export const CART_VERSION_ENDPOINT = "/api/cart/version"

/*
 * Uklízí se podle předpon, ne `clear()`. Na stejném původu běží i studio
 * ValeCMS a plošné smazání by bralo i jeho stav — obchod nemá co sahat na
 * cizí klíče, i když jsou to klíče vlastní aplikace.
 *
 * Pokryté klíče: `kz_last_payment_method`, `kz-banner-dismissed:…`,
 * `kz-admin-bar-hidden`, `kz:shaders-demoted`, `shop:snapshot` a dvojice
 * `cart_id` / `region_id`.
 */
const RESET_PREFIXES = ["kz_", "kz-", "kz:", "shop:", "cart_id", "region_id"]

/** Jmenovka serverové cache Medusy. Není httpOnly, takže na ni skript dosáhne. */
const CACHE_ID_COOKIE = "_medusa_cache_id"

const sweep = (store: Storage | null, keep: string[]) => {
  if (!store) return

  const doomed: string[] = []

  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i)
    if (key === null || keep.includes(key)) continue
    if (RESET_PREFIXES.some((prefix) => key.startsWith(prefix))) doomed.push(key)
  }

  doomed.forEach((key) => store.removeItem(key))
}

/**
 * Smaže stav, který patřil předchozí verzi. Volá se z prohlížeče.
 */
export const clearAppStorage = () => {
  try {
    sweep(window.localStorage, [STAMP_KEY])
    sweep(window.sessionStorage, [])
    document.cookie = `${CACHE_ID_COOKIE}=; Max-Age=0; Path=/`
  } catch {
    // Soukromé okno může úložiště odmítnout. Není co uklízet.
  }
}

/**
 * Zdroj skriptu, který se vkládá rovnou do stránky a běží dřív než cokoli
 * jiného — tedy dřív, než si aplikace stihne přečíst stav po staré verzi.
 * Proto se tady neobchází žádné znovunačtení: stránka sama je čerstvá
 * (HTML jede s `no-store`), stačí uklidit úložiště, než se rozběhne.
 *
 * Napsané ručně a bez závislostí, protože jde o inline `<script>`, který
 * neprochází Babelem ani bundlerem. Prázdný řetězec, když otisk chybí —
 * pak není s čím porovnávat a skript by jen zaváděl.
 */
export const bootResetScript = (): string => {
  if (!BUILD_STAMP) return ""

  const args = [
    BUILD_STAMP,
    STAMP_KEY,
    RELOAD_GUARD_KEY,
    RESET_PREFIXES,
    CACHE_ID_COOKIE,
    CART_PENDING_KEY,
  ]
    .map((value) => JSON.stringify(value))
    .join(",")

  return `(function(s,k,g,p,c,q){try{
var L=window.localStorage,S=window.sessionStorage,d=L.getItem(k);
if(d===s)return;
if(d!==null){
var u=function(t,keep){if(!t)return;var r=[],i,j,x;
for(i=0;i<t.length;i++){x=t.key(i);if(x===null||x===keep)continue;
for(j=0;j<p.length;j++){if(x.indexOf(p[j])===0){r.push(x);break}}}
for(i=0;i<r.length;i++)t.removeItem(r[i])};
u(L,k);u(S,null);
document.cookie=c+"=; Max-Age=0; Path=/";
L.removeItem(g);
if(window.caches&&caches.keys)caches.keys().then(function(n){n.forEach(function(x){caches.delete(x)})}).catch(function(){});
if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()})}).catch(function(){});
}
S.setItem(q,s);
L.setItem(k,s)}catch(e){}})(${args})`
}
