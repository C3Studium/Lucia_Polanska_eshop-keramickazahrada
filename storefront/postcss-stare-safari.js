/*
 * Zálohy pro starší Safari (iOS 12–16) — doplní se do VÝSLEDNÉHO CSS, zdroj
 * se nemění (19. 11. 2026, Matěj: „older version of safari, make sure it
 * works there too").
 *
 * Princip je vždy stejný: těsně PŘED deklaraci s novinkou vloží stejnou
 * vlastnost v podobě, kterou starý prohlížeč zná. Starý Safari novinku
 * neumí, zahodí ji a zůstane mu záloha; nový přečte obě a vyhraje pozdější,
 * tedy původní řádek. Na novém prohlížeči se tak nemění nic.
 *
 * 1. Jednotky okna dvh/svh/lvh/dvw/svw/lvw (+ dvmin…) — Safari až od 15.4.
 *    Na webu jich je ~300 a bez nich se rozpadaly výšky panelů a šířky
 *    (`max-width: 100dvw` na body nedělalo na starém iPhonu nic).
 *    Výšky jdou přes `--kz-vh` = 1 % skutečné výšky okna (window.innerHeight),
 *    které nastavuje `ViewportGuard`; holé `vh` je na iOS výška BEZ lišt
 *    prohlížeče, takže by panel vyjel pod ně.
 * 2. `inset` — Safari až od 14.1. Bez zálohy měl absolutní prvek nulový
 *    rozměr (podklad spodní lišty zmizel a lišta splynula se stránkou).
 * 3. `overflow: clip` — Safari až od 16. Záloha `hidden`.
 * 4. `color-mix()` — Safari až od 16.2. Záloha přibližnou barvou.
 */

const NOVE_JEDNOTKY = /(-?\d*\.?\d+)(dvh|svh|lvh|dvw|svw|lvw|dvmin|svmin|lvmin|dvmax|svmax|lvmax)\b/g

const zalohaJednotek = (hodnota) =>
  hodnota.replace(NOVE_JEDNOTKY, (_, cislo, jednotka) => {
    if (jednotka.endsWith('h')) {
      return jednotka === 'lvh' ? `${cislo}vh` : `calc(${cislo} * var(--kz-vh, 1vh))`
    }
    if (jednotka.endsWith('w')) return `${cislo}vw`
    return `${cislo}${jednotka.slice(2)}` // dvmin → vmin …
  })

/** Rozdělí hodnotu podle mezer jen na nejvyšší úrovni (ne uvnitř závorek). */
const rozdel = (hodnota) => {
  const casti = []
  let hloubka = 0
  let akt = ''
  for (const z of hodnota.trim()) {
    if (z === '(') hloubka++
    if (z === ')') hloubka--
    if (/\s/.test(z) && hloubka === 0) {
      if (akt) casti.push(akt)
      akt = ''
    } else akt += z
  }
  if (akt) casti.push(akt)
  return casti
}

/**
 * `color-mix(in srgb, A 94%, B)` → A, je-li jí aspoň polovina, jinak B.
 * Starý Safari (do 16.2) míchání neumí a celou deklaraci zahodil — panel
 * hledání pak neměl pozadí vůbec. Přibližná barva je lepší než žádná.
 */
