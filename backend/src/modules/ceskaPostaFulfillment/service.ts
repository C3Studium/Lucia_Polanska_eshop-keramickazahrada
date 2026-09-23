import {
  AbstractFulfillmentProviderService,
  Modules,
} from "@medusajs/framework/utils"
import type {
  CreateFulfillmentResult,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
  Logger,
} from "@medusajs/framework/types"
import { callCeskaPosta } from "./client"
import {
  chybaZOdpovedi,
  prectiOdpoved,
  sestavPodani,
  popisChyb,
  sluzbyProZasilku,
  variabilniSymbol,
  type KodSluzby,
  type VelikostZasilky,
  type VydejnaBalikovny,
} from "./parcel"

/**
 * Vybraná výdejna z metadat objednávky.
 *
 * Storefront ji ukládá do `cart.metadata` ve čtyřech plochých klíčích a Medusa
 * je při dokončení košíku přenese na objednávku. `zip` je ten spolehlivý údaj —
 * viz `adresaPrijemce` v `parcel.ts`.
 */
export const vydejnaZMetadat = (
  metadata: Record<string, unknown> | null | undefined
): VydejnaBalikovny | null => {
  const zip = String((metadata as any)?.balikovna_point_zip ?? "").trim()
  if (!zip) return null
  return { zip, name: String((metadata as any)?.balikovna_point_name ?? "").trim() }
}

/**
 * Česká pošta / Balíkovna fulfilment provider (WorkflowPlan.md D8, P4-1).
 *
 * ## Naming, and what the admin actually shows
 *
 * The `identifier` here is only half of the composite provider id — the other
 * half is the registration id in `medusa-config.js`, which is set to
 * `balikovna`. That matters because **the dashboard has no display name for a
 * provider**: `formatProvider` splits the composite id on `_` and shows the
 * *second* segment. With both halves equal the admin read
 * „Ceska Posta Fulfillment"; it now reads „Balikovna".
 *
 * The identifier itself stays `ceska-posta-fulfillment` because the module
 * directory, its migrations and its module key are all named that, and renaming
 * them buys nothing the registration id has not already bought.
 *
 * ## What it replaces
 *
 * The previous version was a stub: it advertised two options and implemented no
 * `createFulfillment` at all, so the one-click ship failed outright for every
 * Česká pošta order. Anything is better than that, but „anything" is not the
 * bar — see the two modes below.
 *
 * ## Record-only mode, and why it is not a lie
 *
 * With no credentials configured, `createFulfillment` records the parcel and
 * returns `data.mode = "manual"` with no labels. That is a truthful statement:
 * the items *are* packed and inventory *is* decremented, but no carrier has
 * been told anything.
 *
 * The ship workflow reads that flag and **stops before creating a shipment**
 * (A1): no „odesláno" status, no shipment e-mail, no stage change. The order
 * waits in K odeslání showing „Čeká na ruční podání zásilky." until she
 * confirms she has actually handed it over. This is the whole point — a
 * customer must never be told a parcel is on its way because a database row
 * exists.
 *
 * ## API mode
 *
 * S nastavenými `BALIKOVNA_API_*` podá `createFulfillment` skutečnou zásilku a
 * vrátí `mode: "api"` s číslem zásilky a štítkem — jedno kliknutí tedy odešle
 * objednávku od začátku do konce, protože dopravce balík opravdu má.
 *
 * Ověřeno živým voláním 22. 9. 2026 pro všechny čtyři kombinace (Balíkovna a
 * adresa, každá s dobírkou i bez): ČP vrátila číslo zásilky a PDF štítek.
 *
 * ## Dvě věci, na kterých se tu dá pohořet
 *
 * **`HTTP 200` neznamená přijatou zásilku.** Verdikt je až v těle odpovědi —
 * viz `prectiOdpoved` v `parcel.ts`. Kdo se řídí stavovým kódem, oznámí
 * zákazníkovi odeslání balíku, který nevznikl.
 *
 * **Testovací prostředí zná jen vlastní smyšlené výdejny Balíkovny.** Skutečné
 * ID z widgetu (`10109`, `39715`) tam vrátí `247 INVALID_ADDRESS`, zatímco
 * zkušební `10000` projde. Není to chyba v kódu a v ostrém provozu se to
 * obrátí.
 */

