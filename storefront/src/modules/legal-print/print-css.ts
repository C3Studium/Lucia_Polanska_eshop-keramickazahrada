/**
 * Styl tiskové stránky právních dokumentů (A4 → PDF přes Playwright).
 *
 * Vložený `<style>`, ne CSS modul: potřebuje globální pravidla (`@page`,
 * `body`, schování všeho mimo tiskový obsah), která CSS moduly v režimu
 * „pure" nedovolí, a PDF nemá záviset na pořadí načtení stylů webu.
 *
 * Písma jsou lokální TTF z `/public/fonts` (Sansation — OFL, Sentient —
 * Fontshare/ITF; obě povolují vložení, fsType 8 / 0) a pokrývají českou
 * diakritiku. Vlastní názvy rodin („KZ Print …"), ať se nepletou s
 * `@font-face` webu. Ligatury vypnuté: z PDF se pak dá text spolehlivě
 * kopírovat a vyhledávat (ligaturní glyf nemá vlastní znak v ToUnicode).
 *
 * Zvýšit `PRINT_LAYOUT_REVISION` v `./meta.ts` při každé změně, která mění
 * vzhled PDF.
 */
const SANS = "/fonts/Sansation/fonts"
const SERIF = "/fonts/Sentient/fonts"

export const PRINT_FONT_FACES = [
  { family: "KZ Print Sans", weight: "400", style: "normal", src: `${SANS}/Sansation-Regular.ttf` },
  { family: "KZ Print Sans", weight: "700", style: "normal", src: `${SANS}/Sansation-Bold.ttf` },
  { family: "KZ Print Sans", weight: "400", style: "italic", src: `${SANS}/Sansation-Italic.ttf` },
  { family: "KZ Print Sans", weight: "700", style: "italic", src: `${SANS}/Sansation-BoldItalic.ttf` },
  { family: "KZ Print Serif", weight: "400", style: "normal", src: `${SERIF}/Sentient-Regular.ttf` },
  { family: "KZ Print Serif", weight: "500", style: "normal", src: `${SERIF}/Sentient-Medium.ttf` },
  { family: "KZ Print Serif", weight: "400", style: "italic", src: `${SERIF}/Sentient-Italic.ttf` },
  { family: "KZ Print Serif", weight: "700", style: "normal", src: `${SERIF}/Sentient-Bold.ttf` },
] as const

const fontFaces = PRINT_FONT_FACES.map(
  (face) => `@font-face {
  font-family: "${face.family}";
  src: url("${face.src}") format("truetype");
  font-weight: ${face.weight};
  font-style: ${face.style};
  font-display: block;
}`
).join("\n")

const INK = "#20211c"
const BODY = "#2a2b25"
const MUTED = "#5c574e"
const LINE = "#b9ae9f"
const OLIVE = "#5f6a4c"
const PAPER = "#f6f2ea"

