import { test } from "node:test"
import assert from "node:assert/strict"
import { legacyRedirect } from "../legacy-wordpress"

const WP = "https://dev.keramickazahrada.cz"

test("starý výrobek vede na stejný výrobek v novém obchodě (301)", () => {
  assert.deepEqual(legacyRedirect("/shop/zvonkove-tlacitko-vazka", "cz", WP), {
    location: "/cz/products/zvonkove-tlacitko-vazka",
    status: 301,
  })
  // Přejmenovaný kus („– PRODANÉ" → „– SKLADEM") najde nový název.
  assert.equal(
    legacyRedirect("/shop/keramicka-plastika-domovni-znameni-divka-s-dracim-zubem", "cz", WP)?.location,
    "/cz/products/keramicka-plastika-domovni-znameni-divka-s-dracim-zubem-skladem"
  )
  // WooCommerce umí i /produkt/ a koncové lomítko.
  assert.equal(
    legacyRedirect("/produkt/zvonkove-tlacitko-vazka/", "cz", WP)?.location,
    "/cz/products/zvonkove-tlacitko-vazka"
  )
})

test("výrobek, který nový obchod nemá, vede do své kategorie, ne na cizí kus", () => {
  assert.equal(
    legacyRedirect("/shop/keramicke-srdce-s-pomnenkami-a-stuzkou", "cz", WP)?.location,
    encodeURI("/cz/categories/domovní-znamení-a-plastiky")
  )
  // Neznámý starý výrobek → obchod, ne 404.
  assert.equal(legacyRedirect("/shop/nikdy-nebyl", "cz", WP)?.location, "/cz/store")
})

test("kategorie, štítky a stránky starého webu", () => {
  assert.equal(
    legacyRedirect("/kategorie-produktu/zvonkove-tlacitko", "cz", WP)?.location,
    encodeURI("/cz/collections/zvonková-tlačítka")
  )
  // Podkategorie WooCommerce: rozhoduje poslední článek.
  assert.equal(
    legacyRedirect("/kategorie-produktu/kvetiny/neznama", "cz", WP)?.location,
    "/cz/store"
  )
  assert.equal(legacyRedirect("/stitek-produktu/chalupa", "cz", WP)?.location, "/cz/store")
  assert.equal(legacyRedirect("/keramika_obchod", "cz", WP)?.location, "/cz/store")
  assert.equal(legacyRedirect("/keramicke_kurzy", "cz", WP)?.location, "/cz/kurzy")
  assert.equal(legacyRedirect("/obchodni-podminky", "cz", WP)?.location, "/cz/smluvni-podminky")
  assert.equal(legacyRedirect("/my-account/orders", "cz", WP)?.location, "/cz/account")
  assert.equal(legacyRedirect("/dovolena-1-7-18-7-2022", "cz", WP)?.location, "/cz")
})

test("obrázky a administrace WordPressu dočasně na starý web (307)", () => {
  assert.deepEqual(legacyRedirect("/wp-content/uploads/2022/10/a.jpg", "cz", WP), {
    location: `${WP}/wp-content/uploads/2022/10/a.jpg`,
    status: 307,
  })
  assert.equal(legacyRedirect("/wp-admin/", "cz", WP)?.location, `${WP}/wp-admin/`)
  assert.equal(legacyRedirect("/wp-login.php", "cz", WP)?.status, 307)
  // Bez známé adresy starého webu se nepřesměrovává nikam.
  assert.equal(legacyRedirect("/wp-content/uploads/a.jpg", "cz", ""), null)
})

test("nové adresy obchodu zůstávají netknuté", () => {
  for (const path of ["/", "/cz", "/cz/store", "/cz/products/zvonkove-tlacitko-vazka", "/store", "/cart", "/kurzy", "/o-mne", "/studio"]) {
    assert.equal(legacyRedirect(path, "cz", WP), null, path)
  }
})
