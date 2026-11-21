import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import { CatalogFilters } from "@/components/catalog-filters";
import { ItemCard, type ItemCardData } from "@/components/item-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/session";
import { getFavoriteKeySet, listCatalog, toPublicItem, type CatalogItem } from "@/lib/items";
import { catalogQuerySchema } from "@/lib/validation";
import { buttonClass } from "@/components/ui/button";

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

function toCard(item: CatalogItem, favorites: Set<string>): ItemCardData {
  const publicItem = toPublicItem(item, favorites.has(`${item.type}:${item.id}`));
  return {
    id: publicItem.id,
    type: publicItem.type,
    slug: publicItem.slug,
    name: publicItem.name,
    summary: publicItem.summary,
    priceCents: publicItem.priceCents,
    priceUnit: publicItem.priceUnit,
    currency: publicItem.currency,
    imageUrl: publicItem.imageUrl,
    seller: { name: publicItem.seller.name, verified: publicItem.seller.verified },
    ratingAvg: publicItem.ratingAvg,
    ratingCount: publicItem.ratingCount,
    availability: publicItem.availability,
    location: publicItem.location,
    favorited: publicItem.favorited,
  };
}

function buildHref(basePath: string, params: CatalogSearchParams, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value && key !== "page") search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function CatalogView({
  kind,
  title,
  subtitle,
  basePath,
  searchParams,
}: {
  kind: "PRODUCT" | "SERVICE";
  title: string;
  subtitle: string;
  basePath: string;
  searchParams: CatalogSearchParams;
}) {
  const parsed = catalogQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : {};
  const page = query.page ?? 1;

  const [user, result] = await Promise.all([
    getCurrentUser(),
    listCatalog({
      ...query,
      type: kind,
      sort: query.sort,
      page,
      pageSize: query.pageSize ?? 12,
    }),
  ]);
  const favorites = await getFavoriteKeySet(user?.id);
  const items = result.items.map((item) => toCard(item, favorites));
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{subtitle}</p>
        </div>
        <p className="text-xs text-muted">
          <strong className="text-ink">{result.total}</strong> {result.total === 1 ? "listing" : "listings"}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside aria-label="Filters">
          <div className="lg:sticky lg:top-6">
            <CatalogFilters
              categories={result.categories.map((category) => ({
                value: category.slug,
                label: category.name,
                count: category.count,
              }))}
              brands={result.brands.map((brand) => ({ value: brand.name, label: brand.name, count: brand.count }))}
              locations={result.locations.map((location) => ({ value: location.name, label: location.name, count: location.count }))}
            />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {items.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <ItemCard key={`${item.type}:${item.id}`} item={item} />
                ))}
              </div>
              {pages > 1 ? (
                <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Pagination">
                  <Link
                    href={buildHref(basePath, searchParams, Math.max(1, page - 1))}
                    aria-disabled={page <= 1}
                    className={buttonClass("outline", "sm", page <= 1 ? "pointer-events-none opacity-40" : "")}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </Link>
                  <span className="px-2 text-xs text-muted">
                    Page {page} of {pages}
                  </span>
                  <Link
                    href={buildHref(basePath, searchParams, Math.min(pages, page + 1))}
                    aria-disabled={page >= pages}
                    className={buttonClass("outline", "sm", page >= pages ? "pointer-events-none opacity-40" : "")}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </nav>
              ) : null}
            </>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Nothing matches those filters"
              description="Try widening the price range, clearing a category, or searching the whole catalog."
              action={
                <Link href={basePath} className={buttonClass("outline", "sm")}>
                  Clear filters
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