const zalohaMichani = (hodnota) => {
  let vystup = ''
  let i = 0
  while (i < hodnota.length) {
    const start = hodnota.indexOf('color-mix(', i)
    if (start < 0) {
      vystup += hodnota.slice(i)
      break
    }
    vystup += hodnota.slice(i, start)
    let hloubka = 0
    let konec = start + 'color-mix'.length
    for (; konec < hodnota.length; konec++) {
      if (hodnota[konec] === '(') hloubka++
      if (hodnota[konec] === ')' && --hloubka === 0) break
    }
    const vnitrek = hodnota.slice(start + 'color-mix('.length, konec)
    const args = []
    let h = 0
    let akt = ''
    for (const z of vnitrek) {
      if (z === '(') h++
      if (z === ')') h--
      if (z === ',' && h === 0) {
        args.push(akt.trim())
        akt = ''
      } else akt += z
    }
    args.push(akt.trim())
    const barva = (arg) => {
      const m = /^(.*?)\s+(\d*\.?\d+)%$/.exec(arg || '')
      return m ? { c: m[1], p: Number(m[2]) } : { c: arg, p: null }
    }
    const a = barva(args[1])
    const b = barva(args[2])
    const podilA = a.p != null ? a.p : b.p != null ? 100 - b.p : 50
    vystup += zalohaMichani(podilA >= 50 ? a.c : b.c)
    i = konec + 1
  }
  return vystup
}

const uzMaZalohu = (decl, prop, hodnota) => {
  const pred = decl.prev()
  return pred && pred.type === 'decl' && pred.prop === prop && pred.value === hodnota
}

const vloz = (decl, prop, value) => {
  if (uzMaZalohu(decl, prop, value)) return
  decl.cloneBefore({ prop, value })
}

module.exports = () => ({
  postcssPlugin: 'postcss-stare-safari',
  Declaration(decl, { AtRule, Rule }) {
    /*
     * Vlastní proměnná (`--hero-h: 62svh`) zálohu „řádkem před" mít nemůže —
     * pro starý prohlížeč je platná i s neznámou jednotkou a selže až tam,
     * kde se použije. Záloha proto jde do `@supports not (height: 1dvh)`
     * hned za pravidlo: nový prohlížeč blok přeskočí celý.
     */
    if (decl.prop.startsWith('--')) {
      NOVE_JEDNOTKY.lastIndex = 0
      const pravidlo = decl.parent
      if (!NOVE_JEDNOTKY.test(decl.value) || !pravidlo || pravidlo.type !== 'rule') return
      if (pravidlo.parent?.type === 'atrule' && pravidlo.parent.name === 'supports' && /not \(height: 1dvh\)/.test(pravidlo.parent.params)) return
      const blok = new AtRule({ name: 'supports', params: 'not (height: 1dvh)' })
      blok.append(new Rule({ selector: pravidlo.selector }).append(decl.clone({ value: zalohaJednotek(decl.value) })))
      pravidlo.after(blok)
      return
    }

    // 1. Jednotky okna.
    NOVE_JEDNOTKY.lastIndex = 0
    if (NOVE_JEDNOTKY.test(decl.value)) {
      NOVE_JEDNOTKY.lastIndex = 0
      const zaloha = zalohaJednotek(decl.value)
      if (zaloha !== decl.value) vloz(decl, decl.prop, zaloha)
    }

    // 2. inset → top/right/bottom/left.
    if (decl.prop === 'inset') {
      const hodnota = zalohaJednotek(decl.value.replace(/\s*!important\s*$/, ''))
      // Hodnotu jen z proměnné nelze rozložit — může nést 1 i 4 čísla.
      if (/^var\(/.test(hodnota.trim()) && rozdel(hodnota).length === 1) return
      const c = rozdel(hodnota)
      if (c.length < 1 || c.length > 4) return
      const [t, r = t, b = t, l = r] = c
      const pred = decl.prev()
      if (pred && pred.type === 'decl' && pred.prop === 'left') return
      for (const [prop, value] of [['top', t], ['right', r], ['bottom', b], ['left', l]]) {
        decl.cloneBefore({ prop, value })
      }
    }

    // 4. color-mix() → přibližná barva.
    if (decl.value.includes('color-mix(')) {
      vloz(decl, decl.prop, zalohaJednotek(zalohaMichani(decl.value)))
    }

    // 3. overflow: clip → hidden.
    if (/^overflow(-x|-y)?$/.test(decl.prop) && /\bclip\b/.test(decl.value)) {
      vloz(decl, decl.prop, decl.value.replace(/\bclip\b/g, 'hidden'))
    }
  },
})
module.exports.postcss = true
