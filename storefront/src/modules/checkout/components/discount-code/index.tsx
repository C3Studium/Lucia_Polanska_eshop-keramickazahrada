"use client"

import { Badge, Heading, Text, clx } from "@medusajs/ui"
import React, { useActionState } from "react"

import { applyPromotions, submitPromotionForm } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { maZlevnenePolozky } from "@lib/util/sleva"
import { HttpTypes } from "@medusajs/types"
import Trash from "@modules/common/icons/trash"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import ErrorMessage from "../error-message"
import { AnimatePresence, motion } from "framer-motion"

import styles from "./style.module.scss"

type DiscountCodeProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[]
  }
  /**
   * `stacked` je souhrn v úzkém sloupci: přepínač, pod ním pole s tlačítkem.
   * `inline` je vodorovná linka pro široké místo, například plovoucí pruh
   * košíku na svislém tabletu.
   *
   * Je to prop, ne selektory zvenčí. Svislé odstupy nese uvnitř `margin`
   * přepínače a `padding` řádku — ve sloupci jsou to mezery mezi nimi, na
   * lince posun jednoho proti druhému. Volající je odtud přebít nemůže:
   * pravidla modulu mají čtyři třídy, jeho selektor by musel mít víc.
   */
  layout?: "stacked" | "inline"
}

