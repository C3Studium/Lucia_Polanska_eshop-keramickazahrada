"use client"

import { useId, useState } from "react"

import { submitClaim } from "@lib/data/claims"
import { fact, FALLBACK_FACTS, type LegalFacts } from "@lib/legal/facts"
import {
  findOpenWithdrawal,
  formatClaimDateTime,
  type ClaimConfirmation,
  type ConfirmationLine,
  type OrderClaims,
  type WithdrawalItem,
} from "@lib/util/claims"
import { convertToLocale } from "@lib/util/money"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"

import WithdrawalEntry from "./entry"
import styles from "./style.module.scss"

/**
 * Odstoupení od smlouvy online — dvoustupňové (§ 1830a OZ, NV 29/2023 Sb.
 * pokyn [4]; právní audit §7):
 *
 * 1. **Formulář** předvyplněný ze serveru (`withdrawal` v `GET …/claims`):
 *    adresát, jméno (lze opravit), e-mail, číslo a datum objednávky, převzetí,
 *    zboží — vše, od čeho odstoupit lze, předvybrané (zákazník může odškrtnout
 *    = částečné odstoupení), zakázka na míru zamčená s důvodem (§ 1837
 *    písm. d), nepovinný důvod, číslo účtu jen když peníze nejdou vrátit na
 *    kartu (`refund_account_needed`). Tlačítko „Pokračovat ke kontrole".
 * 2. **Kontrola** — přesně to, co odejde, ve tvaru prohlášení podle vzorového
 *    formuláře. Tlačítko „Potvrdit odstoupení od smlouvy" → POST.
 * 3. **Potvrzení** na obrazovce: obsah a datum a čas odeslání ze serveru
 *    (`confirmation`) + že totéž odešlo e-mailem.
 *
 * Pravidla (lhůta od převzetí, zakázka, fronta žádostí) hlídá server; tady
 * se jen zrcadlí. Zakázku server vyjme i kdyby ji prohlížeč poslal.
 */

type Step = "form" | "review" | "done"

/** Počet kusů sevřený do 1..objednáno. */
const clampQty = (value: number, max: number) =>
  Math.min(Math.max(1, Math.floor(Number(value) || 1)), Math.max(1, max))

/**
 * Adresát odstoupení — právní údaje z administrace obchodu (`getLegalFacts()`
 * na serveru, sem jako prop). Pevné hodnoty jen pro případ, že by údaj
 * v administraci někdo vymazal: adresát v prohlášení prázdný být nesmí.
 */
type Seller = { name: string; address: string; email: string }

const sellerOf = (facts: LegalFacts): Seller => ({
  name: fact("seller.name", facts) ?? "Lucie Polanská",
  address: fact("seller.address", facts) ?? "Putim 229, 397 01 Písek",
  email: fact("seller.email", facts) ?? "info@keramickazahrada.cz",
})

