import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getProductionPaymentMode } from "@lib/data/made-to-order"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CmsText from "@modules/common/components/cms-text"
import { CopyProvider } from "@modules/common/components/cms-text/copy-context"
import { getPageCopy } from "@lib/data/site-copy"
import { itemFieldPath, itemText } from "@lib/util/site-copy"
import { Metadata } from "next"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import {
  cartNeedsVoucherSetup,
  GIFT_VOUCHER_SETUP_ID,
} from "@lib/util/gift-voucher-setup"
import styles from "./page.module.scss"
import { productLines } from "@lib/util/packaging"

export const metadata: Metadata = {
  title: "Pokladna",
  description: "Dokončení objednávky — doprava, platba a přehled.",
}

/*
 * Rozházené pozadí Přehledu (16. 11. 2026, Matěj): náhodná poloha, velikost
 * i rozestupy, ale nic se nepřekrývá. Stěna je rozdělená na neviditelné
 * čtvercové buňky (ART_COLUMNS na řádek) a každá nese nejvýš jednu fotku —
 * náhodně velkou (42–88 % buňky) a náhodně posunutou UVNITŘ buňky, takže
 * nemůže zasáhnout do sousední. Část buněk zůstává prázdná.
 *
 * Náhoda je ze semínka podle košíku: mezi kroky a po obnovení stránky se
 * pozadí nepřeskládá, jiný košík má jiné.
 */
const ART_COLUMNS = 9
const ART_ROWS = 16
const ART_EMPTY = 0.3

