import {
  Button,
  Drawer,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../lib/sdk";
import { formatCzk } from "../lib/workbench";
import {
  CourseScopePicker,
  emptyScopeState,
  scopeToPayload,
  type ScopeState,
  type ScopeTerm,
} from "./course-scope-picker";

/**
 * The two edits that were buried in the term drawer, each with its own door.
 *
 * The old „Nový termín" drawer asked for when, how many, how much and what to
 * tell people, all in one scroll — so the owner met the pricing tiers while
 * still deciding on a date, and the participant note (which goes out in the
 * reminder e-mail) sat below the fold of a form she opened to fix a time.
 *
 * Splitting them is not only tidiness. Both of these are things she changes
 * *for a season*, not for a session, which is why each carries a scope picker
 * and the term drawer no longer carries them at all.
 */

export type BulkTerm = ScopeTerm & {
  price_single: number;
  price_two: number | null;
  group_min: number | null;
  price_group_per_person: number | null;
  note: string | null;
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

/** "" → null, "1 200" / "1200,50" → number. */
const parseAmount = (value: string): number | null => {
  const trimmed = value.replace(/\s/g, "").replace(",", ".");
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const amountToInput = (value: number | null): string =>
  value == null ? "" : String(value);

/* ------------------------------------------------------------------ */
/* Ceny                                                                */
/* ------------------------------------------------------------------ */

type PricingDraft = {
  price_single: string;
  price_two: string;
  group_min: string;
  price_group_per_person: string;
};

const pricingDraftOf = (term: BulkTerm): PricingDraft => ({
  price_single: amountToInput(term.price_single),
  price_two: amountToInput(term.price_two),
  group_min: amountToInput(term.group_min),
  price_group_per_person: amountToInput(term.price_group_per_person),
});

/** The tiers restated as arithmetic — labels alone leave „za dva = dohromady?" open. */
const pricingExampleLines = (draft: PricingDraft): string[] => {
  const lines: string[] = [];
  const single = parseAmount(draft.price_single);
  if (single != null) {
    lines.push(`Jeden sám zaplatí ${formatCzk(single)}.`);
  }
  const two = parseAmount(draft.price_two);
  if (two != null) {
    lines.push(
      `Dva spolu zaplatí 2 × ${formatCzk(two)} = ${formatCzk(two * 2)} dohromady.`
    );
  }
  const groupMin = parseAmount(draft.group_min);
  const groupPrice = parseAmount(draft.price_group_per_person);
  if (groupMin != null && groupMin >= 2 && groupPrice != null) {
    lines.push(
      `Skupina ${groupMin} lidí zaplatí ${groupMin} × ${formatCzk(
        groupPrice
      )} = ${formatCzk(groupMin * groupPrice)} dohromady.`
    );
  }
  return lines;
};

export const CoursePricingDrawer = ({
  term,
  terms,
  trigger,
}: {
  term: BulkTerm;
  terms: BulkTerm[];
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PricingDraft>(() => pricingDraftOf(term));
  const [scope, setScope] = useState<ScopeState>(emptyScopeState);
  const queryClient = useQueryClient();

  const openWith = (next: boolean) => {
    if (next) {
      setDraft(pricingDraftOf(term));
      setScope(emptyScopeState);
    }
    setOpen(next);
  };

  const set = (patch: Partial<PricingDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const baseline = pricingDraftOf(term);
  /*
   * Only what the owner actually touched is written. Opening this on a 500 Kč
   * term, changing nothing but the pair price and applying it to the whole
   * autumn must not quietly drag every other term's single price to 500.
   */
  const patch: Record<string, number | null> = {};
  if (draft.price_single !== baseline.price_single) {
    patch.price_single = parseAmount(draft.price_single);
  }
  if (draft.price_two !== baseline.price_two) {
    patch.price_two = parseAmount(draft.price_two);
  }
  if (draft.group_min !== baseline.group_min) {
    patch.group_min = parseAmount(draft.group_min);
  }
  if (draft.price_group_per_person !== baseline.price_group_per_person) {
    patch.price_group_per_person = parseAmount(draft.price_group_per_person);
  }

  const payload = scopeToPayload(scope, term.id, terms);
  const problems: string[] = [];
  if (!Object.keys(patch).length) {
    problems.push("Zatím jste žádnou cenu nezměnili.");
  }
  if (patch.price_single !== undefined && (patch.price_single ?? -1) < 0) {
    problems.push("Cena za jednoho musí být číslo.");
  }
  const groupMin = "group_min" in patch ? patch.group_min : term.group_min;
  const groupPrice =
    "price_group_per_person" in patch
      ? patch.price_group_per_person
      : term.price_group_per_person;
  if ((groupMin == null) !== (groupPrice == null)) {
    problems.push(
      "Skupinová cena potřebuje obojí: od kolika lidí platí i kolik zaplatí osoba."
    );
  }
  if (!payload) {
    problems.push("Vyberte, kterých termínů se změna týká.");
  }

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/courses/terms/bulk`, {
        method: "POST",
        body: { scope: payload, patch },
      }),
    onSuccess: async (result: unknown) => {
      await queryClient.invalidateQueries({ queryKey: ["course-terms"] });
      const updated = (result as { updated?: number })?.updated ?? 0;
      const overbooked =
        (result as { skipped_overbooked_titles?: string[] })
          ?.skipped_overbooked_titles ?? [];
      toast.success(
        updated === 1
          ? "Ceny upraveny u 1 termínu."
          : `Ceny upraveny u ${updated} termínů.`
      );
      if (overbooked.length) {
        toast.warning(
          `Beze změny zůstaly: ${overbooked.join(", ")} — už je tam víc rezervací.`
        );
      }
      setOpen(false);
    },
    onError: async (error) =>
      toast.error(await errorMessage(error, "Ceny se nepodařilo uložit")),
  });

  const examples = pricingExampleLines(draft);

  return (
    <Drawer open={open} onOpenChange={openWith}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Ceny</Drawer.Title>
          <Drawer.Description>
            Každá cena je za jednoho člověka. Cena za dva a skupinová cena jsou
            nepovinné — bez nich platí každý cenu za jednoho.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="price-single">Cena za jednoho (Kč)</Label>
                <Input
                  id="price-single"
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
                <Label htmlFor="price-two">Cena za dva — za osobu (Kč)</Label>
                <Input
                  id="price-two"
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
                <Label htmlFor="group-min">Skupina od (osob)</Label>
                <Input
                  id="group-min"
                  inputMode="numeric"
                  placeholder="nepovinné"
                  value={draft.group_min}
                  onChange={(event) => set({ group_min: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="group-price">
                  Skupinová cena — za osobu (Kč)
                </Label>
                <Input
                  id="group-price"
                  inputMode="decimal"
                  placeholder="nepovinné"
                  value={draft.price_group_per_person}
                  onChange={(event) =>
                    set({ price_group_per_person: event.target.value })
                  }
                />
              </div>
            </div>

            {examples.length ? (
              <div className="bg-ui-bg-subtle flex flex-col gap-y-1 rounded-lg p-3">
                {examples.map((line) => (
                  <Text key={line} size="small" className="text-ui-fg-subtle">
                    {line}
                  </Text>
                ))}
              </div>
            ) : null}

            <div className="border-ui-border-base border-t pt-6">
              <CourseScopePicker
                state={scope}
                onChange={setScope}
                thisTermId={term.id}
                terms={terms}
              />
            </div>

            {problems.length ? (
              <div className="flex flex-col gap-y-1">
                {problems.map((problem) => (
                  <Text key={problem} size="small" className="text-ui-fg-muted">
                    · {problem}
                  </Text>
                ))}
              </div>
            ) : null}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Zrušit</Button>
          </Drawer.Close>
          <Button
            disabled={problems.length > 0 || save.isPending}
            isLoading={save.isPending}
            onClick={() => save.mutate()}
          >
            Uložit ceny
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

/* ------------------------------------------------------------------ */
/* Poznámky                                                            */
/* ------------------------------------------------------------------ */

export const CourseNoteDrawer = ({
  term,
  terms,
  trigger,
}: {
  term: BulkTerm;
  terms: BulkTerm[];
  trigger: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(term.note ?? "");
  const [scope, setScope] = useState<ScopeState>(emptyScopeState);
  const queryClient = useQueryClient();

  const openWith = (next: boolean) => {
    if (next) {
      setNote(term.note ?? "");
      setScope(emptyScopeState);
    }
    setOpen(next);
  };

  const payload = scopeToPayload(scope, term.id, terms);

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/courses/terms/bulk`, {
        method: "POST",
        body: { scope: payload, patch: { note: note.trim() || null } },
      }),
    onSuccess: async (result: unknown) => {
      await queryClient.invalidateQueries({ queryKey: ["course-terms"] });
      const updated = (result as { updated?: number })?.updated ?? 0;
      toast.success(
        note.trim()
          ? updated === 1
            ? "Poznámka uložena u 1 termínu."
            : `Poznámka uložena u ${updated} termínů.`
          : updated === 1
            ? "Poznámka smazána u 1 termínu."
            : `Poznámka smazána u ${updated} termínů.`
      );
      setOpen(false);
    },
    onError: async (error) =>
      toast.error(await errorMessage(error, "Poznámku se nepodařilo uložit")),
  });

  return (
    <Drawer open={open} onOpenChange={openWith}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Content className="flex h-full flex-col">
        <Drawer.Header>
          <Drawer.Title>Poznámka k termínu</Drawer.Title>
          <Drawer.Description>
            Pošle se účastníkům v připomínce tři dny před kurzem — ideální místo
            pro „co s sebou". Nepište sem nic, co nemají číst zákazníci.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="term-note">Text poznámky</Label>
              <Textarea
                id="term-note"
                rows={4}
                placeholder="Vezměte si prosím ručník a přezůvky."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Prázdné pole poznámku u vybraných termínů smaže.
              </Text>
            </div>

            <div className="border-ui-border-base border-t pt-6">
              <CourseScopePicker
                state={scope}
                onChange={setScope}
                thisTermId={term.id}
                terms={terms}
              />
            </div>

            {!payload ? (
              <Text size="small" className="text-ui-fg-muted">
                · Vyberte, kterých termínů se poznámka týká.
              </Text>
            ) : null}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Zrušit</Button>
          </Drawer.Close>
          <Button
            disabled={!payload || save.isPending}
            isLoading={save.isPending}
            onClick={() => save.mutate()}
          >
            Uložit poznámku
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
