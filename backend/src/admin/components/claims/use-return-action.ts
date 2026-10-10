import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@medusajs/ui";
import { sdk } from "../../lib/sdk";

/**
 * Jeden hook pro všechny akce nad žádostí (`POST
 * /admin/return-requests/:id/<action>`). Po úspěchu obnoví seznam, detail
 * stránky (klíč `["return-requests", "detail", id]` sdílí předponu), počty
 * v tabech i widget na detailu objednávky. Chybu ze serveru ukáže doslova —
 * server vrací srozumitelné hlášky („Vrácení peněz vyřiďte…"), tak ať je vidí.
 */
export const useReturnAction = <TResponse = unknown,>(
  requestId: string,
  action: string
) => {
  const queryClient = useQueryClient();
  return useMutation<TResponse, Error, Record<string, unknown>>({
    mutationFn: (body) =>
      sdk.client.fetch<TResponse>(
        `/admin/return-requests/${encodeURIComponent(requestId)}/${action}`,
        { method: "POST", body }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["return-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["return-requests", "counts"] }),
        queryClient.invalidateQueries({ queryKey: ["order-returns"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Akci se nepodařilo provést"
      );
    },
  });
};
