/**
 * Minimální čtečka textu z PDF — bez závislostí (jen node:zlib).
 *
 * Slouží `legal-build.mjs` ke kontrole, že vygenerované PDF má VLOŽENÁ písma
 * a že se z něj dá přečíst text s českou diakritikou (mapa ToUnicode). To je
 * přesně to, co potřebuje čtečka PDF, vyhledávání i kopírování textu: když
 * by Chromium písmo nevložilo nebo glyfy převedlo na křivky, text by z PDF
 * nešel přečíst a kontrola selže.
 *
 * Umí to, co produkuje Chromium (Skia): objekty i objektové proudy
 * (ObjStm), FlateDecode, písma Type0/Identity-H i jednobajtová, ToUnicode
 * (bfchar/bfrange), operátory Tf/Tj/TJ/'/" a vnořené Form XObjecty.
 * Obecný parser PDF to není a být nemá.
 */
import { inflateSync } from "node:zlib"

class PdfName {
  constructor(value) {
    this.name = value
  }
}

class PdfRef {
  constructor(num, gen) {
    this.num = num
    this.gen = gen
  }
}

const isWhite = (c) => c === 0x00 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d || c === 0x20
const DELIMS = new Set(Array.from("()<>[]{}/%").map((ch) => ch.charCodeAt(0)))
const isRegular = (c) => !isWhite(c) && !DELIMS.has(c)

class Lexer {
  constructor(buf, pos = 0) {
    this.b = buf
    this.p = pos
  }

  skipWhite() {
    const b = this.b
    while (this.p < b.length) {
      const c = b[this.p]
      if (isWhite(c)) {
        this.p++
      } else if (c === 0x25 /* % */) {
        while (this.p < b.length && b[this.p] !== 0x0a && b[this.p] !== 0x0d) this.p++
      } else {
        break
      }
    }
  }

  next() {
    this.skipWhite()
    const b = this.b
    if (this.p >= b.length) return null
    const c = b[this.p]

    if (c === 0x5b /* [ */) {
      this.p++
      return { t: "[" }
    }
    if (c === 0x5d /* ] */) {
      this.p++
      return { t: "]" }
    }
    if (c === 0x3c /* < */) {
      if (b[this.p + 1] === 0x3c) {
        this.p += 2
        return { t: "<<" }
      }
      const end = b.indexOf(0x3e, this.p)
      const hex = b
        .subarray(this.p + 1, end < 0 ? b.length : end)
        .toString("latin1")
        .replace(/[^0-9a-fA-F]/g, "")
      this.p = end < 0 ? b.length : end + 1
      return { t: "str", v: Buffer.from(hex.length % 2 ? `${hex}0` : hex, "hex") }
    }
    if (c === 0x3e /* > */) {
      this.p += b[this.p + 1] === 0x3e ? 2 : 1
      return { t: ">>" }
    }
    if (c === 0x28 /* ( */) return { t: "str", v: this.literalString() }
    if (c === 0x2f /* / */) {
      this.p++
      const start = this.p
      while (this.p < b.length && isRegular(b[this.p])) this.p++
      const raw = b.subarray(start, this.p).toString("latin1")
      return { t: "name", v: raw.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) }
    }
    if (c === 0x7b || c === 0x7d) {
      this.p++
      return { t: "kw", v: String.fromCharCode(c) }
    }

    const start = this.p
    while (this.p < b.length && isRegular(b[this.p])) this.p++
    if (this.p === start) {
      this.p++
      return { t: "kw", v: String.fromCharCode(c) }
    }
    const word = b.subarray(start, this.p).toString("latin1")
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) return { t: "num", v: Number(word) }
    return { t: "kw", v: word }
  }

  literalString() {
    const b = this.b
    const out = []
    let depth = 0
    this.p++ // (
    while (this.p < b.length) {
      const c = b[this.p++]
      if (c === 0x5c /* \ */) {
        const n = b[this.p++]
        const map = { 0x6e: 0x0a, 0x72: 0x0d, 0x74: 0x09, 0x62: 0x08, 0x66: 0x0c }
        if (n in map) out.push(map[n])
        else if (n >= 0x30 && n <= 0x37) {
          let oct = n - 0x30
          for (let i = 0; i < 2 && b[this.p] >= 0x30 && b[this.p] <= 0x37; i++) {
            oct = oct * 8 + (b[this.p++] - 0x30)
          }
          out.push(oct & 0xff)
        } else if (n === 0x0d) {
          if (b[this.p] === 0x0a) this.p++
        } else if (n !== 0x0a) out.push(n)
      } else if (c === 0x28) {
        depth++
        out.push(c)
      } else if (c === 0x29) {
        if (depth === 0) break
        depth--
        out.push(c)
      } else {
        out.push(c)
      }
    }
    return Buffer.from(out)
  }
}

