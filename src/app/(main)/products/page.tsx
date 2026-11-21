import type { Metadata } from "next";
import { CatalogView, type CatalogSearchParams } from "@/components/catalog-view";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse every indexed product in the Brandmark catalog.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogView
      kind="PRODUCT"
      title="Products"
      subtitle="Every product in the indexed catalog, with real prices, ratings and availability."
      basePath="/products"
      searchParams={params}
    />
  );
}
