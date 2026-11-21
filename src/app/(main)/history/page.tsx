import type { Metadata } from "next";
import { ChevronRight, Clock, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Search history",
  description: "Your past searches on Brandmark.",
};

export default async function HistoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Search}
          title="Search history"
          description="Sign in to keep a history of your searches and revisit past results."
          action={
            <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
              Sign in <ChevronRight className="h-3 w-3" />
            </Link>
          }
        />
      </div>
    );
  }

  const { db } = await import("@/lib/db");
  const searches = await db.searchQuery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      session: { select: { id: true, title: true, createdAt: true } },
      results: { take: 4, orderBy: { rank: "asc" } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Search history</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          {searches.length} past search{searches.length === 1 ? "" : "es"}. Re-run any query to see updated results.
        </p>
      </header>

      {searches.length > 0 ? (
        <div className="space-y-3">
          {searches.map((search) => (
            <section key={search.id} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    <span>{new Date(search.createdAt).toLocaleString()}</span>
                    <span className="text-muted">{search.mode === "openai" ? "· AI mode" : "· Local"}</span>
                  </div>
                  <p className="text-sm font-semibold truncate">{search.queryText}</p>
                  <p className="mt-1 text-xs text-muted">
                    {search.resultCount} result{search.resultCount === 1 ? "" : "s"} found
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/search?q=${encodeURIComponent(search.queryText)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:border-ink/20 hover:text-accent-strong"
                  >
                    Run again <ChevronRight className="h-3 w-3" />
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      fetch(`/api/history?id=${search.id}`, { method: "DELETE" }).then(() => {
                        window.location.reload();
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {search.results.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scroll-thin">
                  {search.results.map((result) => (
                    <Link
                      key={result.id}
                      href={`/item/${result.itemType.toLowerCase() === "product" ? "product" : "service"}/${result.itemId}`}
                      className="shrink-0 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-muted hover:bg-canvas transition"
                    >
                      {result.itemType} · #{result.rank}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No search history yet"
          description="Your searches will appear here once you start looking for products and services."
          action={
            <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
              Start searching <ChevronRight className="h-3 w-3" />
            </Link>
          }
        />
      )}

      <div className="border-t border-line pt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            fetch("/api/history", { method: "DELETE" }).then(() => {
              window.location.reload();
            })
          }
        >
          Clear all history
        </Button>
      </div>
    </div>
  );
}
