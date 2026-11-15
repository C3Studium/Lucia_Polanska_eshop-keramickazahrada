import Medusa from "@medusajs/js-sdk"
/* Globální čitelnost administrace. Tady, protože tenhle modul načítá skoro
   každá stránka i widget hned při startu — viz citelnost.css. */
import "./citelnost.css"
import { spustCestinu } from "./admin-cestina"

/*
 * Administrace česky (14. 11. 2026). Medusa má hotový český překlad (i data
 * „13. 11. 2026" místo „Nov 13, 2026 11:37 AM"), jenže jazyk bere jen
 * z uložené volby (cookie / localStorage `lng`) a jinak padne na angličtinu —
 * jazyk prohlížeče nečte. Detail objednávky tak byl napůl anglicky.
 *
 * Jednou přepneme na češtinu; kdo si pak v Profilu vybere jiný jazyk, tomu
 * zůstane. Běží při načtení modulu, tedy dřív, než se Medusa překlad spustí.
 */
const CESTINA_ZNACKA = "kz-admin-cs-v1"
if (typeof window !== "undefined") {
  try {
    if (!window.localStorage.getItem(CESTINA_ZNACKA)) {
      window.localStorage.setItem("lng", "cs")
      document.cookie = "lng=cs; path=/; max-age=31536000; SameSite=Lax"
      window.localStorage.setItem(CESTINA_ZNACKA, "1")
    }
  } catch {
    /* Bez úložiště (soukromé okno) zůstane výchozí jazyk. */
  }
  /* Co Medusa nepřeloží (id plateb, „Captured"…) a karty Metadata/JSON. */
  spustCestinu()
}

const browserBaseUrl = typeof window !== "undefined" ? window.location.origin : undefined

export const sdk = new Medusa({
  // Use current origin in the browser (admin is served by the backend),
  // fall back to localhost for build/SSR.
  baseUrl: browserBaseUrl || "http://localhost:9000",
  debug: false,
  auth: {
    type: "session",
  },
})
