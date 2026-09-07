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
  /**
   * Dvojklik označí celou hodnotu, ne jedno slovo.
   *
   * Dvojklik v inputu označuje SLOVO a prohlížeč bere za jeho hranici i `@`
   * a tečku — na `lucie@keramickazahrada.cz` tak padne výběr na `lucie`,
   * ne na adresu, a vypadá to, jako by dvojklik nedělal nic.
   *
   * Volba, ne automatika podle typu: zapíná se jen na přihlášení a registraci,
   * kde se hodnota přepisuje celá. Ve zbytku webu (adresa, město, poznámka)
   * se po slovech opravuje běžně a označit rovnou celý řádek by z opravy
   * překlepu udělalo přepsání všeho. Trojklik označí vše všude a bez tohohle.
   */
  selectAllOnDoubleClick?: boolean
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
      selectAllOnDoubleClick = false,
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

    /* Vlastní `onDoubleClick` z props se nepřepisuje, jen se zavolá za tím
       naším — komponenta je sdílená a nemá právo brát volajícímu chování. */
    const oznacitVse = (event: React.MouseEvent<HTMLInputElement>) => {
      if (selectAllOnDoubleClick) {
        event.currentTarget.select()
      }
      props.onDoubleClick?.(event)
    }

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
            onDoubleClick={oznacitVse}
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
