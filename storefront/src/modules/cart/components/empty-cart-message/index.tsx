import s from "./style.module.scss"
import LinkButton from "@modules/common/components/Buttons/LinkButton"
import CmsText from "@modules/common/components/cms-text"
import type { CopyBlock } from "@lib/util/site-copy"

/**
 * Prázdný košík. Texty z bloku `kosik.prazdny` — nadpis (`title`), věta
 * (`body`) a tlačítko (`accent.0`); cíl tlačítka (`/store`) drží kód.
 */
const EmptyCartMessage = ({ block }: { block?: CopyBlock }) => {
  const doc = block?.id ?? null
  const title = block?.title?.trim() || "Košík"
  const text =
    block?.bodyText?.trim() ||
    "Zatím je prázdný. Podívejte se, co je v ateliéru — třeba vás něco chytne."
  const cta = block?.accent?.[0]?.trim() || "Prozkoumat produkty"

  return (
    <div className={s.root} data-testid="empty-cart-message">
      <CmsText as="h1" className={s.title} doc={doc} field="title">
        {title}
      </CmsText>
      <CmsText as="p" className={s.desc} doc={doc} field="body">
        {text}
      </CmsText>
      {/* Anotace na obalu, jako u ostatních tlačítek — vnitřek se při
          najetí myší animuje a přepisuje. */}
      <CmsText as="div" doc={doc} field="accent.0">
        <LinkButton href="/store" text={cta} />
      </CmsText>
    </div>
  )
}

export default EmptyCartMessage
