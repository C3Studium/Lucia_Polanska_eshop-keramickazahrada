import {
  Button,
  Checkbox,
  Drawer,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  clx,
  toast,
} from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ceskaChyba } from "../lib/ceska-chyba";
import { sdk } from "../lib/sdk";

/**
 * „Vytvořit objednávku" z poptávky zakázky (17. 11. 2026, Matěj: zákazník
 * poptá kus na míru → z poptávky jde založit objednávku, zákazníkovi přijde
 * e-mail a dál to jede jako každá zakázka).
 *
 * Formulář je předvyplněný z poptávky; majitelka doplní cenu, zálohu
 * a dopravu. Server (`POST /admin/commission-inquiries/:id/create-order`)
 * založí objednávku se zakázkou a — když je cena — pošle zákazníkovi e-mail
 * s odkazem k zaplacení zálohy (tentýž jako u „ceny po domluvě").
 */

export type InquiryForOrder = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  description: string;
  dimensions: string | null;
  motif: string | null;
  deadline: string | null;
  product_title: string | null;
  photo_urls: string[];
};

type Result = {
  order_id: string;
  display_id: number | null;
  emailed_price: boolean;
  warning: string | null;
};

const kc = (value: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value) + " Kč";

/** Zadání = text poptávky + rozměry, motiv a termín, ať se nic neztratí. */
const briefOf = (inquiry: InquiryForOrder): string =>
  [
    inquiry.description?.trim(),
    inquiry.dimensions ? `Rozměry: ${inquiry.dimensions}` : null,
    inquiry.motif ? `Motiv / text / číslo: ${inquiry.motif}` : null,
    inquiry.deadline ? `Termín: ${inquiry.deadline}` : null,
  ]
    .filter(Boolean)
    .join("\n");

