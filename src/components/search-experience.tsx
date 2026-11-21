"use client";

import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MessageSquareText,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ItemCard, type ItemCardData } from "@/components/item-card";
import { SearchBox } from "@/components/search-box";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/skeleton";
import { AVAILABILITY, SORT_OPTIONS, availabilityLabel, type SortOption } from "@/lib/constants";
import type { SearchResponse } from "@/lib/ai/search";
import type { SearchIntent } from "@/lib/ai/intent";
import type { PublicItem } from "@/lib/items";
import { cn, formatPrice } from "@/lib/utils";

type Filters = {
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  category?: string;
  availability?: string;
  location?: string;
  brand?: string;
  delivery?: "online" | "onsite";
};

type SearchPayload = Omit<SearchResponse, "items" | "alternatives"> & {
  items: PublicItem[];
  alternatives: PublicItem[];
};

function toCard(item: PublicItem): ItemCardData {
  return {
    id: item.id,
    type: item.type,
    slug: item.slug,
    name: item.name,
    summary: item.summary,
    priceCents: item.priceCents,
    priceUnit: item.priceUnit,
    currency: item.currency,
    imageUrl: item.imageUrl,
    seller: { name: item.seller.name, verified: item.seller.verified },
    ratingAvg: item.ratingAvg,
    ratingCount: item.ratingCount,
    availability: item.availability,
    location: item.location,
    matchScore: item.matchScore,
    matchReasons: item.matchReasons,
    explanation: item.explanation,
    favorited: item.favorited,
    deliveryMode: item.deliveryMode,
  };
}

