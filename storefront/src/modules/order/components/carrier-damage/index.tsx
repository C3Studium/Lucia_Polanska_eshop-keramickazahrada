"use client"

import { AnimatePresence, cubicBezier, motion, useReducedMotion } from "framer-motion"
import { useId, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import styles from "./style.module.scss"

/**
 * Poškozená zásilka — what to do, and the window it has to happen in.
 *
 * ## Why the customer is told rather than the shop handling it
 *
 * Under Česká pošta's rules the **recipient** files a transport claim, not the sender. She
 * physically cannot do it on their behalf. So the only useful thing the shop can do is tell
 * them clearly, early, and while the clock is still running:
 *
 * - inspect the packaging **before signing**, and open it in front of the courier if anything
 *   looks wrong;
 * - report damage at handover or **within two working days** — after that ČP refuses the claim;
 * - file at any branch or through *eReklamace*, with photographs and proof of value.
 *
 * A parcel accepted without inspection and found broken on day three is nobody's liability but
 * the customer's. Saying so before it happens is kinder than saying so afterwards, which is
 * why this sits on the order rather than only in the terms.
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

export const CP_EREKLAMACE_URL = "https://www.ceskaposta.cz/ereklamace"

/** Jméno dokumentu v modulu Dokumenty; prázdné místo se ohlásí v Přehledu. */
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
  const bezPohybu = useReducedMotion()
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
                  Prohlédněte si prosím obal ještě před podpisem. Je-li promáčklý,
                  protržený nebo něčím prosakuje, rozbalte zásilku rovnou před
                  doručovatelem. Keramika se rozbije tiše — zvenku bývá krabice
                  v pořádku.
                </p>
              ) : (
                <p className={styles.lede}>
                  Reklamaci u dopravce podává příjemce, tedy vy — my ji za vás
                  bohužel podat nemůžeme. Máte na ni dva pracovní dny od doručení.
                </p>
              )}

              <ol className={styles.steps}>
                <li>
                  <strong>Vyfoťte</strong> obal i obsah, ještě než cokoli vybalíte
                  dál.
                </li>
                <li>
                  <strong>Nahlaste to do dvou pracovních dnů</strong> — na kterékoli
                  pobočce České pošty, nebo online v{" "}
                  <a href={CP_EREKLAMACE_URL} target="_blank" rel="noreferrer">
                    eReklamaci
                  </a>
                  . Po této lhůtě už Česká pošta reklamaci nepřijme.
                </li>
                <li>
                  <strong>Přiložte doklad o ceně</strong> zboží
                  {orderNumber ? ` a číslo objednávky ${orderNumber}` : ""}.
                </li>
                <li>
                  <strong>Dejte vědět i nám.</strong> O poškozené zásilce chceme
                  vědět, i když ji řeší dopravce.
                </li>
              </ol>

              <div className={styles.document}>
                <p className={styles.documentLabel}>
                  {claimForm?.title ?? "Formulář k reklamaci"}
                </p>
                {claimForm ? (
                  <p className={styles.documentNote}>
                    <a href={claimForm.url} target="_blank" rel="noreferrer">
                      Stáhnout formulář
                    </a>
                  </p>
                ) : (
                  /* Nenahráno — Přehled na to upozorňuje. Do té doby ať je aspoň
                     řečeno, kde formulář sehnat, místo mlčení nebo mrtvého odkazu. */
                  <p className={styles.documentNote}>
                    Dokument sem doplníme — do té doby použijte formulář přímo na
                    pobočce nebo v eReklamaci České pošty.
                  </p>
                )}
              </div>

              <p className={styles.more}>
                Podrobný postup a vaše práva najdete v{" "}
                <LocalizedClientLink href="/reklamacni-protokol">
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
