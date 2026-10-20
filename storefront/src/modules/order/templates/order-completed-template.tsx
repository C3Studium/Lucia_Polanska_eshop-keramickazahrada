import {
  isDobirkaPayment,
  isPickupPayment,
  paymentMethodTitle,
} from "@lib/constants"
import { translateStatus } from "@lib/i18n/statuses"
import { convertToLocale } from "@lib/util/money"
import { PLATCE_DPH } from "@lib/util/dph"
import OrderProgressPanel from "@modules/order/components/order-progress"
import type { OrderProgress } from "@lib/data/order-progress"
import { HttpTypes } from "@medusajs/types"
import LineItemOptions from "@modules/common/components/line-item-options"
import type { CommissionNote } from "@lib/util/made-to-order"
import type {
  CommissionBalance,
  CommissionCancellation,
} from "@lib/data/made-to-order"
import CommissionPanel from "@modules/order/components/commission-panel"
import { isCarrierShippingMethod } from "@lib/util/carrier"
import CarrierDamageNotice, {
  CLAIM_FORM_KEY,
} from "@modules/order/components/carrier-damage"
import { getSiteDocument } from "@lib/data/documents"
import { orderTermsRef } from "@lib/legal/order-terms"
import CommissionConversation from "@modules/order/components/commission-conversation"
import BalancePayPanel from "@modules/order/components/balance-pay"
import ClaimsSummary from "@modules/order/components/claim-status/summary"
import { withdrawalHref } from "@modules/order/components/withdrawal/entry"
import { withdrawBlockText, type OrderClaims } from "@lib/util/claims"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PremiumActionLink from "@modules/common/components/premium-action-link"
import CmsText from "@modules/common/components/cms-text"
import type { CopyBlocks } from "@lib/util/site-copy"
import Thumbnail from "@modules/products/components/thumbnail"
import s from "./styles/oder-complete.module.scss"
import { pickupPointLabel } from "@lib/util/pickup-point"
import { isPackagingLine, productLines, withPackagingUnderProducts } from "@lib/util/packaging"
import PackagingLine, { PackagingNote, packagingFor } from "@modules/common/components/packaging-line"
import { dobirkaFeeSubtotal, packagingSubtotal } from "@lib/util/packaging"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
  progress?: OrderProgress | null
  /** Used when the merchant workflow has no stage for this order yet. */
  progressFallback?: string
  /** The zakázka's diary, when this order has one. Absent for ordinary orders. */
  commissionNotes?: CommissionNote[] | null
  /** Stav doplatku zakázky (zaplaceno zálohou / zbývá / odkaz na doplacení). */
  commissionBalance?: CommissionBalance | null
  /** Zrušení zakázky (`/cancellation`) — host z e-mailu ho dostane tímtéž tokenem. */
  commissionCancellation?: CommissionCancellation | null
  /**
   * Podepsaný token pro self-service odkazy (úprava / zrušení / reklamace).
   * `null` → tlačítka se nevykreslí (nešlo ho získat).
   */
  selfServiceToken?: string | null
  /**
   * Reklamace a vrácení k objednávce + zda jde ještě odstoupit (ze serveru,
   * stejným tokenem). `null` → sekce se nevykreslí, tlačítka zůstanou jako dřív.
   */
  claims?: OrderClaims | null
  /**
   * Bloky stránky `kosik`: `kosik.objednavka-hotova` (poděkování nahoře)
   * a `kosik.objednavka-pomoc` (nadpis okénka s kontaktem). Jen tyhle dva
   * kusy — věta o potvrzení e-mailem nese adresu zákazníka, kontakty jsou
   * údaje obchodu a odstoupení, podmínky a reklamace jsou vázané na zákon.
   */
  copy?: CopyBlocks
}

const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))

