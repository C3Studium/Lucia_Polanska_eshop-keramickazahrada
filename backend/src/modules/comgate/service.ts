import { AbstractPaymentProvider } from "@medusajs/framework/utils";
import {
  CancelPaymentInput,
  CancelPaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/types";
import { Logger } from "@medusajs/framework/types";
import {
  COMGATE_MERCHANT,
  COMGATE_METHOD,
  COMGATE_SECRET,
} from "lib/constants";
import {
  COMGATE_API_URL,
  createComgateAuthorization,
  resolveComgateCountry,
  resolveComgateMethod,
  resolveComgateTestMode,
  resolveStorefrontReturnUrl,
} from "./utils";

type ComgateOptions = {
  merchant: string;
  secret: string;
  test?: boolean | string;
  country: string; // Změněno na povinné
  curr: string; // Změněno na povinné
  method: string;
};

type InjectedDependencies = {
  logger: Logger;
};

class ComgatePaymentProviderService extends AbstractPaymentProvider<ComgateOptions> {
  static identifier = "comgate";
  protected logger_: Logger;
  protected options: ComgateOptions;

  constructor(container: InjectedDependencies, options: ComgateOptions) {
    super(container, options);

    this.logger_ = container.logger;
    this.options = options;
  }

  async authorizePayment(data: any): Promise<any> {
    // Implementujte logiku pro autorizaci platby
    return { success: true, data, status: "authorized" };
  }

  async capturePayment(data: any): Promise<any> {
    // Implementujte logiku pro zachycení platby
    return { success: true, data };
  }

  async refundPayment(data: any): Promise<any> {
    // Implementujte logiku pro refundaci platby
    return { success: true, data };
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const { currency_code, context } = input;

    // Získání údajů o zákazníkovi, pokud jsou k dispozici; fallback na input.data
    const dataAny = (input?.data as any) || {};
    const email = context?.customer?.email || dataAny.email || null;
    const firstName = context?.customer?.first_name || dataAny.first_name || "";
    const lastName = context?.customer?.last_name || dataAny.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const cartId = dataAny.cart_id || null;
    const merchant = this.options?.merchant || COMGATE_MERCHANT;
    const secret = this.options?.secret || COMGATE_SECRET;
    const selectedMethod = resolveComgateMethod(
      dataAny.method,
      resolveComgateMethod(this.options?.method || COMGATE_METHOD, "ALL")
    );
    const country = resolveComgateCountry(
      dataAny.country_code,
      resolveComgateCountry(this.options?.country, "CZ")
    );
    const fallbackPath = `/${country.toLowerCase()}/cart/${cartId}/confirmed`;
    const paidUrl = resolveStorefrontReturnUrl(
      process.env.STOREFRONT_PUBLIC_URL,
      dataAny.url_paid,
      fallbackPath
    );
    const cancelledUrl = resolveStorefrontReturnUrl(
      process.env.STOREFRONT_PUBLIC_URL,
      dataAny.url_cancelled,
      `/${country.toLowerCase()}/cart/${cartId}/canceled`
    );

    const payload = {
      test: resolveComgateTestMode(this.options?.test),
      country,
      price: Math.round(Number(input?.amount) * 100),
      curr: currency_code.toUpperCase(),
      label: "Keram. zahrada",
      refId: cartId || dataAny.session_id || `payment-${Date.now()}`,
      method: selectedMethod,
      email: email,
      fullName: fullName,
      billingAddrCity: dataAny.billing_city,
      billingAddrStreet: dataAny.billing_street,
      billingAddrPostalCode: dataAny.billing_postal_code,
      billingAddrCountry: country,
      delivery: dataAny.delivery || "HOME_DELIVERY",
      homeDeliveryCity: dataAny.shipping_city,
      homeDeliveryStreet: dataAny.shipping_street,
      homeDeliveryPostalCode: dataAny.shipping_postal_code,
      homeDeliveryCountry: country,
      category: "PHYSICAL_GOODS_ONLY",
      lang: dataAny.lang || "cs",
      enableApplePayGooglePay: true,
      url_paid: paidUrl,
      url_cancelled: cancelledUrl,
    };

    const headers = {
      Authorization: createComgateAuthorization(merchant, secret),
      "Content-Type": "application/json",
    };

    const response = await fetch(`${COMGATE_API_URL}/payment.json`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Chyba Comgate API: ${response.status} - ${text}`);
    }

    const data = JSON.parse(text);
    if (
      Number(data?.code) !== 0 ||
      typeof data?.transId !== "string" ||
      typeof data?.redirect !== "string"
    ) {
      throw new Error(
        `Comgate payment creation failed: ${
          data?.message || "invalid response"
        }`
      );
    }
    return {
      status: "pending",
      id: data.transId,
      data: {
        redirectUrl: data.redirect,
        method: selectedMethod,
        transId: data.transId,
      },
    };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    // Implementujte logiku pro smazání platby
    return {};
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    // Implementujte logiku pro získání stavu platby
    return { status: "authorized" };
  }

  async getPaymentDetails(paymentId: string): Promise<any> {
    // Implementujte logiku pro získání detailů platby
    return { success: true, paymentId };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Implementujte logiku pro aktualizaci platby
    return { data: input.data };
  }

  async getWebhookActionAndData(
    data: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    // Implementujte logiku pro zpracování webhooku
    return { action: "authorized" };
  }

  async createPayment(data: any): Promise<any> {
    // Implementujte logiku pro vytvoření platby
    return { success: true, data };
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    // Implementujte logiku pro získání platby
    return {};
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return {};
  }

  // Zde implementujte potřebné metody pro autorizaci, zachycení, refund atd.
}

export default ComgatePaymentProviderService;
