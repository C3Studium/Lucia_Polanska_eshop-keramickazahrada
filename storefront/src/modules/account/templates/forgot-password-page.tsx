"use client"

import { requestPasswordReset } from "@lib/data/customer"
import { Toaster, toast } from "@medusajs/ui"
import { useState } from "react"

import type { CopyBlock } from "@lib/util/site-copy"
import AuthPortal from "../components/auth-portal"
import { useTexty } from "@lib/context/texty"
import {
  SupportButton,
  SupportField,
  SupportForm,
  SupportHeader,
  SupportLink,
  SupportLinks,
  SupportPanel,
} from "../components/auth-support"

export default function RequestResetPassword({ block }: { block?: CopyBlock }) {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = useTexty()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error("Vyplňte prosím e-mail.")
      return
    }
    /* Tvar se kontroluje i na serveru; tahle kontrola je kvůli odezvě, aby
       se za zjevný překlep nechodilo přes síť. O tom, kdo u nás účet má,
       neprozrazuje nic — je to informace o napsaném textu. */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      toast.error(texty["account.templates_2"])
      return
    }
    setLoading(true)

    /* Přes serverovou akci, ne `sdk.auth` z prohlížeče: auth endpointy
       Medusy nemají povolený CORS pro origin obchodu, takže volání odsud
       skončilo na „Failed to fetch". Ze serveru žádné CORS není. */
    const chyba = await requestPasswordReset(email)
    setLoading(false)

    if (chyba) {
      toast.error(chyba)
      return
    }

    toast.success(
      texty["account.templates_3"]
    )
  }

  return (
    <AuthPortal mode="recovery" block={block}>
      <SupportPanel>
        <SupportHeader
          eyebrow="Obnova přístupu · 03"
          title={
            <>
              Kam máme <em>poslat odkaz?</em>
            </>
          }
          description={
            texty["account.templates_4"]
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
