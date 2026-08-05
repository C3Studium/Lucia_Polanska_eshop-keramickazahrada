import { Label } from "@medusajs/ui"
import React, { useEffect, useId, useImperativeHandle, useState } from "react"
import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"
import styles from "./style.module.scss"

type InputProps = Omit<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
  "placeholder"
> & {
  label: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  topLabel?: string
  className?: string
  variant?: "default" | "contact"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type,
      name,
      label,
      touched,
      required,
      topLabel,
      className,
      variant = "default",
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [inputType, setInputType] = useState(type)
    // The label used to point `htmlFor` at `name`, which is not an id — so no checkout, login
    // or address field had a programmatic label. `useId` also survives two inputs sharing a name.
    const generatedId = useId()
    const inputId = props.id ?? `${name}-${generatedId}`

    useEffect(() => {
      if (type === "password" && showPassword) {
        setInputType("text")
      }

      if (type === "password" && !showPassword) {
        setInputType("password")
      }
    }, [type, showPassword])

    useImperativeHandle(ref, () => inputRef.current!)

    return (
      <div
        className={`${styles.root} ${
          variant === "contact" ? styles.contact : ""
        } ${className ?? ""}`}
      >
        {topLabel && (
          <Label className={styles.topLabel}>{topLabel}</Label>
        )}
        <div className={styles.inputWrapper}>
          <input
            type={inputType}
            name={name}
            placeholder=" "
            required={required}
            className=""
            {...props}
            id={inputId}
            ref={inputRef}
          />
          <label htmlFor={inputId} className="">
            {label}
            {/* Requirement stated in words, not by a colour-only asterisk (SC 1.4.1). */}
            {required && <span className={styles.requiredHint}> (povinné)</span>}
          </label>
          {type === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={styles.passwordBtn}
              aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          )}
        </div>
      </div>
    )
  }
)

Input.displayName = "Input"

export default Input
