import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, MapPin } from "lucide-react";
import { FavoriteButton } from "@/components/favorite-button";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { availabilityLabel } from "@/lib/constants";
import { cn, formatPrice, truncate } from "@/lib/utils";

export type ItemCardData = {
  id: string;
  type: "PRODUCT" | "SERVICE";
  slug: string;
  name: string;
  summary: string;
  priceCents: number;
  priceUnit?: string | null;
  currency: string;
  imageUrl: string;
  seller: { name: string; verified: boolean };
  ratingAvg: number;
  ratingCount: number;
  availability: string;
  location?: string | null;
  matchScore?: number;
  matchReasons?: string[];
  explanation?: string;
  favorited?: boolean;
  deliveryMode?: string;
};

export function ItemCard({
  item,
  compare,
  className,
}: {
  item: ItemCardData;
  compare?: { selected: boolean; onToggle: () => void; disabled?: boolean };
  className?: string;
}) {
  const href = `/item/${item.type === "PRODUCT" ? "product" : "service"}/${item.slug}`;
  const reasons = (item.matchReasons ?? []).slice(0, 2);
  const score = item.matchScore ?? 0;

  return (
    <article
      className={cn(
        "surface group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-card",
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#ececE7]">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <Badge tone={item.type === "SERVICE" ? "accent" : "neutral"} className="bg-panel/95 backdrop-blur">
            {item.type === "SERVICE" ? "Service" : "Product"}
          </Badge>
          <FavoriteButton
            itemType={item.type}
            itemId={item.id}
            initialFavorited={Boolean(item.favorited)}
          />
        </div>
        {score > 0 ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <Check className="h-3 w-3" aria-hidden /> {Math.round(score)}% match
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-muted">{item.seller.name}</p>
          <Rating value={item.ratingAvg} count={item.ratingCount} />
        </div>

        <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">
          <Link href={href} className="hover:text-accent-ink">
            {item.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{truncate(item.summary, 110)}</p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[15px] font-bold">{formatPrice(item.priceCents, item.currency)}</span>
          {item.priceUnit ? <span className="text-xs text-muted">/ {item.priceUnit}</span> : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="muted">{availabilityLabel(item.availability)}</Badge>
          {item.location ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <MapPin className="h-3 w-3" aria-hidden /> {item.location}
            </span>
          ) : null}
        </div>

        {reasons.length > 0 ? (
          <ul className="mt-3 space-y-1 rounded-lg bg-canvas px-2.5 py-2 text-[11px] leading-relaxed text-muted">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-good" aria-hidden />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-4">
          <Link href={href} className={buttonClass("outline", "sm", "flex-1")}>
            View details <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          {compare ? (
            <button
              type="button"
              onClick={compare.onToggle}
              disabled={compare.disabled && !compare.selected}
              aria-pressed={compare.selected}
              className={cn(
                "inline-flex h-8 items-center rounded-xl border px-2.5 text-xs font-semibold transition disabled:opacity-40",
                compare.selected
                  ? "border-accent/25 bg-accent-soft text-accent-ink"
                  : "border-line bg-panel text-muted hover:text-ink"
              )}
            >
              {compare.selected ? "Added" : "Compare"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