export default function WithdrawalFlow({
  orderId,
  token,
  claims,
  currencyCode = "czk",
  facts = FALLBACK_FACTS,
}: {
  orderId: string
  token: string
  claims: OrderClaims
  currencyCode?: string
  /** Právní údaje obchodu ze serveru (`getLegalFacts()`). */
  facts?: LegalFacts
}) {
  const SELLER = sellerOf(facts)
  const withdrawal = claims.withdrawal ?? null
  const items = withdrawal?.items ?? []
  const withdrawableItems = items.filter((item) => item.withdrawable)
  const excludedItems = items.filter((item) => !item.withdrawable)

  const [step, setStep] = useState<Step>("form")
  /** id položky → počet kusů; nezaškrtnuté v mapě nejsou. Výchozí = vše. */
  const [selected, setSelected] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      withdrawableItems.map((item) => [item.id, Math.max(1, item.quantity)])
    )
  )
  const [name, setName] = useState(withdrawal?.customer_name ?? "")
  const [reason, setReason] = useState("")
  const [account, setAccount] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ClaimConfirmation | null>(null)
  const [fallbackSentAt, setFallbackSentAt] = useState<string | null>(null)
  const nameId = useId()
  const reasonId = useId()
  const accountId = useId()
  const fieldId = useId()

  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: currencyCode })
  const claimsHref = `/order/${orderId}/claims?token=${encodeURIComponent(token)}`

  // Hotovo — potvrzení na obrazovce má přednost před čímkoli dalším.
  if (step === "done") {
    return (
      <WithdrawalDone
        confirmation={confirmation}
        fallbackSentAt={fallbackSentAt}
        email={withdrawal?.email ?? null}
        claimsHref={claimsHref}
        money={money}
        seller={SELLER}
      />
    )
  }

  // Odstoupit teď nejde (lhůta, zakázka, zrušeno, už běží) → vysvětlení.
  if (!claims.can_withdraw || !withdrawal) {
    const open = findOpenWithdrawal(claims)
    return (
      <div className={styles.flow}>
        <WithdrawalEntry orderId={orderId} token={token} claims={claims} />
        {open && (
          <p className={styles.hint}>
            Odstoupení jsme přijali{" "}
            {formatClaimDateTime(open.submitted_at ?? open.created_at)} —{" "}
            <LocalizedClientLink href={claimsHref}>podrobnosti a stav</LocalizedClientLink>.
          </p>
        )}
        {!withdrawal && claims.can_withdraw && (
          <p className={styles.hint}>
            Formulář se teď nepodařilo načíst. Odstoupit můžete i e-mailem na{" "}
            <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a> — stačí napsat
            číslo objednávky a že od smlouvy odstupujete.
          </p>
        )}
      </div>
    )
  }

  const accountNeeded = Boolean(claims.refund_account_needed)
  const picked: WithdrawalItem[] = withdrawableItems.filter((item) => item.id in selected)
  const wholeOrder =
    excludedItems.length === 0 &&
    withdrawableItems.every((item) => (selected[item.id] ?? 0) >= item.quantity)
  const pickedTotal = picked.reduce(
    (sum, item) => sum + item.unit_price * (selected[item.id] ?? 0),
    0
  )
  const canReview =
    picked.length > 0 && (!accountNeeded || Boolean(account.trim())) && !sending

  const toggle = (item: WithdrawalItem) =>
    setSelected((current) => {
      if (item.id in current) {
        const { [item.id]: _removed, ...rest } = current
        return rest
      }
      return { ...current, [item.id]: Math.max(1, item.quantity) }
    })

  const setQty = (item: WithdrawalItem, value: number) =>
    setSelected((current) =>
      item.id in current
        ? { ...current, [item.id]: clampQty(value, item.quantity) }
        : current
    )

  const refundText = accountNeeded
    ? account.trim()
      ? `Převodem na účet ${account.trim()} (objednávku jste neplatili online přes ComGate).`
      : "Převodem na účet — vyplňte prosím číslo účtu."
    : withdrawal.refund_method_text

  const confirm = async () => {
    if (!canReview) return
    setSending(true)
    setError(null)
    const result = await submitClaim(orderId, token, {
      kind: "odstoupeni",
      reason: reason.trim() || undefined,
      items: picked.map((item) => ({ id: item.id, quantity: selected[item.id] })),
      customer_name: name.trim() || undefined,
      ...(accountNeeded ? { refund_account: account } : {}),
    })
    setSending(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    setConfirmation(result.confirmation ?? null)
    setFallbackSentAt(result.submitted_at ?? new Date().toISOString())
    setStep("done")
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // --- krok 2: kontrola ---------------------------------------------------
  if (step === "review") {
    return (
      <div className={styles.flow}>
        <p className={styles.stepLabel}>Krok 2 ze 2 · kontrola</p>
        <p className={styles.lead}>
          Zkontrolujte prosím, co odešleme. Odesláním odstoupíte od smlouvy —
          potvrzení s tímto obsahem a s datem a časem odeslání vám hned přijde
          e-mailem.
        </p>

        <article className={styles.statement} aria-label="Odstoupení od smlouvy — obsah">
          <h2 className={styles.statementTitle}>Odstoupení od smlouvy</h2>
          <dl className={styles.facts}>
            <div>
              <dt>Adresát</dt>
              <dd>
                {SELLER.name}, {SELLER.address}, {SELLER.email}
              </dd>
            </div>
            <div className={styles.factWide}>
              <dt>Prohlášení</dt>
              <dd>
                {wholeOrder
                  ? "Oznamuji, že tímto odstupuji od smlouvy o koupi tohoto zboží:"
                  : "Oznamuji, že tímto odstupuji od smlouvy o koupi tohoto zboží (jen uvedené kusy):"}
                <ul className={styles.statementItems}>
                  {picked.map((item) => (
                    <li key={item.id}>
                      {item.title}
                      {item.variant_title ? ` · ${item.variant_title}` : ""} ·{" "}
                      {selected[item.id]} ks · {money(item.unit_price * selected[item.id])}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>Objednávka</dt>
              <dd>
                č. {withdrawal.order_display_id}
                {withdrawal.order_date_text
                  ? `, objednáno ${withdrawal.order_date_text}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Převzetí</dt>
              <dd>{withdrawal.takeover_text}</dd>
            </div>
            <div>
              <dt>Jméno a příjmení</dt>
              <dd>{name.trim() || withdrawal.customer_name || "—"}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{withdrawal.email || "—"}</dd>
            </div>
            {reason.trim() && (
              <div className={styles.factWide}>
                <dt>Důvod</dt>
                <dd>{reason.trim()}</dd>
              </div>
            )}
            <div className={styles.factWide}>
              <dt>Vrácení peněz</dt>
              <dd>{refundText}</dd>
            </div>
          </dl>
          {excludedItems.length > 0 && (
            <p className={styles.excludedNote}>
              Zboží vyrobené na zakázku ({excludedItems.map((item) => item.title).join(", ")})
              z odstoupení vyjímáme — u něj zákon odstoupení nepřipouští (§ 1837
              písm. d) občanského zákoníku).
            </p>
          )}
        </article>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              setError(null)
              setStep("form")
            }}
            disabled={sending}
          >
            Zpět k úpravám
          </button>
          <button
            type="button"
            className={styles.submit}
            onClick={confirm}
            disabled={!canReview}
          >
            {sending ? "Odesíláme…" : "Potvrdit odstoupení od smlouvy"}
          </button>
        </div>
      </div>
    )
  }

  // --- krok 1: předvyplněný formulář --------------------------------------
  return (
    <div className={styles.flow}>
      <p className={styles.stepLabel}>Krok 1 ze 2 · údaje</p>
      <p className={styles.lead}>
        Od smlouvy můžete odstoupit bez udání důvodu
        {withdrawal.deadline_text
          ? ` do ${withdrawal.deadline_text}`
          : withdrawal.takeover_basis === "not_shipped" ||
              withdrawal.takeover_basis === "in_transit"
            ? " — i před doručením; lhůta 14 dnů poběží od převzetí zboží"
            : ""}
        . Údaje jsme předvyplnili z objednávky; stačí zkontrolovat zboží
        a pokračovat.
      </p>

      <section className={styles.block}>
        <h2 className={styles.legend}>Adresát</h2>
        <p className={styles.static}>
          {SELLER.name}, {SELLER.address} · {SELLER.email}
        </p>
      </section>

      <section className={styles.block}>
        <h2 className={styles.legend}>Objednávka</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Číslo objednávky</dt>
            <dd>{withdrawal.order_display_id}</dd>
          </div>
          <div>
            <dt>Datum objednání</dt>
            <dd>{withdrawal.order_date_text || "—"}</dd>
          </div>
          <div>
            <dt>Převzetí zboží</dt>
            <dd>{withdrawal.takeover_text}</dd>
          </div>
          <div>
            <dt>E-mail pro potvrzení</dt>
            <dd>{withdrawal.email || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.block}>
        <label htmlFor={nameId} className={styles.legend}>
          Jméno a příjmení
        </label>
        <input
          id={nameId}
          className={styles.input}
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          disabled={sending}
        />
      </section>

      <fieldset className={styles.block}>
        <legend className={styles.legend}>
          Zboží, od jehož koupě odstupujete
        </legend>
        <p className={styles.hint}>
          Předvybrali jsme všechno. Chcete-li odstoupit jen od části, odškrtněte,
          co si necháváte, nebo snižte počet kusů.
        </p>
        <ul className={styles.itemList}>
          {items.map((item) => {
            const checked = item.withdrawable && item.id in selected
            const qty = checked ? selected[item.id] : item.quantity
            return (
              <li
                key={item.id}
                className={styles.item}
                data-checked={checked || undefined}
                data-locked={!item.withdrawable || undefined}
              >
                <label className={styles.itemMain}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!item.withdrawable || sending}
                    onChange={() => toggle(item)}
                    aria-describedby={
                      item.block_reason ? `${fieldId}-reason-${item.id}` : undefined
                    }
                  />
                  <span className={styles.itemThumb}>
                    <Thumbnail thumbnail={item.thumbnail} size="square" />
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={styles.itemMeta}>
                      {item.variant_title ? `${item.variant_title} · ` : ""}
                      objednáno {item.quantity} ks · {money(item.unit_price)}
                      {item.quantity > 1 ? "/ks" : ""}
                    </span>
                    {item.block_reason && (
                      <span
                        id={`${fieldId}-reason-${item.id}`}
                        className={styles.itemLocked}
                      >
                        {item.block_reason}
                      </span>
                    )}
                  </span>
                </label>
                {item.withdrawable && item.quantity > 1 && (
                  <div
                    className={styles.stepper}
                    role="group"
                    aria-label={`Počet kusů — ${item.title}`}
                  >
                    <button
                      type="button"
                      onClick={() => setQty(item, qty - 1)}
                      disabled={!checked || qty <= 1 || sending}
                      aria-label="Méně kusů"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={item.quantity}
                      value={qty}
                      disabled={!checked || sending}
                      onChange={(event) => setQty(item, Number(event.target.value))}
                      aria-label="Počet kusů"
                    />
                    <button
                      type="button"
                      onClick={() => setQty(item, qty + 1)}
                      disabled={!checked || qty >= item.quantity || sending}
                      aria-label="Více kusů"
                    >
                      +
                    </button>
                    <span className={styles.stepperOf}>z {item.quantity}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {picked.length === 0 ? (
          <p className={styles.warn}>Vyberte aspoň jednu položku.</p>
        ) : (
          <p className={styles.hint}>
            Cena vybraného zboží: {money(pickedTotal)}
            {wholeOrder
              ? " — odstupujete od celé smlouvy, vracíme i náklady na dodání ve výši nejlevnějšího způsobu dodání, který nabízíme."
              : "."}
          </p>
        )}
      </fieldset>

      <section className={styles.block}>
        <label htmlFor={reasonId} className={styles.legend}>
          Důvod <i>(nepovinné — uvádět ho nemusíte)</i>
        </label>
        <textarea
          id={reasonId}
          className={styles.input}
          rows={3}
          maxLength={2000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={sending}
        />
      </section>

      {accountNeeded ? (
        <section className={styles.block}>
          <label htmlFor={accountId} className={styles.legend}>
            Číslo účtu pro vrácení peněz <i>(povinné)</i>
          </label>
          <input
            id={accountId}
            className={styles.input}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder="např. 123456789/0800 nebo 19-123456789/0800"
            disabled={sending}
          />
          <p className={styles.hint}>
            Objednávku jste neplatili online přes ComGate, takže peníze posíláme převodem na
            účet. Stačí české číslo účtu, případně IBAN.
          </p>
        </section>
      ) : (
        <section className={styles.block}>
          <h2 className={styles.legend}>Vrácení peněz</h2>
          <p className={styles.static}>{withdrawal.refund_method_text}</p>
        </section>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submit}
          onClick={() => {
            if (!canReview) return
            setError(null)
            setStep("review")
            if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
          }}
          disabled={!canReview}
        >
          Pokračovat ke kontrole
        </button>
      </div>

      <p className={styles.legal}>
        Lhůta je zachovaná, když odstoupení odešlete před jejím uplynutím. Zboží
        nám pak pošlete zpět do 14 dnů; přímé náklady na vrácení nesete vy.
        Podrobnosti najdete v{" "}
        <LocalizedClientLink href="/odstoupeni-od-smlouvy">
          poučení o odstoupení od smlouvy
        </LocalizedClientLink>
        .
      </p>
    </div>
  )
}

/** Krok 3 — potvrzení na obrazovce (obsah + datum a čas odeslání ze serveru). */
function WithdrawalDone({
  confirmation,
  fallbackSentAt,
  email,
  claimsHref,
  money,
  seller: SELLER,
}: {
  confirmation: ClaimConfirmation | null
  fallbackSentAt: string | null
  email: string | null
  claimsHref: string
  money: (amount: number) => string
  seller: Seller
}) {
  const sentAt =
    confirmation?.submitted_at_text || formatClaimDateTime(fallbackSentAt)
  const to = confirmation?.email || email
  const line = (item: ConfirmationLine) =>
    [
      item.title,
      item.variant_title,
      `${item.quantity} ks`,
      money(Number(item.total) || 0),
    ]
      .filter(Boolean)
      .join(" · ")

  return (
    <div className={styles.flow}>
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>Odstoupení od smlouvy jsme přijali.</p>
        <p>
          Odesláno <strong>{sentAt}</strong>
          {confirmation?.channel_text ? ` (${confirmation.channel_text})` : ""}.
          {to
            ? ` Potvrzení s tímto obsahem a s datem a časem odeslání jsme poslali na ${to}.`
            : " Potvrzení s tímto obsahem jsme poslali e-mailem."}
        </p>
      </div>

      {confirmation && (
        <article className={styles.statement} aria-label="Potvrzení odstoupení">
          <dl className={styles.facts}>
            <div>
              <dt>Objednávka</dt>
              <dd>
                č. {confirmation.order_display_id}
                {confirmation.order_date_text
                  ? `, objednáno ${confirmation.order_date_text}`
                  : ""}
              </dd>
            </div>
            {confirmation.takeover_text && (
              <div>
                <dt>Převzetí</dt>
                <dd>{confirmation.takeover_text}</dd>
              </div>
            )}
            {confirmation.customer_name && (
              <div>
                <dt>Jméno a příjmení</dt>
                <dd>{confirmation.customer_name}</dd>
              </div>
            )}
            <div className={styles.factWide}>
              <dt>{confirmation.whole_order ? "Odstoupení od celé smlouvy" : "Odstoupení od zboží"}</dt>
              <dd>
                <ul className={styles.statementItems}>
                  {confirmation.items.map((item) => (
                    <li key={item.line_item_id}>{line(item)}</li>
                  ))}
                </ul>
              </dd>
            </div>
            {confirmation.excluded_items.length > 0 && (
              <div className={styles.factWide}>
                <dt>Vyjmuto (zakázka, § 1837 písm. d))</dt>
                <dd>
                  <ul className={styles.statementItems}>
                    {confirmation.excluded_items.map((item) => (
                      <li key={item.line_item_id}>{line(item)}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {confirmation.reason && (
              <div className={styles.factWide}>
                <dt>Důvod</dt>
                <dd>{confirmation.reason}</dd>
              </div>
            )}
            {confirmation.refund_method_text && (
              <div className={styles.factWide}>
                <dt>Vrácení peněz</dt>
                <dd>{confirmation.refund_method_text}</dd>
              </div>
            )}
          </dl>
        </article>
      )}

      {confirmation?.auto_cancelled ? (
        <p className={styles.lead}>
          Objednávka je zrušená. Nic jste nezaplatili a zboží jsme ještě
          neodeslali — nic nám neposílejte, není co vracet.
        </p>
      ) : confirmation && !confirmation.goods_shipped ? (
        <p className={styles.lead}>
          Zboží jsme ještě neodeslali —{" "}
          {confirmation.whole_order
            ? "objednávku zastavíme a nic nám neposíláte."
            : "uvedené kusy vám neposíláme, zbytek objednávky pošleme jako obvykle."}{" "}
          {confirmation.nothing_to_refund
            ? "Zatím jste nic nezaplatili, takže není co vracet."
            : "Peníze vrátíme nejpozději do 14 dnů."}
        </p>
      ) : (
        <ol className={styles.nextSteps}>
          <li>
            Zboží nám prosím pošlete zpět nebo předejte nejpozději do 14 dnů na
            adresu{" "}
            <strong>
              {confirmation?.return_address || `${SELLER.name}, ${SELLER.address}`}
            </strong>
            . Lhůta je zachovaná, když zásilku odešlete před jejím uplynutím;
            keramiku pečlivě zabalte, přímé náklady na vrácení nesete vy.
          </li>
          {confirmation?.nothing_to_refund ? (
            <li>Zatím jste nic nezaplatili, takže není co vracet.</li>
          ) : (
            <li>
              Peníze vrátíme nejpozději do 14 dnů od odstoupení
              {confirmation?.whole_order
                ? " — kupní cenu i náklady na dodání ve výši nejlevnějšího způsobu dodání, který nabízíme"
                : ""}
              . Smíme počkat, než k nám zboží dorazí, nebo než nám prokážete,
              že jste ho odeslali.
            </li>
          )}
        </ol>
      )}

      <p className={styles.legal}>
        Stav odstoupení můžete sledovat{" "}
        <LocalizedClientLink href={claimsHref}>tady</LocalizedClientLink>.
      </p>
    </div>
  )
}
