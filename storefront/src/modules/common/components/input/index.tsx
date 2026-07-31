import { Label } from "@medusajs/ui"
import React, { useEffect, useImperativeHandle, useState } from "react"
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
            ref={inputRef}
          />
          <label
            htmlFor={name}
            onClick={() => inputRef.current?.focus()}
            className=""
          >
            {label}
            {required && <span style={{ color: '#f43f5e' }}>*</span>}
          </label>
          {type === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={styles.passwordBtn}
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
