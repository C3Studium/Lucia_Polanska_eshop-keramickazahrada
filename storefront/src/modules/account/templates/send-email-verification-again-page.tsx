"use client"

import { useState } from "react"
import { Toaster, toast } from "@medusajs/ui"
import { resendVerification } from "@lib/data/customer"
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

type Props = {
  customer: {
    email: string
  }
}

export default function VerifyEmailReminderPage({ customer }: Props) {
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)
  const handleResend = async () => {
    setLoading(true)
    setResent(false)
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
          eyebrow="Váš účet · poslední krok"
          title={
            <>
              Zkontrolujte <em>poštu.</em>
            </>
          }
          description="Ověřovací odkaz vás bezpečně propojí s vaším soukromým archivem."
        />
        <SupportEmail>{customer.email}</SupportEmail>
        <SupportNotice
          eyebrow={resent ? "Nová zpráva odeslána" : "Kde odkaz hledat"}
          tone={resent ? "success" : "neutral"}
        >
          {resent
            ? "Nový ověřovací odkaz je na cestě."
            : "Zkontrolujte doručenou poštu i složku se spamem. Odkaz může dorazit s krátkým zpožděním."}
        </SupportNotice>
        <SupportButton type="button" onClick={handleResend} disabled={loading}>
          {loading
            ? "Odesíláme…"
            : resent
            ? "Odeslat ještě jednou"
            : "Znovu odeslat ověřovací e-mail"}
        </SupportButton>
        <SupportLinks>
          <SupportLink href="/account" label="Zpět do archivu">
            Můj účet
          </SupportLink>
          <SupportLink href="/dotazy" label="Odkaz nedorazil">
            Potřebuji pomoc
          </SupportLink>
        </SupportLinks>
        <Toaster />
      </SupportPanel>
    </AuthPortal>
  )
}
