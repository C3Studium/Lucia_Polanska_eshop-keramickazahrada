import type { AdminOrder } from "@medusajs/framework/types";
import { Container, Heading, Text } from "@medusajs/ui";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * „Zákazník" — kdo objednal a kam to jde, jako jednoduchá tabulka
 * (popisek vlevo, hodnota vpravo; 17. 11. 2026).
 *
 * Nahrazuje nativní kartu zákazníka z pravého sloupce: majitelka tam hledala
 * adresu mezi technickými údaji. Úpravy adresy a e-mailu vedou na nativní
 * formuláře Medusy, takže se nic nepřepisuje jinou cestou.
 */

type Address = {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone?: string | null;
};

const COUNTRIES: Record<string, string> = {
  cz: "Česko",
  sk: "Slovensko",
  de: "Německo",
  at: "Rakousko",
  pl: "Polsko",
};

const nameOf = (address?: Address | null) =>
  [address?.first_name, address?.last_name].filter(Boolean).join(" ").trim();

const addressLines = (address?: Address | null): string[] => {
  if (!address) return [];
  const country = String(address.country_code ?? "").toLowerCase();
  return [
    address.company,
    [address.address_1, address.address_2].filter(Boolean).join(", "),
    [address.postal_code, address.city].filter(Boolean).join(" "),
    country && country !== "cz" ? COUNTRIES[country] ?? country.toUpperCase() : null,
  ].filter((line): line is string => Boolean(line && line.trim()));
};

const sameAddress = (a?: Address | null, b?: Address | null) =>
  addressLines(a).join("|") === addressLines(b).join("|") && nameOf(a) === nameOf(b);

const Row = ({ label, children, edit }: { label: string; children: ReactNode; edit?: string }) => (
  <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-6">
    <Text size="small" className="text-ui-fg-subtle pt-px">
      {label}
    </Text>
    <div className="min-w-0 break-words">{children}</div>
    {edit ? (
      <Link to={edit} className="text-ui-fg-interactive text-sm hover:underline">
        Upravit
      </Link>
    ) : (
      <span />
    )}
  </div>
);

const Value = ({ children }: { children: ReactNode }) => (
  <Text size="small" weight="plus">
    {children}
  </Text>
);

export const OrderCustomerPanel = ({ order }: { order: AdminOrder }) => {
  const shipping = (order as any).shipping_address as Address | null | undefined;
  const billing = (order as any).billing_address as Address | null | undefined;
  const customer = (order as any).customer as { first_name?: string; last_name?: string } | null;
  const name =
    nameOf(shipping) ||
    nameOf(billing) ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    "—";
  const phone = shipping?.phone || billing?.phone || null;
  const method = ((order as any).shipping_methods ?? [])[0]?.name as string | undefined;
  // U osobního odběru se nikam nedoručuje — adresa je jen kontaktní.
  const pickup = /osobn|vyzvednut/i.test(method ?? "");
  const base = `/orders/${order.id}`;
  const shippingLines = addressLines(shipping);
  const billingDiffers = billing && !sameAddress(shipping, billing) && addressLines(billing).length > 0;

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Zákazník</Heading>
      </div>
      <Row label="Jméno">
        <Value>{name}</Value>
      </Row>
      <Row label="E-mail" edit={`${base}/email`}>
        {order.email ? (
          <a href={`mailto:${order.email}`} className="text-ui-fg-base text-sm font-medium [overflow-wrap:anywhere] hover:underline">
            {order.email}
          </a>
        ) : (
          <Value>—</Value>
        )}
      </Row>
      <Row label="Telefon">
        {phone ? (
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className="text-ui-fg-base text-sm font-medium [overflow-wrap:anywhere] hover:underline">
            {phone}
          </a>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            Nevyplnil
          </Text>
        )}
      </Row>
      {method && (
        <Row label="Doprava">
          <Value>{method}</Value>
        </Row>
      )}
      <Row
        label={pickup ? "Adresa" : "Doručit na"}
        edit={shippingLines.length ? `${base}/shipping-address` : undefined}
      >
        {shippingLines.length ? (
          <div className="flex flex-col">
            {shippingLines.map((line) => (
              <Text key={line} size="small" weight="plus">
                {line}
              </Text>
            ))}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            Bez adresy (vyzvednutí nebo poukaz e-mailem)
          </Text>
        )}
      </Row>
      {billingDiffers && (
        <Row label="Fakturace" edit={`${base}/billing-address`}>
          <div className="flex flex-col">
            {nameOf(billing) && (
              <Text size="small" weight="plus">
                {nameOf(billing)}
              </Text>
            )}
            {addressLines(billing).map((line) => (
              <Text key={line} size="small" weight="plus">
                {line}
              </Text>
            ))}
          </div>
        </Row>
      )}
    </Container>
  );
};
