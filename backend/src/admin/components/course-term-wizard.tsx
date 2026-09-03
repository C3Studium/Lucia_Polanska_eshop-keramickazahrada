import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Switch,
  Text,
  toast,
} from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CZECH_WEEKLY_PHRASES,
  horizonEndDayKey,
  planMultiDayOccurrences,
  type RepeatHorizon,
} from "../../modules/course/recurrence";
import { mondayIndex, parseDayKey, pragueDayKey } from "../lib/course-calendar";
import { sdk } from "../lib/sdk";
import { formatCzk } from "../lib/workbench";
import { CourseDayPicker } from "./course-day-picker";

/**
 * „Nový termín" in two steps: when, then how much.
 *
 * The old drawer asked everything at once — name, place, a typed date, three
 * pricing tiers and a participant note in one scroll — and the pricing half
 * was the part that made the owner stop and think while she was still
 * deciding on a date. Splitting it means step 1 answers one question
 * („kdy se to koná?") and step 2 answers the other.
 *
 * The calendar is the substantive change. Picking days directly means one
 * pass can open a whole month of sessions, and „opakovat každý týden" now
 * composes with it: every picked day grows its own weekly series and the
 * union is what gets created (`modules/course/recurrence.ts`). The preview
 * count runs that very function, so the „vznikne 12 termínů" line and the
 * rows the server writes cannot drift apart.
 */

type Step = "kdy" | "ceny";

type WizardDraft = {
  title: string;
  location: string;
  days: string[];
  time: string;
  duration_minutes: string;
  capacity: string;
  status: "draft" | "published";
  price_single: string;
  price_two: string;
  group_min: string;
  price_group_per_person: string;
};

const emptyDraft: WizardDraft = {
  title: "",
  location: "Ateliér u Písku",
  days: [],
  time: "17:00",
  duration_minutes: "180",
  capacity: "8",
  status: "published",
  price_single: "",
  price_two: "",
  group_min: "",
  price_group_per_person: "",
};

/** The „Do kdy" pills — fixed horizons plus a custom end date. */
const HORIZON_OPTIONS: { key: RepeatHorizon | "vlastni"; label: string }[] = [
  { key: "tento_mesic", label: "Tento měsíc" },
  { key: "ctvrt_roku", label: "Čtvrt roku" },
  { key: "pul_roku", label: "Půl roku" },
  { key: "rok", label: "Rok" },
  { key: "vlastni", label: "Vlastní konec" },
];