export const PRINT_CSS = `${fontFaces}

@page { size: A4; }

html, body { background: #ffffff !important; }

/* Na tiskové stránce je jen dokument: nic z kořenového layoutu (lišty,
   překryvy, vývojářský indikátor Next.js) se do PDF nesmí dostat. */
body > *:not(:has([data-legal-print-shell])) { display: none !important; }

.lp-root {
  font-family: "KZ Print Sans", Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.5;
  color: ${BODY};
  font-variant-ligatures: none;
  font-kerning: normal;
  text-rendering: geometricPrecision;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.lp-root *, .lp-root *::before, .lp-root *::after { box-sizing: border-box; }

.lp-page {
  width: 100%;
  max-width: 210mm;
  margin: 0 auto;
  padding: 14mm 16mm 16mm;
  background: #ffffff;
}
@media screen {
  html, body { background: #e9e5dc !important; }
  .lp-page { margin: 8mm auto; box-shadow: 0 1px 8px rgba(0, 0, 0, 0.14); }
}
@media print {
  .lp-page { padding: 0; margin: 0; max-width: none; box-shadow: none; }
}

.lp-root a {
  color: inherit;
  text-decoration: underline;
  text-decoration-thickness: 0.5pt;
  text-underline-offset: 0.6mm;
}
.lp-root strong { font-weight: 700; }

/* Zástupný údaj — v PDF musí být vidět na první pohled. */
.lp-root mark.lp-placeholder {
  background: #ffe600;
  color: #1a1a1a;
  font-weight: 700;
  padding: 0 0.6mm;
  outline: 0.5pt solid #c9a800;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

/* Hlavička: značka a identita prodávající. */
.lp-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8mm;
  padding-bottom: 4mm;
  margin-bottom: 8mm;
  border-bottom: 0.75pt solid ${INK};
}
.lp-brand { margin: 0; }
.lp-wordmark {
  display: block;
  font-family: "KZ Print Serif", Georgia, serif;
  font-size: 17pt;
  line-height: 1.1;
  color: ${INK};
}
.lp-wordmark em { font-style: italic; color: ${OLIVE}; }
.lp-brand-sub {
  display: block;
  margin-top: 1.2mm;
  font-size: 7.5pt;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${MUTED};
}
.lp-seller {
  margin: 0;
  font-size: 8.4pt;
  line-height: 1.5;
  color: ${MUTED};
  text-align: right;
}
.lp-seller strong { color: ${INK}; }

.lp-title {
  margin: 0 0 2mm;
  font-family: "KZ Print Serif", Georgia, serif;
  font-weight: 400;
  font-size: 25pt;
  line-height: 1.12;
  letter-spacing: -0.01em;
  color: ${INK};
}
.lp-validity { margin: 0; font-size: 10pt; color: ${INK}; }
.lp-validity strong { font-weight: 700; }
.lp-validity span { color: ${MUTED}; }
.lp-summary { margin: 4mm 0 0; font-size: 10.5pt; color: #3b3c35; max-width: 160mm; }

.lp-draft {
  margin: 6mm 0 0;
  padding: 2.5mm 4mm;
  background: #fff6b3;
  border: 0.75pt solid #c9a800;
  font-size: 9pt;
  color: #1a1a1a;
}

/* Obsah. */
.lp-toc {
  margin: 7mm 0 8mm;
  padding: 3.5mm 0 2mm;
  border-top: 0.5pt solid ${LINE};
  border-bottom: 0.5pt solid ${LINE};
  break-inside: avoid;
}
.lp-toc-label {
  margin: 0 0 2mm;
  font-size: 7.5pt;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${OLIVE};
  font-weight: 700;
}
.lp-toc ol {
  margin: 0;
  padding: 0;
  list-style: none;
  columns: 2;
  column-gap: 8mm;
  font-size: 9pt;
  line-height: 1.55;
}
.lp-toc li { break-inside: avoid; margin: 0 0 0.6mm; }
.lp-toc a { text-decoration: none; }

/* Kapitoly a bloky. */
.lp-section { margin: 0 0 6mm; }
.lp-h2 {
  margin: 0 0 2.5mm;
  font-family: "KZ Print Serif", Georgia, serif;
  font-weight: 500;
  font-size: 13pt;
  line-height: 1.25;
  color: ${INK};
  break-after: avoid;
  page-break-after: avoid;
}
.lp-p { margin: 0 0 2.2mm; orphans: 3; widows: 3; }
.lp-list { margin: 0 0 2.6mm; padding-left: 5.5mm; }
.lp-list--ul { list-style: disc outside; }
.lp-list--ol { list-style: decimal outside; }
.lp-list li { margin: 0 0 1.1mm; padding-left: 0.6mm; }

.lp-table-wrap { margin: 2.5mm 0 4mm; }
.lp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.8pt;
  line-height: 1.4;
}
.lp-table caption {
  caption-side: top;
  text-align: left;
  padding: 0 0 1.5mm;
  font-size: 8.5pt;
  color: ${MUTED};
}
.lp-table thead { display: table-header-group; }
.lp-table tr { break-inside: avoid; page-break-inside: avoid; }
.lp-table th {
  text-align: left;
  vertical-align: bottom;
  font-weight: 700;
  color: ${INK};
  background: ${PAPER};
  border: 0.5pt solid ${LINE};
  padding: 1.6mm 2mm;
}
.lp-table td {
  vertical-align: top;
  border: 0.5pt solid ${LINE};
  padding: 1.6mm 2mm;
}

/* Rámeček — vzorové poučení, důležité upozornění. */
.lp-box {
  margin: 3mm 0 4.5mm;
  padding: 4mm 5mm 2.5mm;
  background: ${PAPER};
  border: 0.9pt solid ${INK};
}
.lp-box-title {
  margin: 0 0 2mm;
  font-family: "KZ Print Serif", Georgia, serif;
  font-weight: 500;
  font-size: 11pt;
  color: ${INK};
  break-after: avoid;
}
.lp-box > :last-child { margin-bottom: 1.5mm; }

/* Formulář k vyplnění rukou. */
.lp-form {
  margin: 4mm 0 5mm;
  padding: 5mm 6mm 4mm;
  background: #ffffff;
  border: 0.9pt solid ${INK};
  break-inside: avoid;
  page-break-inside: avoid;
}
.lp-form-title {
  margin: 0 0 4mm;
  font-family: "KZ Print Serif", Georgia, serif;
  font-weight: 500;
  font-size: 12pt;
  color: ${INK};
}
.lp-field { margin: 0 0 3.4mm; break-inside: avoid; }
.lp-field-label {
  display: block;
  margin: 0 0 0.6mm;
  font-size: 8.6pt;
  line-height: 1.35;
  color: ${MUTED};
}
.lp-field-line {
  display: block;
  min-height: 7.5mm;
  padding: 1.4mm 0 0.6mm;
  border-bottom: 0.6pt solid ${INK};
  font-size: 10pt;
  color: ${INK};
}
.lp-field-line--blank { min-height: 9mm; }
.lp-form-note { margin: 3mm 0 0; font-size: 8.4pt; line-height: 1.4; color: ${MUTED}; }

.lp-end {
  margin-top: 9mm;
  padding-top: 3mm;
  border-top: 0.5pt solid ${LINE};
  font-size: 8.4pt;
  line-height: 1.5;
  color: ${MUTED};
  break-inside: avoid;
}
.lp-end p { margin: 0 0 1mm; }
`
