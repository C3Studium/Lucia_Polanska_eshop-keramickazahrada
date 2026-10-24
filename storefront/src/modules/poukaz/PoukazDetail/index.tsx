"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"

import {
  getGiftVoucher,
  payGiftVoucher,
  type PublicGiftVoucher,
} from "@lib/data/gift-vouchers"
import WebButton from "@modules/common/components/Buttons/webButton"

import { CONTACT_EMAIL, czk } from "../format"
import { formatVoucherCode } from "@lib/util/gift-voucher-code"
import styles from "../panel.module.scss"
import PoukazKarta from "../PoukazKarta"

/**
 * Stránka dárkového poukazu — vzor `kurzy/RezervaceDetail`.
 *
 * Co se ukáže, rozhoduje stav z backendu (`state`), ne odkaz: starý odkaz
 * z e-mailu tak nikdy neukáže staré peníze. Jediné, co přidává URL, je
 * `vysledek` z návratu z ComGate — a ten mění jen hlášku nad nezaplaceným
 * poukazem, nikdy nepředstírá zaplacení.
 *
 * Návrat s `paid`/`pending`: platba se zapisuje asynchronně (oznámení od
 * ComGate, nebo dohledová úloha do 10 minut), takže zákazník se z brány
 * vrátí dřív, než o ní evidence ví. Stránka proto ukáže „Platbu ověřujeme"
 * a sama se ptá znovu — každých 5 s, nejdéle 2 minuty. Jakmile poukaz
 * zaplacený je, ukáže se rovnou karta.
 */

const POLL_INTERVAL_MS = 5_000
const POLL_MAX_ATTEMPTS = 24 // 24 × 5 s = 2 minuty

type Phase = "idle" | "polling" | "timeout"