/** Hodnota PDF z tokenu (pole, slovník, odkaz `n g R`, …). */
const parseFrom = (tok, lx) => {
  if (!tok) return undefined
  switch (tok.t) {
    case "num": {
      const save = lx.p
      const t2 = lx.next()
      if (t2 && t2.t === "num") {
        const t3 = lx.next()
        if (t3 && t3.t === "kw" && t3.v === "R") return new PdfRef(tok.v, t2.v)
      }
      lx.p = save
      return tok.v
    }
    case "name":
      return new PdfName(tok.v)
    case "str":
      return tok.v
    case "[": {
      const arr = []
      for (;;) {
        const t = lx.next()
        if (!t || t.t === "]") return arr
        arr.push(parseFrom(t, lx))
      }
    }
    case "<<": {
      const dict = {}
      for (;;) {
        const key = lx.next()
        if (!key || key.t === ">>") return dict
        if (key.t !== "name") continue
        dict[key.v] = parseFrom(lx.next(), lx)
      }
    }
    case "kw":
      if (tok.v === "true") return true
      if (tok.v === "false") return false
      if (tok.v === "null") return null
      return { op: tok.v }
    default:
      return undefined
  }
}

const nameOf = (value) => (value instanceof PdfName ? value.name : undefined)

const decodeStream = (dict, raw) => {
  const filters = [].concat(dict?.Filter ?? []).map(nameOf).filter(Boolean)
  let data = raw
  for (const filter of filters) {
    if (filter === "FlateDecode") data = inflateSync(data)
    else throw new Error(`nepodporovaný filtr ${filter}`)
  }
  return data
}

/** Načte všechny objekty (i z objektových proudů). */
const readObjects = (buf) => {
  const s = buf.toString("latin1")
  const objects = new Map()
  const pattern = /(\d+)\s+(\d+)\s+obj\b/g
  let match
  while ((match = pattern.exec(s)) !== null) {
    const num = Number(match[1])
    const lx = new Lexer(buf, match.index + match[0].length)
    let value
    try {
      value = parseFrom(lx.next(), lx)
    } catch {
      continue
    }
    lx.skipWhite()
    let stream = null
    if (s.startsWith("stream", lx.p)) {
      let start = lx.p + 6
      if (buf[start] === 0x0d) start++
      if (buf[start] === 0x0a) start++
      const length = typeof value?.Length === "number" ? value.Length : null
      let end = -1
      if (length !== null) {
        const probe = new Lexer(buf, start + length)
        probe.skipWhite()
        if (s.startsWith("endstream", probe.p)) end = start + length
      }
      if (end < 0) {
        end = s.indexOf("endstream", start)
        if (end < 0) end = buf.length
        while (end > start && (buf[end - 1] === 0x0a || buf[end - 1] === 0x0d)) end--
      }
      stream = buf.subarray(start, end)
      pattern.lastIndex = end
    }
    objects.set(num, { value, stream })
  }

  // Objektové proudy: objekty bez vlastního `obj` uložené uvnitř ObjStm.
  for (const { value, stream } of Array.from(objects.values())) {
    if (!stream || nameOf(value?.Type) !== "ObjStm") continue
    const data = decodeStream(value, stream)
    const header = new Lexer(data)
    const pairs = []
    for (let i = 0; i < value.N; i++) {
      const num = header.next()
      const offset = header.next()
      if (!num || !offset) break
      pairs.push([num.v, offset.v])
    }
    for (const [num, offset] of pairs) {
      if (objects.has(num)) continue
      const lx = new Lexer(data, value.First + offset)
      objects.set(num, { value: parseFrom(lx.next(), lx), stream: null })
    }
  }
  return objects
}

