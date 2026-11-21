import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { ItemCard, type ItemCardData } from "@/components/item-card";
import { SearchBox } from "@/components/search-box";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EXAMPLE_QUERIES } from "@/lib/constants";
import { getCurrentUser, getVisitorId } from "@/lib/auth/session";
import {
  getCategoryCounts,
  getFavoriteKeySet,
  getFeaturedItems,
  getRecentlyViewed,
  toPublicItem,
} from "@/lib/items";
import { getPersonalizedRecommendations } from "@/lib/ai/search";
import type { CatalogItem, RankedItem } from "@/lib/items";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Describe what you want in plain language. Brandmark searches products and services together and explains every match.",
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function toCard(item: CatalogItem | RankedItem, favorites: Set<string>): ItemCardData {
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
    matchScore: publicItem.matchScore,
    matchReasons: publicItem.matchReasons,
    favorited: publicItem.favorited,
  };
}

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  const visitorId = await getVisitorId();

  const [categories, favorites, recommended, recent] = await Promise.all([
    getCategoryCounts(),
    getFavoriteKeySet(user?.id),
    user ? getPersonalizedRecommendations(user.id, 6) : getFeaturedItems(6),
    getRecentlyViewed(user?.id ?? visitorId ?? "", 4),
  ]);

  const totalProducts = categories.reduce((sum, category) => sum + category.count, 0);
  const firstName = user?.name.split(/\s+/)[0];
  const featured = recommended.map((item) => toCard(item, favorites));

  return (
    <div className="space-y-10">
      <section className="surface relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_120%_at_50%_0%,#efeaff_0%,rgba(239,234,255,0)_70%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <Badge tone="accent" className="mb-4">
            <Sparkles className="h-3 w-3" aria-hidden /> AI agent search
          </Badge>
          <h1 className="text-balance text-3xl font-bold tracking-[-0.03em] sm:text-[40px] sm:leading-[1.1]">
            {user ? `${greeting()}, ${firstName}.` : "Tell us what you love."}{" "}
            <span className="text-muted">We&apos;ll find what you want.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-[15px]">
            One search across every product and service, matched to your intent by an agent that explains its reasoning —
            using only real catalog data.
          </p>

          <div className="mt-6 text-left">
            <SearchBox autoFocus />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Try asking</span>
            {EXAMPLE_QUERIES.slice(0, 3).map((query) => (
              <Link
                key={query}
                href={`/search?q=${encodeURIComponent(query)}`}
                className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted transition hover:border-ink/20 hover:text-ink"
              >
                {query}
              </Link>
            ))}
          </div>

          <p className="mt-4 text-[11px] text-muted">
            {totalProducts} indexed products &amp; services · {categories.length} categories · prices in PHP
          </p>
        </div>
      </section>

      <section aria-labelledby="categories-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="categories-heading" className="text-lg font-semibold tracking-[-0.01em]">
              Popular categories
            </h2>
            <p className="mt-0.5 text-xs text-muted">Start broad, then let the agent narrow it down.</p>
          </div>
          <Link href="/categories" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
            All categories <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 8).map((category) => (
            <Link
              key={category.slug}
              href={`/products?category=${category.slug}`}
              className="surface group flex items-center gap-3 p-3.5 transition hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink transition group-hover:bg-accent group-hover:text-white">
                <CategoryIcon name={category.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{category.name}</span>
                <span className="block text-[11px] text-muted">{category.count} listings</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="picks-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="picks-heading" className="text-lg font-semibold tracking-[-0.01em]">
              {user ? "Picked for your interests" : "Featured across the catalog"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {user
                ? "Based on saved interests, past searches and ratings — edit them in Settings."
                : "A sample of the catalog. Sign in to personalize your picks."}
            </p>
          </div>
          <Link href="/search?q=things%20I%27d%20love" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
            See matches <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((item) => (
              <ItemCard key={`${item.type}:${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="surface p-6 text-sm text-muted">No items indexed yet.</div>
        )}
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="recent-heading" className="text-lg font-semibold tracking-[-0.01em]">
                Recently viewed
              </h2>
              <p className="mt-0.5 text-xs text-muted">Pick up where you left off.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((item) => (
              <ItemCard key={`${item.type}:${item.id}`} item={toCard(item, favorites)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface grid gap-6 p-6 sm:grid-cols-3 sm:p-8">
        {[
          {
            title: "Read your request",
            body: "The agent extracts budget, category, attributes and location — and tells you what it assumed.",
          },
          {
            title: "Search the real catalog",
            body: "Candidates come from indexed products and services. No invented prices, ratings or availability.",
          },
          {
            title: "Explain and refine",
            body: "Each match shows why it fits. Refine conversationally and keep the context of your search.",
          },
        ].map((step, index) => (
          <div key={step.title}>
            <span className="mb-2 inline-grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-bold text-white">
              {index + 1}
            </span>
            <h3 className="text-sm font-semibold">{step.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </section>

      {!user ? (
        <section className="surface flex flex-col items-start justify-between gap-4 bg-ink p-6 text-white sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-lg font-semibold">Make it yours</h2>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Save interests, keep your search history and get recommendations grounded in what you actually like.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/register" className={buttonClass("primary", "md")}>
              Create account
            </Link>
            <Link href="/login" className={buttonClass("outline", "md", "border-white/25 bg-transparent text-white hover:bg-white/10")}>
              Sign in
            </Link>
          </div>
        </section>
      ) : null}

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-muted">
        <Compass className="h-3.5 w-3.5" aria-hidden /> One search across products and services.
      </p>
    </div>
  );
}
