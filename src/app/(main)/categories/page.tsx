import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { Badge } from "@/components/ui/badge";
import { getCategoryCounts } from "@/lib/items";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse the Brandmark catalog by category.",
};

export default async function CategoriesPage() {
  const categories = await getCategoryCounts();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Categories</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Every category in the catalog, with how many listings it contains. Counts come from the database, not from
          estimates.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <section key={category.slug} className="surface p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                <CategoryIcon name={category.icon} className="h-5 w-5" />
              </span>
              <Badge tone="muted">{category.count} listings</Badge>
            </div>
            <h2 className="mt-3 text-base font-semibold">{category.name}</h2>
            {category.description ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{category.description}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/products?category=${category.slug}`} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
                Products <ArrowRight className="h-3 w-3" />
              </Link>
              <Link href={`/services?category=${category.slug}`} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
                Services <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
