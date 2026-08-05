"use client"

import {
  fromComgateOptionId,
  getComgateMethodLogo,
  toComgateOptionId,
  type ComgatePaymentMethod,
} from "@lib/util/comgate"
import ApplePay from "@modules/common/icons/apple-pay"
import GooglePay from "@modules/common/icons/google-pay"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import { useMemo, useState } from "react"
import styles from "./style.module.scss"

type MethodGroup = "card" | "wallet" | "bank"

type SelectorMethod = ComgatePaymentMethod & {
  optionId: string
  selectorGroup: MethodGroup
}

type ComgatePaymentSelectorProps = {
  methods: ComgatePaymentMethod[]
  selectedOptionId: string
  onSelect: (optionId: string) => void | Promise<void>
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  isSubmitting?: boolean
  className?: string
}

const ease = [0.76, 0, 0.24, 1] as const

const groupOrder: MethodGroup[] = ["card", "wallet", "bank"]

const groupMeta: Record<
  MethodGroup,
  { index: string; title: string; detail: string }
> = {
  card: {
    index: "01",
    title: "Platební karta",
    detail: "Visa, Mastercard a další karty",
  },
  wallet: {
    index: "02",
    title: "Apple / Google Pay",
    detail: "Rychlá platba uloženou peněženkou",
  },
  bank: {
    index: "03",
    title: "Platba přes banku",
    detail: "Vyberte svou banku nebo jinou banku",
  },
}

const fallbackMethods: ComgatePaymentMethod[] = [
  {
    id: "CARD_ALL",
    group: "CARD",
    groupLabel: "Platba kartou",
    name: "Platební karta",
    name_short: "Platební karta",
    description: "Visa, Mastercard a další podporované karty",
    logo: "",
    logo_120c: "",
    logo_240: "",
    logo_240c: "",
    logo_150s: "",
    logo_100s: "",
  },
  {
    id: "APPLEPAY_REDIRECT",
    group: "CARD",
    groupLabel: "Mobilní peněženka",
    name: "Apple Pay",
    name_short: "Apple Pay",
    description: "Potvrzení přes Face ID nebo Touch ID",
    logo: "",
    logo_120c: "",
    logo_240: "",
    logo_240c: "",
    logo_150s: "",
    logo_100s: "",
  },
  {
    id: "GOOGLEPAY_REDIRECT",
    group: "CARD",
    groupLabel: "Mobilní peněženka",
    name: "Google Pay",
    name_short: "Google Pay",
    description: "Rychlé potvrzení přes Google účet",
    logo: "",
    logo_120c: "",
    logo_240: "",
    logo_240c: "",
    logo_150s: "",
    logo_100s: "",
  },
  {
    id: "BANK_ALL",
    group: "BANK",
    groupLabel: "Bankovní převod",
    name: "Ostatní banky",
    name_short: "Ostatní banky",
    description: "Vyberete banku v zabezpečené bráně ComGate",
    logo: "",
    logo_120c: "",
    logo_240: "",
    logo_240c: "",
    logo_150s: "",
    logo_100s: "",
  },
]

const resolveGroup = (method: ComgatePaymentMethod): MethodGroup | null => {
  const id = method.id.toUpperCase()
  const group = method.group.toUpperCase()

  if (id.includes("APPLE") || id.includes("GOOGLE")) return "wallet"
  if (group === "BANK" || id.startsWith("BANK_")) return "bank"
  if (group === "LATER" || id.startsWith("LATER_")) return null
  return "card"
}

const legacyMethodId = (optionId: string) => {
  if (optionId === "pp_comgate_card") return "CARD_ALL"
  if (optionId === "pp_comgate_applepay") return "APPLEPAY_REDIRECT"
  if (optionId === "pp_comgate_googlepay") return "GOOGLEPAY_REDIRECT"
  if (optionId === "pp_comgate_bank") return "BANK_ALL"
  return ""
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs")

const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
  exit: { opacity: 0, transition: { duration: 0.18 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease },
  },
}

