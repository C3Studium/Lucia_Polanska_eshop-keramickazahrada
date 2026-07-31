export const COMGATE_API_URL = "https://payments.comgate.cz/v2.0";

const methodPattern = /^[A-Z0-9][A-Z0-9_.+-]{0,127}$/;
const countryPattern =
  /^(ALL|AT|BE|CY|CZ|DE|EE|EL|ES|FI|FR|GB|HR|HU|IE|IT|LT|LU|LV|MT|NL|NO|PL|PT|RO|SI|SK|SE|US)$/;

export const resolveComgateMethod = (
  value: unknown,
  fallback = "ALL"
): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toUpperCase();
  return methodPattern.test(normalized) ? normalized : fallback;
};

export const resolveComgateTestMode = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase()
  );
};

export const resolveComgateCountry = (
  value: unknown,
  fallback = "CZ"
): string => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return countryPattern.test(normalized) ? normalized : fallback;
};

export const createComgateAuthorization = (
  merchant?: string,
  secret?: string
): string => {
  if (!merchant || !secret) {
    throw new Error("Comgate credentials are not configured");
  }

  return `Basic ${Buffer.from(`${merchant}:${secret}`).toString("base64")}`;
};

export const resolveStorefrontReturnUrl = (
  storefrontUrl: string | undefined,
  path: unknown,
  fallbackPath: string
): string => {
  const base = String(storefrontUrl || "").replace(/\/$/, "");
  const requestedPath =
    typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
      ? path
      : fallbackPath;

  return `${base}${requestedPath}`;
};
