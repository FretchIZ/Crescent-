"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, MapPin, Play, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { ItemCard, type ItemCardData } from "@/components/item-card";
import { FavoriteButton } from "@/components/favorite-button";
import { ReviewForm } from "@/components/review-form";
import { BookingForm } from "@/components/booking-form";
import { ShareButton } from "@/components/share-button";
import { RecordView } from "@/components/record-view";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { EmptyState } from "@/components/ui/empty-state";
import { availabilityLabel, DESCRIPTION_SOURCE_LABEL } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";

type ItemDetailClientProps = {
  item: import("@/lib/items").PublicItem;
  itemType: "PRODUCT" | "SERVICE";
  itemId: string;
  signedIn: boolean;
};

export function ItemDetailClient({
  item,
  itemType,
  itemId,
  signedIn,
}: ItemDetailClientProps) {
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; title: string | null; body: string | null; verifiedPurchase: boolean; createdAt: string; author: string }>>([]);
  const [related, setRelated] = useState<ItemCardData[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "reviews" | "specs">("details");
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const reviewsRes = await fetch(
          `/api/items/${itemType}/${encodeURIComponent(itemId)}`
        );
        if (cancelled) return;
        const data = await reviewsRes.json();
        if (reviewsRes.ok && data.data) {
          setReviews(data.data.reviews ?? []);
          const relatedItems = (data.data.related ?? []).map((entry: any) => ({
            id: entry.id,
            type: entry.type,
            slug: entry.slug,
            name: entry.name,
            summary: entry.summary,
            priceCents: entry.priceCents,
            priceUnit: entry.priceUnit,
            currency: entry.currency,
            imageUrl: entry.imageUrl,
            seller: { name: entry.seller.name, verified: entry.seller.verified },
            ratingAvg: entry.ratingAvg,
            ratingCount: entry.ratingCount,
            availability: entry.availability,
            location: entry.location,
            favorited: entry.favorited,
          }));
          setRelated(relatedItems);
        }
      } catch {
        // Silent degrade — server data is still usable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemType, itemId]);

  const galleryImages = item.images?.length ? item.images : [item.imageUrl];

  return (
    <div className="space-y-6">
      <RecordView itemType={itemType} itemId={itemId} />

      {/* Hero image + actions */}
      <div className="surface grid gap-6 lg:grid-cols-[1fr_340px] p-6 sm:p-8">
        <section className="space-y-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl2 bg-[#ecebe7]">
            {galleryImages.map((url, index) => (
              <Image
                key={index}
                src={url}
                alt={`${item.name} image ${index + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className={cn(
                  "object-cover opacity-0 transition-opacity duration-300",
                  index === galleryIndex ? "opacity-100" : "opacity-0"
                )}
                priority={index === 0}
                loading={index === 0 ? "eager" : "lazy"}
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => setGalleryIndex((i) => (i + 1) % galleryImages.length)}
              aria-label="Next image"
              className="absolute right-3 top-3 z-10 p-2 rounded-full bg-white/90 backdrop-blur hover:bg-white"
            >
              <Play className="h-4 w-4" aria-hidden />
            </button>
            {galleryImages.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                {galleryImages.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setGalleryIndex(index)}
                    aria-label={`Image ${index + 1}`}
                    className={`h-2 w-2 rounded-full transition ${
                      index === galleryIndex
                        ? "bg-accent"
                        : "bg-white/60 hover:bg-accent"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition",
                activeTab === "details"
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-panel text-muted hover:text-ink"
              )}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition",
                activeTab === "specs"
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-panel text-muted hover:text-ink"
              )}
            >
              Specs
            </button>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <FavoriteButton
              itemType={itemType}
              itemId={itemId}
              initialFavorited={Boolean(item.favorited)}
              variant="button"
              label
            />
            <ShareButton title={item.name} />
          </div>
        </section>

        {/* Actions sidebar */}
        <section className="space-y-4 lg:sticky lg:top-[104px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">
                {formatPrice(item.priceCents, item.currency)}
              </span>
              {item.priceUnit && <span className="text-xs text-muted">/{item.priceUnit}</span>}
            </div>
            <Badge
              tone={
                item.availability === "IN_STOCK" || item.availability === "AVAILABLE"
                  ? "good"
                  : item.availability === "OUT_OF_STOCK" || item.availability === "UNAVAILABLE"
                    ? "muted"
                    : "warn"
              }
            >
              {availabilityLabel(item.availability)}
            </Badge>
            <div className="flex items-start gap-2">
              <Rating value={item.ratingAvg} count={item.ratingCount} />
              {item.location && (
                <span className="text-xs text-muted">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />{" "}
                  {item.location}
                </span>
              )}
            </div>
            <p className="text-xs text-muted leading-relaxed">{item.summary}</p>
          </div>

          {item.type === "SERVICE" ? (
            <BookingForm serviceId={itemId} serviceName={item.name} signedIn={signedIn} />
          ) : null}

          <div className="border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Description source
            </p>
            <Badge tone="neutral" className="text-[11px]">
              {item.descriptionSource === "PROVIDER"
                ? DESCRIPTION_SOURCE_LABEL.PROVIDER
                : DESCRIPTION_SOURCE_LABEL.PLATFORM}
            </Badge>
            {item.sourceUrl ? (
              <Link
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
              >
                View provider source <ChevronRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        </section>
      </div>

      {/* Tabs content */}
      <section className="surface p-6 sm:p-8 space-y-6">
        {activeTab === "details" && (
          <>
            <h2 className="text-lg font-semibold">About {item.name}</h2>
            <p className="leading-relaxed text-muted">{item.description}</p>
            <ReviewForm itemType={itemType} itemId={itemId} signedIn={signedIn} />
          </>
        )}

        {activeTab === "specs" && item.attributes && Object.keys(item.attributes).length > 0 && (
          <>
            <h2 className="text-lg font-semibold">Specifications</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(item.attributes).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-line bg-canvas p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {key}
                  </p>
                  <p className="mt-0.5 text-sm text-ink">{value}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "specs" && (!item.attributes || Object.keys(item.attributes).length === 0) && (
          <EmptyState
            icon={Star}
            title="No specifications listed"
            description="This item doesn't have structured attributes in the catalog."
          />
        )}

        {/* Reviews */}
        <section aria-label="Customer reviews" className="border-t border-line pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Reviews ({reviews.length})</h2>
              {reviews.length > 0 && (
                <p className="mt-0.5 text-xs text-muted">
                  {item.ratingAvg.toFixed(1)} average · {item.ratingCount} rating{item.ratingCount === 1 ? "" : "s"}
                </p>
              )}
            </div>
          </div>

          {reviews.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              description="Be the first to share your experience with this item."
              action={
                signedIn ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className={buttonClass("outline", "sm")}
                  >
                    Write a review
                  </button>
                ) : (
                  <Link href={`/login?next=${encodeURIComponent(window.location.pathname)}`} className={buttonClass("outline", "sm")}>
                    Sign in to review
                  </Link>
                )
              }
            />
          ) : (
            <div className="space-y-4 mt-4">
              {reviews.map((review: { id: string; rating: number; title: string | null; body: string | null; verifiedPurchase: boolean; createdAt: string; author: string }) => (
                <div key={review.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{review.author}</span>
                      {review.verifiedPurchase && (
                        <Badge tone="good" className="text-[10px] px-2 py-0.5">
                          Verified purchase
                        </Badge>
                      )}
                    </div>
                    <Rating value={review.rating} className="text-xs" />
                  </div>
                  {review.title && <h4 className="text-sm font-semibold">{review.title}</h4>}
                  <p className="text-sm leading-relaxed text-muted">{review.body}</p>
                  <span className="text-[11px] text-muted">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Related */}
        <section aria-label="Related items" className="border-t border-line pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">You might also like</h2>
          </div>
          {related.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mt-4">
              {related.map((entry) => (
                <ItemCard key={`${entry.type}:${entry.id}`} item={entry} />
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