const DiscountCode: React.FC<DiscountCodeProps> = ({
  cart,
  layout = "stacked",
}) => {
  const [isOpen, setIsOpen] = React.useState(false)

  const { items = [], promotions = [] } = cart
  const [removeError, setRemoveError] = React.useState<string | null>(null)

  /*
   * Removal = re-apply everything EXCEPT the removed code. The original filter
   * was inverted (`code === undefined`), which sent an empty list and wiped
   * every promotion the moment any single one was removed.
   */
  const removePromotionCode = async (code: string) => {
    setRemoveError(null)
    try {
      await applyPromotions(
        promotions
          .filter((promotion) => promotion.code !== undefined)
          .filter((promotion) => promotion.code !== code)
          .map((promotion) => promotion.code!)
      )
    } catch {
      setRemoveError("Kód se nepodařilo odebrat. Zkuste to prosím znovu.")
    }
  }

  const [message, formAction] = useActionState(submitPromotionForm, null)

  /*
   * Jeden kód na objednávku — ale pole zůstává otevřené.
   *
   * Chvíli tu místo formuláře stála jen věta „odeberte nejdřív ten stávající".
   * Pravidlo to popisovalo správně a bylo to k ničemu: člověk u pokladny chce
   * kód napsat tam, kde stojí, ne se vracet do košíku nebo hledat koš.
   *
   * Zadání nového kódu se tedy vždycky zkusí a v košíku zůstane ten, který
   * slevuje víc (`submitPromotionForm`) — pořád je uplatněná jedna sleva
   * a zákazník o tu výhodnější nepřijde tím, že zkusil druhý kód.
   *
   * Automatické akce se do toho nepočítají: ty si nasazuje obchod sám
   * a zákazník je nezadával; poznají se podle toho, že u nich chybí i tlačítko
   * na odebrání.
   */
  const maRucniKod = promotions.some((promotion) => !promotion.is_automatic)

  /* Kód se nevztahuje na kusy, které už mají sníženou cenu. Píše se to, jen
     když je takový kus opravdu v košíku — jinak by to byla výstraha do prázdna. */
  const maZlevnene = maZlevnenePolozky(items as any[])

  return (
    <div className={clx(styles.root, layout === "inline" && styles.inline)}>
      <div className={styles.content}>
        <form action={formAction} className={styles.form}>
          {/* A div, not <Label>: a label wrapping a button (with no control)
              is a semantic misuse some screen readers announce twice. */}
          <div className={styles.label}>
            <PremiumActionButton
              compact
              text="Mám slevový kód"
              onClickAction={() => setIsOpen((current) => !current)}
              active={isOpen}
              type="button"
              className={styles.toggleBtn}
              data-testid="add-discount-button"
            />

            {/* <Tooltip content="You can add multiple promotion codes">
              <InformationCircleSolid color="var(--fg-muted)" />
            </Tooltip> */}
          </div>

          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                className={styles.promoReveal}
                initial={initial}
                animate={animate}
                exit={exit}
                transition={transition}
              >
                <div className={styles.row}>
                  {/*
                    Vlastní `<input>`, ne `<Input>` z @medusajs/ui.

                    Ta komponenta si nese svůj vzhled — vlastní rámeček, poloměr
                    a modrý focus prstenec — který na krémovém souhrnu vypadá jako
                    kus cizí administrace. Navíc obaluje pole ještě jedním divem,
                    takže flexovou položkou řádku byl ten obal a ne pole samo; kvůli
                    tomu tu stálo pravidlo na `> :first-child`.
                  */}
                  <input
                    className={styles.input}
                    id="promotion-input"
                    name="code"
                    type="text"
                    aria-label="Slevový kód"
                    placeholder="Napište slevový kód"
                    autoFocus
                    data-testid="discount-input"
                  />
                  <PremiumActionButton
                    compact
                    text="Použít"
                    type="submit"
                    data-testid="discount-apply-button"
                    className={styles.applyBtn}
                  />
                </div>

                {/* Odebrání kódu je vždycky chyba, když se ozve; výsledek
                    zadání si druh nese s sebou (`VysledekKodu`). */}
                <ErrorMessage
                  error={message?.text ?? removeError}
                  druh={message?.druh ?? "chyba"}
                  data-testid="discount-error-message"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {(maRucniKod || maZlevnene) && (
          <div className={styles.poznamky}>
            {maRucniKod && (
              <Text
                className={styles.poznamka}
                data-testid="discount-replace-note"
              >
                Uplatnit lze jeden slevový kód — zůstane ten, který slevuje víc.
              </Text>
            )}
            {maZlevnene && (
              <Text
                className={styles.poznamka}
                data-testid="discount-sale-note"
              >
                Na zlevněné kusy se slevové kódy nevztahují.
              </Text>
            )}
          </div>
        )}

        {promotions.length > 0 && (
          <div className={styles.promotionsWrap}>
            <div className={styles.promotionsCol}>
              <Heading className={styles.heading}>
                Použité slevové kódy:
              </Heading>

              {promotions.map((promotion) => {
                return (
                  <div
                    key={promotion.id}
                    className={styles.promoRow}
                    data-testid="discount-row"
                  >
                    <Text className={styles.promoText}>
                      <span className="truncate" data-testid="discount-code">
                        <Badge
                          color={promotion.is_automatic ? "green" : "grey"}
                          size="small"
                        >
                          {promotion.code}
                        </Badge>{" "}
                        (
                        {promotion.application_method?.value !== undefined &&
                          promotion.application_method.currency_code !==
                            undefined && (
                            <>
                              {promotion.application_method.type ===
                              "percentage"
                                ? `${promotion.application_method.value}%`
                                : convertToLocale({
                                    amount: Number(
                                      promotion.application_method.value as any
                                    ),
                                    currency_code:
                                      promotion.application_method
                                        .currency_code,
                                  })}
                            </>
                          )}
                        )
                        {/* {promotion.is_automatic && (
                          <Tooltip content="This promotion is automatically applied">
                            <InformationCircleSolid className="inline text-zinc-400" />
                          </Tooltip>
                        )} */}
                      </span>
                    </Text>
                    {!promotion.is_automatic && (
                      <button
                        className={styles.removeBtn}
                        onClick={() => {
                          if (!promotion.code) {
                            return
                          }

                          void removePromotionCode(promotion.code)
                        }}
                        data-testid="remove-discount-button"
                      >
                        <Trash size={14} />
                        <span className="sr-only">
                          Odebrat slevový kód
                        </span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DiscountCode


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff.
   Dráha je svislá, takže vh místo px: dosavadních 8px na 900px vysokém okně je
   .89vh (8 / 900 * 100). Výstupní posun byl 6px, tedy 3/4 vstupního — odvozuje se
   z jednoho čísla, neopisuje se druhé: .89 * .75 = .67vh. Na 660px notebooku je
   z toho 5.9px, na 1351 12.0px, tedy pořád tentýž podíl obrazovky.
   Obě strany interpolace musí mít stejný tvar výrazu, proto "0vh" a ne 0. */
const REVEAL_VH = 0.89
const initial = { height: 0, opacity: 0, y: `-${REVEAL_VH}vh` }
const animate = { height: "auto" as const, opacity: 1, y: "0vh" }
const exit = { height: 0, opacity: 0, y: `-${(REVEAL_VH * 0.75).toFixed(2)}vh` }
const transition = {
                  height: { duration: 0.48, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] },
                  opacity: { duration: 0.24, delay: 0.08 },
                  y: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
                }