const parseAmount = (value: string): number | null => {
  const trimmed = value.replace(/\s/g, "").replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const errorMessage = async (error: unknown, fallback: string) => {
  const response = (error as { response?: { json?: () => Promise<unknown> } })
    ?.response;
  try {
    const body = (await response?.json?.()) as { message?: string } | undefined;
    if (body?.message) return body.message;
  } catch {
    // Fall through to the generic sentence.
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const termCountLabel = (count: number): string =>
  count === 1
    ? "1 termín"
    : count < 5
      ? `${count} termíny`
      : `${count} termínů`;

type CreateResult = {
  created: number;
  skipped: number;
  skipped_dates: string[];
  failed: number;
  failed_dates: string[];
  truncated: boolean;
};

const resultMessage = (result: CreateResult): string => {
  const created =
    result.created === 0
      ? "Žádný nový termín nevznikl"
      : `Vytvořeno ${termCountLabel(result.created)}`;
  const skipped = !result.skipped
    ? ""
    : `, ${result.skipped} přeskočeno — už existovalo`;
  return `${created}${skipped}.`;
};

export const CourseTermWizard = ({
  termCounts,
  trigger,
}: {
  /** Day key → existing term count, so the calendar can warn before a clash. */
  termCounts: Map<string, number>;
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("kdy");
  const [draft, setDraft] = useState<WizardDraft>(emptyDraft);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [horizon, setHorizon] = useState<RepeatHorizon | "vlastni">(
    "tento_mesic"
  );
  const [customEnd, setCustomEnd] = useState("");
  const queryClient = useQueryClient();

  const openWith = (next: boolean) => {
    if (next) {
      setStep("kdy");
      setDraft(emptyDraft);
      setRepeatWeekly(false);
      setHorizon("tento_mesic");
      setCustomEnd("");
    }
    setOpen(next);
  };

  const set = (patch: Partial<WizardDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const todayKey = pragueDayKey(new Date().toISOString());

  /*
   * The repeat horizon is anchored on the earliest picked day: „půl roku"
   * counted from anywhere else would end at a date the owner never named.
   */
  const anchorIso = useMemo(() => {
    if (!draft.days.length) return "";
    return `${draft.days.slice().sort()[0]}T12:00:00.000Z`;
  }, [draft.days]);

  const untilKey = !repeatWeekly
    ? null
    : horizon === "vlastni"
      ? customEnd || null
      : anchorIso
        ? horizonEndDayKey(anchorIso, horizon)
        : null;

  const plan = useMemo(
    () =>
      draft.days.length
        ? planMultiDayOccurrences(draft.days, draft.time, untilKey)
        : null,
    [draft.days, draft.time, untilKey]
  );

  /** „každé úterý" — only meaningful when every picked day is the same weekday. */
  const weeklyPhrase = useMemo(() => {
    if (!repeatWeekly || !draft.days.length) return null;
    const indexes = new Set(
      draft.days.map((key) => {
        const { year, month, day } = parseDayKey(key);
        return mondayIndex(year, month, day);
      })
    );
    return indexes.size === 1
      ? CZECH_WEEKLY_PHRASES[Array.from(indexes)[0]]
      : "každý týden ve vybrané dny";
  }, [repeatWeekly, draft.days]);

  const stepOneProblems: string[] = [];
  if (!draft.title.trim()) stepOneProblems.push("Chybí název kurzu.");
  if (!draft.location.trim()) stepOneProblems.push("Chybí místo konání.");
  if (!draft.days.length)
    stepOneProblems.push("Vyberte v kalendáři aspoň jeden den.");
  if (plan && !plan.ok) {
    stepOneProblems.push(
      plan.reason === "invalid_time"
        ? "Čas začátku zadejte ve tvaru 17:00."
        : "Některý z vybraných dnů není platné datum."
    );
  }
  if (repeatWeekly && !untilKey)
    stepOneProblems.push("Vyplňte, do kdy se má opakovat.");
  const capacity = Number(draft.capacity);
  if (!Number.isInteger(capacity) || capacity < 1)
    stepOneProblems.push("Kapacita musí být aspoň 1 osoba.");

  const priceSingle = parseAmount(draft.price_single);
  const groupMin = parseAmount(draft.group_min);
  const groupPrice = parseAmount(draft.price_group_per_person);
  const stepTwoProblems: string[] = [];
  if (priceSingle == null || priceSingle < 0)
    stepTwoProblems.push("Chybí cena za jednoho.");
  if ((groupMin == null) !== (groupPrice == null))
    stepTwoProblems.push(
      "Skupinová cena potřebuje obojí: od kolika lidí platí i kolik zaplatí osoba."
    );

  const create = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/courses/terms`, {
        method: "POST",
        body: {
          title: draft.title.trim(),
          location: draft.location.trim(),
          days: draft.days,
          time: draft.time,
          duration_minutes: parseAmount(draft.duration_minutes),
          capacity,
          price_single: priceSingle,
          price_two: parseAmount(draft.price_two),
          group_min: groupMin,
          price_group_per_person: groupPrice,
          status: draft.status,
          ...(repeatWeekly && untilKey
            ? { repeat: { frequency: "weekly", until: untilKey } }
            : {}),
        },
      }),
    onSuccess: async (result: unknown) => {
      await queryClient.invalidateQueries({ queryKey: ["course-terms"] });
      const outcome = result as CreateResult;
      const suffix =
        draft.status === "published"
          ? " Zákazníci je hned vidí na webu."
          : " Uložené jako koncepty — na webu zatím nejsou.";
      if (outcome.created > 0) {
        toast.success(resultMessage(outcome) + suffix);
      } else {
        toast.warning(resultMessage(outcome));
      }
      if (outcome.failed > 0) {
        toast.warning(
          `Nepodařilo se vytvořit ${outcome.failed} termínů. Zkuste je vypsat jednotlivě.`
        );
      }
      setOpen(false);
    },
    onError: async (error) =>
      toast.error(await errorMessage(error, "Termíny se nepodařilo vytvořit")),
  });

  const plannedCount = plan?.ok ? plan.occurrences.length : 0;

  return (
    <Drawer open={open} onOpenChange={openWith}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>
            {step === "kdy" ? "Nový termín — kdy" : "Nový termín — ceny"}
          </Drawer.Title>
          <Drawer.Description>
            {step === "kdy"
              ? "Naklikejte v kalendáři dny, kdy se kurz koná. Čas a délka platí pro všechny vybrané dny."
              : "Každá cena je za jednoho člověka. Cena za dva a skupinová cena jsou nepovinné."}
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          {step === "kdy" ? (
            <div className="flex flex-col gap-y-6">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="wizard-title">Název</Label>
                <Input
                  id="wizard-title"
                  placeholder="Kurz točení pro dospělé"
                  value={draft.title}
                  onChange={(event) => set({ title: event.target.value })}
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label htmlFor="wizard-location">Kde</Label>
                <Input
                  id="wizard-location"
                  value={draft.location}
                  onChange={(event) => set({ location: event.target.value })}
                />
              </div>

              <div className="flex flex-col gap-y-3">
                <Label>Kdy — vyberte dny</Label>
                <CourseDayPicker
                  selected={draft.days}
                  onChange={(days) => set({ days })}
                  termCounts={termCounts}
                  minDayKey={todayKey}
                  emptyHint="Klikněte na dny, kdy se kurz koná. Tečka označuje den, kde už nějaký termín je."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="wizard-time">Čas začátku</Label>
                  <Input
                    id="wizard-time"
                    type="time"
                    value={draft.time}
                    onChange={(event) => set({ time: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="wizard-duration">Délka (minuty)</Label>
                  <Input
                    id="wizard-duration"
                    inputMode="numeric"
                    value={draft.duration_minutes}
                    onChange={(event) =>
                      set({ duration_minutes: event.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="wizard-capacity">Kapacita (osob)</Label>
                  <Input
                    id="wizard-capacity"
                    inputMode="numeric"
                    value={draft.capacity}
                    onChange={(event) => set({ capacity: event.target.value })}
                  />
                </div>
              </div>

              <div className="border-ui-border-base flex flex-col gap-y-3 border-t pt-6">
                <div className="flex items-center gap-x-3">
                  <Switch
                    id="wizard-repeat"
                    checked={repeatWeekly}
                    onCheckedChange={setRepeatWeekly}
                  />
                  <Label htmlFor="wizard-repeat">Opakovat každý týden</Label>
                </div>
                <Text size="small" className="text-ui-fg-muted">
                  Z každého vybraného dne vznikne řada termínů — vždy stejný den
                  v týdnu a stejný čas. Každý termín pak žije sám za sebe:
                  upravíte nebo zrušíte jeden, ostatních se to nedotkne.
                </Text>

                {repeatWeekly ? (
                  <div className="flex flex-col gap-y-3">
                    <div className="flex flex-wrap gap-2">
                      {HORIZON_OPTIONS.map((option) => (
                        <Button
                          key={option.key}
                          type="button"
                          size="small"
                          variant={
                            horizon === option.key ? "primary" : "secondary"
                          }
                          onClick={() => setHorizon(option.key)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                    {horizon === "vlastni" ? (
                      <div className="flex flex-col gap-y-2">
                        <Label htmlFor="wizard-until" size="small">
                          Opakovat do
                        </Label>
                        <Input
                          id="wizard-until"
                          type="date"
                          value={customEnd}
                          onChange={(event) => setCustomEnd(event.target.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {plan?.ok && plannedCount > 0 ? (
                <div className="bg-ui-bg-subtle flex flex-col gap-y-1 rounded-lg p-3">
                  <Text size="small" weight="plus">
                    {`Vznikne ${termCountLabel(plannedCount)}.`}
                  </Text>
                  {weeklyPhrase ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {`Opakuje se ${weeklyPhrase} v ${draft.time}.`}
                    </Text>
                  ) : null}
                  {plan.truncated ? (
                    <Text size="small" className="text-ui-orange-fg">
                      Delší období najednou nejde — vytvoří se prvních 60
                      termínů, zbytek vypište znovu později.
                    </Text>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-y-2">
                <Label htmlFor="wizard-status">Stav</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    set({ status: value as "draft" | "published" })
                  }
                >
                  <Select.Trigger id="wizard-status">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="published">
                      Vypsaný — lze rezervovat
                    </Select.Item>
                    <Select.Item value="draft">
                      Koncept — na webu není
                    </Select.Item>
                  </Select.Content>
                </Select>
              </div>

              {stepOneProblems.length ? (
                <div className="flex flex-col gap-y-1">
                  {stepOneProblems.map((problem) => (
                    <Text
                      key={problem}
                      size="small"
                      className="text-ui-fg-muted"
                    >
                      · {problem}
                    </Text>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-y-6">
              <div className="bg-ui-bg-subtle rounded-lg p-3">
                <Text size="small" className="text-ui-fg-subtle">
                  {`Ceny se použijí na všech ${termCountLabel(plannedCount)}, které teď vzniknou. Později je jde kdykoliv změnit tlačítkem Ceny — i hromadně.`}
                </Text>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="wizard-price-single">
                    Cena za jednoho (Kč)
                  </Label>
                  <Input
                    id="wizard-price-single"
                    inputMode="decimal"
                    value={draft.price_single}
                    onChange={(event) =>
                      set({ price_single: event.target.value })
                    }
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Kolik zaplatí ten, kdo přijde sám.
                  </Text>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="wizard-price-two">
                    Cena za dva — za osobu (Kč)
                  </Label>
                  <Input
                    id="wizard-price-two"
                    inputMode="decimal"
                    placeholder="nepovinné"
                    value={draft.price_two}
                    onChange={(event) => set({ price_two: event.target.value })}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Když přijdou dva spolu, tolik zaplatí každý z nich.
                  </Text>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="wizard-group-min">Skupina od (osob)</Label>
                  <Input
                    id="wizard-group-min"
                    inputMode="numeric"
                    placeholder="nepovinné"
                    value={draft.group_min}
                    onChange={(event) => set({ group_min: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="wizard-group-price">
                    Skupinová cena — za osobu (Kč)
                  </Label>
                  <Input
                    id="wizard-group-price"
                    inputMode="decimal"
                    placeholder="nepovinné"
                    value={draft.price_group_per_person}
                    onChange={(event) =>
                      set({ price_group_per_person: event.target.value })
                    }
                  />
                </div>
              </div>

              {priceSingle != null ? (
                <div className="bg-ui-bg-subtle flex flex-col gap-y-1 rounded-lg p-3">
                  <Text size="small" className="text-ui-fg-subtle">
                    {`Jeden sám zaplatí ${formatCzk(priceSingle)}.`}
                  </Text>
                  {parseAmount(draft.price_two) != null ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {`Dva spolu zaplatí 2 × ${formatCzk(
                        parseAmount(draft.price_two)!
                      )} = ${formatCzk(
                        parseAmount(draft.price_two)! * 2
                      )} dohromady.`}
                    </Text>
                  ) : null}
                  {groupMin != null && groupMin >= 2 && groupPrice != null ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      {`Skupina ${groupMin} lidí zaplatí ${groupMin} × ${formatCzk(
                        groupPrice
                      )} = ${formatCzk(groupMin * groupPrice)} dohromady.`}
                    </Text>
                  ) : null}
                </div>
              ) : null}

              {stepTwoProblems.length ? (
                <div className="flex flex-col gap-y-1">
                  {stepTwoProblems.map((problem) => (
                    <Text
                      key={problem}
                      size="small"
                      className="text-ui-fg-muted"
                    >
                      · {problem}
                    </Text>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </Drawer.Body>

        <Drawer.Footer>
          {step === "kdy" ? (
            <>
              <Drawer.Close asChild>
                <Button variant="secondary">Zrušit</Button>
              </Drawer.Close>
              <Button
                disabled={stepOneProblems.length > 0}
                onClick={() => setStep("ceny")}
              >
                Dál — ceny
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep("kdy")}>
                Zpět
              </Button>
              <Button
                disabled={stepTwoProblems.length > 0 || create.isPending}
                isLoading={create.isPending}
                onClick={() => create.mutate()}
              >
                {`Vytvořit ${termCountLabel(plannedCount)}`}
              </Button>
            </>
          )}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
