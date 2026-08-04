import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { 
  createDataTableColumnHelper, 
  Container, 
  DataTable, 
  useDataTable, 
  Heading, 
  createDataTableCommandHelper, 
  DataTableRowSelectionState, 
  StatusBadge, 
  Text,
  Toaster, 
  toast,
  DataTablePaginationState
} from "@medusajs/ui"
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query"
// Použijeme obyčejný <a> místo Link, abychom nevyžadovali Router kontext
import { useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"
import { HttpTypes } from "@medusajs/framework/types"

type Review = {
  id: string
  title?: string
  content: string
  rating: number
  product_id: string
  customer_id?: string
  status: "čeká na schválení" | "schváleno" | "zamítnuto"
  created_at: Date
  updated_at: Date
  product?: HttpTypes.AdminProduct
  customer?: HttpTypes.AdminCustomer
}


const columnHelper = createDataTableColumnHelper<Review>()

const columns = [
  columnHelper.select(),
  columnHelper.accessor("id", {
    header: "ID",
  }),
  columnHelper.accessor("title", {
    header: "Název",
  }),
  columnHelper.accessor("rating", {
    header: "Hodnocení", 
  }),
  columnHelper.accessor("content", {
    header: "Obsah"
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ row }) => {
      const color = row.original.status === "schváleno" ? 
        "green" : row.original.status === "zamítnuto" 
        ? "red" : "grey"
      return (
        <StatusBadge color={color}>
          {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
          </StatusBadge>
      )
    }
  }),
  columnHelper.accessor("product", {
    header: "Product",
    cell: ({ row }) => {
      return (
        <a href={`/app/products/${row.original.product_id}`} className="text-ui-fg-interactive">
          {row.original.product?.title}
        </a>
      )
    }
  }),
]

const commandHelper = createDataTableCommandHelper()

const useCommands = (refetch: () => void) => {
  return [
    commandHelper.command({
      label: "Schválit",
      shortcut: "A",
      action: async (selection) => {
        const reviewsToApproveIds = Object.keys(selection)

        sdk.client.fetch("/admin/reviews/status", {
          method: "POST",
          body: {
            ids: reviewsToApproveIds,
            status: "schváleno"
          }
        }).then(() => {
          toast.success("Recenze schválena/y")
          refetch()
        }).catch(() => {
          toast.error("Nepodařilo se schválit recenze")
        })
      }
    }),
    commandHelper.command({
      label: "Zamítnout",
      shortcut: "R",
      action: async (selection) => {
        const reviewsToRejectIds = Object.keys(selection)

        sdk.client.fetch("/admin/reviews/status", {
          method: "POST",
          body: {
            ids: reviewsToRejectIds,
            status: "zamítnuto"
          }
        }).then(() => {
          toast.success("Recenze zamítnuta/y")
          refetch()
        }).catch(() => {
          toast.error("Nepodařilo se zamítnout recenze")
        })
      }
    })
  ]
}


const limit = 15

const queryClient = new QueryClient()

const ReviewsPageInner = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageSize: limit,
    pageIndex: 0
  })
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({})

  const offset = useMemo(() => {
    return pagination.pageIndex * limit
  }, [pagination])

  const { data, isLoading, isError, refetch } = useQuery<{
    reviews: Review[]
    count: number
    limit: number
    offset: number
  }>({
    queryKey: ["reviews", offset, limit],
    queryFn: () => sdk.client.fetch("/admin/reviews", {
      query: {
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        order: "-created_at"
      }
    })
  })

  const commands = useCommands(refetch)

  const table = useDataTable({
    columns,
    data: data?.reviews || [],
    rowCount: data?.count ?? data?.reviews?.length ?? 0,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination
    },
    commands,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: setRowSelection
    },
    getRowId: (row) => row.id
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 px-6 py-5 md:flex-row md:items-center">
          <div>
            <Heading>Recenze</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Schvalujte zkušenosti zákazníků před zveřejněním v obchodě.
            </Text>
          </div>
        </DataTable.Toolbar>
        {isError ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <Heading level="h2">Recenze se nepodařilo načíst</Heading>
            <Text size="small" className="text-ui-fg-error mt-1">
              Obnovte stránku a zkuste to znovu.
            </Text>
          </div>
        ) : (
          <>
            <DataTable.Table />
            <DataTable.Pagination />
            <DataTable.CommandBar selectedLabel={(count) => `${count} vybráno`} />
          </>
        )}
      </DataTable>
      <Toaster />
    </Container>
  )
}

const ReviewsPage = () => (
  <QueryClientProvider client={queryClient}>
    <ReviewsPageInner />
  </QueryClientProvider>
)

// Promoted out of "/products" to a top-level item so it can sit next to Orders in the
// client's requested workflow order (Denní práce, Orders, Reviews, Promotions, Price
// lists, Products, Inventory, Customers). `rank` only orders this item relative to our
// other top-level extension items (Denní práce, Sanity CMS, Segment Analytics) — it
// cannot interleave with native core items. See docs/denni-prace-audit.md §9.3 for why.
export const config = defineRouteConfig({
  label: "Recenze",
  icon: ChatBubbleLeftRight,
  rank: 10,
})

export default ReviewsPage
