import { AbstractPaymentProvider } from "@medusajs/framework/utils"
import { CancelPaymentInput, CancelPaymentOutput, DeletePaymentInput, DeletePaymentOutput, GetPaymentStatusInput, GetPaymentStatusOutput, InitiatePaymentInput, InitiatePaymentOutput, ProviderWebhookPayload, RetrievePaymentInput, RetrievePaymentOutput, UpdatePaymentInput, UpdatePaymentOutput, WebhookActionResult } from "@medusajs/types"
import { BigNumber } from "@medusajs/framework/utils"
import axios from "axios"
import crypto from "crypto"
import { Logger } from "@medusajs/framework/types"
import { COMGATE_MERCHANT, COMGATE_METHOD, COMGATE_SECRET, COMGATE_TEST } from "lib/constants"


type ComgateOptions = {
  merchant: string
  secret: string
  test?: boolean
  country: string  // Změněno na povinné
  curr: string     // Změněno na povinné
  method: string
}

type InjectedDependencies = {
  logger: Logger
}

class ComgatePaymentProviderService extends AbstractPaymentProvider<ComgateOptions> {
  static identifier = "comgate"
  protected logger_: Logger
  protected options: ComgateOptions

  constructor(
    container: InjectedDependencies,
    options: ComgateOptions
  ) {
    super(container, options)

    this.logger_ = container.logger
    this.options = options
  }

  async authorizePayment(data: any): Promise<any> {
    // Implementujte logiku pro autorizaci platby
    return { success: true, data, status: "authorized" }
  }

  async capturePayment(data: any): Promise<any> {
    // Implementujte logiku pro zachycení platby
    return { success: true, data }
  }

  async refundPayment(data: any): Promise<any> {
    // Implementujte logiku pro refundaci platby
    return { success: true, data }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const { currency_code, context } = input

    // Získání údajů o zákazníkovi, pokud jsou k dispozici; fallback na input.data
    const dataAny = (input?.data as any) || {}
    const email = context?.customer?.email || dataAny.email || null
    const firstName = context?.customer?.first_name || dataAny.first_name || ""
    const lastName = context?.customer?.last_name || dataAny.last_name || ""
    const fullName = `${firstName} ${lastName}`.trim()
    const cartId = input.data?.cart_id || null


    console.log("Comgate initiatePayment input:", input)
    const merchant = this.options?.merchant || COMGATE_MERCHANT
    const secret = this.options?.secret || COMGATE_SECRET
    const auth = Buffer.from(`${merchant}:${secret}`).toString("base64")

    const payload = {
      test: 1,
      price: Number(input?.amount) * 100, // Předpokládáme, že Comgate očekává částku v haléřích
      curr: currency_code.toUpperCase(),
      label: "Keramická zahrada",
      refId: input.data?.session_id,
      method: input.data?.method || "ALL",
      email: email,
      fullName: fullName,
      delivery: "HOME_DELIVERY",
      category: "PHYSICAL_GOODS_ONLY",
      enableApplePayGooglePay: true,
      url_paid: `${process.env.STOREFRONT_PUBLIC_URL}/cart/${cartId}/confirmed`,
      url_cancelled: `${process.env.STOREFRONT_PUBLIC_URL}/cart/${cartId}/canceled`,
      url_success: `${process.env.STOREFRONT_PUBLIC_URL}/cart/${cartId}/confirmed`,
    }

    //redirect to summary url: http://localhost:8000/cz/order/order_01K2D66AE6147SZF9479HZBQR2/confirmed

    const headers = {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    }
    console.log("Comgate API request payload:", payload)

    const response = await fetch("https://payments.comgate.cz/v2.0/payment.json", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Chyba Comgate API: ${response.status} - ${text}`)
    }

    const data = JSON.parse(text)
    console.log("Comgate response payment provider:", data)
    // Ulož potřebné informace do payment session (např. redirect URL)
    return { // nebo jiný klíč podle odpovědi Comgate
      status: "pending", // nebo jiný stav podle potřeby
      id: data.transId, // Předpokládáme, že Comgate vrací ID platby
      data: {
        redirectUrl: data.redirect, // Předpokládáme, že Comgate vrací URL pro přesměrování
      },
    }
  }


  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    // Implementujte logiku pro smazání platby
    return {}
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    // Implementujte logiku pro získání stavu platby
    return { status: "authorized" }
  }

  async getPaymentDetails(paymentId: string): Promise<any> {
    // Implementujte logiku pro získání detailů platby
    return { success: true, paymentId }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Implementujte logiku pro aktualizaci platby
    return { data: input.data }
  }

  async getWebhookActionAndData(data: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    // Implementujte logiku pro zpracování webhooku
    return { action: "authorized" }
  }

  async createPayment(data: any): Promise<any> {
    // Implementujte logiku pro vytvoření platby
    return { success: true, data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    // Implementujte logiku pro získání platby
    return {}
  }


  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return {

    }
  }

  // Zde implementujte potřebné metody pro autorizaci, zachycení, refund atd.
}

export default ComgatePaymentProviderService