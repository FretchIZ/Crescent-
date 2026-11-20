import type { RankedItem } from "@/lib/items";
import type { SearchIntent } from "@/lib/ai/intent";
import {
  buildLexicalVector,
  cosineDense,
  cosineLexical,
} from "@/lib/ai/embeddings";
import { stem, tokenize } from "@/lib/ai/synonyms";

/**
 * Relevance ranking.
 *
 * Combines lexical/semantic text fit, category fit, must-have and nice-to-have
 * attribute fit, budget fit, saved-interest affinity, verified ratings, and
 * availability into a 0..100 match score with human-readable reasons.
 * Every component is grounded in indexed catalog data — nothing is invented.
 */

export type RankOptions = {
  /** The signed-in user's saved interest labels (personalization, consented). */
  interests: string[];
  /** Query embedding when OpenAI embeddings are enabled; null otherwise. */
  openAIQueryEmbedding: number[] | null;
};

const MAX = {
  text: 38,
  category: 12,
  required: 14,
  optional: 6,
  budget: 13,
  interest: 9,
  rating: 10,
  brand: 4,
  location: 4,
  availability: 4,
  verified: 2,
} as const;

type Reasons = { text: string; points: number }[];

function haystack(item: RankedItem): string {
  return [
    item.name,
    item.summary,
    item.description,
    item.searchText,
    item.tags.join(" "),
    Object.entries(item.attributes)
      .map(([k, v]) => `${k} ${v}`)
      .join(" "),
    item.category.name,
    item.seller.name,
    item.brand ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function queryText(intent: SearchIntent): string {
  return [
    intent.rawQuery,
    intent.keywords.join(" "),
    intent.categorySlugs.join(" "),
    intent.requiredAttributes.map((a) => `${a.name} ${a.value}`).join(" "),
    intent.optionalAttributes.map((a) => `${a.name} ${a.value}`).join(" "),
  ].join(" ");
}

function matchedTokens(intent: SearchIntent, item: RankedItem): string[] {
  const itemTokens = new Set(tokenize(`${item.name} ${item.tags.join(" ")}`).map(stem));
  const hits = new Set<string>();
  for (const token of tokenize(intent.rawQuery).map(stem)) {
    if (itemTokens.has(token)) hits.add(token);
  }
  return [...hits].slice(0, 4);
}

function attrMatches(
  attrs: SearchIntent["requiredAttributes"],
  text: string
): { hit: string[]; miss: string[] } {
  const hit: string[] = [];
  const miss: string[] = [];
  for (const attr of attrs) {
    const tokens = `${attr.name} ${attr.value}`
      .toLowerCase()
      .split(/[^a-z0-9+]+/)
      .filter((t) => t.length > 2);
    (tokens.some((t) => text.includes(t)) ? hit : miss).push(attr.name);
  }
  return { hit, miss };
}

function scoreItem(
  item: RankedItem,
  intent: SearchIntent,
  options: RankOptions,
  queryVector: ReturnType<typeof buildLexicalVector> | null
): { score: number; reasons: Reasons; components: Record<string, number> } {
  const text = haystack(item);
  const reasons: Reasons = [];

  // --- Text / semantic fit ------------------------------------------------
  let textPoints = 0;
  if (options.openAIQueryEmbedding && item.embedding) {
    textPoints = Math.round(
      cosineDense(options.openAIQueryEmbedding, item.embedding) * MAX.text
    );
  } else if (queryVector) {
    textPoints = Math.round(
      cosineLexical(queryVector, buildLexicalVector(item.searchText || text)) * MAX.text
    );
  }
  const tokens = matchedTokens(intent, item);
  if (tokens.length > 0) {
    textPoints = Math.min(MAX.text, textPoints + tokens.length * 3);
    reasons.push({ text: `Matches “${tokens.join(", ")}”`, points: textPoints });
  }

  // --- Category fit -------------------------------------------------------
  let categoryPoints = 0;
  if (intent.categorySlugs.includes(item.category.slug)) {
    categoryPoints = MAX.category;
    reasons.push({
      text: `Matches ${item.category.name}`,
      points: categoryPoints,
    });
  } else if (intent.categorySlugs.length > 0) {
    const itemWords = new Set(
      `${item.name} ${item.summary} ${item.category.name}`.toLowerCase().split(/[^a-z]+/)
    );
    const overlap = intent.keywords.filter((k) => itemWords.has(k)).length;
    categoryPoints = Math.min(MAX.category - 4, overlap * 3);
  }

  // --- Required / optional attributes ------------------------------------
  const required = attrMatches(intent.requiredAttributes, text);
  const requiredPoints =
    required.hit.length > 0 && intent.requiredAttributes.length > 0
      ? Math.round((required.hit.length / intent.requiredAttributes.length) * MAX.required)
      : 0;
  for (const name of required.hit) {
    const attr = intent.requiredAttributes.find((a) => a.name === name);
    reasons.push({
      text: `Has your must-have: ${name}${attr && attr.value ? ` (${attr.value})` : ""}`,
      points: Math.round(requiredPoints / Math.max(1, required.hit.length)),
    });
  }

  const optional = attrMatches(intent.optionalAttributes, text);
  const optionalPoints =
    optional.hit.length > 0 && intent.optionalAttributes.length > 0
      ? Math.round((optional.hit.length / intent.optionalAttributes.length) * MAX.optional)
      : 0;
  if (optional.hit.length > 0) {
    reasons.push({ text: `Also fits: ${optional.hit.join(", ").toLowerCase()}`, points: optionalPoints });
  }

  // --- Budget -------------------------------------------------------------
  let budgetPoints = 0;
  const pricePesos = item.priceCents / 100;
  if (intent.maxPrice != null) {
    if (pricePesos <= intent.maxPrice) {
      const headroom = (intent.maxPrice - pricePesos) / intent.maxPrice;
      budgetPoints = Math.round(MAX.budget * (0.75 + 0.25 * (1 - headroom)));
      reasons.push({
        text: `Under your ₱${intent.maxPrice.toLocaleString("en-PH")} budget`,
        points: budgetPoints,
      });
    } else {
      budgetPoints = 0;
      reasons.push({
        text: `Over your ₱${intent.maxPrice.toLocaleString("en-PH")} budget`,
        points: -50,
      });
    }
  }
  if (intent.minPrice != null && pricePesos < intent.minPrice) {
    budgetPoints = 0;
  }

  // --- Saved-interest affinity -------------------------------------------
  let interestPoints = 0;
  const interestHits = options.interests.filter((label) => {
    const head = label.toLowerCase().split(" ")[0];
    return head.length > 2 && text.includes(head);
  });
  if (interestHits.length > 0) {
    interestPoints = Math.min(MAX.interest, interestHits.length * Math.ceil(MAX.interest / 2));
    reasons.push({
      text: `Fits your love of ${interestHits.join(", ").toLowerCase()}`,
      points: interestPoints,
    });
  }

  // --- Ratings ------------------------------------------------------------
  let ratingPoints = 0;
  if (item.ratingAvg > 0) {
    const base = (item.ratingAvg / 5) * MAX.rating * 0.85;
    const reviewFactor = Math.min(1, Math.log10(item.ratingCount + 1) / 1.5);
    ratingPoints = Math.round(base * (0.6 + 0.4 * reviewFactor));
    if (item.ratingAvg >= 4.4) {
      reasons.push({
        text: `Rated ${item.ratingAvg.toFixed(1)} from ${item.ratingCount} reviews`,
        points: ratingPoints,
      });
    }
    if (intent.minRating != null) {
      ratingPoints =
        item.ratingAvg >= intent.minRating
          ? Math.min(MAX.rating, ratingPoints + 2)
          : Math.max(0, ratingPoints - 8);
      if (item.ratingAvg < intent.minRating) {
        reasons.push({
          text: `Below your ${intent.minRating}★ minimum`,
          points: -40,
        });
      }
    }
  }

  // --- Brand --------------------------------------------------------------
  let brandPoints = 0;
  if (intent.brand && item.brand) {
    if (item.brand.toLowerCase().includes(intent.brand.toLowerCase())) {
      brandPoints = MAX.brand;
      reasons.push({ text: `From ${item.brand}`, points: brandPoints });
    }
  }

  // --- Location -----------------------------------------------------------
  let locationPoints = 0;
  if (intent.location && intent.location !== "near me" && item.location) {
    if (item.location.toLowerCase().includes(intent.location.toLowerCase())) {
      locationPoints = MAX.location;
      reasons.push({ text: `Available in ${item.location}`, points: locationPoints });
    }
  }

  // --- Availability -------------------------------------------------------
  const wantsImmediate = intent.keywords.some((k) =>
    ["week", "today", "tomorrow", "now", "asap", "urgent", "immediately"].includes(k)
  );
  let availabilityPoints = 0;
  const inStock = ["IN_STOCK", "AVAILABLE", "LOW_STOCK"].includes(item.availability);
  if (inStock) availabilityPoints = MAX.availability;
  else if (item.availability === "MADE_TO_ORDER") availabilityPoints = Math.round(MAX.availability * 0.6);
  else availabilityPoints = Math.round(MAX.availability * 0.2);
  if (wantsImmediate) {
    availabilityPoints = inStock ? MAX.availability : 0;
    if (!inStock) {
      reasons.push({ text: "Not available right away", points: -30 });
    } else {
      reasons.push({ text: "Available right away", points: MAX.availability });
    }
  }

  // --- Verified provider --------------------------------------------------
  const verifiedPoints = item.verified && item.seller.verified ? MAX.verified : 0;

  const components: Record<string, number> = {
    text: textPoints,
    category: categoryPoints,
    required: requiredPoints,
    optional: optionalPoints,
    budget: budgetPoints,
    interest: interestPoints,
    rating: ratingPoints,
    brand: brandPoints,
    location: locationPoints,
    availability: availabilityPoints,
    verified: verifiedPoints,
  };

  // Normalize over the components that can apply to this specific query so a
  // query without a budget or interests doesn't dilute everyone's score.
  const applicableMax =
    MAX.text +
    (intent.categorySlugs.length > 0 ? MAX.category : 0) +
    (intent.requiredAttributes.length > 0 ? MAX.required : 0) +
    (intent.optionalAttributes.length > 0 ? MAX.optional : 0) +
    (intent.maxPrice != null || intent.minPrice != null ? MAX.budget : 0) +
    (options.interests.length > 0 ? MAX.interest : 0) +
    MAX.rating +
    (intent.brand ? MAX.brand : 0) +
    (intent.location && intent.location !== "near me" ? MAX.location : 0) +
    MAX.availability +
    MAX.verified;

  const raw = Object.values(components).reduce((sum, v) => sum + Math.max(0, v), 0);
  const score = Math.max(
    0,
    Math.min(100, Math.round((raw / Math.max(1, applicableMax)) * 100))
  );

  if (reasons.length === 0) {
    reasons.push({ text: `Related to “${intent.rawQuery.slice(0, 60)}”`, points: 1 });
  }

  return { score, reasons: reasons.sort((a, b) => b.points - a.points).slice(0, 4), components };
}

/**
 * Rank the full (type-filtered) catalog against an intent.
 * Returns every item with matchScore/matchReasons/explanation, best first.
 */
export function rankItems(
  catalog: RankedItem[],
  intent: SearchIntent,
  options: RankOptions
): RankedItem[] {
  const qText = queryText(intent);
  const queryVector = options.openAIQueryEmbedding ? null : buildLexicalVector(qText);

  const ranked = catalog.map((item) => {
    const { score, reasons } = scoreItem(item, intent, options, queryVector);
    const explanation = reasons
      .filter((r) => r.points > 0)
      .map((r) => r.text)
      .join(". ");
    return {
      ...item,
      matchScore: score,
      matchReasons: reasons.map((r) => r.text),
      explanation: explanation || `Closest fit for “${intent.rawQuery.slice(0, 60)}”`,
    } satisfies RankedItem;
  });

  ranked.sort(
    (a, b) => b.matchScore - a.matchScore || b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount
  );
  return ranked;
}
