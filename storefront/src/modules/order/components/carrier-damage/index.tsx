"use client"

import { AnimatePresence, cubicBezier, motion } from "framer-motion"
import { useId, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

import { useSiteReducedMotion } from "@lib/context/MotionPreferenceProvider"
/**
 * Poškozená zásilka — co udělat, když keramika dorazí rozbitá.
 *
 * ## Kdo za poškození odpovídá (14. 10. 2026, právní audit §4.1)
 *
 * Prodávající odpovídá za to, že zboží při PŘEVZETÍ nemá vady (§ 2161 odst. 1
 * OZ), a nebezpečí škody přechází na zákazníka až převzetím (§ 2159 odst. 2).
 * Rozbitý kus v krabici je tedy vada při převzetí: zákazník ho reklamuje
 * u nás a škodu u dopravce si řeší prodávající (pojištění balíku). Lhůta
 * České pošty (2 pracovní dny) je vztah prodávající–dopravce — zákazníka
 * nezavazuje a reklamaci nepodmiňuje.
 *
 * Dřívější text („reklamaci u dopravce podává příjemce, máte na ni dva
 * pracovní dny, potom ji Česká pošta nepřijme") z toho dělal podmínku —
 * v rozporu se zákonem. Teď:
 *
 * - prohlédnout obal při převzetí je PROSBA (pomůže nám s dopravcem);
 * - poškození hlásí zákazník nám — fotky vítány, obal schovat, pokud to jde;
 * - kdyby Česká pošta potřebovala jeho součinnost, ozveme se.
 *
 * ## Sbalené, dokud o to člověk nestojí
 *
 * Je to pojistka, ne zpráva: naprostá většina zásilek dorazí v pořádku a čtyři kroky
 * reklamace odsouvaly to, kvůli čemu na stránku člověk přišel — číslo objednávky
 * a co si koupil. Sbalené to zůstává jednou větou, kterou si přečte každý, a otevře
 * si ho ten, komu se zásilka poškodila.
 *
 * ## Formulář přichází jako prop, ne z fetche
 *
 * Tenhle blok visí i na stránce objednávky v účtu, a ta je klientská. Kdyby si dokument
 * načítal sám, přitáhl by si s sebou `server-only` část datové vrstvy a build spadne
 * na „that only works in a Server Component". Načíst ho tedy musí ta stránka, která je
 * serverová, a poslat sem hotový.
 *
 * ## Shown for carrier deliveries only
 *
 * Osobní odběr has no courier to inspect in front of and no carrier to claim against. Showing
 * it there would be noise, and noise is how the warning stops being read on the orders where
 * it matters.
 */

/**
 * Jméno dokumentu v modulu Dokumenty („Formulář k reklamaci"); prázdné místo
 * se ohlásí v Přehledu. Od 14. 10. 2026 se nabízí jen jako NEPOVINNÁ pomůcka
 * — reklamace jde podat online i bez něj, a není to formulář dopravce, který
 * by zákazník musel vyplnit.
 */
export const CLAIM_FORM_KEY = "reklamacni-formular"

/*
 * Rychle do tří čtvrtin, zbytek doplout.
 *
 * Změřeno na téhle křivce: 75 % dráhy je za 24 % času, zbylá čtvrtina se
 * roztáhne přes zbývajících 76 %. Blok je tím prakticky hned otevřený a poslední
 * kus dojede tak pomalu, že oko sleduje text, ne pohyb. Táž křivka jede
 * i jinde v projektu, takže se rozbalování chová jako zbytek webu.
 */
const OTEVIRANI = cubicBezier(0.22, 1, 0.36, 1)
const DELKA = 0.85

type Props = {
  orderNumber?: string | number
  /* Jen to, co se tu vypisuje — ne celý typ z datové vrstvy, ať si tahle
     komponenta nepřitáhne nic serverového. */
  claimForm?: { title: string; url: string } | null
  /** False for Osobní odběr — no carrier, no claim. */
  isCarrierDelivery: boolean
  /** `pending` before dispatch (warn), `delivered` after (how to claim). */
  stage?: "pending" | "delivered"
}

export default function CarrierDamageNotice({
  orderNumber,
  isCarrierDelivery,
  claimForm = null,
  stage = "pending",
}: Props) {
  const [otevreno, setOtevreno] = useState(false)
  const bezPohybu = useSiteReducedMotion()
  const idObsahu = useId()

  if (!isCarrierDelivery) {
    return null
  }

  const prechod = { duration: bezPohybu ? 0 : DELKA, ease: OTEVIRANI }

  return (
    <section className={styles.root}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={otevreno}
        aria-controls={idObsahu}
        onClick={() => setOtevreno((stav) => !stav)}
      >
        <span className={styles.summaryCopy}>
          <span className={styles.eyebrow}>Převzetí zásilky</span>
          <span className={styles.heading}>
            {stage === "delivered"
              ? "Dorazila zásilka poškozená?"
              : "Než zásilku převezmete"}
          </span>
        </span>
        <motion.span
          className={styles.chevron}
          aria-hidden="true"
          animate={{ rotate: otevreno ? 180 : 0 }}
          transition={prechod}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {otevreno && (
          <motion.div
            id={idObsahu}
            className={styles.bodyWrap}
            /* Výška na `auto`, ne na změřený pixel: obsah se láme podle šířky
               okna a napevno spočítaná výška by ho po otočení telefonu ustřihla. */
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={prechod}
          >
            <div className={styles.body}>
              {stage === "pending" ? (
                <p className={styles.lede}>
                  Prohlédněte si prosím obal ještě při převzetí. Je-li promáčklý,
                  protržený nebo něčím prosakuje, můžete zásilku rozbalit před
                  doručovatelem a poškození s ním rovnou sepsat — usnadní nám to
                  vyřízení s dopravcem. Podmínkou to ale není: keramika se rozbije
                  tiše a poškození často najdete až doma.
                </p>
              ) : (
                <p className={styles.lede}>
                  Za to, že zboží dorazí v pořádku, odpovídáme my. Poškozený kus
                  vyměníme nebo vrátíme peníze — a s dopravcem si to vyřešíme
                  sami. Vy kvůli tomu nikam chodit nemusíte.
                </p>
              )}

              <ol className={styles.steps}>
                <li>
                  <strong>Vyfoťte</strong> obal i obsah, pokud můžete — fotky nám
                  s dopravcem pomohou.
                </li>
                <li>
                  <strong>Napište nám</strong> — reklamaci podáte z odkazu
                  v e-mailu u objednávky
                  {orderNumber ? ` (objednávka ${orderNumber})` : ""}, nebo na{" "}
                  <a href="mailto:info@keramickazahrada.cz">
                    info@keramickazahrada.cz
                  </a>
                  .
                </li>
                <li>
                  <strong>Obal si prosím schovejte</strong>, dokud se vám
                  neozveme. Kdyby Česká pošta potřebovala vaši pomoc (například
                  sepsat záznam o poškození), dáme vám vědět — vaši reklamaci to
                  nijak nepodmiňuje.
                </li>
              </ol>

              {/* Nepovinná pomůcka (modul Dokumenty). Když chybí, nic se
                  nevypisuje — reklamace jde podat i bez ní. */}
              {claimForm ? (
                <div className={styles.document}>
                  <p className={styles.documentLabel}>
                    {claimForm.title || "Formulář k reklamaci"}
                  </p>
                  <p className={styles.documentNote}>
                    Pokud vám to tak vyhovuje víc, můžete nám poslat i vyplněný{" "}
                    <a href={claimForm.url} target="_blank" rel="noreferrer">
                      formulář k reklamaci
                    </a>{" "}
                    — povinné to není.
                  </p>
                </div>
              ) : null}

              <p className={styles.more}>
                Podrobný postup a vaše práva najdete v{" "}
                <LocalizedClientLink href="/reklamacni-rad">
                  reklamačním řádu
                </LocalizedClientLink>
                .
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
