import { Button, toast } from "@medusajs/ui"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { ConfirmDialog } from "./confirm-dialog"

type DeleteBundledProductProps = {
  id: string
}

const DeleteBundledProduct = ({ id }: DeleteBundledProductProps) => {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { mutateAsync: deleteBundle, isPending } = useMutation({
    mutationFn: async () => {
      await sdk.client.fetch(`/admin/bundled-products/${id}`, {
        method: "DELETE",
      })
    },
  })

  const handleDelete = async () => {
    try {
      await deleteBundle()
      setOpen(false)
      toast.success("Balíček smazán")
      queryClient.invalidateQueries({ queryKey: ["bundled-products"] })
    } catch {
      toast.error("Nepodařilo se smazat balíček")
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="secondary">Smazat</Button>}
      title="Smazat balíček?"
      consequence="Smazání nejde vrátit."
      confirmLabel="Smazat balíček"
      isPending={isPending}
      onConfirm={(event) => {
        // Zavře se až po úspěchu — při chybě zůstane otevřené.
        event.preventDefault()
        void handleDelete()
      }}
    />
  )
}

export default DeleteBundledProduct