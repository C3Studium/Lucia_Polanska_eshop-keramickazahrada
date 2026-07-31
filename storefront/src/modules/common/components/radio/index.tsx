"use client"

import { motion } from "framer-motion"
import s from "./style.module.scss"

type RadioProps = {
  checked: boolean
  disabled?: boolean
  "data-testid"?: string
}

const ease = [0.22, 1, 0.36, 1] as const

const Radio = ({
  checked,
  disabled = false,
  "data-testid": dataTestId,
}: RadioProps) => {
  const state = disabled ? "disabled" : checked ? "checked" : "unchecked"

  return (
    <span
      className={s.root}
      data-testid={dataTestId || "radio-button"}
      data-state={state}
      aria-hidden="true"
    >
      <motion.span
        className={s.outer}
        initial={false}
        animate={state}
        variants={{
          unchecked: {
            borderColor: "rgba(32, 33, 28, .48)",
            backgroundColor: "rgba(255, 232, 214, 0)",
            scale: 1,
          },
          checked: {
            borderColor: "#20211c",
            backgroundColor: "rgba(187, 183, 136, .18)",
            scale: 1,
          },
          disabled: {
            borderColor: "rgba(32, 33, 28, .18)",
            backgroundColor: "rgba(32, 33, 28, .04)",
            scale: 0.94,
          },
        }}
        transition={{ duration: 0.38, ease }}
      >
        <motion.span
          className={s.inner}
          initial={false}
          animate={checked && !disabled ? "checked" : "unchecked"}
          variants={{
            unchecked: { scale: 0, opacity: 0 },
            checked: { scale: 1, opacity: 1 },
          }}
          transition={{ duration: 0.36, ease }}
        />
      </motion.span>
    </span>
  )
}

export default Radio
