/**
 * Builds the denormalized keyword corpus used for lexical retrieval.
 * Kept dependency-free so both the application and the seed script can use it.
 */
export function buildSearchText(input: {
  name: string;
  summary?: string | null;
  description?: string | null;
  brand?: string | null;
  tags: string[];
  attributes: Record<string, string>;
  categoryName?: string;
  sellerName?: string;
  location?: string | null;
  priceUnit?: string | null;
}): string {
  return [
    input.name,
    input.brand ?? "",
    input.summary ?? "",
    input.description ?? "",
    input.categoryName ?? "",
    input.sellerName ?? "",
    input.location ?? "",
    input.priceUnit ?? "",
    input.tags.join(" "),
    Object.entries(input.attributes)
      .map(([key, value]) => `${key} ${value}`)
      .join(" "),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}