type ProviderOptions = {
  api_url?: string
  api_token?: string
  api_secret?: string
  /**
   * Čtyři různá čísla, ne jedno — viz `src/lib/constants.ts`. `customer_id` je
   * technologické číslo (`U124`), ne číslo smlouvy.
   */
  customer_id?: string
  post_code?: string
  contract_number?: string
  location_number?: string | number
  /**
   * Velikostní kategorie zásilek na adresu (`S`/`M`/`L`/`XL`).
   *
   * Česká pošta ji u zásilek na adresu **vyžaduje** — bez ní vrátí
   * `261 MISSING_SIZE_CATEGORY`. Balíkovna ji nechce.
   *
   * Je to jedna hodnota pro všechny zásilky, protože rozměry se u nás nikde
   * neevidují. `M` je kompromis; až budou balíky vycházet jinak, patří sem
   * změna na jediném místě.
   */
  default_size_category?: VelikostZasilky
  /** Fallback when no product in the parcel carries a weight (D2). */
  default_parcel_weight_kg?: number
  /**
   * Carriage before packaging, per service code. These mirror what the flat
   * shipping options charge today, so switching an option to `calculated`
   * cannot silently change the base price out from under her.
   */
  base_price_czk?: Record<string, number>
  /** Used for a piece she has not priced yet, so the catalogue works half-filled. */
  default_packaging_price_czk?: number
}

type InjectedDependencies = {
  logger: Logger
  /**
   * Resolved opportunistically. The calculation context hands over each line's
   * `product.id` but not its metadata, and that is where the packaging price
   * lives — so the product service is looked up rather than assumed. If a
   * future Medusa stops registering it here, `calculatePrice` falls back to
   * carriage alone instead of failing.
   */
  [key: string]: unknown
}

/** Service codes as Česká pošta names them. `NB` is „Do Balíkovny". */
export const CP_SERVICE_CODES = {
  balikovna: "NB",
  address: "DR",
} as const

export type FulfillmentMode = "manual" | "api"

class CeskaPostaFulfillmentService extends AbstractFulfillmentProviderService {
  static identifier = "ceska-posta-fulfillment"

  protected readonly logger_: Logger
  protected readonly options_: ProviderOptions

  protected readonly container_: InjectedDependencies

  constructor(container: InjectedDependencies, options: ProviderOptions = {}) {
    super()
    this.logger_ = container.logger as Logger
    this.options_ = options
    this.container_ = container
  }