export default async function OrderCompletedTemplate({
  order,
  progress = null,
  progressFallback = "Přijato",
  commissionNotes = null,
  commissionBalance = null,
  commissionCancellation,
  selfServiceToken = null,
  claims = null,
  copy,
}: OrderCompletedTemplateProps) {
  const thanks = copy?.["kosik.objednavka-hotova"]
  const help = copy?.["kosik.objednavka-pomoc"]
  const money = (amount?: number | null) =>
    convertToLocale({
      amount: amount ?? 0,
      currency_code: order.currency_code,
    })
  // Rozpad mezisoučtu v Souhrnu (výrobky / balné / doběrečné).
  const packaging = packagingSubtotal(order.items)
  const dobirkaFee = dobirkaFeeSubtotal(order.items)

  // Balné (lib/util/packaging.ts) hned pod svým výrobkem.
  const items = withPackagingUnderProducts(
    [...(order.items ?? [])].sort((a, b) =>
      (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
    )
  )
  const goods = productLines(items)
  const payment = order.payment_collections?.[0]?.payments?.[0]
  const shippingMethod = order.shipping_methods?.at(-1) as
    | (HttpTypes.StoreOrderShippingMethod & { amount?: number })
    | undefined
  const orderNumber = String(order.display_id).padStart(4, "0")
  const claimForm = await getSiteDocument(CLAIM_FORM_KEY)
  // Persisted at checkout by the shipping step; the confirmation never showed it (spec §4).
  const pickupPoint = pickupPointLabel(
    order.metadata as Record<string, unknown> | undefined
  )
  // Serverová komponenta → registr dokumentů smí přímo (do prohlížeče nejde).
  const terms = await orderTermsRef(order)
  /* Stav objednávky ze serveru (reklamace, odesláno, výroba zakázky…) —
     `fulfillment_status` Medusy sám neví o Denní práci ani o reklamacích
     a navíc ho načtení objednávky nevrací, takže tu stálo napořád „Přijato". */
  const orderStatusLabel =
    progress?.status?.label ||
    progress?.stage_label ||
    progressFallback ||
    translateStatus(order.fulfillment_status, "fulfillment", "cs")
  const paymentStatus = translateStatus(
    order.payment_status,
    "payment",
    "cs"
  )
  const paymentTitle = payment
    ? paymentMethodTitle(payment.provider_id)
    : "Čeká na přiřazení"

  /*
   * Zakázka se platí na dvakrát (záloha teď, doplatek po dokončení). Souhrn
   * ukazoval „Celkem … / Zaplaceno", i když člověk zaplatil jen zálohu — doplatek
   * totiž žije v modulu zakázky, ne v nativní ceně objednávky (ta po záloze
   * vypadá zaplaceně). Bereme to proto PŘEDNOSTNĚ z `/balance`; dopočet z plateb
   * je jen záloha, kdyby endpoint selhal.
   */
  const paidNow = (order.payment_collections ?? [])
    .flatMap((collection: any) => collection?.payments ?? [])
    .reduce((sum: number, p: any) => sum + (Number(p?.amount) || 0), 0)
  const fallbackRemaining = Math.max(0, (order.total ?? 0) - paidNow)

  const isCommission =
    commissionBalance?.is_commission ?? commissionNotes != null
  const outstanding =
    typeof commissionBalance?.outstanding === "number"
      ? commissionBalance.outstanding
      : fallbackRemaining
  const depositPaid =
    typeof commissionBalance?.deposit_paid === "number" &&
    commissionBalance.deposit_paid > 0
      ? commissionBalance.deposit_paid
      : paidNow
  const showDeposit = isCommission && outstanding > 0.005

  /*
   * Platba až při převzetí (osobní odběr u pultu, dobírka u pošty) je v Meduse
   * jen „autorizovaná" — pro zákazníka nic neříkající slovo, které navíc
   * vypadá, jako by se něco strhlo. Dokud není zachyceno, říkáme, KDE zaplatí;
   * po zachycení (u pultu / dopravce zúčtoval) už sedí běžné „Zaplaceno".
   */
  const paysLater =
    order.payment_status !== "captured" &&
    (isPickupPayment(payment?.provider_id) || isDobirkaPayment(payment?.provider_id))
  const payLaterLabel = isPickupPayment(payment?.provider_id)
    ? "Platba až na místě"
    : "Platba při převzetí (dobírka)"
  const paymentStatusLabel = showDeposit
    ? "Záloha zaplacena"
    : paysLater
      ? payLaterLabel
      : paymentStatus

  /*
   * „Odstoupit od smlouvy" (§ 1829, tlačítko § 1830a OZ) — od 14. 10. 2026
   * místo dřívějšího „Zrušit objednávku": před odesláním i po něm je to táž
   * cesta (dvoustupňová stránka `/order/:id/odstoupeni`). Dostupné po celou
   * lhůtu, i když už k objednávce běží jiná žádost (reklamace odstoupení
   * neblokuje). Server říká, zda to jde: u zakázky ne (§ 1837 písm. d), po
   * lhůtě ne, u běžícího odstoupení ne — pak místo tlačítka věta s důvodem.
   * Když se `claims` nenačetly, tlačítko necháme; pravidla pohlídá stránka.
   */
  const hasClaims = Boolean(claims && claims.requests.length > 0)
  const withdrawBlocked = claims ? claims.all_made_to_order || !claims.can_withdraw : false
  const withdrawBlockedText = claims ? withdrawBlockText(claims) : null

  return (
    <main className={s.root}>
      <div className={s.ambient} aria-hidden="true">
        <span />
        <i />
        <b />
      </div>

      <div className={s.container} data-testid="order-complete-container">
        <header className={s.masthead}>
          <span>Objednávka · {orderNumber}</span>
          <span className={s.confirmed}>{orderStatusLabel}</span>
        </header>

        <section className={s.hero}>
          {/* `kosik.objednavka-hotova`: obočí (`accent.0`), nadpis (`title`)
              a jeho zvýrazněný konec (`headline`). */}
          <div className={s.heroCopy}>
            <CmsText as="p" className={s.eyebrow} doc={thanks?.id} field="accent.0">
              {thanks?.accent?.[0]?.trim() || "Objednávka je uložená"}
            </CmsText>
            <h1 className={s.title}>
              <CmsText doc={thanks?.id} field="title">
                {thanks?.title?.trim() || "Děkujeme!"}
              </CmsText>
              <CmsText as="em" doc={thanks?.id} field="headline">
                {thanks?.headline?.trim() || "Teď se do toho pustím."}
              </CmsText>
            </h1>
          </div>

          <div className={s.heroAside}>
            <p>
              Potvrzení jsme poslali na <strong>{order.email}</strong>. Jakmile
              se něco pohne, ozveme se vám znovu.
            </p>
            {/* Znění OP, podle kterého se objednávka uzavřela (OP čl. III
                a IV, § 1827 OZ) — stejné jako v účtu u objednávky. */}
            {terms && (
              <p className={s.heroTerms} data-testid="order-terms">
                Obchodní podmínky:{" "}
                <LocalizedClientLink href={terms.href}>
                  znění od {terms.validFrom}
                </LocalizedClientLink>
                {terms.pdfUrl && (
                  <>
                    {" · "}
                    <a href={terms.pdfUrl} target="_blank" rel="noopener noreferrer">
                      PDF
                    </a>
                  </>
                )}
              </p>
            )}
            <span>Reference · {orderNumber}</span>
          </div>
        </section>

        {/* A three-step progress rail that never moved was a trust liability: it implied
            tracking the shop cannot yet provide (spec §4). It returns when the backend exposes
            a real fulfillment timeline — until then the confirmation states only what is true. */}

        <OrderProgressPanel progress={progress} fallbackLabel={progressFallback} />

        {/* Co se dá s objednávkou ještě udělat — vedle stavu „Přijato": úprava
            (jen než ji zabalíme), odstoupení od smlouvy (i zrušení před
            odesláním) a reklamace / vrácení. Každé otevře příslušnou stránku
            s podepsaným tokenem; ta si ho ověří a pravidla pohlídá sama
            (reklamace zvlášť, úprava jen včas). */}
        {selfServiceToken && (
          <section className={s.selfService} aria-label="Co s objednávkou">
            <p className={s.selfServiceLead}>
              Potřebujete s objednávkou něco udělat?
            </p>
            <div className={s.selfServiceActions}>
              <LocalizedClientLink
                className={s.selfServiceBtn}
                href={`/order/${order.id}/edit?token=${selfServiceToken}`}
              >
                Upravit objednávku
              </LocalizedClientLink>
              {/* § 1830a — po celou lhůtu, i vedle běžící reklamace. */}
              {!withdrawBlocked && (
                <LocalizedClientLink
                  className={s.selfServiceBtn}
                  href={withdrawalHref(order.id, selfServiceToken)}
                >
                  Odstoupit od smlouvy
                </LocalizedClientLink>
              )}
              {/* S existující žádostí nese reklamaci sekce „Reklamace
                  a vrácení" níž (stav + odkaz) — tady by se tloukly. */}
              {!hasClaims && (
                <LocalizedClientLink
                  className={`${s.selfServiceBtn} ${s.selfServiceBtnGhost}`}
                  href={`/order/${order.id}/refund?token=${selfServiceToken}&kind=reklamace`}
                >
                  Reklamace nebo vrácení
                </LocalizedClientLink>
              )}
            </div>
            {!withdrawBlocked && (
              <p className={s.selfServiceNote}>
                Rozmysleli jste si to? Od smlouvy můžete odstoupit bez udání
                důvodu{" "}
                {claims?.withdrawal?.deadline_text
                  ? `do ${claims.withdrawal.deadline_text} (14 dnů od převzetí zboží)`
                  : claims?.withdrawal?.takeover_basis === "in_transit"
                    ? "— lhůta 14 dnů poběží od převzetí zboží"
                    : "— i před odesláním; lhůta 14 dnů poběží od převzetí zboží"}
                .
              </p>
            )}
            {withdrawBlocked && withdrawBlockedText && (
              <p className={s.selfServiceNote}>
                <strong>Odstoupení od smlouvy:</strong> {withdrawBlockedText}
                {claims?.all_made_to_order
                  ? " Napište nám, kdybyste se chtěli domluvit."
                  : ""}
              </p>
            )}
          </section>
        )}

        {/* Reklamace a vrácení — stav každé žádosti + odkaz na stránku se vším
            (časová osa, protokol, adresa pro vrácení, číslo zásilky). */}
        {selfServiceToken && claims && hasClaims && (
          <ClaimsSummary
            orderId={order.id}
            token={selfServiceToken}
            claims={claims}
            currencyCode={order.currency_code}
          />
        )}

        {/* Carrier deliveries only — Osobní odběr has no courier to inspect in front
            of and no carrier to claim against. */}
        <section className={s.commission}>
          <CarrierDamageNotice
            orderNumber={order.display_id}
            isCarrierDelivery={isCarrierShippingMethod(order as any)}
            claimForm={claimForm}
            stage="pending"
          />
        </section>

        {/* BACKEND-HOOKED: These values come from the retrieved StoreOrder response. */}
        <section className={s.orderMeta} aria-label="Údaje objednávky">
          {pickupPoint && (
            <div>
              <span>Výdejní místo</span>
              <strong data-testid="order-pickup-point">{pickupPoint}</strong>
            </div>
          )}
          <div>
            <span>Vytvořeno</span>
            <strong data-testid="order-date">
              {formatDate(order.created_at)}
            </strong>
          </div>
          <div>
            <span>Stav objednávky</span>
            <strong data-testid="order-status">{orderStatusLabel}</strong>
          </div>
          <div>
            <span>Stav platby</span>
            <strong data-testid="order-payment-status">
              {paymentStatusLabel}
            </strong>
          </div>
          <div>
            <span>Číslo objednávky</span>
            <strong data-testid="order-id">#{orderNumber}</strong>
          </div>
        </section>

        {/*
         * Dvousloupcové tělo objednávky:
         *  — LEVÝ sloupec (`.main`): nejdřív údaje (Doručení + Platba), které dřív
         *    byly utopené úplně dole, pak seznam objednaných kusů.
         *  — PRAVÝ sloupec (`.rail`): souhrn (doklad) a HNED POD NÍM brief / deník
         *    zakázky, přesně jako brief v checkoutu sedí pod přehledem. U běžné
         *    objednávky brief není a v railu je jen souhrn.
         * Na úzké obrazovce se to skládá pod sebe v pořadí souhrn → brief →
         * údaje → kusy (viz stylopis).
         */}
        <div className={s.purchaseGrid}>
          <div className={s.main}>
            {/* BACKEND-HOOKED: Delivery, contact, shipping method and payment data come from StoreOrder. */}
            <section className={s.details}>
              <article className={s.detailCard}>
                <div className={s.detailHeading}>
                  <span>01</span>
                  <div>
                    <p>Doručení</p>
                    <h2>Vaše adresa</h2>
                  </div>
                </div>

                <div className={s.detailGrid}>
                  <div data-testid="shipping-address-summary">
                    <span>Adresa</span>
                    <strong>
                      {order.shipping_address?.first_name}{" "}
                      {order.shipping_address?.last_name}
                    </strong>
                    <p>
                      {order.shipping_address?.address_1}
                      {order.shipping_address?.address_2
                        ? `, ${order.shipping_address.address_2}`
                        : ""}
                      <br />
                      {order.shipping_address?.postal_code}{" "}
                      {order.shipping_address?.city}
                      <br />
                      {order.shipping_address?.country_code?.toUpperCase()}
                    </p>
                  </div>
                  <div data-testid="shipping-contact-summary">
                    <span>Kontakt</span>
                    <strong>{order.email}</strong>
                    <p>{order.shipping_address?.phone || "Telefon neuveden"}</p>
                  </div>
                  <div data-testid="shipping-method-summary">
                    <span>Způsob dopravy</span>
                    <strong>{shippingMethod?.name || "Ještě upřesníme"}</strong>
                    <p>
                      {shippingMethod
                        ? money(shippingMethod.total ?? shippingMethod.amount)
                        : "—"}
                    </p>
                  </div>
                </div>
              </article>

              <article className={s.detailCard}>
                <div className={s.detailHeading}>
                  <span>02</span>
                  <div>
                    <p>Platba</p>
                    <h2>Vaše platba</h2>
                  </div>
                </div>

                <div className={s.paymentGrid}>
                  <div>
                    <span>Metoda</span>
                    <strong data-testid="payment-method">{paymentTitle}</strong>
                  </div>
                  <div>
                    <span>Stav</span>
                    <strong>{paymentStatusLabel}</strong>
                  </div>
                  <div>
                    <span>{showDeposit ? "Zaplaceno teď" : "Částka"}</span>
                    <strong data-testid="payment-amount">
                      {money(showDeposit ? paidNow : payment?.amount ?? order.total)}
                    </strong>
                  </div>
                </div>
              </article>
            </section>

            {/* BACKEND-HOOKED: Products, quantities, prices, discounts and totals come from StoreOrder. */}
            <section className={s.objects}>
              <div className={s.sectionHead}>
                <div>
                  <p>03 · Vaše položky</p>
                  <h2>Co jste objednali</h2>
                </div>
                <span>
                  {goods.reduce((count, item) => count + item.quantity, 0)} ks
                </span>
              </div>

              <div className={s.itemList} data-testid="products-table">
                {items.map((item) => {
                  if (isPackagingLine(item)) {
                    if (items.some((other: any) => !isPackagingLine(other) && packagingFor(items, other) === item)) return null
                    return (
                      <PackagingLine
                        key={item.id}
                        item={item}
                        currencyCode={order.currency_code}
                      />
                    )
                  }
                  const index = goods.indexOf(item)
                  const unitPrice = item.unit_price ?? 0
                  const lineTotal =
                    (item as HttpTypes.StoreOrderLineItem & { total?: number })
                      .total ?? unitPrice * item.quantity

                  return (
                    <article
                      className={s.item}
                      key={item.id}
                      data-testid="product-row"
                    >
                      <span className={s.itemIndex}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className={s.thumbnail}>
                        <Thumbnail thumbnail={item.thumbnail} size="square" />
                      </div>
                      <div className={s.itemCopy}>
                        <p>Z ateliéru</p>
                        <h3 data-testid="product-name">{item.product_title}</h3>
                        <div className={s.variant}>
                          <LineItemOptions
                            variant={item.variant}
                            data-testid="product-variant"
                          />
                        </div>
                        <PackagingNote item={packagingFor(items, item)} currencyCode={order.currency_code} />
                      </div>
                      <div className={s.itemQuantity}>
                        <span>Množství</span>
                        <strong data-testid="product-quantity">
                          {item.quantity} × {money(unitPrice)}
                        </strong>
                      </div>
                      <div className={s.itemTotal}>
                        <span>Celkem</span>
                        <strong>{money(lineTotal)}</strong>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </div>

          <aside className={s.rail}>
            {/* BACKEND-HOOKED: Products, quantities, prices, discounts and totals come from StoreOrder. */}
            <div className={s.receipt}>
              <div className={s.receiptInner}>
                <p className={s.receiptNote}>
                  Bezpečná platba · pečlivé balení
                </p>
                <span className={s.receiptEyebrow}>04 · Souhrn</span>
                <h2>Souhrn</h2>

                <div className={s.totalRows}>
                  <div>
                    <span>Mezisoučet</span>
                    <strong>{money(order.item_total)}</strong>
                  </div>
                  {/* Rozpad mezisoučtu: výrobky, balné a doběrečné, odsazeně.
                      Doběrečné do „Výrobky" nepatří — vlastní řádek. */}
                  {(packaging !== null || dobirkaFee !== null) && (
                    <>
                    <div style={{ paddingLeft: ".9rem", opacity: .78, fontSize: ".9em" }}>
                      <span>Výrobky</span>
                      <strong style={{ fontWeight: 300 }}>{money(order.item_total - (packaging ?? 0) - (dobirkaFee ?? 0))}</strong>
                    </div>
                    {packaging !== null && (
                      <div style={{ paddingLeft: ".9rem", opacity: .78, fontSize: ".9em" }}>
                        <span>Balné</span>
                        <strong style={{ fontWeight: 300 }}>{money(packaging)}</strong>
                      </div>
                    )}
                    {dobirkaFee !== null && (
                      <div style={{ paddingLeft: ".9rem", opacity: .78, fontSize: ".9em" }}>
                        <span>Doběrečné</span>
                        <strong style={{ fontWeight: 300 }}>{money(dobirkaFee)}</strong>
                      </div>
                    )}
                    </>
                  )}
                  {order.discount_total > 0 && (
                    <div>
                      <span>Sleva</span>
                      <strong>− {money(order.discount_total)}</strong>
                    </div>
                  )}
                  {order.gift_card_total > 0 && (
                    <div>
                      <span>Dárkový poukaz</span>
                      <strong>− {money(order.gift_card_total)}</strong>
                    </div>
                  )}
                  <div>
                    <span>Doprava</span>
                    <strong>{money(order.shipping_total)}</strong>
                  </div>
                  {/* Jen pro plátce DPH — viz `lib/util/dph.ts`. */}
                  {PLATCE_DPH && (
                    <div>
                      <span>Daně</span>
                      <strong>{money(order.tax_total)}</strong>
                    </div>
                  )}
                </div>

                <div className={s.grandTotal}>
                  <span>Celkem</span>
                  <strong>{money(order.total)}</strong>
                </div>

                {/* Zakázka: kolik se zaplatilo teď (záloha) a kolik zbývá — ať
                    souhrn neříká „Zaplaceno" u objednávky, kde je zaplacená jen
                    záloha. */}
                {showDeposit && (
                  <div className={s.depositSplit}>
                    <div>
                      <span>Zaplaceno teď (záloha)</span>
                      <strong>{money(depositPaid)}</strong>
                    </div>
                    <div>
                      <span>Zbývá doplatit</span>
                      <strong>{money(outstanding)}</strong>
                    </div>
                  </div>
                )}

                <div className={s.receiptStatus}>
                  <span>Platba</span>
                  <strong>{paymentStatusLabel}</strong>
                </div>
              </div>
            </div>

            {/* Konverzace s ateliérem — co zákazník napsal a vyfotil a místo,
                kam dopsat další, jako POPUP pod souhrnem (jeden znovupoužitelný
                komponent napříč stránkami objednávky). Jen u zakázky; běžná
                objednávka má v railu jen souhrn. */}
            {commissionNotes && (
              <CommissionConversation orderId={order.id} notes={commissionNotes} />
            )}

            {/* Zakázka (audit § 0): stav podle e-mailu o zahájení, smluvní
                záloha, PDF potvrzení a „Zrušit zakázku" — i pro hosta z
                e-mailu (token). Jen u zakázky. */}
            <CommissionPanel
              orderId={order.id}
              balance={commissionBalance}
              cancellation={commissionCancellation}
              token={selfServiceToken}
            />
            {/* Doplatek zakázky — doplatit zbytek rovnou odsud, nemusí čekat na
                e-mail. Self-service odkaz nese podepsaný token (funguje i bez
                přihlášení) → ComGate → zpět na tohle potvrzení, kde se platba
                srovná (reconcileOrderBalance). Panel se sám skryje, když není
                co doplácet nebo nejde o zakázku. */}
            <BalancePayPanel balance={commissionBalance} variant="full" />
          </aside>
        </div>

        <section className={s.support}>
          {/* `kosik.objednavka-pomoc`: obočí (`accent.0`) a nadpis (`title`).
              E-mail a telefon pod tím jsou údaje obchodu, ne redakční text. */}
          <div>
            <CmsText as="p" doc={help?.id} field="accent.0">
              {help?.accent?.[0]?.trim() || "Potřebujete s něčím pomoct?"}
            </CmsText>
            <CmsText as="h2" doc={help?.id} field="title">
              {help?.title?.trim() || "Ozvěte se."}
            </CmsText>
          </div>
          <p>
            Napište na{" "}
            <a href="mailto:info@keramickazahrada.cz">
              info@keramickazahrada.cz
            </a>{" "}
            nebo zavolejte na{" "}
            <a href="tel:+420775211578">+420 775 211 578</a>.
          </p>
          <div className={s.actions}>
            <PremiumActionLink
              href="/store"
              text="Zpět do obchodu"
            />
            <LocalizedClientLink className={s.textAction} href="/dotazy">
              Časté dotazy
            </LocalizedClientLink>
          </div>
        </section>

        <footer className={s.footer}>
          <span>Zabalíme pečlivě</span>
          <span>Ručně vyrobeno</span>
          <span>Ateliér · Písek</span>
        </footer>
      </div>
    </main>
  )
}
