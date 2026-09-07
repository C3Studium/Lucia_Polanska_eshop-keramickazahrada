"use client"

import {
  loginAfterPasswordReset,
  updatePasswordWithToken,
} from "@lib/data/customer"
import { Toaster, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
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

  /* Přečteno JEDNOU, při prvním vykreslení — hned nato se z adresního řádku
     obojí maže, takže po zbytek života stránky už v `searchParams` nic není. */
  const [token] = useState(() => searchParams.get("token"))
  const [email] = useState(() => searchParams.get("email") ?? "")

  /*
   * Token a adresa pryč z adresního řádku.
   *
   * Odkaz z e-mailu nese v adrese živý klíč k účtu. Dokud tam stojí, zapíše
   * se do historie prohlížeče, nabídne se při psaní v adresním řádku a odejde
   * v hlavičce `Referer` (tu ruší `referrer: no-referrer` na routě, ale
   * historie zůstává). Když si člověk odkaz omylem někam zkopíruje, kopíruje
   * přihlašovací údaj.
   *
   * `replaceState`, ne `push`: nová položka v historii by znamenala, že se
   * tlačítkem zpět dá vrátit na adresu s tokenem — tedy přesně to, co se tu
   * odstraňuje. Hodnoty jsou v tu chvíli už ve stavu výš, takže formuláři
   * nic nechybí.
   */
  useEffect(() => {
    if (!searchParams.toString()) {
      return
    }

    window.history.replaceState(null, "", window.location.pathname)
    // Jen po prvním vykreslení; `searchParams` se schválně nesleduje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) {
      toast.error("Odkaz není celý — otevřete ho prosím z e-mailu znovu.")
      return
    }
    if (!password) {
      toast.error("Vyplňte prosím heslo.")
      return
    }
    /* Táž mez jako v `updatePasswordWithToken` na serveru. Tady kvůli
       odezvě, tam kvůli platnosti — nápis „Alespoň 8 znaků" nad polem musí
       něco znamenat na obou stranách. */
    if (password.length < 8) {
      toast.error("Heslo musí mít aspoň 8 znaků.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Hesla se neshodují.")
      return
    }
    setLoading(true)

    /* Serverová akce ze stejného důvodu jako u žádosti o odkaz — auth
       endpointy Medusy nejsou pro origin obchodu v CORS. */
    const chyba = await updatePasswordWithToken(email, password, token)
    setLoading(false)

    if (chyba) {
      toast.error(`Heslo se nepovedlo změnit: ${chyba}`)
      return
    }

    toast.success("Heslo bylo úspěšně změněno.")
    setSuccess(true)
  }

  // Auto-login handler
  const handleAutoLogin = async () => {
    if (!email || !password) return
    setLoginLoading(true)

    /* Musí to udělat server, a ne kvůli CORS: přihlášení aplikace čte
       z httpOnly cookie `_medusa_jwt`, kterou z JS nastavit nejde. Token
       vrácený do prohlížeče by se tedy zahodil a účet by nás poslal zpátky
       na přihlášení. */
    const chyba = await loginAfterPasswordReset(email, password)
    setLoginLoading(false)

    if (chyba) {
      toast.error(chyba)
      return
    }

    toast.success("Jste přihlášeni.")
    router.push("/account")
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
            "Zvolte si nové heslo a vraťte se ke svým objednávkám i uloženým kouskům."
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
              <SupportNotice eyebrow="Hotovo" tone="success">
                Heslo je změněné.
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
