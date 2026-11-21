import type { Metadata } from "next";
import { CatalogView, type CatalogSearchParams } from "@/components/catalog-view";

export const metadata: Metadata = {
  title: "Services",
  description: "Browse every indexed service and provider in the Brandmark catalog.",
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  return (
    <CatalogView
      kind="SERVICE"
      title="Services"
      subtitle="Workshops, repairs, consultations and experiences — with provider details you can verify."
      basePath="/services"
      searchParams={params}
    />
  );
}
