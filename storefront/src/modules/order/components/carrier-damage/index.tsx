"use client"

import { AnimatePresence, cubicBezier, motion } from "framer-motion"
import { useId, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ContactEmailLink from "@modules/common/components/contact-email"

import styles from "./style.module.scss"

import { useSiteReducedMotion } from "@lib/context/MotionPreferenceProvider"
/**
 * Poškozená zásilka — co udělat, když keramika dorazí rozbitá.
 *
 * ## Dva různé případy (4. 11. 2026, rozhodnutí majitelky)
 *
 * Blok se rozděluje podle toho, v jakém stavu dorazila KRABICE, protože každý
 * stav patří někomu jinému:
 *
 * - **poškozený obal** = škoda dopravce. Zabaleno je dobře, a co se s obalem
 *   stalo po cestě, uznává a platí Česká pošta. Zákazník to tedy hlásí na
 *   poště, a není to jen pohodlnější cesta: náhradu ČP vyplácí ADRESÁTOVI,
 *   takže ji za něj nikdo jiný uplatnit nemůže, a nárok propadá do dvou
 *   pracovních dnů od dodání;
 * - **krabice v pořádku, rozbitý výrobek** = naše věc, běžná reklamace u nás.
 *
 * Předchozí znění („s dopravcem si to vyřešíme sami, vy kvůli tomu nikam
 * chodit nemusíte") mělo nechtěnou cenu: dvoudenní lhůta pošty propadla, než
 * se k zásilce kdokoli dostal, a náhradu pak nedostal nikdo.
 *
 * ## Co v textu zůstává a proč
 *
 * Reklamační řád, čl. 5 (vydané znění od 3. 11. 2026) říká, že poškození při
 * přepravě je vada při převzetí (§ 2161 odst. 1 OZ), reklamuje se U NÁS
 * a žádná lhůta dopravce zákazníka nezavazuje. Dokud tohle znění platí,
 * nesmí blok tvrdit, že se na nás obrátit nemůže — proto první krok končí
 * tím, že jeho reklamaci vyřídíme, i kdyby na poště neuspěl. Udělat z pošty
 * jedinou cestu znamená nové znění reklamačního řádu, ne jiný text tady.
 *
 * ## Vlastní protokol, žádný formulář dopravce
 *
 * „Reklamační protokol" je NÁŠ vydávaný právní dokument
 * (`/reklamacni-protokol#formular`), ne nahrané PDF z administrace. Česká
 * pošta formulář ke stažení pro obyčejné zásilky nevydává — ten jediný, co
 * zveřejňuje, platí pro balíky nad 30 kg (viz `modules/dokumenty/catalogue`,
 * kde kvůli tomu zmizel slot `reklamacni-formular`).
 *
 * ## Sbalené, dokud o to člověk nestojí
 *
 * Je to pojistka, ne zpráva: naprostá většina zásilek dorazí v pořádku a kroky
 * reklamace odsouvaly to, kvůli čemu na stránku člověk přišel — číslo objednávky
 * a co si koupil. Sbalené to zůstává jednou větou, kterou si přečte každý, a otevře
 * si ho ten, komu se zásilka poškodila.
 *
 * ## Shown for carrier deliveries only
 *
 * Osobní odběr has no courier to inspect in front of and no carrier to claim against. Showing
 * it there would be noise, and noise is how the warning stops being read on the orders where
 * it matters.
 */


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
  /** False for Osobní odběr — no carrier, no claim. */
  isCarrierDelivery: boolean
  /** `pending` before dispatch (warn), `delivered` after (how to claim). */
  stage?: "pending" | "delivered"
}

export default function CarrierDamageNotice({
  orderNumber,
  isCarrierDelivery,
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
                  protržený nebo něčím prosakuje, rozbalte zásilku před
                  doručovatelem a poškození s ním rovnou sepište — se záznamem
                  pošta reklamaci vyřídí nejsnáz. Podmínkou to ale není:
                  keramika se rozbije tiše a poškození často najdete až doma.
                </p>
              ) : (
                <p className={styles.lede}>
                  Záleží na tom, v jakém stavu dorazila krabice. Poškozený obal
                  je škoda dopravce a hlásí se na poště; rozbitý kus
                  v nepoškozené krabici je na nás.
                </p>
              )}

              <ol className={styles.steps}>
                <li>
                  <strong>Poškozená krabice</strong> — nahlaste zásilku na
                  kterékoli poště, nejlépe do dvou pracovních dnů od převzetí.
                  Náhradu Česká pošta vyplácí adresátovi, tedy vám, a nikdo ji
                  za vás uplatnit nemůže. Vezměte s sebou zásilku i s obalem
                  a výplní, nebo aspoň fotky. Kdyby vám reklamaci nepřijali,
                  napište nám — vyřídíme ji my.
                </li>
                <li>
                  <strong>Krabice v pořádku, rozbitý výrobek</strong> —
                  reklamaci podáte u nás z odkazu v e-mailu u objednávky
                  {orderNumber ? ` (objednávka ${orderNumber})` : ""}, nebo na{" "}
                  <ContactEmailLink role="objednavky" />
                  .
                </li>
                <li>
                  <strong>Vyfoťte obal i obsah</strong> a obal si prosím
                  schovejte, dokud se to nevyřeší — fotky potřebuje pošta
                  i my.
                </li>
              </ol>

              <div className={styles.document}>
                <p className={styles.documentLabel}>Reklamační protokol</p>
                <p className={styles.documentNote}>
                  K reklamaci u nás můžete použít i náš{" "}
                  <LocalizedClientLink href="/reklamacni-protokol#formular">
                    reklamační protokol
                  </LocalizedClientLink>
                  {" "}— povinné to není, stačí nám napsat.
                </p>
              </div>

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