const utf16be = (bytes) => {
  const swapped = Buffer.alloc(bytes.length - (bytes.length % 2))
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    swapped[i] = bytes[i + 1]
    swapped[i + 1] = bytes[i]
  }
  return swapped.toString("utf16le")
}

/** ToUnicode CMap → Map(kód → text) + délka kódu v bajtech. */
const parseCMap = (text) => {
  const map = new Map()
  const space = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(text)
  const codeBytes = space ? Math.max(1, space[1].length / 2) : 2
  const hex = (h) => Buffer.from(h, "hex")

  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      map.set(parseInt(pair[1], 16), utf16be(hex(pair[2])))
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const entries = block[1].matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g
    )
    for (const entry of entries) {
      const lo = parseInt(entry[1], 16)
      const hi = parseInt(entry[2], 16)
      if (entry[3].startsWith("[")) {
        const items = Array.from(entry[3].matchAll(/<([0-9a-fA-F]*)>/g)).map((m) => m[1])
        items.forEach((item, index) => map.set(lo + index, utf16be(hex(item))))
      } else {
        const base = hex(entry[3].slice(1, -1))
        for (let code = lo; code <= hi && code - lo < 65536; code++) {
          const dst = Buffer.from(base)
          // Přičte se k poslední 16bitové jednotce (tak bfrange definuje PDF).
          const last = dst.length - 2
          if (last >= 0) dst.writeUInt16BE((dst.readUInt16BE(last) + (code - lo)) & 0xffff, last)
          map.set(code, utf16be(dst))
        }
      }
    }
  }
  return { map, codeBytes }
}

/**
 * Text, písma a počet stran z PDF.
 *
 * @param {Buffer} buf
 * @returns {{ text: string, pages: number, unmapped: number,
 *   fonts: { name: string, subtype: string, embedded: boolean, toUnicode: boolean }[] }}
 */
