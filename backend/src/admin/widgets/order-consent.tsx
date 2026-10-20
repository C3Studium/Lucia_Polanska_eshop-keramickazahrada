import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { formatDateTime } from "../lib/format"

/**
 * Souhlas s obchodními podmínkami u objednávky — co zákazník před odesláním
 * odsouhlasil a kdy (důkaz pro § 1820, § 1826 a § 1837 písm. d) OZ).
 *
 * Čte jen `order.metadata` (detail objednávky ho už má), takže žádná routa:
 * - `terms_version`, `terms_accepted_at` — verze OP a čas zaškrtnutí (prohlížeč),
 * - `terms_recorded_at` — serverový čas, dopíše subscriber `order-consent`,
 * - `withdrawal_info_version`, `privacy_version` — verze poučení a Zásad,
 * - `made_to_order_ack_at`, `made_to_order_ack_version` — u zakázky poučení,
 *   že ji nelze vrátit do 14 dnů.
 */

type Meta = Record<string, unknown>

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null

/** „15. 10. 2026" z verze `2026-10-15`; jinak verzi vypíše, jak je. */
const versionLabel = (value: unknown): string => {
  const version = text(value)
  if (!version) return "—"
  if (version === "unknown") return "neznámá (registr dokumentů byl prázdný)"
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version)
  return match
    ? `znění od ${Number(match[3])}. ${Number(match[2])}. ${match[1]}`
    : version
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-x-4">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text size="small" className="text-right">
      {value}
    </Text>
  </div>
)

const OrderConsentWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const meta = ((order as any)?.metadata ?? {}) as Meta
  const hasTerms = Boolean(text(meta.terms_version))
  const madeToOrderAt = text(meta.made_to_order_ack_at)

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Souhlas s podmínkami</Heading>
        {hasTerms ? (
          <Badge color="green">Zaznamenán</Badge>
        ) : (
          <Badge color="red">Chybí</Badge>
        )}
      </div>

      <div className="flex flex-col gap-y-2 px-6 py-4">
        {hasTerms ? (
          <>
            <Row label="Obchodní podmínky" value={versionLabel(meta.terms_version)} />
            <Row
              label="Odsouhlaseno (čas zákazníka)"
              value={text(meta.terms_accepted_at) ? formatDateTime(String(meta.terms_accepted_at)) : "—"}
            />
            <Row
              label="Zaznamenáno serverem"
              value={
                text(meta.terms_recorded_at)
                  ? formatDateTime(String(meta.terms_recorded_at))
                  : "zatím ne"
              }
            />
            <Row
              label="Poučení o odstoupení"
              value={versionLabel(meta.withdrawal_info_version)}
            />
            <Row
              label="Zásady ochrany os. údajů"
              value={versionLabel(meta.privacy_version)}
            />
            {madeToOrderAt ? (
              <>
                <Row
                  label="Zakázka: poučení o vyloučení odstoupení"
                  value={`potvrzeno ${formatDateTime(madeToOrderAt)}`}
                />
                <Row
                  label="Podle obchodních podmínek"
                  value={versionLabel(meta.made_to_order_ack_version)}
                />
              </>
            ) : null}
          </>
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            Objednávka nemá záznam souhlasu s obchodními podmínkami. U ruční
            objednávky založené v administraci je to v pořádku; u objednávky
            z e-shopu jde o chybu pokladny (vývojář dostal upozornění).
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderConsentWidget
