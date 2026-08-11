import { AnimatePresence, motion } from "framer-motion"
import s from "./style.module.scss"
import { useEffect } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import { useFormStatus } from "react-dom"
import PremiumActionButton from "@modules/common/components/premium-action-button"
import AccountInteractiveSurface from "../account-interactive-surface"
import { accountDisclosureVariants, accountSectionVariants } from "../../motion"

type AccountInfoProps = {
  label: string
  currentInfo: string | React.ReactNode
  isSuccess?: boolean
  isError?: boolean
  errorMessage?: string
  clearState: () => void
  children?: React.ReactNode
  "data-testid"?: string
}

const AccountInfo = ({
  label,
  currentInfo,
  isSuccess,
  isError,
  clearState,
  errorMessage = "An error occurred, please try again",
  children,
  "data-testid": dataTestid,
}: AccountInfoProps) => {
  const { state, close, toggle } = useToggleState()

  const { pending } = useFormStatus()

  const handleToggle = () => {
    clearState()
    toggle()
  }

  useEffect(() => {
    if (isSuccess) {
      close()
    }
  }, [isSuccess, close])

  return (
    <motion.div
      className={s.root}
      variants={accountSectionVariants}
      data-testid={dataTestid}
    >
      <AccountInteractiveSurface
        className={s.summaryRow}
        contentClassName={s.headerRow}
      >
        <span className={s.labelUpper}>{label}</span>
        <div className={s.currentValue}>
          {typeof currentInfo === "string" ? (
            <span className={s.valueText} data-testid="current-info">
              {currentInfo}
            </span>
          ) : (
            currentInfo
          )}
        </div>
        <div className={s.editAction}>
          <PremiumActionButton
            text={state ? "Zrušit" : "Upravit"}
            onClickAction={handleToggle}
            className={s.editBtn}
            active={state}
            compact
            data-testid="edit-button"
          />
        </div>
      </AccountInteractiveSurface>

      <AnimatePresence initial={false}>
        {isSuccess && (
          <motion.div
            className={s.successPanel}
            variants={accountDisclosureVariants}
            initial="closed"
            animate="open"
            exit="closed"
            data-testid="success-message"
          >
            <p>{label} jsme uložili.</p>
          </motion.div>
        )}
        {isError && (
          <motion.div
            className={s.errorPanel}
            variants={accountDisclosureVariants}
            initial="closed"
            animate="open"
            exit="closed"
            data-testid="error-message"
          >
            <p>{errorMessage}</p>
          </motion.div>
        )}
        {state && (
          <motion.div
            className={s.editPanel}
            variants={accountDisclosureVariants}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <div className={s.editContent}>
              <div>{children}</div>
              <div className={s.editActions}>
                <PremiumActionButton
                  text="Uložit změny"
                  type="submit"
                  disabled={pending}
                  className={s.saveBtn}
                  data-testid="save-button"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default AccountInfo