const panelVariants: Variants = {
  hidden: { height: 0, opacity: 0, y: -8 },
  visible: {
    height: "auto",
    opacity: 1,
    y: 0,
    transition: {
      height: { duration: 0.5, ease },
      opacity: { duration: 0.32, delay: 0.1 },
      y: { duration: 0.42, ease },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    y: -6,
    transition: {
      height: { duration: 0.42, ease },
      opacity: { duration: 0.18 },
      y: { duration: 0.28, ease },
    },
  },
}

const MethodLogo = ({ method }: { method: SelectorMethod }) => {
  const methodId = method.id.toUpperCase()

  if (methodId.includes("APPLE")) {
    return <ApplePay aria-hidden="true" />
  }

  if (methodId.includes("GOOGLE")) {
    return <GooglePay aria-hidden="true" />
  }

  const logo = getComgateMethodLogo(method)

  return logo ? (
    <img src={logo} alt="" loading="lazy" />
  ) : (
    <span aria-hidden="true">
      {(method.name_short || method.name || "P").slice(0, 1)}
    </span>
  )
}

export default function ComgatePaymentSelector({
  methods,
  selectedOptionId,
  onSelect,
  onConfirm,
  disabled = false,
  isSubmitting = false,
  className = "",
}: ComgatePaymentSelectorProps) {
  const options = useMemo<SelectorMethod[]>(
    () =>
      (methods.length ? methods : fallbackMethods).flatMap((method) => {
        const selectorGroup = resolveGroup(method)

        return selectorGroup
          ? [
              {
                ...method,
                optionId: toComgateOptionId(method.id),
                selectorGroup,
              },
            ]
          : []
      }),
    [methods]
  )
  const selectedMethodId =
    fromComgateOptionId(selectedOptionId) || legacyMethodId(selectedOptionId)
  const selectedMethod =
    options.find((method) => method.id === selectedMethodId) ||
    options.find((method) => {
      if (selectedMethodId === "CARD_ALL") {
        return method.selectorGroup === "card"
      }
      if (selectedMethodId === "BANK_ALL") {
        return (
          method.selectorGroup === "bank" &&
          (method.id.includes("OTHER") ||
            normalize(method.name_short || method.name).includes("ostatni"))
        )
      }
      return false
    })
  const [isChanging, setIsChanging] = useState(!selectedMethod)
  const [openGroup, setOpenGroup] = useState<MethodGroup | null>(
    selectedMethod?.selectorGroup || null
  )
  const [bankSearch, setBankSearch] = useState("")

  const grouped = useMemo(
    () =>
      groupOrder.map((id) => ({
        id,
        methods: options.filter((method) => method.selectorGroup === id),
      })),
    [options]
  )

  const choose = async (method: SelectorMethod) => {
    if (disabled || isSubmitting) return
    setIsChanging(false)
    await onSelect(method.optionId)
  }

  const open = (group: MethodGroup, groupMethods: SelectorMethod[]) => {
    if (disabled || isSubmitting) return

    if (groupMethods.length === 1) {
      void choose(groupMethods[0])
      return
    }

    setOpenGroup((current) => (current === group ? null : group))
    if (group !== "bank") setBankSearch("")
  }

  const activeGroupMethods =
    grouped.find((group) => group.id === openGroup)?.methods || []
  const isBankOpen = openGroup === "bank"
  const otherBank = isBankOpen
    ? activeGroupMethods.find(
        (method) =>
          method.id.includes("OTHER") ||
          normalize(method.name_short || method.name).includes("ostatni")
      )
    : undefined
  const filteredMethods = activeGroupMethods.filter((method) => {
    if (method === otherBank) return false
    if (!isBankOpen || !bankSearch.trim()) return true
    return normalize(`${method.name_short} ${method.name}`).includes(
      normalize(bankSearch.trim())
    )
  })

  return (
    <div className={`${styles.selector} ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        {selectedMethod && !isChanging ? (
          <motion.div
            className={styles.selectedState}
            key="selected"
            initial={initial}
            animate={animate}
            exit={exit}
            transition={transition}
          >
            <div className={styles.selected}>
              <span className={styles.selectedLogo}>
                <MethodLogo method={selectedMethod} />
              </span>
              <span className={styles.selectedCopy}>
                <small>Vybraná metoda</small>
                <strong>
                  {selectedMethod.name_short || selectedMethod.name}
                </strong>
                <span>
                  {isSubmitting
                    ? "Otevíráme bezpečnou platbu…"
                    : selectedMethod.description ||
                      "Bezpečná platba přes ComGate"}
                </span>
              </span>
              <button
                type="button"
                className={styles.change}
                onClick={() => {
                  setOpenGroup(selectedMethod.selectorGroup)
                  setIsChanging(true)
                }}
                disabled={disabled || isSubmitting}
              >
                Změnit
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <PremiumActionButton
              text={
                isSubmitting
                  ? "Otevíráme platební bránu…"
                  : "Potvrdit objednávku a zaplatit"
              }
              onClickAction={onConfirm}
              disabled={disabled || isSubmitting}
              active={isSubmitting}
              className={styles.confirm}
              data-testid="confirm-comgate-payment-button"
            />
          </motion.div>
        ) : (
          <motion.div
            className={styles.chooser}
            key="chooser"
            variants={listVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className={styles.groups}>
              {grouped.map(({ id, methods: groupMethods }) => {
                if (!groupMethods.length) return null
                const meta = groupMeta[id]
                const expanded = openGroup === id

                return (
                  <motion.button
                    type="button"
                    className={styles.group}
                    key={id}
                    variants={itemVariants}
                    data-group={id}
                    data-active={expanded}
                    aria-expanded={
                      groupMethods.length > 1 ? expanded : undefined
                    }
                    onClick={() => open(id, groupMethods)}
                    disabled={disabled || isSubmitting}
                  >
                    <span className={styles.groupFill} aria-hidden="true" />
                    <span className={styles.groupIndex}>{meta.index}</span>
                    <span className={styles.groupCopy}>
                      <strong>{meta.title}</strong>
                      <small>{meta.detail}</small>
                    </span>
                    <span className={styles.logoStack} aria-hidden="true">
                      {groupMethods.slice(0, 3).map((method) => (
                        <span key={method.id}>
                          <MethodLogo method={method} />
                        </span>
                      ))}
                    </span>
                    <span className={styles.groupArrow} aria-hidden="true">
                      {groupMethods.length > 1 ? (expanded ? "−" : "+") : "↗"}
                    </span>
                  </motion.button>
                )
              })}
            </div>

            <AnimatePresence initial={false}>
              {openGroup && activeGroupMethods.length > 1 && (
                <motion.div
                  className={styles.pickerWrap}
                  key={openGroup}
                  variants={panelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <div className={styles.picker}>
                    <div className={styles.pickerHeader}>
                      <span>
                        {openGroup === "bank"
                          ? "Vyberte banku"
                          : groupMeta[openGroup].title}
                      </span>
                      <small>{activeGroupMethods.length} možností</small>
                    </div>

                    {isBankOpen && (
                      <label className={styles.search}>
                        <span>Hledat banku</span>
                        <input
                          type="search"
                          value={bankSearch}
                          onChange={(event) =>
                            setBankSearch(event.target.value)
                          }
                          placeholder="Název banky…"
                          autoComplete="off"
                        />
                        {bankSearch && (
                          <button
                            type="button"
                            onClick={() => setBankSearch("")}
                            aria-label="Vymazat hledání"
                          >
                            ×
                          </button>
                        )}
                      </label>
                    )}

                    <motion.div
                      className={styles.methodGrid}
                      variants={listVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredMethods.map((method) => (
                        <motion.button
                          type="button"
                          key={method.id}
                          className={styles.method}
                          variants={itemVariants}
                          onClick={() => void choose(method)}
                          disabled={disabled || isSubmitting}
                        >
                          <span className={styles.methodLogo}>
                            <MethodLogo method={method} />
                          </span>
                          <span>{method.name_short || method.name}</span>
                          <span aria-hidden="true">↗</span>
                        </motion.button>
                      ))}
                    </motion.div>

                    {!filteredMethods.length && (
                      <p className={styles.noResults}>
                        Banku jsme nenašli. Použijte volbu „Ostatní banky“.
                      </p>
                    )}

                    {otherBank && (
                      <button
                        type="button"
                        className={styles.otherBank}
                        onClick={() => void choose(otherBank)}
                        disabled={disabled || isSubmitting}
                      >
                        <span className={styles.methodLogo}>
                          <MethodLogo method={otherBank} />
                        </span>
                        <span>
                          <strong>Ostatní banky</strong>
                          <small>Banku vyberete v zabezpečené bráně</small>
                        </span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const initial = { opacity: 0, y: 7 }
const animate = { opacity: 1, y: 0 }
const exit = { opacity: 0, y: -5 }
const transition = { duration: 0.42, ease }
