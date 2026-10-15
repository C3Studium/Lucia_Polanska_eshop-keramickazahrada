import type { ReactNode } from "react"
import { renderInline } from "@lib/legal/inline"
import { formatVersionDate, LEGAL_PATHS } from "@lib/legal/registry"
import type { LegalBlock, LegalDocumentVersion } from "@lib/legal/types"
import { documentHasPlaceholder, printHrefFor } from "./meta"

/**
 * Dokument pro tisk do PDF (A4). Serverová komponenta bez hooků a animací —
 * PDF musí odpovídat tomu, co je v registru, ne stavu prohlížeče.
 *
 * Do PDF se záměrně NEDÁVÁ nic, co se s časem mění (archivní příznak,
 * „nahrazeno zněním od …"): PDF vydané verze je neměnné, váže se k němu
 * uzavřená smlouva.
 */

const inline = (text: string): ReactNode[] =>
  renderInline(text, { hrefFor: printHrefFor, placeholderClassName: "lp-placeholder" })

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </>
  )
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "p":
      return <p className="lp-p">{inline(block.text)}</p>
    case "ul":
      return (
        <ul className="lp-list lp-list--ul">
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>
      )
    case "ol":
      return (
        <ol className="lp-list lp-list--ol">
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ol>
      )
    case "table":
      return (
        <div className="lp-table-wrap">
          <table className="lp-table">
            {block.caption ? <caption>{inline(block.caption)}</caption> : null}
            <thead>
              <tr>
                {block.head.map((cell, index) => (
                  <th key={index} scope="col">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case "box":
      return (
        <div className="lp-box">
          {block.title ? <p className="lp-box-title">{inline(block.title)}</p> : null}
          <Blocks blocks={block.blocks} />
        </div>
      )
    case "form":
      return (
        <div className="lp-form">
          {block.title ? <p className="lp-form-title">{inline(block.title)}</p> : null}
          {block.fields.map((field, index) => (
            <div key={index} className="lp-field">
              <span className="lp-field-label">{inline(field.label)}</span>
              <span
                className={
                  field.value ? "lp-field-line" : "lp-field-line lp-field-line--blank"
                }
              >
                {field.value ? inline(field.value) : null}
              </span>
            </div>
          ))}
          {block.note ? <p className="lp-form-note">{inline(block.note)}</p> : null}
        </div>
      )
    default:
      return null
  }
}

export default function LegalPrintDocument({ doc }: { doc: LegalDocumentVersion }) {
  const validFrom = formatVersionDate(doc.version)
  const currentUrl = printHrefFor(LEGAL_PATHS[doc.slug])
  const showToc = doc.sections.length >= 4

  return (
    <article
      className="lp-root"
      data-legal-print-ready=""
      data-legal-slug={doc.slug}
      data-legal-version={doc.version}
    >
      <div className="lp-page">
        <header className="lp-head">
          <p className="lp-brand">
            <span className="lp-wordmark">
              Keramická <em>zahrada</em>
            </span>
            <span className="lp-brand-sub">Ateliér Lucie Polanské · Písek</span>
          </p>
          <p className="lp-seller">
            <strong>Prodávající: {inline("{{seller.name}}")}</strong>
            <br />
            {inline("{{seller.address}}")}
            <br />
            IČO {inline("{{seller.ico}}")}
            <br />
            {inline("{{seller.email}}")} · {inline("{{seller.phone}}")}
            <br />
            {inline("{{seller.web}}")}
          </p>
        </header>

        <h1 className="lp-title">{inline(doc.title)}</h1>
        <p className="lp-validity">
          <strong>Platné od {validFrom}</strong>
          <span> · verze {doc.version}</span>
        </p>
        {doc.summary ? <p className="lp-summary">{inline(doc.summary)}</p> : null}

        {documentHasPlaceholder(doc) ? (
          <p className="lp-draft">
            <strong>Pracovní znění.</strong> Žlutě zvýrazněné údaje ještě nejsou
            doplněné — takové PDF se nesmí posílat zákazníkům.
          </p>
        ) : null}

        {showToc ? (
          <nav className="lp-toc" aria-label="Obsah">
            <p className="lp-toc-label">Obsah</p>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{inline(section.title)}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="lp-section">
            <h2 className="lp-h2">{inline(section.title)}</h2>
            <Blocks blocks={section.blocks} />
          </section>
        ))}

        <footer className="lp-end">
          <p>
            {inline(doc.title)} · znění platné od {validFrom} (verze {doc.version}).
          </p>
          <p>
            {inline("{{seller.name}}")}, {inline("{{seller.address}}")}, IČO{" "}
            {inline("{{seller.ico}}")}. Aktuální znění najdete na{" "}
            <a href={currentUrl}>{currentUrl.replace(/^https?:\/\//, "")}</a>.
          </p>
        </footer>
      </div>
    </article>
  )
}
