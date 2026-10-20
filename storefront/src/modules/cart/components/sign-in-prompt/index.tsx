"use client"
import { editable } from "@c3studium/valecms/edit"
import { useEditRerender } from "@lib/hooks/use-edit-rerender"
import type { CopyBlock } from "@lib/util/site-copy"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import s from "./style.module.scss"

/**
 * Výzva k přihlášení v košíku. Texty z bloku `kosik.prihlaseni` — nadpis
 * (`title`), věta (`body`) a tlačítko (`accent.0`); cíl přihlášení drží kód.
 */
const SignInPrompt = ({ block }: { block?: CopyBlock }) => {
  /* Klidná sekce bez vlastního stavu — po zapnutí editace by se sama
     nepřekreslila a anotace by zůstaly prázdné. Viz hook. */
  useEditRerender()

  const title = block?.title?.trim() || "Máte u nás účet?"
  const text =
    block?.bodyText?.trim() || "Přihlaste se a nemusíte znovu vyplňovat adresu."
  const cta = block?.accent?.[0]?.trim() || "Přihlásit se"

  return (
    <div className={s.root}>
      <div className={s.content}>
        <h2 className={s.title} {...editable(block, "title")}>{title}</h2>
        <p className={s.desc} {...editable(block, "body")}>{text}</p>
      </div>
      <div className={s.ctaWrap} {...editable(block, "accent.0")}>
        <LocalizedClientLink
          className={s.link}
          href="/account?redirectTo=/cart"
        >
          <PremiumActionButton
            compact
            text={cta}
            type="button"
            className={s.button}
            data-testid="sign-in-button"
            onClickAction={undefined} // navigation handled by Link
          />
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default SignInPrompt