const seededRandom = (seedText: string) => {
  let seed = 0
  for (let index = 0; index < seedText.length; index++) {
    seed = (Math.imul(seed, 31) + seedText.charCodeAt(index)) | 0
  }
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

type ArtCell = { src: string; size: number; x: number; y: number } | null

const scatterArt = (sources: string[], seedText: string): ArtCell[] => {
  const random = seededRandom(seedText || "kz")
  const cells: ArtCell[] = []
  const picked: number[] = []
  for (let index = 0; index < ART_COLUMNS * ART_ROWS; index++) {
    if (random() < ART_EMPTY) {
      cells.push(null)
      picked.push(-1)
      continue
    }
    // Ne stejná fotka jako soused vlevo ani nad ní (když je z čeho vybírat).
    const left = index % ART_COLUMNS ? picked[index - 1] : -1
    const above = index >= ART_COLUMNS ? picked[index - ART_COLUMNS] : -1
    let choice = Math.floor(random() * sources.length)
    for (let tries = 0; tries < 4 && sources.length > 2 && (choice === left || choice === above); tries++) {
      choice = Math.floor(random() * sources.length)
    }
    const size = Math.round(42 + random() * 46)
    cells.push({
      src: sources[choice],
      size,
      x: Math.round(random() * (100 - size)),
      y: Math.round(random() * (100 - size)),
    })
    picked.push(choice)
  }
  return cells
}

export default async function Checkout(props:{
  params: Promise<{countryCode:string}>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const cart = await retrieveCart()
  const params = await props.params
  /* Přehled bez levého souhrnu (16. 11. 2026, Matěj): krok Přehled sám
     ukazuje položky i ceny, takže souhrn vlevo by tytéž údaje opakoval
     podruhé. Slevový kód se přestěhoval do Přehledu. */
  const isReview = (await props.searchParams)?.step === "review"
  const { countryCode } = params
  if (!cart) {
    return notFound()
  }

  /*
   * Nenastavený dárkový poukaz patří zpátky do košíku (30. 10. 2026). Hodnotu
   * a podobu volí zákazník tam, pod souhrnem; pokladna na to pole nemá a
   * backend by takový košík stejně nedokončil. Košík cestu sem zamyká, tohle
   * je pro přímý odkaz a pro zapamatovanou adresu.
   */
  if (cartNeedsVoucherSetup(cart as never)) {
    redirect(`/${countryCode}/cart#${GIFT_VOUCHER_SETUP_ID}`)
  }

  const customer = await retrieveCustomer()
  // Jednou tady a předané oběma stranám (formulář i souhrn) — fetch je
  // `no-store`, takže dvojí volání by znamenalo dvě cesty na backend.
  const productionMode = await getProductionPaymentMode(cart.id)
  // Kusy zboží — balné a doběrečné do počtu nepatří.
  const itemCount = productLines(cart.items).reduce((total, item) => total + item.quantity, 0)
  /*
   * Pozadí Přehledu: všechny fotky objednaných výrobků (náhled i galerie),
   * opakované do stěny dlaždic. Posun o 3 na každé kolo, ať se stejná fotka
   * neskládá do svislých pruhů.
   */
  const artSources = isReview
    ? (Array.from(
        new Set(
          productLines(cart.items).flatMap((item: any) => [
            item.thumbnail,
            ...((item.variant?.product?.images ?? []) as { url?: string }[]).map((image) => image?.url),
          ])
        )
      ).filter(Boolean) as string[])
    : []
  const artCells = artSources.length ? scatterArt(artSources, cart.id) : []

  /*
   * Úvodní věty pokladny z CMS (stránka `pokladna`). Jen hlavička, nadpis
   * souhrnu a první věty kroků — nic z toho, co se k objednávce váže
   * (souhlasy, předsmluvní informace, platba, ceny), viz valecms.config.ts.
   * Výpadek CMS = věty z kódu.
   */
  const copy = await getPageCopy("pokladna")
  const intro = copy["pokladna.uvod"]
  const introDoc = intro?.id ?? null
  const backLabel = itemText(intro, "zpet", "Zpět do košíku")

  return (
    <div className={styles.root} data-step={isReview ? "review" : undefined}>
      {/* Hlavička přes oba sloupce (15. 11. 2026, Matěj): kde jsem a cesta
          zpět nahoře, takže „Přehled objednávky" vlevo a kroky pokladny
          vpravo začínají na stejné výšce. */}
      <header className={styles.masthead}>
        {/* Počet výrobků je údaj, ne text — „Pokladna · 02 výrobky" zůstává v kódu. */}
        <p className={styles.mastheadMeta}>Pokladna · {String(itemCount).padStart(2, "0")} {itemCount === 1 ? "výrobek" : itemCount < 5 ? "výrobky" : "výrobků"}</p>
        <LocalizedClientLink href="/cart" className={styles.backLink}>
          <span>←</span>{" "}
          {introDoc ? (
            <CmsText doc={introDoc} field={itemFieldPath(intro, "zpet")}>{backLabel}</CmsText>
          ) : (
            backLabel
          )}
        </LocalizedClientLink>
      </header>
      {/* Vlevo souhrn objednávky, vpravo formulář kroku. */}
      {/* Přehled (16. 11. 2026, Matěj): panel na střed, širší a vzdušnější.
          Pozadí je tichá stěna fotek objednaných výrobků — jen grafika,
          nic se na ní neklikne a čtečka ji přeskočí. Souhrn vlevo tu není,
          údaje by se opakovaly. */}
      {isReview && artCells.length > 0 && (
        <div className={styles.reviewArt} aria-hidden="true">
          {artCells.map((cell, index) => (
            <span key={index} className={styles.artCell}>
              {cell && (
                <Image
                  src={cell.src}
                  alt=""
                  width={256}
                  height={256}
                  sizes="11rem"
                  quality={75}
                  loading="lazy"
                  style={{ width: `${cell.size}%`, left: `${cell.x}%`, top: `${cell.y}%` }}
                />
              )}
            </span>
          ))}
        </div>
      )}
      {!isReview && (
        <div className={styles.intro}>
          <aside className={styles.order}>
            <CheckoutSummary
              cart={cart}
              productionMode={productionMode}
              copy={copy["pokladna.souhrn"]}
            />
          </aside>
        </div>
      )}
      {/* Kroky jsou hluboko (formulář → krok → adresa), proto blok kontextem, ne propem. */}
      <CopyProvider blocks={{ "pokladna.kroky": copy["pokladna.kroky"] }}>
        <section className={styles.ledger}>
          <PaymentWrapper cart={cart}>
            <CheckoutForm
              cart={cart}
              customer={customer}
              countryCode={countryCode}
              productionMode={productionMode}
            />
          </PaymentWrapper>
        </section>
      </CopyProvider>
    </div>
  )
}
