import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * Stav slevového kódu: `/store/promotions/JARO25`.
 *
 * Proč to vůbec existuje: `POST /store/carts/:id` s `promo_codes` neplatný kód
 * TIŠE ZAHODÍ — vrátí košík bez něj a nic neřekne. Obchod tedy z odpovědi pozná
 * jen „neuplatnilo se", a nedokáže rozlišit překlep od kódu, který doběhl. To je
 * pro člověka u pokladny rozdíl mezi „zkontrolujte, co jste napsal" a „tenhle
 * kód už neplatí, hledat překlep nemá smysl".
 *
 * Vrací se schválně JEN stav, nikdy podmínky ani výše slevy. Endpoint je
 * veřejný, takže by se přes něj daly kódy zkoušet; ať z toho útočník nemá víc
 * než „ano/ne", které stejně zjistí z pokladny.
 *
 * `valid` je „dá se dnes uplatnit", ne „uplatní se na tenhle košík" — jestli
 * sedí i podmínky (minimální částka, konkrétní produkty), rozhodne až samotné
 * přidání do košíku.
 */
type Stav =
  | { exists: false }
  | { exists: true; valid: true }
  | {
      exists: true;
      valid: false;
      reason: "inactive" | "not-started" | "expired";
    };

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const code = String(req.params.code ?? "").trim();

  if (!code) {
    return res.status(400).json({ message: "Chybí kód." });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "promotion",
    fields: ["id", "code", "status", "campaign.starts_at", "campaign.ends_at"],
    filters: { code },
  });

  const promotion = data?.[0] as
    | {
        status?: string;
        campaign?: { starts_at?: string | Date; ends_at?: string | Date };
      }
    | undefined;

  if (!promotion) {
    return res.json({ exists: false } satisfies Stav);
  }

  /* Kampaň je nepovinná. Když u kódu žádná není, neomezuje ho žádné okno
     a rozhoduje jen jeho stav. */
  const now = Date.now();
  const zacatek = promotion.campaign?.starts_at;
  const konec = promotion.campaign?.ends_at;

  if (promotion.status !== "active") {
    return res.json({
      exists: true,
      valid: false,
      reason: "inactive",
    } satisfies Stav);
  }

  if (zacatek && new Date(zacatek).getTime() > now) {
    return res.json({
      exists: true,
      valid: false,
      reason: "not-started",
    } satisfies Stav);
  }

  if (konec && new Date(konec).getTime() < now) {
    return res.json({
      exists: true,
      valid: false,
      reason: "expired",
    } satisfies Stav);
  }

  res.json({ exists: true, valid: true } satisfies Stav);
}
