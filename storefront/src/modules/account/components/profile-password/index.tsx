"use client"

import React from "react"
import Input from "@modules/common/components/input"
import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { toast } from "@medusajs/ui"
import s from "./style.module.scss"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfilePassword: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  const updatePassword = async (formData: FormData) => {
    const old_password = formData.get("old_password") as string
    const new_password = formData.get("new_password") as string
    const confirm_password = formData.get("confirm_password") as string

    if (!old_password || !new_password || !confirm_password) {
      toast.error("Vyplňte prosím všechna pole")
      return
    }
    if (new_password !== confirm_password) {
      toast.error("Nová hesla se neshodují")
      return
    }
    if (new_password.length < 8) {
      toast.error("Nové heslo musí mít alespoň 8 znaků")
      return
    }

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password, new_password, confirm_password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.message || "Nepodařilo se změnit heslo")
        return
      }

      setSuccessState(true)
      toast.success("Heslo bylo úspěšně změněno")
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se změnit heslo")
    }
  }

  const clearState = () => {
    setSuccessState(false)
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await updatePassword(fd)
  }

  return (
    <form onSubmit={onSubmit} onReset={() => clearState()} className={s.root}>
      <AccountInfo
        label="Heslo"
        currentInfo={
          <span>Heslo není z bezpečnostních důvodů zobrazeno</span>
        }
        isSuccess={successState}
        isError={false}
        errorMessage={undefined}
        clearState={clearState}
        data-testid="account-password-editor"
      >
        <div className={s.gridTwo}>
          <Input
            variant="contact"
            label="Staré heslo"
            name="old_password"
            required
            type="password"
            data-testid="old-password-input"
          />
          <Input
            variant="contact"
            label="Nové heslo"
            type="password"
            name="new_password"
            required
            data-testid="new-password-input"
          />
          <Input
            variant="contact"
            label="Potvrdit heslo"
            type="password"
            name="confirm_password"
            required
            data-testid="confirm-password-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfilePassword
