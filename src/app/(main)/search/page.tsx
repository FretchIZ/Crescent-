import type { Metadata } from "next";
import { SearchExperience } from "@/components/search-experience";

export const metadata: Metadata = {
  title: "Search",
  description: "Natural-language search across the Brandmark product and service catalog.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <SearchExperience initialQuery={typeof q === "string" ? q.slice(0, 500) : ""} />;
}