export const extractPdfText = (buf) => {
  const objects = readObjects(buf)
  const resolve = (value) => (value instanceof PdfRef ? objects.get(value.num)?.value : value)
  const streamOf = (value) => (value instanceof PdfRef ? objects.get(value.num) : null)

  const fontCache = new Map()
  const fontInfo = (ref) => {
    const key = ref instanceof PdfRef ? ref.num : ref
    if (fontCache.has(key)) return fontCache.get(key)
    const dict = resolve(ref) ?? {}
    const subtype = nameOf(dict.Subtype) ?? "?"
    const name = (nameOf(dict.BaseFont) ?? "(bez názvu)").replace(/^[A-Z]{6}\+/, "")
    let descriptor = resolve(dict.FontDescriptor)
    if (subtype === "Type0") {
      const descendant = resolve([].concat(resolve(dict.DescendantFonts) ?? [])[0])
      descriptor = resolve(descendant?.FontDescriptor)
    }
    const embedded =
      subtype === "Type3" ||
      Boolean(descriptor && (descriptor.FontFile || descriptor.FontFile2 || descriptor.FontFile3))
    let cmap = null
    const toUnicode = streamOf(dict.ToUnicode)
    if (toUnicode?.stream) {
      try {
        cmap = parseCMap(decodeStream(toUnicode.value, toUnicode.stream).toString("latin1"))
      } catch {
        cmap = null
      }
    }
    const info = {
      name,
      subtype,
      embedded,
      toUnicode: Boolean(cmap),
      cmap: cmap?.map ?? new Map(),
      codeBytes: cmap?.codeBytes ?? (subtype === "Type0" ? 2 : 1),
    }
    fontCache.set(key, info)
    return info
  }

  let unmapped = 0
  const decodeText = (font, bytes) => {
    if (!(bytes instanceof Buffer)) return ""
    if (!font) return bytes.toString("latin1")
    let out = ""
    for (let i = 0; i + font.codeBytes <= bytes.length; i += font.codeBytes) {
      const code = font.codeBytes === 2 ? bytes.readUInt16BE(i) : bytes[i]
      const ch = font.cmap.get(code)
      if (ch === undefined) {
        unmapped++
        out += "�"
      } else {
        out += ch
      }
    }
    return out
  }

  const parts = []
  const runContent = (data, resources, depth) => {
    if (depth > 8) return
    const res = resolve(resources) ?? {}
    const fonts = resolve(res.Font) ?? {}
    const xobjects = resolve(res.XObject) ?? {}
    const lx = new Lexer(data)
    let operands = []
    let font = null
    for (;;) {
      const tok = lx.next()
      if (!tok) break
      if (tok.t !== "kw" || ["true", "false", "null"].includes(tok.v)) {
        operands.push(parseFrom(tok, lx))
        continue
      }
      const op = tok.v
      switch (op) {
        case "Tf": {
          const fontName = nameOf(operands[0])
          font = fontName && fonts[fontName] ? fontInfo(fonts[fontName]) : null
          break
        }
        case "Tj":
          parts.push(decodeText(font, operands[operands.length - 1]))
          break
        case "'":
          parts.push("\n", decodeText(font, operands[operands.length - 1]))
          break
        case '"':
          parts.push("\n", decodeText(font, operands[2]))
          break
        case "TJ":
          for (const item of [].concat(operands[0] ?? [])) {
            if (item instanceof Buffer) parts.push(decodeText(font, item))
            else if (typeof item === "number" && item < -250) parts.push(" ")
          }
          break
        case "Td":
        case "TD":
        case "T*":
        case "Tm":
          parts.push(" ")
          break
        case "ET":
          parts.push("\n")
          break
        case "Do": {
          const xobject = streamOf(xobjects[nameOf(operands[0])])
          if (xobject?.stream && nameOf(xobject.value?.Subtype) === "Form") {
            runContent(
              decodeStream(xobject.value, xobject.stream),
              xobject.value.Resources ?? resources,
              depth + 1
            )
          }
          break
        }
        case "BI": {
          // Vložený obrázek: přeskočit až za `EI`.
          const end = data.indexOf("EI", lx.p, "latin1")
          lx.p = end < 0 ? data.length : end + 2
          break
        }
        default:
          break
      }
      operands = []
    }
  }

  let pages = 0
  for (const { value } of objects.values()) {
    if (nameOf(value?.Type) !== "Page") continue
    pages++
    // `/Contents` je odkaz na jeden proud, nebo pole odkazů.
    const resolved = resolve(value.Contents)
    const refs = Array.isArray(resolved) ? resolved : [value.Contents]
    for (const ref of refs) {
      const content = streamOf(ref)
      if (!content?.stream) continue
      runContent(decodeStream(content.value, content.stream), value.Resources, 0)
    }
    parts.push("\n\f\n")
  }

  const fonts = Array.from(fontCache.values()).map(({ name, subtype, embedded, toUnicode }) => ({
    name,
    subtype,
    embedded,
    toUnicode,
  }))

  return { text: parts.join(""), pages, unmapped, fonts }
}

/** Porovnání bez ohledu na mezery a zalomení (PDF mezery často nekreslí). */
export const squash = (text) => text.normalize("NFC").replace(/\s+/g, "")

/**
 * Zkontroluje PDF: vložená písma, žádné nepřevoditelné glyfy, úryvky čitelné
 * jako text včetně diakritiky.
 */
export const verifyPdfText = (buf, probes = []) => {
  const result = extractPdfText(buf)
  const haystack = squash(result.text)
  const missingProbes = probes.filter((probe) => !haystack.includes(squash(probe)))
  const notEmbedded = result.fonts.filter((font) => !font.embedded).map((font) => font.name)
  const noUnicode = result.fonts.filter((font) => !font.toUnicode).map((font) => font.name)
  const czech = (result.text.match(/[ěščřžýáíéúůťďňĚŠČŘŽÝÁÍÉÚŮŤĎŇ]/g) ?? []).length
  const ok =
    result.pages > 0 &&
    missingProbes.length === 0 &&
    notEmbedded.length === 0 &&
    noUnicode.length === 0 &&
    result.unmapped === 0
  return { ...result, ok, missingProbes, notEmbedded, noUnicode, czech }
}