/** Bez `vysledek` v adrese — obnovení stránky po zaplacení už nemá znovu „ověřovat". */
const dropOutcomeFromUrl = () => {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("vysledek")) return
    url.searchParams.delete("vysledek")
    window.history.replaceState(window.history.state, "", url.toString())
  } catch {
    /* Kosmetika — když to nejde, nic se neděje. */
  }
}

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export default function PoukazDetail({
  initialVoucher,
  token,
  outcome,
}: {
  initialVoucher: PublicGiftVoucher
  token: string
  outcome?: string
}) {
  const [voucher, setVoucher] = useState(initialVoucher)
  const paid = voucher.payment_status === "paid"
  const returnedFromPayment = outcome === "paid" || outcome === "pending"

  const [phase, setPhase] = useState<Phase>(() =>
    !paid && voucher.state === "pending_payment" && returnedFromPayment
      ? "polling"
      : "idle"
  )
  /* Platba dorazila, zatímco stránka byla otevřená — jedna věta nad kartou. */
  const [justPaid, setJustPaid] = useState(false)

  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  /* ---------------------------------------------------------- polling */
  useEffect(() => {
    if (phase !== "polling") return
    let stopped = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    /* Řetěz timeoutů, ne setInterval — pomalá odpověď se nepřekryje s další. */
    const tick = async () => {
      attempts += 1
      const fresh = await getGiftVoucher(initialVoucher.id, token)
      if (stopped) return
      if (fresh) setVoucher(fresh)
      if (fresh && (fresh.payment_status === "paid" || fresh.state !== "pending_payment")) {
        setPhase("idle")
        if (fresh.payment_status === "paid") setJustPaid(true)
        dropOutcomeFromUrl()
        return
      }
      if (attempts >= POLL_MAX_ATTEMPTS) {
        setPhase("timeout")
        return
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [phase, initialVoucher.id, token])

  /* Zpět z ComGate přes bfcache: stránka se probudí zamrzlá v „Připravuji
     platbu…" — tlačítko se musí dát použít znovu. */
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPaying(false)
    }
    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [])

  const pay = useCallback(async () => {
    if (paying) return
    setPaying(true)
    setPayError(null)
    const result = await payGiftVoucher(voucher.id, token)
    if (result.payment_url) {
      window.location.href = result.payment_url
      return
    }
    setPayError(result.message ?? "Platbu se teď nepodařilo založit.")
    setPaying(false)
  }, [paying, token, voucher.id])

  /* ------------------------------------------------------------ views */

  if (voucher.state === "active" && voucher.code) {
    return (
      <main className={styles.page}>
        {justPaid ? (
          <p className={styles.notice} role="status">
            Platba dorazila, děkuji! Poukaz je platný
            {voucher.kind === "electronic"
              ? " a posílám ho i e-mailem."
              : " — vytisknu ho a pošlu poštou."}
          </p>
        ) : null}

        <PoukazKarta voucher={voucher} />

        <section className={styles.howTo}>
          <h2 className={styles.howToTitle}>Jak poukaz uplatnit</h2>
          <ul>
            <li>
              V obchodě zadejte kód v košíku nebo v pokladně do pole Slevový
              kód nebo dárkový poukaz — částka se odečte hned. Odečítá se ze
              zboží, které není ve slevě; poštovné doplatíte.
            </li>
            <li>V dílně stačí poukaz ukázat.</li>
            <li>
              Platí na keramiku i na zakázky, na kurzy zatím ne. Co
              neutratíte, zůstane na poukazu.
            </li>
            <li>
              Platí do {voucher.valid_until_label}. Kolik na něm zbývá, uvidíte
              vždycky tady na této stránce.
            </li>
          </ul>
          <div className={styles.actions}>
            <WebButton
              Kind="Link"
              href="/store"
              title="Nakupovat"
              className={styles.button}
            />
            <WebButton
              Kind="Button"
              title="Vytisknout"
              onClickAction={() => window.print()}
              className={styles.button}
            />
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div aria-live="polite">
          <StateText voucher={voucher} phase={phase} outcome={outcome} />
        </div>

        <dl className={styles.facts}>
          {voucher.recipient_name ? (
            <div>
              <dt>Pro koho</dt>
              <dd>{voucher.recipient_name}</dd>
            </div>
          ) : null}
          {voucher.code ? (
            <div>
              <dt>Kód</dt>
              <dd translate="no">{formatVoucherCode(voucher.code)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Hodnota</dt>
            <dd className={styles.total}>{czk(voucher.initial_value)}</dd>
          </div>
          {voucher.state === "used" ? null : (
            <div>
              <dt>Platí do</dt>
              <dd>{voucher.valid_until_label}</dd>
            </div>
          )}
          {voucher.state === "pending_payment" ? (
            <div>
              <dt>Poukaz</dt>
              <dd>
                {voucher.kind === "electronic"
                  ? "Elektronický, přijde e-mailem"
                  : "Vytištěný, pošlu poštou"}
              </dd>
            </div>
          ) : null}
          {voucher.dedication && voucher.state === "pending_payment" ? (
            <div>
              <dt>Věnování</dt>
              <dd className={styles.dedication}>{voucher.dedication}</dd>
            </div>
          ) : null}
        </dl>

        {voucher.state === "pending_payment" && voucher.can_pay_online && phase !== "polling" ? (
          <div className={styles.actions}>
            <WebButton
              Kind="Button"
              title={
                paying
                  ? "Připravuji platbu…"
                  : outcome === "cancelled" || phase === "timeout"
                    ? "Zkusit zaplatit znovu"
                    : `Zaplatit ${czk(voucher.initial_value)}`
              }
              onClickAction={pay}
              disabled={paying}
              className={styles.button}
            />
            {phase === "timeout" ? (
              <WebButton
                Kind="Button"
                title="Zkontrolovat platbu"
                onClickAction={() => setPhase("polling")}
                className={styles.button}
              />
            ) : null}
          </div>
        ) : null}
        {payError ? (
          <p className={styles.error} role="alert">
            {payError}
          </p>
        ) : null}
      </section>
    </main>
  )
}

/** Obočí, nadpis a odstavec podle stavu poukazu. */
function StateText({
  voucher,
  phase,
  outcome,
}: {
  voucher: PublicGiftVoucher
  phase: Phase
  outcome?: string
}) {
  const afterPayment =
    voucher.kind === "electronic"
      ? "Hned po zaplacení vám poukaz přijde e-mailem a uvidíte ho i tady, i s kódem."
      : "Po zaplacení poukaz vytisknu a pošlu poštou. Kód uvidíte i tady, hned jak platba dorazí."

  switch (voucher.state) {
    case "refunded":
      return (
        <Head eyebrow="Neplatný poukaz" title="Za poukaz se" accent="vrátily peníze." tone="warn">
          Peníze za tenhle poukaz se vrátily, takže ho už nejde uplatnit.
          Kdyby vám něco nesedělo, napište mi na <Mail />.
        </Head>
      )
    case "cancelled":
      return (
        <Head
          eyebrow="Zrušený poukaz"
          title="Tenhle poukaz"
          accent="je zrušený."
          tone="warn"
        >
          Zrušený poukaz už nejde uplatnit. Pokud si myslíte, že jde o omyl,
          ozvěte se mi na <Mail /> a podívám se na to.
        </Head>
      )
    case "used":
      return (
        <Head eyebrow="Vyčerpaný poukaz" title="Poukaz je" accent="vyčerpaný." tone="warn">
          Celá hodnota poukazu už byla uplatněna, takže na něm nic nezbývá.
          Kdyby vám něco nesedělo, napište mi na <Mail />.
        </Head>
      )
    case "expired":
      return (
        <Head
          eyebrow="Platnost skončila"
          title="Platnost poukazu"
          accent={`skončila ${voucher.valid_until_label}.`}
          tone="warn"
        >
          Po konci platnosti už poukaz uplatnit nejde. Kdybyste se chtěli
          na cokoli zeptat, ozvěte se mi na <Mail />.
        </Head>
      )
    default:
      break
  }

  /* --- nezaplacený poukaz --- */
  if (!voucher.can_pay_online) {
    return (
      <Head eyebrow="Čeká na zaplacení" title="Poukaz čeká" accent="na zaplacení.">
        Tenhle poukaz se platí hotově nebo převodem na účet — ozvěte se mi na{" "}
        <Mail /> a domluvíme se. {afterPayment}
      </Head>
    )
  }

  if (phase === "polling") {
    return (
      <Head eyebrow="Ověřuji platbu" title="Ještě chvilku," accent="platbu ověřujeme.">
        <span className={styles.pulse} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        Platba je na cestě, jen se k nám ještě nedostala zpráva od banky.
        Stránka se sama obnoví, jakmile dorazí — nemusíte nic dělat ani platit
        znovu.
      </Head>
    )
  }

  if (phase === "timeout") {
    return (
      <Head eyebrow="Ověřuji platbu" title="Platba se zatím" accent="neukázala." tone="warn">
        Někdy to bance trvá déle. Pokud vám peníze z účtu odešly, neplaťte
        prosím znovu — zkuste platbu za pár minut zkontrolovat, nebo mi napište
        na <Mail />. Pokud jste platbu nedokončili, můžete to zkusit znovu.
      </Head>
    )
  }

  if (outcome === "cancelled") {
    return (
      <Head eyebrow="Platba nedokončena" title="Platba se" accent="nedokončila." tone="warn">
        Peníze se vám nestrhly. Můžete to zkusit znovu, nebo mi
        napište na <Mail /> a domluvíme se na převodu.
      </Head>
    )
  }

  return (
    <Head eyebrow="Dárkový poukaz" title="Poukaz je připravený," accent="zbývá ho zaplatit.">
      {afterPayment}
    </Head>
  )
}

function Head({
  eyebrow,
  title,
  accent,
  tone,
  children,
}: {
  eyebrow: string
  title: string
  accent: string
  tone?: "warn"
  children: ReactNode
}) {
  return (
    <>
      <span className={styles.eyebrow} data-tone={tone}>
        {eyebrow}
      </span>
      <h1>
        {title}
        <em>{accent}</em>
      </h1>
      <p className={styles.lede}>
        {children}
      </p>
    </>
  )
}
