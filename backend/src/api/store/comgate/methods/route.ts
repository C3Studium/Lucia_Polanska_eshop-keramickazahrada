import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  COMGATE_COUNTRY,
  COMGATE_CURRENCY,
  COMGATE_MERCHANT,
  COMGATE_SECRET,
} from "../../../../lib/constants";
import {
  COMGATE_API_URL,
  createComgateAuthorization,
  resolveComgateMethod,
} from "../../../../modules/comgate/utils";

type ComgateMethod = {
  id: string;
  group: string;
  groupLabel: string;
  name: string;
  name_short: string;
  description: string;
  logo: string;
  logo_120c: string;
  logo_240: string;
  logo_240c: string;
  logo_150s: string;
  logo_100s: string;
};

const currencies = new Set([
  "CZK",
  "EUR",
  "PLN",
  "HUF",
  "USD",
  "GBP",
  "RON",
  "HRK",
  "NOK",
  "SEK",
]);

const countries = new Set([
  "AT",
  "BE",
  "CY",
  "CZ",
  "DE",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "GB",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SI",
  "SL",
  "SK",
  "SE",
  "US",
]);

const languages = new Set([
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fi",
  "fr",
  "hr",
  "hu",
  "it",
  "lt",
  "lv",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sl",
  "sk",
  "sv",
  "uk",
  "vi",
]);

const firstQueryValue = (value: unknown): string | undefined =>
  Array.isArray(value)
    ? String(value[0] ?? "")
    : value == null
    ? undefined
    : String(value);

const safeText = (value: unknown, maxLength = 240): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const safeLogo = (value: unknown): string => {
  const candidate = safeText(value, 1000);

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const sanitizeMethod = (method: unknown): ComgateMethod | null => {
  if (!method || typeof method !== "object") return null;

  const source = method as Record<string, unknown>;
  const id = resolveComgateMethod(source.id, "");
  if (!id) return null;

  return {
    id,
    group: safeText(source.group, 80),
    groupLabel: safeText(source.groupLabel, 120),
    name: safeText(source.name, 160),
    name_short: safeText(source.name_short, 100),
    description: safeText(source.description, 320),
    logo: safeLogo(source.logo),
    logo_120c: safeLogo(source.logo_120c),
    logo_240: safeLogo(source.logo_240),
    logo_240c: safeLogo(source.logo_240c),
    logo_150s: safeLogo(source.logo_150s),
    logo_100s: safeLogo(source.logo_100s),
  };
};

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const requestedCurrency = firstQueryValue(req.query.curr)?.toUpperCase();
  const requestedCountry = firstQueryValue(req.query.country)?.toUpperCase();
  const requestedLanguage = firstQueryValue(req.query.lang)?.toLowerCase();
  const requestedPrice = Number(firstQueryValue(req.query.price));

  const curr = currencies.has(requestedCurrency || "")
    ? requestedCurrency!
    : String(COMGATE_CURRENCY || "CZK").toUpperCase();
  const country = countries.has(requestedCountry || "")
    ? requestedCountry!
    : String(COMGATE_COUNTRY || "CZ").toUpperCase();
  const lang = languages.has(requestedLanguage || "")
    ? requestedLanguage!
    : "cs";

  const query = new URLSearchParams({ curr, country, lang });
  if (Number.isSafeInteger(requestedPrice) && requestedPrice > 0) {
    query.set("price", String(requestedPrice));
  }
  const shopperUserAgent = firstQueryValue(
    req.headers["x-shopper-user-agent"]
  )?.slice(0, 512);
  if (shopperUserAgent) {
    query.set("userAgent", shopperUserAgent);
  }

  try {
    const response = await fetch(`${COMGATE_API_URL}/method.json?${query}`, {
      headers: {
        Authorization: createComgateAuthorization(
          COMGATE_MERCHANT,
          COMGATE_SECRET
        ),
        Accept: "application/json",
      },
    });

    if (response.status === 204) {
      return res.status(200).json({ methods: [] });
    }

    if (!response.ok) {
      req.scope
        .resolve("logger")
        .error(`Comgate methods request failed with status ${response.status}`);
      return res.status(502).json({
        methods: [],
        message: "Platební metody se nyní nepodařilo načíst.",
      });
    }

    const payload = (await response.json()) as { methods?: unknown[] };
    const methods = Array.isArray(payload.methods)
      ? payload.methods
          .map(sanitizeMethod)
          .filter((method): method is ComgateMethod => Boolean(method))
      : [];

    res.setHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    return res.status(200).json({ methods });
  } catch (error) {
    req.scope.resolve("logger").error("Comgate methods request failed", error);
    return res.status(502).json({
      methods: [],
      message: "Platební metody se nyní nepodařilo načíst.",
    });
  }
}
