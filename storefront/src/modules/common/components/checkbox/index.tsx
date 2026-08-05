import { Checkbox, Label } from "@medusajs/ui"
import React, { useId } from "react"
import styles from "./style.module.scss"

type CheckboxProps = {
  checked?: boolean
  onChange?: () => void
  label: string
  name?: string
  id?: string
  "data-testid"?: string
}

const CheckboxWithLabel: React.FC<CheckboxProps> = ({
  checked = true,
  onChange,
  label,
  name,
  id,
  "data-testid": dataTestId,
}) => {
  // Previously hardcoded `id="checkbox"`, so any two checkboxes on a page shared an id and the
  // second label pointed at the first control.
  const generatedId = useId()
  const checkboxId = id ?? `checkbox-${generatedId}`

  return (
    <div className={styles.root}>
      <Checkbox
        className={styles.checkbox}
        id={checkboxId}
        role="checkbox"
        type="button"
        checked={checked}
        aria-checked={checked}
        onClick={onChange}
        name={name}
        data-testid={dataTestId}
      />
      <Label htmlFor={checkboxId} className={styles.label} size="large">
        {label}
      </Label>
    </div>
  )
}

export default CheckboxWithLabel