/** Řádek formuláře: popisek vlevo, pole vpravo (na telefonu pod sebou). */
const Row = ({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) => (
  <div className="grid gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-x-4">
    <Label htmlFor={htmlFor} size="small" className="text-ui-fg-subtle sm:pt-2">
      {label}
    </Label>
    <div className="flex min-w-0 flex-col gap-1">
      {children}
      {hint && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
  </div>
);

const Segmented = <T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) => (
  <div role="radiogroup" aria-label={label} className="bg-ui-bg-subtle inline-flex w-fit rounded-lg p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={clx(
          "txt-compact-small min-h-[34px] rounded-md px-3 font-medium transition-colors",
          value === option.value
            ? "bg-ui-bg-base text-ui-fg-base shadow-elevation-card-rest"
            : "text-ui-fg-subtle hover:text-ui-fg-base"
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const InquiryOrderDrawer = ({
  inquiry,
  trigger,
}: {
  inquiry: InquiryForOrder;
  trigger: ReactNode;
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(inquiry.name ?? "");
  const [email, setEmail] = useState(inquiry.email ?? "");
  const [phone, setPhone] = useState(inquiry.phone ?? "");
  const [title, setTitle] = useState(
    inquiry.product_title ? `${inquiry.product_title} — na míru` : "Zakázka na míru"
  );
  const [brief, setBrief] = useState(briefOf(inquiry));
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("25");
  const [delivery, setDelivery] = useState<"pickup" | "post">("pickup");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [parcel, setParcel] = useState<"male" | "velke">("male");
  const [fragile, setFragile] = useState(true);
  const [sendLink, setSendLink] = useState(true);

  const priceNumber = Number(price.replace(",", ".")) || 0;
  const depositNumber = Math.min(50, Math.max(1, Number(deposit) || 25));
  const depositAmount = Math.round(priceNumber * depositNumber) / 100;

  /* Co zákazník dostane — jedna věta nad tlačítkem, ať je jasné, co klik udělá. */
  const summary = useMemo(() => {
    if (priceNumber <= 0) {
      return "Zákazník dostane e-mail s potvrzením objednávky. Cenu mu pošlete později z objednávky.";
    }
    if (!sendLink) {
      return "Zákazník dostane e-mail s potvrzením objednávky. Cena se uloží jen k zakázce — pošlete ji později z objednávky.";
    }
    return `Zákazník dostane e-mail s potvrzením objednávky a odkazem k zaplacení zálohy ${kc(depositAmount)} (${depositNumber} %) z ceny ${kc(priceNumber)}.`;
  }, [priceNumber, sendLink, depositAmount, depositNumber]);

  const create = useMutation<Result>({
    mutationFn: () =>
      sdk.client.fetch(`/admin/commission-inquiries/${inquiry.id}/create-order`, {
        method: "POST",
        body: {
          name,
          email,
          phone: phone || null,
          title,
          brief,
          price: priceNumber,
          deposit_percentage: depositNumber,
          delivery,
          ...(delivery === "post"
            ? {
                address: { address_1: street, city, postal_code: postal },
                parcel_size: parcel,
                fragile,
              }
            : {}),
          send_payment_link: priceNumber > 0 && sendLink,
          photo_urls: inquiry.photo_urls,
        },
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["commission-inquiries"] });
      setOpen(false);
      const number = result.display_id ? `#${result.display_id}` : "";
      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(`Objednávka ${number} je založená, zákazník dostal e-mail.`, {
          action: {
            label: "Otevřít",
            altText: "Otevřít objednávku",
            onClick: () => navigate(`/orders/${result.order_id}`),
          },
        });
      }
    },
    onError: (error) => toast.error(ceskaChyba(error, "Objednávku se nepodařilo založit.")),
  });

  const missing =
    !name.trim() ||
    !email.trim() ||
    !title.trim() ||
    !brief.trim() ||
    (delivery === "post" && (!street.trim() || !city.trim() || !postal.trim()));

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Vytvořit objednávku z poptávky</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          <section className="flex flex-col gap-y-3">
            <Text size="small" weight="plus">
              Zákazník
            </Text>
            <Row label="Jméno" htmlFor="io-name">
              <Input id="io-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Row>
            <Row label="E-mail" htmlFor="io-email" hint="Sem přijde potvrzení objednávky.">
              <Input id="io-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Row>
            <Row label="Telefon" htmlFor="io-phone">
              <Input id="io-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Row>
          </section>

          <section className="flex flex-col gap-y-3">
            <Text size="small" weight="plus">
              Zakázka
            </Text>
            <Row label="Název" htmlFor="io-title" hint="Tak ji zákazník uvidí v e-mailu a na faktuře.">
              <Input id="io-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Row>
            <Row label="Zadání" htmlFor="io-brief">
              <Textarea id="io-brief" rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} />
            </Row>
            {inquiry.photo_urls.length > 0 && (
              <Row label="Fotky">
                <div className="flex flex-wrap gap-2">
                  {inquiry.photo_urls.slice(0, 8).map((url) => (
                    <img key={url} src={url} alt="" className="size-14 rounded-md object-cover" />
                  ))}
                </div>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Přejdou k zakázce jako zadání od zákazníka.
                </Text>
              </Row>
            )}
          </section>

          <section className="flex flex-col gap-y-3">
            <Text size="small" weight="plus">
              Cena a doprava
            </Text>
            <Row label="Cena" htmlFor="io-price" hint="0 = cenu pošlete později z objednávky.">
              <div className="relative w-40">
                <Input
                  id="io-price"
                  inputMode="decimal"
                  placeholder="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pr-9"
                />
                <span className="text-ui-fg-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  Kč
                </span>
              </div>
            </Row>
            <Row label="Záloha" htmlFor="io-deposit" hint="Výroba začne až po zaplacení zálohy (nejvýš 50 %).">
              <div className="relative w-24">
                <Input
                  id="io-deposit"
                  inputMode="numeric"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="pr-7"
                />
                <span className="text-ui-fg-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  %
                </span>
              </div>
            </Row>
            <Row label="Doprava">
              <Segmented
                label="Doprava"
                value={delivery}
                onChange={(value) => setDelivery(value as "pickup" | "post")}
                options={[
                  { value: "pickup", label: "Osobní odběr" },
                  { value: "post", label: "Česká pošta" },
                ]}
              />
            </Row>
            {delivery === "post" && (
              <>
                <Row label="Ulice a číslo" htmlFor="io-street">
                  <Input id="io-street" value={street} onChange={(e) => setStreet(e.target.value)} />
                </Row>
                <Row label="Město a PSČ" htmlFor="io-city">
                  <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                    <Input id="io-city" placeholder="Město" value={city} onChange={(e) => setCity(e.target.value)} />
                    <Input placeholder="397 01" value={postal} onChange={(e) => setPostal(e.target.value)} />
                  </div>
                </Row>
                <Row label="Zásilka" hint="Podle velikosti se spočítá poštovné z ceníku dopravy.">
                  <div className="flex flex-wrap items-center gap-4">
                    <Segmented
                      label="Velikost zásilky"
                      value={parcel}
                      onChange={(value) => setParcel(value as "male" | "velke")}
                      options={[
                        { value: "male", label: "Malá" },
                        { value: "velke", label: "Velká" },
                      ]}
                    />
                    <label className="flex items-center gap-2">
                      <Switch checked={fragile} onCheckedChange={setFragile} />
                      <Text size="small">Křehké</Text>
                    </label>
                  </div>
                </Row>
              </>
            )}
            {priceNumber > 0 && (
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={sendLink}
                  onCheckedChange={(value) => setSendLink(value === true)}
                  className="mt-0.5"
                />
                <Text size="small">Poslat zákazníkovi odkaz k zaplacení zálohy</Text>
              </label>
            )}
          </section>
        </Drawer.Body>
        <Drawer.Footer className="flex-col items-stretch gap-y-3 sm:flex-row sm:items-center sm:justify-between">
          <Text size="small" className="text-ui-fg-subtle max-w-md">
            {summary}
          </Text>
          <div className="flex shrink-0 gap-x-2">
            <Drawer.Close asChild>
              <Button size="small" variant="secondary">
                Zrušit
              </Button>
            </Drawer.Close>
            <Button
              size="small"
              isLoading={create.isPending}
              disabled={missing}
              onClick={() => create.mutate()}
            >
              Vytvořit objednávku
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
