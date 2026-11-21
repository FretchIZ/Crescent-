"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SORT_OPTIONS } from "@/lib/constants";

type Option = { value: string; label: string; count?: number };

export function CatalogFilters({
  categories,
  brands,
  locations,
}: {
  categories: Option[];
  brands: Option[];
  locations: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(next: Record<string, string | undefined>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) search.delete(key);
      else search.set(key, value);
    }
    search.delete("page");
    router.push(`${pathname}?${search.toString()}`);
  }

  function reset() {
    setQ("");
    router.push(pathname);
  }

  const hasFilters = ["q", "category", "brand", "location", "minPrice", "maxPrice", "minRating", "availability", "delivery", "sort"].some(
    (key) => params.get(key)
  );

  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted" aria-hidden /> Refine
        </p>
        {hasFilters ? (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink">
            <X className="h-3 w-3" /> Clear all
          </button>
        ) : null}
      </div>

      <form
        className="space-y-3 text-xs"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: q.trim() || undefined });
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search this catalog…"
            className="h-9 pl-8 text-xs"
            aria-label="Keyword search"
          />
        </div>

        <div>
          <p className="label">Category</p>
          <Select value={params.get("category") ?? ""} onChange={(event) => apply({ category: event.target.value || undefined })} className="h-9 py-0 text-xs">
            <option value="">All categories</option>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} {option.count ? `(${option.count})` : ""}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <p className="label">Price (₱)</p>
          <div className="flex items-center gap-1.5">
            <Input
              name="minPrice"
              inputMode="numeric"
              placeholder="Min"
              defaultValue={params.get("minPrice") ?? ""}
              onBlur={(event) => apply({ minPrice: event.target.value || undefined })}
              className="h-8 px-2 text-xs"
              aria-label="Minimum price"
            />
            <span className="text-muted">–</span>
            <Input
              name="maxPrice"
              inputMode="numeric"
              placeholder="Max"
              defaultValue={params.get("maxPrice") ?? ""}
              onBlur={(event) => apply({ maxPrice: event.target.value || undefined })}
              className="h-8 px-2 text-xs"
              aria-label="Maximum price"
            />
          </div>
        </div>

        <div>
          <p className="label">Rating</p>
          <Select value={params.get("minRating") ?? ""} onChange={(event) => apply({ minRating: event.target.value || undefined })} className="h-9 py-0 text-xs">
            <option value="">Any rating</option>
            <option value="4">4★ &amp; up</option>
            <option value="3">3★ &amp; up</option>
            <option value="2">2★ &amp; up</option>
          </Select>
        </div>

        {brands.length > 0 ? (
          <div>
            <p className="label">Brand</p>
            <Select value={params.get("brand") ?? ""} onChange={(event) => apply({ brand: event.target.value || undefined })} className="h-9 py-0 text-xs">
              <option value="">Any brand</option>
              {brands.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {locations.length > 0 ? (
          <div>
            <p className="label">Location</p>
            <Select value={params.get("location") ?? ""} onChange={(event) => apply({ location: event.target.value || undefined })} className="h-9 py-0 text-xs">
              <option value="">Anywhere</option>
              {locations.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div>
          <p className="label">Sort</p>
          <Select value={params.get("sort") ?? "relevance"} onChange={(event) => apply({ sort: event.target.value })} className="h-9 py-0 text-xs">
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit" size="sm" className="w-full">
          Apply
        </Button>
      </form>
    </div>
  );
}
