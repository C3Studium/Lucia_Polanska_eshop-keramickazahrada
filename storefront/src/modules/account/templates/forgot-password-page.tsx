"use client"

import { sdk } from "@lib/config"
import { Toaster, toast } from "@medusajs/ui"
import { useState } from "react"

import AuthPortal from "../components/auth-portal"
import {
  SupportButton,
  SupportField,
  SupportForm,
  SupportHeader,
  SupportLink,
  SupportLinks,
  SupportPanel,
} from "../components/auth-support"

export default function RequestResetPassword() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email) {
      toast.error("Vyplňte prosím e-mail.")
      return
    }
    setLoading(true)

    sdk.auth
      .resetPassword("customer", "emailpass", {
        identifier: email,
      })
      .then(() => {
        toast.success(
          "Pokud u nás účet s tímhle e-mailem máte, poslali jsme na něj odkaz pro nastavení nového hesla."
        )
      })
      .catch((error) => {
        toast.error(error.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  return (
    <AuthPortal mode="recovery">
      <SupportPanel>
        <SupportHeader
          eyebrow="Obnova přístupu · 03"
          title={
            <>
              Kam máme <em>poslat odkaz?</em>
            </>
          }
          description={
            "Napište e-mail, na který máte účet. Pošleme vám odkaz pro nastavení nového hesla."
          }
        />

        <SupportForm onSubmit={handleSubmit}>
          <SupportField label="E-mail" index="01" htmlFor="recovery-email">
            <input
              id="recovery-email"
              placeholder="vas@email.cz"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </SupportField>
          <SupportButton type="submit" disabled={loading}>
            {loading ? "Odesíláme…" : "Poslat odkaz"}
          </SupportButton>
        </SupportForm>

        <SupportLinks>
          <SupportLink href="/login" label="Mám účet">
            Přihlásit se
          </SupportLink>
          <SupportLink href="/register" label="Jsem tu poprvé">
            Vytvořit účet
          </SupportLink>
        </SupportLinks>
      </SupportPanel>
      <Toaster />
    </AuthPortal>
  )
}
