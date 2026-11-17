import { Text } from "@medusajs/ui";
import { useMutationState } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

/**
 * „Ukládám… / ✓ Uloženo" v hlavičce detailu výrobku (17. 11. 2026).
 *
 * Nahrazuje stálou větu „Změny se ukládají samy — stačí opustit pole…",
 * která v hlavičce pořád svítila. Stránka ukládá sama po opuštění pole;
 * teď to řekne jen ve chvíli, kdy se doopravdy ukládá. Chybu hlásí toast
 * mutace, proto se po chybě „Uloženo" neukáže.
 *
 * Navíc pojistka: dokud se ukládá, zavření záložky se zeptá — jinak by
 * rozepsaná změna, která právě odchází na server, mohla zmizet.
 */
export const SaveIndicator = () => {
  const mutations = useMutationState({
    select: (mutation) => ({
      status: mutation.state.status,
      at: mutation.state.submittedAt,
    }),
  });
  const pending = mutations.some((mutation) => mutation.status === "pending");
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setSaved(false);
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    const latest = [...mutations].sort((a, b) => b.at - a.at)[0];
    if (latest?.status !== "success") return;
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 3000);
    return () => window.clearTimeout(timer);
    // Schválně jen `pending`: zajímá nás přechod „ukládá se → hotovo".
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  return (
    <Text
      size="xsmall"
      aria-live="polite"
      title="Změny se ukládají samy — stačí opustit pole nebo přepnout přepínač."
      className={`min-h-[20px] transition-opacity ${
        saved ? "text-ui-tag-green-text" : "text-ui-fg-muted"
      } ${pending || saved ? "opacity-100" : "opacity-0"}`}
    >
      {pending ? "Ukládám…" : saved ? "✓ Uloženo" : " "}
    </Text>
  );
};
