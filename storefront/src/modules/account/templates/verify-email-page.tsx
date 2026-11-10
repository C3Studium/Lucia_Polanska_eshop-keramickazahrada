"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Toaster, toast } from "@medusajs/ui"
import {
  verifyCustomerEmail,
  resendVerification,
  retrieveCustomer,
} from "@lib/data/customer"
import AuthPortal from "../components/auth-portal"
import { useTexty } from "@lib/context/texty"
import {
  SupportButton,
  SupportEmail,
  SupportHeader,
  SupportLink,
  SupportLinks,
  SupportNotice,
  SupportPanel,
} from "../components/auth-support"

type VerificationState = "verifying" | "success" | "error"

export default function VerifyEmailPage() {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = useTexty()
  const [status, setStatus] = useState<VerificationState>("verifying")
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const email = searchParams.get("email") || ""

  const handleVerify = async () => {
    if (!token || !email) {
      setStatus("error")
      toast.error(texty["account.templates_18"])
      return
    }

    setStatus("verifying")
    try {
      const result = await verifyCustomerEmail(token, email)
      if (result.ok) {
        toast.success(result.message || "Potvrzení e-mailu bylo úspěšné!")
        setStatus("success")
        // fetch fresh customer so UI reflects updated metadata
        try {
          await retrieveCustomer({ forceFresh: true })
        } catch (e) {
          // non-fatal
          console.warn("verify-email: failed to refresh customer", e)
        }
      } else {
        setStatus("error")
        toast.error(result.message || "Ověření se nepovedlo.")
      }
    } catch {
      setStatus("error")
      toast.error("Ověření se nepovedlo.")
    }
  }

  const handleResend = async () => {
    if (!email) {
      toast.error("Nevíme, kam e-mail poslat.")
      return
    }
    setResending(true)
    setResent(false)
    try {
      const result = await resendVerification(email)
      if (result.success) {
        toast.success(result.message)
        setResent(true)
      } else {
        toast.error(result.message)
      }
    } catch (e: any) {
      toast.error(e?.message || "E-mail se nepovedlo odeslat.")
    } finally {
      setResending(false)
    }
  }

  useEffect(() => {
    handleVerify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthPortal mode="verification">
      <SupportPanel>
        <SupportHeader
          eyebrow="Ověření identity · 04"
          title={
            <>
              Potvrďte <em>e-mail.</em>
            </>
          }
          description={
            status === "verifying"
              ? texty["account.templates_19"]
              : status === "success"
              ? texty["account.templates_20"]
              : "Odkaz se nepovedlo ověřit. Nejspíš vypršel, nebo už byl použitý."
          }
        />
        {email && <SupportEmail>{email}</SupportEmail>}
        <SupportNotice
          eyebrow={
            status === "verifying"
              ? "Ověřujeme"
              : status === "success"
              ? "Přístup potvrzen"
              : texty["account.templates_21"]
          }
          tone={
            status === "success"
              ? "success"
              : status === "error"
              ? "error"
              : "neutral"
          }
        >
          {status === "verifying"
            ? "Kontrolujeme, jestli odkaz platí."
            : status === "success"
            ? texty["account.templates_22"]
            : resent
            ? texty["account.templates_23"]
            : "Zkuste to ještě jednou, nebo si nechte poslat nový odkaz."}
        </SupportNotice>
        {status === "error" && token && email && (
          <SupportButton type="button" onClick={handleVerify}>
            Ověřit odkaz znovu
          </SupportButton>
        )}
        {status === "error" && (
          <SupportButton
            type="button"
            onClick={handleResend}
            disabled={resending || !email}
            variant="secondary"
          >
            {resending
              ? "Odesíláme…"
              : resent
              ? "Odesláno"
              : "Poslat nový ověřovací odkaz"}
          </SupportButton>
        )}
        <SupportLinks>
          {status === "success" ? (
            <>
              <SupportLink href="/account" label="Váš účet">
                Přejít na můj účet
              </SupportLink>
              <SupportLink href="/store" label="Zpět do obchodu">
                Prohlédnout výrobky
              </SupportLink>
            </>
          ) : (
            <>
              <SupportLink href="/login" label="Jiný účet">
                Přihlásit se
              </SupportLink>
              <SupportLink href="/dotazy" label="Potřebuji pomoc">
                Napsat do ateliéru
              </SupportLink>
            </>
          )}
        </SupportLinks>
        <Toaster />
      </SupportPanel>
    </AuthPortal>
  )
}
