"use client"

import { ChevronUpDown } from "@medusajs/icons"
import { motion } from "framer-motion"
import {
  ChangeEvent,
  FocusEvent,
  SelectHTMLAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import s from "./style.module.scss"

export type NativeSelectProps = {
  placeholder?: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  variant?: "default" | "contact"
} & SelectHTMLAttributes<HTMLSelectElement>

const ease = [0.22, 1, 0.36, 1] as const

const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      placeholder = "Zvolte…",
      defaultValue,
      value,
      className,
      children,
      variant = "default",
      errors,
      touched,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLSelectElement>(null)
    const [isFocused, setIsFocused] = useState(false)
    const [isPlaceholder, setIsPlaceholder] = useState(
      (value ?? defaultValue ?? "") === ""
    )
    const invalid = Boolean(
      props.name && touched?.[props.name] && errors?.[props.name]
    )

    useImperativeHandle(ref, () => innerRef.current as HTMLSelectElement)

    useEffect(() => {
      if (value !== undefined) {
        setIsPlaceholder(value === "")
      }
    }, [value])

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
      setIsPlaceholder(event.target.value === "")
      onChange?.(event)
    }

    const handleFocus = (event: FocusEvent<HTMLSelectElement>) => {
      setIsFocused(true)
      onFocus?.(event)
    }

    const handleBlur = (event: FocusEvent<HTMLSelectElement>) => {
      setIsFocused(false)
      onBlur?.(event)
    }

    const visualState = invalid
      ? "invalid"
      : isFocused
      ? "focused"
      : isPlaceholder
      ? "placeholder"
      : "rest"

    return (
      <div className={`${s.root} ${variant === "contact" ? s.contact : ""}`}>
        <motion.div
          className={`${s.wrapper} ${className ?? ""}`}
          initial={false}
          animate={visualState}
          variants={{
            rest: {
              backgroundColor: "rgba(255, 248, 238, .16)",
              color: "#20211c",
            },
            placeholder: {
              backgroundColor: "rgba(255, 248, 238, .1)",
              color: "rgba(32, 33, 28, .52)",
            },
            focused: {
              backgroundColor: "rgba(187, 183, 136, .1)",
              color: "#20211c",
            },
            invalid: {
              backgroundColor: "rgba(154, 111, 101, .08)",
              color: "#20211c",
            },
          }}
          transition={transition}
          data-invalid={invalid || undefined}
        >
          <select
            ref={innerRef}
            defaultValue={value === undefined ? defaultValue : undefined}
            value={value}
            {...props}
            className={s.select}
            aria-invalid={invalid || undefined}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            <option disabled value="">
              {placeholder}
            </option>
            {children}
          </select>
          <motion.span
            className={s.icon}
            initial={false}
            animate={{ rotate: isFocused ? 180 : 0 }}
            transition={transition2}
            aria-hidden="true"
          >
            <ChevronUpDown />
          </motion.span>
          <motion.span
            className={s.focusLine}
            initial={false}
            animate={{ scaleX: isFocused || invalid ? 1 : 0 }}
            style={{ originX: invalid ? 0.5 : 0 }}
            transition={transition3}
            data-invalid={invalid || undefined}
            aria-hidden="true"
          />
        </motion.div>
      </div>
    )
  }
)

NativeSelect.displayName = "NativeSelect"

export default NativeSelect


/* Hoisted from JSX: these motion objects are static, so allocating them per
   render only gave framer-motion new references to re-diff. Values are unchanged. */
const transition = { duration: 0.4, ease }
const transition2 = { duration: 0.46, ease }
const transition3 = { duration: 0.52, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] }
