"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Toaster, toast } from "@medusajs/ui"
import { checkEmailVerified, resendVerification } from "@lib/data/customer"
import AuthPortal from "../components/auth-portal"
import { useTexty } from "@lib/context/texty"
import { useContactDialog } from "@modules/layout/ContactDialog"
import {
  SupportAction,
  SupportButton,
  SupportEmail,
  SupportHeader,
  SupportLinks,
  SupportNotice,
  SupportPanel,
} from "../components/auth-support"

type Props = {
  customer: {
    email: string
  }
}

/** Jak často se stránka ptá, jestli už zákazník klikl na odkaz. */
const POLL_MS = 5000

export default function VerifyEmailReminderPage({ customer }: Props) {
  /* Věty z administrace (Právní věci a texty → Texty obchodu). */
  const texty = useTexty()
  const router = useRouter()
  const contact = useContactDialog()
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [notYet, setNotYet] = useState(false)
  const done = useRef(false)

  /*
   * Stránka se sama dozví, že je e-mail potvrzený (15. 11. 2026). Zákazník
   * často klikne na odkaz v jiné záložce nebo na telefonu — dřív tahle
   * záložka zůstala viset na „Zkontrolujte poštu", dokud ji sám neobnovil.
   * Ptá se každých 5 s a hned při návratu do záložky; po potvrzení obnoví
   * stránku a účet se otevře.
   */
  const check = useCallback(
    async (manual = false) => {
      if (done.current) return true
      if (manual) setChecking(true)
      const verified = await checkEmailVerified().catch(() => false)
      if (manual) setChecking(false)
      if (verified) {
        done.current = true
        toast.success("E-mail je potvrzený — otevírám váš účet.")
        router.refresh()
      } else if (manual) {
        setNotYet(true)
      }
      return verified
    },
    [router]
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [check])

  const handleResend = async () => {
    setLoading(true)
    setResent(false)
    setNotYet(false)
    const result = await resendVerification(customer.email)
    if (result.success) {
      toast.success(result.message)
      setResent(true)
    } else {
      toast.error(result.message)
    }
    setLoading(false)
  }

  return (
    <AuthPortal mode="verification">
      <SupportPanel>
        <SupportHeader
          eyebrow={texty["account.templates_14"]}
          title={
            <>
              Zkontrolujte <em>poštu.</em>
            </>
          }
          description={texty["account.templates_15"]}
        />
        <SupportEmail>{customer.email}</SupportEmail>
        <SupportNotice
          eyebrow={
            notYet ? "Zatím nepotvrzeno" : resent ? "Nová zpráva odeslána" : "Kde odkaz hledat"
          }
          tone={resent ? "success" : "neutral"}
        >
          {notYet
            ? "Potvrzení jsme zatím nedostali. Klikněte na odkaz v e-mailu — tahle stránka se pak sama přepne do účtu."
            : resent
              ? texty["account.templates_16"]
              : texty["account.templates_17"]}
        </SupportNotice>
        <SupportButton type="button" onClick={handleResend} disabled={loading}>
          {loading
            ? "Odesíláme…"
            : resent
            ? "Odeslat ještě jednou"
            : "Znovu odeslat ověřovací e-mail"}
        </SupportButton>
        <SupportLinks>
          <SupportAction label="Už jsem klikl(a) na odkaz" onClick={() => void check(true)}>
            {checking ? "Ověřuji…" : "Otevřít můj účet"}
          </SupportAction>
          <SupportAction label="Odkaz nedorazil" onClick={() => contact.open()}>
            Napsat nám
          </SupportAction>
        </SupportLinks>
        <Toaster />
      </SupportPanel>
    </AuthPortal>
  )
}
