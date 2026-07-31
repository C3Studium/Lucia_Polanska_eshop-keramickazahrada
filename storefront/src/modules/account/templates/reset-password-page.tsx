"use client"

import { sdk } from "@lib/config"
import { Toaster, toast } from "@medusajs/ui"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeSlash } from "@medusajs/icons"
import AuthPortal from "../components/auth-portal"
import {
  PasswordToggle,
  SupportButton,
  SupportField,
  SupportForm,
  SupportHeader,
  SupportLink,
  SupportLinks,
  SupportNotice,
  SupportPanel,
} from "../components/auth-support"

export default function ResetPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email") ?? ""

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) {
      toast.error("Chybí token.")
      return
    }
    if (!password) {
      toast.error("Heslo je povinné pole.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Hesla se neshodují.")
      return
    }
    setLoading(true)

    sdk.auth
      .updateProvider(
        "customer",
        "emailpass",
        {
          email,
          password,
        },
        token
      )
      .then(() => {
        toast.success("Heslo bylo úspěšně změněno.")
        setSuccess(true)
      })
      .catch((error) => {
        toast.error(`Heslo se nepodařilo změnit: ${error.message}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  // Auto-login handler
  const handleAutoLogin = async () => {
    if (!email || !password) return
    setLoginLoading(true)
    try {
      await sdk.auth.login("customer", "emailpass", {
        identifier: email,
        password,
      })
      toast.success("Přihlášení bylo úspěšné!")
      router.push("/account")
    } catch (error: any) {
      toast.error(error?.message || "Přihlášení se nezdařilo.")
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <AuthPortal mode="recovery">
      <SupportPanel>
        <SupportHeader
          eyebrow="Nové přístupové údaje · 03"
          title={
            <>
              Nové <em>heslo.</em>
            </>
          }
          description={
            "Zvolte nové heslo a vraťte se ke svým objednávkám a uloženým objektům."
          }
        />
        <SupportForm onSubmit={handleSubmit}>
          <SupportField label="Nové heslo" index="01" htmlFor="new-password">
            <input
              id="new-password"
              placeholder="Alespoň 8 znaků"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={success}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <PasswordToggle
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
            >
              {showPassword ? <Eye /> : <EyeSlash />}
            </PasswordToggle>
          </SupportField>
          <SupportField
            label="Potvrzení hesla"
            index="02"
            htmlFor="confirm-password"
          >
            <input
              id="confirm-password"
              placeholder="Zopakujte nové heslo"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={success}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <PasswordToggle
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={
                showConfirmPassword
                  ? "Skrýt potvrzení hesla"
                  : "Zobrazit potvrzení hesla"
              }
            >
              {showConfirmPassword ? <Eye /> : <EyeSlash />}
            </PasswordToggle>
          </SupportField>
          <SupportButton type="submit" disabled={loading || success}>
            {loading ? "Ukládáme…" : "Nastavit nové heslo"}
          </SupportButton>
          {success && (
            <>
              <SupportNotice eyebrow="Přístup obnoven" tone="success">
                Heslo je bezpečně změněné.
              </SupportNotice>
              <SupportButton
                type="button"
                onClick={handleAutoLogin}
                disabled={loginLoading}
                variant="secondary"
              >
                {loginLoading ? "Přihlašujeme…" : "Pokračovat do účtu"}
              </SupportButton>
            </>
          )}
        </SupportForm>
        {!success && (
          <SupportLinks>
            <SupportLink href="/login" label="Znám své heslo">
              Přihlásit se
            </SupportLink>
            <SupportLink href="/forgot-password" label="Odkaz nefunguje">
              Poslat nový
            </SupportLink>
          </SupportLinks>
        )}
        <Toaster />
      </SupportPanel>
    </AuthPortal>
  )
}
