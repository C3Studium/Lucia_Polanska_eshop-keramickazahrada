import s from "./style.module.scss"
import LinkButton from "@modules/common/components/Buttons/LinkButton"
import CmsText from "@modules/common/components/cms-text"
import type { CopyBlock } from "@lib/util/site-copy"
import { getTexty } from "@lib/data/texty"

/**
 * Prázdný košík. Texty z bloku `kosik.prazdny` — nadpis (`title`), věta
 * (`body`) a tlačítko (`accent.0`); cíl tlačítka (`/store`) drží kód.
 */
const EmptyCartMessage = async ({ block }: { block?: CopyBlock }) => {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = await getTexty()
  const doc = block?.id ?? null
  const title = block?.title?.trim() || "Košík"
  const text =
    block?.bodyText?.trim() ||
    texty["kosik.prazdny"]
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
