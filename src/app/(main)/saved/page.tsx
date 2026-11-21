import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clock, PackageSearch } from "lucide-react";
import { ItemCard, type ItemCardData } from "@/components/item-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/session";
import { getFavoriteKeySet, getItemBySlugOrId, toPublicItem, type CatalogItem } from "@/lib/items";

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

export const metadata: Metadata = {
  title: "Saved items",
  description: "Your saved products and services.",
};

export default async function SavedPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={PackageSearch}
          title="Save items to see them here"
          description="Sign in and favorite products or services to build your personal collection."
          action={
            <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
              Sign in <ChevronRight className="h-3 w-3" />
            </Link>
          }
        />
      </div>
    );
  }

  const favorites = await dbFavoriteItems(user.id);
  const favoriteSet = new Set(favorites.map((f) => `${f.itemType}:${f.itemId}`));

  const items = await Promise.all(
    favorites.map(async (f) => {
      const item = await getItemBySlugOrId(f.itemType as "PRODUCT" | "SERVICE", f.itemId);
      return item ? toCard(item, favoriteSet) : null;
    })
  );
  const validItems = items.filter(Boolean) as ItemCardData[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Saved items</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          {validItems.length} saved product{validItems.length === 1 ? "" : "s"} and service{validItems.length === 1 ? "" : "s"}.
        </p>
      </header>

      {validItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {validItems.map((item) => (
            <ItemCard key={`${item.type}:${item.id}`} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title="Nothing saved yet"
          description="Favorite products and services while browsing to collect them here."
          action={
            <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
              Start browsing <ChevronRight className="h-3 w-3" />
            </Link>
          }
        />
      )}
    </div>
  );
}

async function dbFavoriteItems(userId: string) {
  // Use the server-side db directly for favorite metadata
  const { db } = await import("@/lib/db");
  return db.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { itemType: true, itemId: true, createdAt: true },
  });
}