  /**
   * Credentials are all-or-nothing: a half-configured provider that fails
   * mid-shipment is worse than one that never tried, because the first leaves
   * an order believing it was dispatched.
   */
  private hasCredentials(): boolean {
    return Boolean(
      this.options_.api_url &&
        this.options_.api_token &&
        this.options_.api_secret &&
        this.options_.customer_id &&
        this.options_.post_code &&
        this.options_.location_number
    )
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "balikovna",
        name: "Balíkovna",
        service_code: CP_SERVICE_CODES.balikovna,
      },
      {
        id: "cp-address",
        name: "Česká pošta – na adresu",
        service_code: CP_SERVICE_CODES.address,
      },
      {
        // Kept from the original stub: ceramics break, and the fragile service
        // is the reason this shop needs a carrier option at all.
        id: "cp-fragile",
        name: "Česká pošta – křehké",
        service_code: CP_SERVICE_CODES.address,
        fragile: true,
      },
      {
        // Returns come back through the same carrier. Ceramics being returned
        // are, if anything, more fragile than when they went out.
        id: "cp-return-fragile",
        name: "Česká pošta – křehké (vrácení)",
        service_code: CP_SERVICE_CODES.address,
        fragile: true,
        is_return: true,
      },
    ]

    // Osobní odběr deliberately lives in its own provider
    // (`src/modules/pickupFulfillment`) rather than here — see its docs.
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    /*
     * `fragile` se veze s sebou, protože v `createFulfillment` už volba dopravy
     * k dispozici není — do provideru se dostane jen tohle `data`. U Balíkovny
     * se stejně zahodí: službu „Křehce" tam číselník ČP nepřipouští (viz
     * `sluzbyProZasilku`).
     */
    return {
      ...data,
      service_code: optionData?.service_code,
      ...(optionData?.fragile ? { fragile: true } : {}),
    }
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Boolean(data)
  }

  /**
   * True since 2026-08-07, for packaging — not for carrier rating.
   *
   * The old `false` was about live ČP rating, which still waits on the B2B
   * profile (P4-2). What is calculated here is *her* arithmetic, not theirs:
   * carriage plus what it costs to wrap each piece. That needs no credentials.
   *
   * **An option only calculates if its `price_type` is `calculated`.** That is
   * data on the shipping option, not code — so until she switches the Česká
   * pošta options in the admin, everything keeps charging today's flat prices
   * and nothing changes.
   */
  async canCalculate(): Promise<boolean> {
    return true
  }

  /**
   * What this parcel costs: carriage + the wrapping for every piece in it.
   *
   * ## Never throws
   *
   * The storefront disables a calculated option that returns no price, so an
   * exception here would not surface as an error — it would quietly remove
   * every carrier option from checkout and leave only Osobní odběr. Every
   * failure path therefore falls back to carriage alone, which is exactly
   * today's behaviour.
   *
   * ## Why the metadata is fetched
   *
   * The calculation context carries each line's `product.id` but not its
   * metadata, and `packaging_price` lives there. Reading it server-side also
   * means the price cannot be influenced by anything the browser sent.
   *
   * There is no separate box cost. The box is folded into each piece's
   * packaging price (owner's decision, 2026-08-07), so this sum is the whole
   * of it — no catalogue, no packer, nothing to measure.
   */
  async calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: Record<string, any>
  ): Promise<{ calculated_amount: number; is_calculated_price_tax_inclusive: boolean }> {
    const serviceCode = String(
      (optionData as any)?.service_code ?? CP_SERVICE_CODES.address
    )
    const base =
      this.options_.base_price_czk?.[serviceCode] ??
      (serviceCode === CP_SERVICE_CODES.balikovna ? 90 : 150)

    const flat = { calculated_amount: base, is_calculated_price_tax_inclusive: true }

    try {
      const items: any[] = Array.isArray(context?.items) ? context.items : []
      if (!items.length) return flat

      const productIds = [
        ...new Set(
          items.map((item) => item?.product?.id ?? item?.variant?.product?.id).filter(Boolean)
        ),
      ]
      if (!productIds.length) return flat

      const productModule: any =
        this.container_?.[Modules.PRODUCT] ?? this.container_?.productModuleService
      if (!productModule?.listProducts) {
        // No way to read the metadata here — carriage only, rather than a wrong number.
        return flat
      }

      const products: any[] = await productModule.listProducts(
        { id: productIds },
        { select: ["id", "metadata"] }
      )
      const priceByProduct = new Map<string, number>()
      for (const product of products) {
        const raw = (product?.metadata as any)?.packaging_price
        const parsed = typeof raw === "number" ? raw : Number(raw)
        if (Number.isFinite(parsed) && parsed >= 0) {
          priceByProduct.set(product.id, parsed)
        }
      }

      const fallback = this.options_.default_packaging_price_czk ?? 0

      const packaging = items.reduce((sum, item) => {
        const productId = item?.product?.id ?? item?.variant?.product?.id
        const each = priceByProduct.get(productId) ?? fallback
        const quantity = Number(item?.quantity) || 1
        return sum + each * quantity
      }, 0)

      return {
        calculated_amount: Math.round((base + packaging) * 100) / 100,
        is_calculated_price_tax_inclusive: true,
      }
    } catch (error: any) {
      this.logger_?.warn?.(
        `[ceska-posta] packaging calculation failed, charging carriage only: ${error?.message}`
      )
      return flat
    }
  }

  /**
   * Records the parcel — and, once credentials exist, books it.
   *
   * The returned `data` is what the ship workflow branches on, so its shape is
   * load-bearing: `mode` decides whether a shipment may follow automatically.
   */
  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    const serviceCode = String(data?.service_code ?? CP_SERVICE_CODES.address)

    if (!this.hasCredentials()) {
      this.logger_.info(
        `[ceska-posta] Zásilka pro objednávku ${
          order?.display_id ?? order?.id ?? "?"
        } zaznamenána bez napojení na dopravce — chybí BALIKOVNA_API_* údaje. ` +
          `Podání u dopravce potvrdí ručně obsluha.`
      )

      return {
        data: {
          mode: "manual" satisfies FulfillmentMode,
          service_code: serviceCode,
          weight_kg: this.parcelWeight(items),
          recorded_at: new Date().toISOString(),
        },
        labels: [],
      }
    }

    return this.podejZasilku(serviceCode, items, order, data)
  }

  /**
   * Skutečné podání u České pošty.
   *
   * ## Jedno volání, ne dvě
   *
   * Členění API svádí k tomu čekat `parcelService` (podání) a pak
   * `parcelPrinting` (štítek). Ve skutečnosti přijde PDF rovnou v odpovědi na
   * podání, jako base64 v `responsePrintParams.file`. Ověřeno voláním.
   *
   * ## Když volání selže, zásilka se NEPODÁ — a řekne se to
   *
   * Při chybě se vrací `mode: "manual"` i s důvodem, ne výjimka. Důvod je ten
   * samý, proč režim bez přístupů existuje vůbec: `mode: "manual"` zastaví
   * odeslání (A1), takže objednávka zůstane v K odeslání s vysvětlením a
   * zboží se nerezervuje nadarmo. Výjimka by celé vyskladnění shodila a ona by
   * nemohla balík podat ani ručně.
   *
   * ## Opakování není zadarmo
   *
   * Storno podané zásilky v nAPI **neexistuje** — ověřeno proti všem
   * publikovaným specifikacím B2B. Číslo zásilky navíc zůstává v evidenci ČP
   * 13 měsíců. Když tedy spojení spadne po odeslání požadavku, ale před
   * přečtením odpovědi, může u pošty ležet zásilka, o které nevíme, a další
   * pokus vyrobí druhou. Proto se tu nic neopakuje automaticky: opakovat smí
   * jen člověk, který se podívá do portálu ČP.
   */
  private async podejZasilku(
    serviceCode: string,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    data: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const vaha = this.parcelWeight(items)
    const oznaceni = order?.display_id ?? order?.id ?? "?"

    /* Co se vrátí, když se podat nepodaří — vždy se stejným vysvětlením. */
    const rucne = (duvod: string): CreateFulfillmentResult => {
      this.logger_.error(`[ceska-posta] Objednávka ${oznaceni}: ${duvod}`)
      return {
        data: {
          mode: "manual" satisfies FulfillmentMode,
          service_code: serviceCode,
          weight_kg: vaha,
          recorded_at: new Date().toISOString(),
          carrier_error: duvod,
        },
        labels: [],
      }
    }

    try {
      const kod: KodSluzby = serviceCode === CP_SERVICE_CODES.balikovna ? "NB" : "DR"
      const metadata = (order?.metadata ?? {}) as Record<string, unknown>
      const vydejna = vydejnaZMetadat(metadata)
      const dobirka = this.dobirkaZObjednavky(order)

      const telo = sestavPodani({
        serviceCode: kod,
        vaha,
        prijemce: (order?.shipping_address ?? {}) as any,
        /*
         * `order.email` se do `createFulfillment` nenačítá (není v polích
         * dotazu) — proto ho `stampDobirkaStep` razítkuje do metadat jako
         * `cp_email`. ČP e-mail u podání vyžaduje (250 MISSING_REQUIRED_EMAIL,
         * změřeno na testovacím prostředí); telefon sám nestačí.
         */
        email:
          (order as any)?.email ??
          (typeof metadata.cp_email === "string" ? metadata.cp_email : null) ??
          null,
        vydejna,
        dobirka,
        /* Udaná cena je povinná — hodnotou je to, co zákazník zaplatil. */
        udanaCena: Math.round(Number((order as any)?.total ?? 0)),
        odesilatel: {
          customerId: String(this.options_.customer_id),
          postCode: String(this.options_.post_code),
          locationNumber: Number(this.options_.location_number),
        },
        sluzby: sluzbyProZasilku({
          serviceCode: kod,
          krehke: Boolean(data?.fragile),
          maDobirku: Boolean(dobirka),
          velikost: this.options_.default_size_category,
        }),
      })

      const odpoved = await callCeskaPosta(
        {
          apiUrl: String(this.options_.api_url),
          apiToken: String(this.options_.api_token),
          apiSecret: String(this.options_.api_secret),
        },
        "/ZSKService/v1/parcelService",
        "POST",
        telo
      )

      if (odpoved.status < 200 || odpoved.status >= 300) {
        return rucne(
          `Česká pošta zásilku nepřijala — ${chybaZOdpovedi(odpoved.status, odpoved.body, odpoved.raw)}`
        )
      }

      const { ok, cisloZasilky, stitekBase64, chyby } = prectiOdpoved(odpoved.body)

      /*
       * Tady se rozhoduje podle těla, ne podle stavového kódu HTTP. ČP
       * odpovídá `200` i na odmítnutá podání — viz `prectiOdpoved`.
       */
      if (!ok) {
        return rucne(
          chyby.length
            ? `Česká pošta zásilku nepřijala — ${popisChyb(chyby)}`
            : "Česká pošta odpověděla bez čísla zásilky. Zkontroluj podání v portálu ČP, " +
                `ať nevznikne dvakrát. Odpověď: ${odpoved.raw.slice(0, 200)}`
        )
      }

      this.logger_.info(
        `[ceska-posta] Objednávka ${oznaceni}: podána zásilka ${cisloZasilky} (${kod}, ${vaha} kg)` +
          (dobirka ? `, dobírka ${dobirka.castka} Kč / VS ${dobirka.variabilniSymbol}` : "")
      )

      return {
        data: {
          mode: "api" satisfies FulfillmentMode,
          service_code: serviceCode,
          weight_kg: vaha,
          recorded_at: new Date().toISOString(),
          parcel_code: cisloZasilky,
          /*
           * Štítek se veze s vyskladněním, ne na disku: je to jediná kopie,
           * kterou máme, a `parcelPrinting` by ho sice dotiskl, ale jen dokud
           * zásilka existuje v evidenci.
           */
          ...(stitekBase64 ? { label_pdf_base64: stitekBase64 } : {}),
          ...(dobirka ? { cod_amount: dobirka.castka, cod_vs: dobirka.variabilniSymbol } : {}),
        },
        labels: [
          {
            tracking_number: cisloZasilky,
            tracking_url: `https://www.postaonline.cz/trackandtrace/-/zasilka/cislo?parcelNumbers=${cisloZasilky}`,
            label_url: "",
          },
        ],
      }
    } catch (error: any) {
      return rucne(`podání u České pošty selhalo: ${error?.message ?? error}`)
    }
  }

  /**
   * Dobírka z objednávky — nebo výslovné „nevím".
   *
   * Provider běží v kontejneru fulfillment modulu, kde `payment_collections`
   * nejsou a dotáhnout je nelze. Fakta o dobírce proto do `order.metadata`
   * zapisuje `shipMerchantOrderWorkflow`, které je stejně už načítá.
   *
   * Když klíč chybí, znamená to „bez dobírky". To je bezpečné jen proto, že ho
   * to workflow zapisuje **vždy** — i s nulou. Kdyby se sem objednávka dostala
   * jinudy, zásilka odejde bez dobírky a peníze se nevyberou; na to je ten
   * kontrolní klíč `cp_dobirka_zjistena`.
   */
  private dobirkaZObjednavky(
    order: Partial<FulfillmentOrderDTO> | undefined
  ): { castka: number; variabilniSymbol: string } | null {
    const metadata = (order?.metadata ?? {}) as Record<string, unknown>

    if (metadata.cp_dobirka_zjistena !== true) {
      this.logger_.warn(
        `[ceska-posta] Objednávka ${order?.display_id ?? order?.id}: chybí údaj o dobírce ` +
          `(cp_dobirka_zjistena). Podávám bez dobírky — ověř, že se nemá vybírat hotovost.`
      )
      return null
    }

    const castka = Number(metadata.cp_dobirka_czk ?? 0)
    if (!Number.isFinite(castka) || castka <= 0) return null

    return {
      /* Půlhaléře ČP odmítá (chyba 36) a zásilku vrací bez možnosti opravy. */
      castka: Math.round(castka),
      variabilniSymbol: variabilniSymbol(order?.display_id ?? order?.id ?? 0),
    }
  }

  /**
   * Parcel weight from the items, falling back to the configured default (D2).
   * The old Packeta provider hardcoded 2.5 kg for every parcel regardless of
   * contents, which is how a shop overpays on every small order.
   */
  private parcelWeight(
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[]
  ): number {
    const summed = (items || []).reduce((total, item) => {
      const quantity = Number((item as any)?.quantity ?? 0) || 0
      const weightGrams = Number((item as any)?.variant?.weight ?? 0) || 0
      return total + (weightGrams / 1000) * quantity
    }, 0)

    if (summed > 0) {
      return Math.round(summed * 1000) / 1000
    }
    return Number(this.options_.default_parcel_weight_kg ?? 2.5)
  }

  /**
   * Zrušení zásilky — u České pošty se dělá rukama, ne přes API.
   *
   * **Žádný takový endpoint neexistuje.** Ověřeno proti všem publikovaným
   * specifikacím B2B (ZSK 1.5.0 i 1.13.0): jediná dvě `DELETE` v celé rodině
   * ruší podací místo a dispozici na boxu, nikoli zásilku.
   *
   * Prakticky se nepodaná zásilka prostě nepředá při svozu. Číslo ale zůstává
   * v evidenci ČP **13 měsíců** a pokus o jeho recyklaci vrátí
   * `101 DUPLICATE_PARCEL_CODE`.
   *
   * Tohle se tedy nedá „doimplementovat" — proto tu není TODO, ale vysvětlení.
   */
  async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<any> {
    const mode = (fulfillment as any)?.data?.mode ?? (fulfillment as any)?.mode
    const cislo = (fulfillment as any)?.data?.parcel_code

    if (mode === "api") {
      this.logger_.warn(
        `[ceska-posta] Zásilka ${cislo ?? "?"} je u České pošty podaná a API pro storno nemá. ` +
          `Nepředávej ji při svozu; pokud už odešla, řeš ji v portálu ČP.`
      )
    }

    // V režimu bez napojení není co rušit — dopravci se nikdy nic neřeklo.
    return {}
  }

  // No documents in record-only mode; labels arrive with the carrier call
  // (P4-2). The base class already returns empty for all of these, so they are
  // left to it rather than overridden with the same thing.
}

export default CeskaPostaFulfillmentService
