import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../lib/sdk";

/**
 * „Účet bez zákazníka" — blok v Přehledu, a jen když opravdu je co řešit.
 *
 * Přihlašovací identita, které chybí zákazník, se navenek neprojeví ničím
 * jiným než tím, že se člověk nepřihlásí správným heslem. Obchod na to
 * neupozorní, v logu je to jedna 404 mezi tisíci a zákazník to nahlásí jako
 * „nejde mi přihlášení" — načež zkusí změnit heslo, což nepomůže, protože
 * heslo nikdy problém nebylo.
 *
 * Proto to hlásí Přehled, a proto nahoře: je to účet, ke kterému se někdo
 * právě teď nedostane. Když je všechno v pořádku, blok se nevykreslí vůbec.
 *
 * Tři tlačítka odpovídají třem nálezům a **rozhoduje člověk**, ne kód:
 * obnovení smazaného zákazníka je správně u omylu, ale u žádosti o výmaz
 * údajů by bylo porušením té žádosti. Podrobněji v `lib/orphaned-auth.ts`.
 */
type Ucet = {
  identityId: string;
  email: string;
  customerId: string;
  stav: "mekce-smazany" | "jiny-zakaznik" | "chybi";
  nahradniId?: string;
};

const POPIS: Record<Ucet["stav"], string> = {
  "mekce-smazany":
    "Zákazník je smazaný jen měkce — dá se obnovit i s adresami a objednávkami.",
  "jiny-zakaznik":
    "Původní zákazník je pryč, ale pod stejným e-mailem existuje jiný.",
  chybi:
    "Zákazník v databázi není. Uvolněním e-mailu si účet jde založit znovu; staré heslo tím zanikne.",
};

export const OsireleUcty = () => {
  const queryClient = useQueryClient();

  const { data } = useQuery<{ ucty: Ucet[] }>({
    queryKey: ["osirele-ucty"],
    queryFn: () => sdk.client.fetch("/admin/osirele-ucty"),
  });

  const oprava = useMutation({
    mutationFn: (telo: { identityId: string; oprava: string }) =>
      sdk.client.fetch<{ zprava: string }>("/admin/osirele-ucty", {
        method: "POST",
        body: telo,
      }),
    onSuccess: ({ zprava }) => {
      toast.success(zprava);
      queryClient.invalidateQueries({ queryKey: ["osirele-ucty"] });
    },
    onError: () => toast.error("Opravu se nepodařilo provést."),
  });

  const ucty = data?.ucty ?? [];

  if (!ucty.length) {
    return null;
  }

  return (
    <Container className="flex flex-col gap-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <Heading level="h2">
          {ucty.length === 1 ? "Účet bez zákazníka" : "Účty bez zákazníka"}
        </Heading>
        <Badge size="2xsmall" color="red">
          {ucty.length}
        </Badge>
      </div>

      <Text size="xsmall" className="text-ui-fg-subtle">
        Přihlášení k těmto e-mailům existuje, ale zákazník k němu chybí. Člověk
        zadá správné heslo a účet nenajde — a změna hesla mu nepomůže.
      </Text>

      {ucty.map((ucet) => (
        <div
          key={ucet.identityId}
          className="flex flex-col gap-y-2 border-t border-ui-border-base pt-3"
        >
          <div>
            <Text size="small" weight="plus">
              {ucet.email}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {POPIS[ucet.stav]}
            </Text>
          </div>

          <div className="flex flex-wrap gap-x-2 gap-y-2">
            {ucet.stav === "mekce-smazany" ? (
              <Button
                size="small"
                variant="secondary"
                isLoading={oprava.isPending}
                onClick={() =>
                  oprava.mutate({ identityId: ucet.identityId, oprava: "obnovit" })
                }
              >
                Obnovit zákazníka
              </Button>
            ) : null}

            {ucet.stav === "jiny-zakaznik" ? (
              <Button
                size="small"
                variant="secondary"
                isLoading={oprava.isPending}
                onClick={() =>
                  oprava.mutate({ identityId: ucet.identityId, oprava: "prepojit" })
                }
              >
                Přepojit na existujícího
              </Button>
            ) : null}

            <Button
              size="small"
              variant="danger"
              isLoading={oprava.isPending}
              onClick={() =>
                oprava.mutate({ identityId: ucet.identityId, oprava: "uvolnit" })
              }
            >
              Uvolnit e-mail
            </Button>
          </div>
        </div>
      ))}
    </Container>
  );
};

export default OsireleUcty;
