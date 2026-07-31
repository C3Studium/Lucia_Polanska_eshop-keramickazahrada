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
  const [status, setStatus] = useState<VerificationState>("verifying")
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const email = searchParams.get("email") || ""

  const handleVerify = async () => {
    if (!token || !email) {
      setStatus("error")
      toast.error("Ověřovací odkaz je neúplný.")
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
        toast.error(result.message || "Ověření selhalo.")
      }
    } catch {
      setStatus("error")
      toast.error("Ověření selhalo.")
    }
  }

  const handleResend = async () => {
    if (!email) {
      toast.error("Chybí e-mail pro opětovné odeslání.")
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
      toast.error(e?.message || "Nepodařilo se odeslat ověřovací e-mail.")
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
              ? "Právě ověřujeme bezpečný odkaz. Zabere to jen okamžik."
              : status === "success"
              ? "E-mail je potvrzený. Váš soukromý archiv je připravený."
              : "Odkaz se nepodařilo ověřit. Mohl vypršet nebo už být použitý."
          }
        />
        {email && <SupportEmail>{email}</SupportEmail>}
        <SupportNotice
          eyebrow={
            status === "verifying"
              ? "Probíhá ověření"
              : status === "success"
              ? "Přístup potvrzen"
              : "Odkaz vyžaduje pozornost"
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
            ? "Kontrolujeme platnost odkazu a propojení s vaším účtem."
            : status === "success"
            ? "Můžete pokračovat ke svým objednávkám a uloženým objektům."
            : resent
            ? "Nový ověřovací e-mail je na cestě."
            : "Zkuste ověření zopakovat, nebo si pošlete nový odkaz."}
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
              <SupportLink href="/account" label="Soukromý archiv">
                Přejít na můj účet
              </SupportLink>
              <SupportLink href="/store" label="Pokračovat ve výběru">
                Prohlédnout objekty
              </SupportLink>
            </>
          ) : (
            <>
              <SupportLink href="/login" label="Jiný účet">
                Přihlásit se
              </SupportLink>
              <SupportLink href="/dotazy" label="Potřebuji pomoc">
                Kontaktovat ateliér
              </SupportLink>
            </>
          )}
        </SupportLinks>
        <Toaster />
      </SupportPanel>
    </AuthPortal>
  )
}
