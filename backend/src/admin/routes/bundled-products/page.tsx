import { CubeSolid } from "@medusajs/icons";
import {
  Badge,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Text,
  useDataTable,
} from "@medusajs/ui";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import CreateBundledProduct from "../../components/create-bundled-product";
import DeleteBundledProduct from "../../components/delete-bundled-product";
import UpdateBundledProduct from "../../components/update-bundled-product";
import { formatDate } from "../../lib/format";
import { sdk } from "../../lib/sdk";

type BundledProduct = {
  id: string;
  title?: string | null;
  pricing_mode?: "component_sum" | "component_sum_discount" | "fixed_price";
  discount_percentage?: number | null;
  product?: {
    id?: string | null;
    title?: string | null;
    thumbnail?: string | null;
  } | null;
  items?: Array<{
    id?: string | null;
    product?: {
      id?: string | null;
      title?: string | null;
      thumbnail?: string | null;
    } | null;
    quantity?: number | null;
  }> | null;
  created_at?: string;
  updated_at?: string;
};

const ItemThumb = ({
  item,
}: {
  item: NonNullable<BundledProduct["items"]>[number];
}) => (
  <div className="bg-ui-bg-subtle shadow-borders-base flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
    {item.product?.thumbnail ? (
      <img
        src={item.product.thumbnail}
        alt=""
        className="size-full object-cover"
      />
    ) : (
      <span className="text-ui-fg-muted text-[10px] font-medium">
        {item.product?.title?.slice(0, 1).toLocaleUpperCase("cs") || "–"}
      </span>
    )}
  </div>
);

const getAdminProductHref = (productId: string) => {
  if (typeof window === "undefined") {
    return `/app/products/${productId}`;
  }

  const routeMarker = "/bundled-products";
  const markerIndex = window.location.pathname.indexOf(routeMarker);
  const adminBase =
    markerIndex >= 0
      ? window.location.pathname.slice(0, markerIndex)
      : "/app";

  return `${adminBase}/products/${productId}`;
};

const columnHelper = createDataTableColumnHelper<BundledProduct>();

const columns = [
  columnHelper.accessor("title", {
    header: "Balíček",
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col py-1">
        <Text size="small" weight="plus" className="truncate">
          {row.original.title || "Balíček bez názvu"}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted truncate font-mono">
          {row.original.id}
        </Text>
      </div>
    ),
  }),
  columnHelper.accessor("items", {
    header: "Složení",
    cell: ({ row }) => {
      const items = Array.isArray(row.original.items)
        ? row.original.items.filter(Boolean)
        : [];

      if (!items.length) {
        return <Badge color="grey">Prázdný</Badge>;
      }

      return (
        <div className="flex items-center gap-x-3">
          <div className="flex -space-x-1.5">
            {items.slice(0, 4).map((item, index) => (
              <ItemThumb key={item.id || index} item={item} />
            ))}
          </div>
          <div className="flex flex-col">
            <Text size="small" weight="plus">
              {items.length} {items.length === 1 ? "položka" : "položky"}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {items.reduce((total, item) => total + (item.quantity || 1), 0)}{" "}
              ks celkem
            </Text>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor("product", {
    header: "Produkt v katalogu",
    cell: ({ row }) => {
      const product = row.original.product;
      if (!product?.id) return <Text className="text-ui-fg-muted">—</Text>;

      return (
        <a
          href={getAdminProductHref(product.id)}
          className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover text-sm font-medium"
        >
          Otevřít produkt ↗
        </a>
      );
    },
  }),
  columnHelper.accessor("pricing_mode", {
    header: "Cena",
    cell: ({ row }) => {
      const pricingMode = row.original.pricing_mode || "component_sum";
      const labels = {
        component_sum: "Součet položek",
        component_sum_discount: `Součet − ${row.original.discount_percentage ?? 0} %`,
        fixed_price: "Pevná cena",
      };

      return <Badge color="grey">{labels[pricingMode]}</Badge>;
    },
  }),
  columnHelper.accessor("updated_at", {
    header: "Upraveno",
    cell: ({ row }) => (
      <Text size="small" className="text-ui-fg-subtle">
        {formatDate(row.original.updated_at || row.original.created_at)}
      </Text>
    ),
  }),
  columnHelper.display({
    id: "actions",
    header: "Akce",
    cell: ({ row }) => (
      <div className="flex justify-end gap-x-2">
        <UpdateBundledProduct
          id={row.original.id}
          initialTitle={row.original.title || undefined}
        />
        <DeleteBundledProduct id={row.original.id} />
      </div>
    ),
  }),
];

const limit = 15;
const queryClient = new QueryClient();

const BundledProductsPageInner = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageSize: limit,
    pageIndex: 0,
  });
  const offset = pagination.pageIndex * limit;

  const { data, isLoading } = useQuery<{
    bundled_products: BundledProduct[];
    count: number;
  }>({
    queryKey: ["bundled-products", offset, limit],
    queryFn: () =>
      sdk.client.fetch("/admin/bundled-products", {
        method: "GET",
        query: { limit, offset },
      }),
  });

  const safeData = useMemo(
    () =>
      (Array.isArray(data?.bundled_products)
        ? data.bundled_products
        : []
      ).filter(
        (bundle): bundle is BundledProduct =>
          !!bundle && typeof bundle.id === "string"
      ),
    [data]
  );

  const table = useDataTable({
    columns,
    data: safeData,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
    rowCount: data?.count ?? 0,
  });

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-start justify-between gap-4 px-6 py-5 md:items-center">
          <div>
            <Heading>Balíčky produktů</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Sestavujte společné výběry z existujících produktů.
            </Text>
          </div>
          <CreateBundledProduct />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  );
};

const BundledProductsPage = () => (
  <QueryClientProvider client={queryClient}>
    <BundledProductsPageInner />
  </QueryClientProvider>
);

/**
 * **No sidebar entry.** Reached from Přehled → Produkty. The sidebar is down
 * to the five places she navigates *to*; everything she works *in* lives
 * under Přehled.
 */

export default BundledProductsPage;