export function SearchExperience({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [runId, setRunId] = useState(0);
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [draftMin, setDraftMin] = useState("");
  const [draftMax, setDraftMax] = useState("");
  const [sort, setSort] = useState<SortOption>("relevance");
  const [page, setPage] = useState(1);
  const [itemType, setItemType] = useState<"BOTH" | "PRODUCT" | "SERVICE">("BOTH");
  const [compare, setCompare] = useState<Record<string, ItemCardData>>({});
  const [compareOpen, setCompareOpen] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const sessionRef = useRef<string | undefined>(undefined);
  const requestId = useRef(0);

  const selectedCompare = useMemo(() => Object.values(compare), [compare]);

  const execute = useCallback(
    async (searchQuery: string, refine = false) => {
      const text = searchQuery.trim();
      if (text.length < 3) return;
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            sessionId: sessionRef.current,
            refine,
            itemType,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
            sort,
            page,
            pageSize: 12,
          }),
        });
        const body = await response.json().catch(() => null);
        if (id !== requestId.current) return;
        if (!response.ok) {
          setError(body?.error?.message ?? "Search failed. Please try again.");
          return;
        }
        const data = body.data as SearchPayload;
        sessionRef.current = data.sessionId;
        setPayload(data);
        window.history.replaceState(null, "", `/search?q=${encodeURIComponent(text)}`);
      } catch {
        if (id === requestId.current) setError("Network error. Check your connection and try again.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [filters, itemType, page, sort]
  );

  useEffect(() => {
    if (!query || query.trim().length < 3) return;
    void execute(query);
    // Re-run whenever the query, filters, sort, page or explicit run changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters, sort, page, itemType, runId]);

  function submitSearch(next: string) {
    setPage(1);
    if (next.trim() === query.trim()) {
      setRunId((value) => value + 1);
      return;
    }
    setQuery(next);
  }

  function refineWith(suggestion: string) {
    setPage(1);
    void execute(`${query} ${suggestion}`, true);
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setPage(1);
    setFilters((current) => {
      const next = { ...current };
      if (value === undefined || value === "" || value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function applyPrice() {
    const min = draftMin.trim() === "" ? undefined : Number(draftMin);
    const max = draftMax.trim() === "" ? undefined : Number(draftMax);
    setPage(1);
    setFilters((current) => ({
      ...current,
      ...(Number.isFinite(min) && min! >= 0 ? { minPrice: min } : { minPrice: undefined }),
      ...(Number.isFinite(max) && max! >= 0 ? { maxPrice: max } : { maxPrice: undefined }),
    }));
  }

  function resetFilters() {
    setDraftMin("");
    setDraftMax("");
    setPage(1);
    setFilters({});
  }

  function toggleCompare(item: ItemCardData) {
    const key = `${item.type}:${item.id}`;
    setCompare((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      if (Object.keys(current).length >= 3) return current;
      return { ...current, [key]: item };
    });
  }

  const intent = payload?.intent as SearchIntent | undefined;
  const total = payload?.total ?? 0;
  const pageSize = payload?.pageSize ?? 12;
  const currentPage = payload?.page ?? 1;
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(total, currentPage * pageSize);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters = Object.values(filters).filter((value) => value !== undefined && value !== "").length;

  return (
    <div className="space-y-5">
      <div className="surface p-3 sm:p-4">
        <SearchBox initialQuery={initialQuery} size="compact" busy={loading} onSearch={submitSearch} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Item type">
          {(
            [
              { value: "BOTH", label: "All" },
              { value: "PRODUCT", label: "Products" },
              { value: "SERVICE", label: "Services" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setPage(1);
                setItemType(option.value);
              }}
              aria-pressed={itemType === option.value}
              className={cn(
                "h-8 rounded-lg border px-3 text-xs font-semibold transition",
                itemType === option.value
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-panel text-muted hover:text-ink"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileFilters((value) => !value)}
            className={buttonClass("outline", "sm", "lg:hidden")}
            aria-expanded={mobileFilters}
          >
            <Filter className="h-3.5 w-3.5" /> Filters{activeFilters ? ` (${activeFilters})` : ""}
          </button>
          <label className="flex items-center gap-2 text-xs text-muted">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Sort results</span>
            <Select
              value={sort}
              onChange={(event) => {
                setPage(1);
                setSort(event.target.value as SortOption);
              }}
              className="h-8 w-auto py-0 text-xs"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className={cn("space-y-4", mobileFilters ? "block" : "hidden lg:block")} aria-label="Filters">
          <div className="surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted" aria-hidden /> Filters
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-semibold text-muted hover:text-ink disabled:opacity-40"
                disabled={activeFilters === 0}
              >
                Reset
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="label">Category</p>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1 scroll-thin">
                  {(payload?.facets.categories ?? []).slice(0, 8).map((category) => (
                    <label key={category.slug} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-canvas">
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="category"
                          checked={filters.category === category.slug}
                          onChange={() => updateFilter("category", filters.category === category.slug ? undefined : category.slug)}
                          className="accent-[#5438f5]"
                        />
                        <span className="text-ink">{category.name}</span>
                      </span>
                      <span className="text-muted">{category.count}</span>
                    </label>
                  ))}
                  {!payload ? <p className="text-muted">Run a search to see categories.</p> : null}
                </div>
              </div>

              <div>
                <p className="label">Price (₱)</p>
                <div className="flex items-center gap-1.5">
                  <Input
                    inputMode="numeric"
                    placeholder="Min"
                    value={draftMin}
                    onChange={(event) => setDraftMin(event.target.value.replace(/[^\d]/g, ""))}
                    onKeyDown={(event) => event.key === "Enter" && applyPrice()}
                    className="h-8 px-2 text-xs"
                    aria-label="Minimum price"
                  />
                  <span className="text-muted">–</span>
                  <Input
                    inputMode="numeric"
                    placeholder="Max"
                    value={draftMax}
                    onChange={(event) => setDraftMax(event.target.value.replace(/[^\d]/g, ""))}
                    onKeyDown={(event) => event.key === "Enter" && applyPrice()}
                    className="h-8 px-2 text-xs"
                    aria-label="Maximum price"
                  />
                </div>
                <button type="button" onClick={applyPrice} className="mt-2 w-full rounded-lg border border-line py-1.5 font-semibold text-muted transition hover:text-ink">
                  Apply price
                </button>
              </div>

              <div>
                <p className="label">Rating</p>
                {[4, 3, 2].map((value) => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-canvas">
                    <input
                      type="radio"
                      name="rating"
                      checked={filters.minRating === value}
                      onChange={() => updateFilter("minRating", filters.minRating === value ? undefined : value)}
                      className="accent-[#5438f5]"
                    />
                    <span>{value}★ &amp; up</span>
                  </label>
                ))}
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-canvas">
                  <input type="radio" name="rating" checked={!filters.minRating} onChange={() => updateFilter("minRating", undefined)} className="accent-[#5438f5]" />
                  <span>Any rating</span>
                </label>
              </div>

              {(payload?.facets.brands.length ?? 0) > 0 ? (
                <div>
                  <p className="label">Brand</p>
                  <Select
                    value={filters.brand ?? ""}
                    onChange={(event) => updateFilter("brand", event.target.value || undefined)}
                    className="h-8 py-0 text-xs"
                  >
                    <option value="">Any brand</option>
                    {payload?.facets.brands.slice(0, 12).map((brand) => (
                      <option key={brand.name} value={brand.name}>
                        {brand.name} ({brand.count})
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {(payload?.facets.locations.length ?? 0) > 0 ? (
                <div>
                  <p className="label">Location</p>
                  <Select
                    value={filters.location ?? ""}
                    onChange={(event) => updateFilter("location", event.target.value || undefined)}
                    className="h-8 py-0 text-xs"
                  >
                    <option value="">Anywhere</option>
                    {payload?.facets.locations.slice(0, 12).map((location) => (
                      <option key={location.name} value={location.name}>
                        {location.name} ({location.count})
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              <div>
                <p className="label">Availability</p>
                <Select
                  value={filters.availability ?? ""}
                  onChange={(event) => updateFilter("availability", event.target.value || undefined)}
                  className="h-8 py-0 text-xs"
                >
                  <option value="">Any availability</option>
                  {(payload?.facets.availability ?? []).map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {availabilityLabel(entry.value)} ({entry.count})
                    </option>
                  ))}
                  {payload ? null : Object.keys(AVAILABILITY).slice(0, 4).map((value) => (
                    <option key={value} value={value}>
                      {AVAILABILITY[value as keyof typeof AVAILABILITY]}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <p className="label">Fulfilment</p>
                <div className="space-y-1">
                  {(
                    [
                      { value: "online", label: "Delivery or online" },
                      { value: "onsite", label: "Pickup or on-site" },
                    ] as const
                  ).map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-canvas">
                      <input
                        type="checkbox"
                        checked={filters.delivery === option.value}
                        onChange={() => updateFilter("delivery", filters.delivery === option.value ? undefined : option.value)}
                        className="accent-[#5438f5]"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {intent && intent.interests.length > 0 ? (
            <div className="surface p-4">
              <p className="label">Your interests in play</p>
              <div className="flex flex-wrap gap-1.5">
                {intent.interests.map((interest: string) => (
                  <Badge key={interest} tone="accent">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-4">
          {intent ? (
            <div className="surface p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden /> Here&apos;s how the agent read your request
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(intent.chips.length > 0 ? intent.chips : intent.keywords.slice(0, 6)).map((chip: string) => (
                  <Badge key={chip} tone="neutral" className="bg-canvas">
                    {chip}
                  </Badge>
                ))}
              </div>
              {intent.assumptions.length > 0 ? (
                <p className="mt-2 text-[11px] text-muted">Assumed: {intent.assumptions.join(" · ")}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-xs text-muted">
                <span>
                  <strong className="text-ink">{total}</strong> match{total === 1 ? "" : "es"} · {payload?.mode === "openai" ? "semantic mode" : "local engine"} ·{" "}
                  {payload?.tookMs ?? 0} ms
                </span>
                <button
                  type="button"
                  onClick={() => {
                    sessionRef.current = undefined;
                    setPage(1);
                    setRunId((value) => value + 1);
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-muted hover:text-ink"
                >
                  <RotateCcw className="h-3 w-3" /> Start over
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="surface border-[#f3c6c6] bg-[#fdf3f3] p-4 text-sm text-[#8f1d1d]">
              <p className="font-semibold">We couldn&apos;t finish that search.</p>
              <p className="mt-1 text-xs">{error}</p>
              <button type="button" onClick={() => setRunId((value) => value + 1)} className={buttonClass("outline", "sm", "mt-3")}>
                Try again
              </button>
            </div>
          ) : null}

          {loading && !payload ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
          ) : null}

          {payload && payload.items.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  Showing {start}–{end} of {total}
                </p>
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-accent" aria-label="Updating results" /> : null}
              </div>
              <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", loading && "opacity-60")}>
                {payload.items.map((item) => {
                  const card = toCard(item);
                  const key = `${item.type}:${item.id}`;
                  return (
                    <ItemCard
                      key={key}
                      item={card}
                      compare={{
                        selected: Boolean(compare[key]),
                        onToggle: () => toggleCompare(card),
                        disabled: selectedCompare.length >= 3,
                      }}
                    />
                  );
                })}
              </div>

              {pages > 1 ? (
                <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Pagination">
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={currentPage <= 1 || loading}
                    className={buttonClass("outline", "sm")}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <span className="px-2 text-xs text-muted">
                    Page {currentPage} of {pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.min(pages, value + 1))}
                    disabled={currentPage >= pages || loading}
                    className={buttonClass("outline", "sm")}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </nav>
              ) : null}
            </>
          ) : null}

          {payload && payload.items.length === 0 ? (
            <div className="surface p-6">
              <h2 className="text-base font-semibold">No exact matches</h2>
              <p className="mt-1 text-sm text-muted">
                {payload.agent.reply}
              </p>
              {activeFilters > 0 ? (
                <button type="button" onClick={resetFilters} className={buttonClass("outline", "sm", "mt-3")}>
                  Clear filters
                </button>
              ) : null}
              {payload.alternatives.length > 0 ? (
                <div className="mt-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Closest options</p>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {payload.alternatives.map((item) => (
                      <ItemCard key={`${item.type}:${item.id}`} item={toCard(item)} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!payload && !loading && !error ? (
            <div className="surface p-8 text-center">
              <p className="text-sm font-semibold">Describe what you need</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted">
                Include a budget, a category, or the qualities that matter. The agent will show what it understood before
                listing matches.
              </p>
              <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2">
                {["A gift for my mom who loves gardening, under ₱2,000", "Someone to fix my kitchen sink today"].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => submitSearch(example)}
                    className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-ink/20 hover:text-ink"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="hidden xl:block" aria-label="AI agent">
          <div className="surface sticky top-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent text-white">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </span>
                Your AI agent
              </p>
              <Badge tone={loading ? "warn" : "good"}>{loading ? "Thinking" : "Ready"}</Badge>
            </div>
            <div className="space-y-4 p-4">
              {query ? (
                <p className="rounded-xl rounded-br-sm bg-ink px-3 py-2 text-xs leading-relaxed text-white">{query}</p>
              ) : (
                <p className="text-xs text-muted">Ask something and I&apos;ll explain how I read it.</p>
              )}

              {payload ? (
                <>
                  <p className="text-xs leading-relaxed text-muted">{payload.agent.reply}</p>
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">What I did</p>
                    <ul className="space-y-1">
                      {payload.agent.steps.map((step) => (
                        <li key={step} className="flex gap-1.5 text-[11px] leading-relaxed text-muted">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-good" aria-hidden />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {payload.agent.suggestions.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Want me to narrow it down?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {payload.agent.suggestions.slice(0, 6).map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => refineWith(suggestion)}
                            disabled={loading}
                            className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-accent/30 hover:text-accent-ink disabled:opacity-50"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {payload.agent.clarification ? (
                    <p className="rounded-lg bg-[#fff7e8] px-2.5 py-2 text-[11px] leading-relaxed text-warn">
                      {payload.agent.clarification}
                    </p>
                  ) : null}
                  <p className="flex items-start gap-1.5 border-t border-line pt-3 text-[10px] leading-relaxed text-muted">
                    <MessageSquareText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    Explanations are generated from the indexed catalog — never from invented product data.
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Try</p>
                  {["Under ₱1,000", "Services only", "Near Makati", "Highest rated"].map((hint) => (
                    <p key={hint} className="text-xs text-muted">
                      · {hint}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {selectedCompare.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold">
                Compare ({selectedCompare.length}/3)
              </span>
              {selectedCompare.map((item) => (
                <span key={`${item.type}:${item.id}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-1 text-[11px]">
                  {item.name}
                  <button type="button" onClick={() => toggleCompare(item)} aria-label={`Remove ${item.name} from comparison`}>
                    <X className="h-3 w-3 text-muted hover:text-ink" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCompare({})} className={buttonClass("ghost", "sm")}>
                Clear
              </button>
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                disabled={selectedCompare.length < 2}
                className={buttonClass("primary", "sm")}
              >
                Compare {selectedCompare.length < 2 ? "(pick 2+)" : ""}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {compareOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Compare items">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-t-xl2 bg-panel p-5 shadow-lift sm:rounded-xl2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Side by side</h2>
              <button type="button" onClick={() => setCompareOpen(false)} className={buttonClass("ghost", "icon")} aria-label="Close comparison">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <tbody>
                  {[
                    { label: "Price", render: (item: ItemCardData) => `${formatPrice(item.priceCents, item.currency)}${item.priceUnit ? ` / ${item.priceUnit}` : ""}` },
                    { label: "Rating", render: (item: ItemCardData) => (item.ratingAvg ? `${item.ratingAvg.toFixed(1)} (${item.ratingCount})` : "No rating") },
                    { label: "Provider", render: (item: ItemCardData) => item.seller.name },
                    { label: "Availability", render: (item: ItemCardData) => availabilityLabel(item.availability) },
                    { label: "Location", render: (item: ItemCardData) => item.location ?? "Not specified" },
                    { label: "Type", render: (item: ItemCardData) => (item.type === "PRODUCT" ? "Product" : "Service") },
                    { label: "Match", render: (item: ItemCardData) => (item.matchScore ? `${Math.round(item.matchScore)}%` : "—") },
                  ].map((row) => (
                    <tr key={row.label} className="border-t border-line">
                      <th scope="row" className="w-28 py-2.5 pr-3 text-left font-semibold text-muted">
                        {row.label}
                      </th>
                      {selectedCompare.map((item) => (
                        <td key={`${item.type}:${item.id}`} className="py-2.5 pr-3 align-top">
                          {row.render(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-line">
                    <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-muted">
                      Details
                    </th>
                    {selectedCompare.map((item) => (
                      <td key={`${item.type}:${item.id}`} className="py-2.5 pr-3 align-top">
                        <Link href={`/item/${item.type === "PRODUCT" ? "product" : "service"}/${item.slug}`} className="link">
                          View {item.name}
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
