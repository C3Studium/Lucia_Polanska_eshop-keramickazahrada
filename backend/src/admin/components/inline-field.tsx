import { Input, Text, Textarea, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";

/**
 * Inline editing, the Balení+ way, generalized (product detail page).
 *
 * One rule everywhere: typing is local, leaving the field saves it. Enter
 * blurs (single save path), an unchanged value never writes, the field is
 * disabled while its own save runs, and after the refetch the local state
 * re-syncs to whatever was actually stored. No modals, no edit buttons.
 */

type InlineTextProps = {
  value: string | null | undefined;
  onSave: (next: string) => Promise<unknown>;
  placeholder?: string;
  /** Refuse to save an empty value (e.g. the product title). */
  required?: boolean;
  className?: string;
  inputClassName?: string;
};

export const InlineText = ({
  value,
  onSave,
  placeholder,
  required,
  className,
  inputClassName,
}: InlineTextProps) => {
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  // The page refetches after every save; without this the field would keep
  // showing what was typed rather than what was stored.
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = async () => {
    const next = draft.trim();
    if (next === (value ?? "").trim()) {
      return;
    }
    if (required && !next) {
      setDraft(value ?? "");
      toast.error("Tohle pole nemůže zůstat prázdné.");
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      // The caller's mutation already surfaced the error as a toast.
      setDraft(value ?? "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <Input
        size="small"
        value={draft}
        placeholder={placeholder}
        className={inputClassName}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        disabled={saving}
      />
    </div>
  );
};

type InlineTextareaProps = {
  value: string | null | undefined;
  onSave: (next: string) => Promise<unknown>;
  placeholder?: string;
  rows?: number;
};

export const InlineTextarea = ({
  value,
  onSave,
  placeholder,
  rows = 5,
}: InlineTextareaProps) => {
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = async () => {
    if (draft.trim() === (value ?? "").trim()) {
      return;
    }
    setSaving(true);
    try {
      await onSave(draft.trim());
    } catch {
      // The caller's mutation already surfaced the error as a toast.
      setDraft(value ?? "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Textarea
      value={draft}
      placeholder={placeholder}
      rows={rows}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      disabled={saving}
    />
  );
};

type InlineNumberProps = {
  value: number | null | undefined;
  onSave: (next: number | null) => Promise<unknown>;
  /** Suffix rendered after the input, e.g. "Kč" or "g". */
  unit?: string;
  placeholder?: string;
  /** When false, clearing the field is refused instead of saving null. */
  allowEmpty?: boolean;
  min?: number;
  inputClassName?: string;
};

export const InlineNumber = ({
  value,
  onSave,
  unit,
  placeholder,
  allowEmpty = true,
  min = 0,
  inputClassName = "w-28",
}: InlineNumberProps) => {
  const asText = (input: number | null | undefined) =>
    input === null || input === undefined ? "" : String(input);
  const [draft, setDraft] = useState(asText(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(asText(value));
  }, [value]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === asText(value)) {
      return;
    }
    if (!trimmed) {
      if (!allowEmpty) {
        setDraft(asText(value));
        toast.error("Tohle pole nemůže zůstat prázdné.");
        return;
      }
      setSaving(true);
      try {
        await onSave(null);
      } catch {
        setDraft(asText(value));
      } finally {
        setSaving(false);
      }
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < min) {
      setDraft(asText(value));
      toast.error("Zadejte prosím kladné číslo.");
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed);
    } catch {
      setDraft(asText(value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        size="small"
        type="number"
        min={min}
        value={draft}
        placeholder={placeholder}
        className={inputClassName}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        disabled={saving}
      />
      {unit && (
        <Text size="xsmall" className="text-ui-fg-muted">
          {unit}
        </Text>
      )}
    </div>
  );
};
