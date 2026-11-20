import type { SortOption } from "@/lib/constants";
import { CATEGORY_NAME, CATEGORY_TO_INTEREST } from "@/lib/constants";
import { tokenize, stem } from "@/lib/ai/synonyms";

/**
 * Intent extraction for natural-language search.
 *
 * Two engines:
 *  - extractIntentLocal — deterministic regex/keyword NLP. Default, and the
 *    fallback whenever the OpenAI call fails. No network required.
 *  - extractIntent — uses OpenAI structured outputs when OPENAI_API_KEY is
 *    configured, then normalizes into the same SearchIntent shape.
 *
 * refineIntent is intentionally synchronous: conversational refinement merges
 * the prior turn's constraints with the new message locally (comparative
 * language like "cheaper", "only experiences", "under ₱1,000").
 *
 * Prices in SearchIntent are whole pesos (PHP), matching SearchFilters and
 * UserProfile.budgetMin/budgetMax. Catalog rows store cents.
 */

export type IntentAttribute = { name: string; value: string };

export type SearchIntent = {
  rawQuery: string;
  keywords: string[];
  categorySlugs: string[];
  itemType: "PRODUCT" | "SERVICE" | "BOTH";
  interests: string[];
  requiredAttributes: IntentAttribute[];
  optionalAttributes: IntentAttribute[];
  maxPrice?: number; // PHP, whole pesos
  minPrice?: number;
  minRating?: number;
  location?: string;
  brand?: string;
  sort?: SortOption;
  mode: "local" | "openai";
  confidence: number;
  summary: string;
  chips: string[];
  assumptions: string[];
  needsClarification: boolean;
  clarification?: string;
};

// ---------------------------------------------------------------------------
// Static language resources
// ---------------------------------------------------------------------------

/** Keyword -> category slug (multiple categories can match one request). */
const CATEGORY_KEYWORDS: Array<{ slug: string; words: string[] }> = [
  {
    slug: "home-garden",
    words: [
      "garden", "gardening", "plant", "plants", "planter", "herb", "herbs",
      "soil", "compost", "botanical", "succulent", "orchid", "foliage",
      "landscaping", "lawn", "greenery", "repot",
    ],
  },
  {
    slug: "gifts",
    words: ["gift", "gifts", "present", "presents", "hamper", "keepsake", "gift set", "gift box"],
  },
  {
    slug: "classes-workshops",
    words: [
      "class", "classes", "course", "workshop", "lesson", "lessons",
      "tutorial", "bootcamp", "training", "masterclass", "seminar",
    ],
  },
  {
    slug: "home-services",
    words: [
      "repair", "fix", "plumber", "plumbing", "electrician", "cleaning",
      "cleaner", "housekeeping", "handyman", "carpenter", "carpentry",
      "installation", "install", "pest control", "moving", "mover",
      "laundry", "aircon", "technician", "maintenance",
    ],
  },
  {
    slug: "electronics",
    words: [
      "laptop", "notebook", "phone", "smartphone", "tablet", "camera",
      "headphones", "earbuds", "earphones", "speaker", "keyboard", "mouse",
      "monitor", "charger", "power bank", "drone", "gadget", "electronics",
      "tech", "smartwatch", "router", "console", "ssd", "display", "wired",
    ],
  },
  {
    slug: "travel-experiences",
    words: [
      "travel", "trip", "vacation", "tour", "hotel", "flight", "getaway",
      "experience", "experiences", "activity", "activities", "adventure",
      "island", "hiking", "camping", "weekend", "walk", "city tour",
    ],
  },
  {
    slug: "food-drink",
    words: [
      "cook", "cooking", "kitchen", "recipe", "coffee", "tea", "bake",
      "baking", "pastry", "knife", "cookware", "meal", "food", "snack",
      "spice", "beans", "brew", "espresso", "pantry",
    ],
  },
  {
    slug: "wellness-fitness",
    words: [
      "fitness", "workout", "exercise", "gym", "yoga", "pilates", "running",
      "cycling", "bike", "dumbbell", "massage", "wellness", "meditation",
      "protein", "sneakers", "training plan", "sauna", "recovery",
    ],
  },
  {
    slug: "fashion",
    words: [
      "fashion", "shirt", "dress", "jacket", "bag", "wallet", "shoes",
      "sandals", "jewelry", "accessories", "sunglasses", "belt", "apparel",
      "outfit", "jeans", "clothing", "wear",
    ],
  },
  {
    slug: "books-learning",
    words: [
      "book", "books", "novel", "reading", "journal", "planner", "pen",
      "stationery", "manga", "comic", "notebook paper", "diary", "stationery",
    ],
  },
  {
    slug: "pets",
    words: ["pet", "pets", "dog", "cat", "puppy", "kitten", "leash", "aquarium", "pet food"],
  },
];

const SERVICE_HINT_WORDS = [
  "service", "services", "fix", "repair", "book", "booking", "appointment",
  "class", "course", "workshop", "lesson", "consultation", "consult",
  "install", "cleaning", "clean", "hire", "experience", "activity",
  "tour", "tutor", "training", "visit", "maintenance", "session",
  "someone to", "i need someone", "on-site", "onsite",
];

const PRODUCT_HINT_WORDS = [
  "buy", "shop", "set", "kit", "pack", "bundle", "gadget", "laptop",
  "planter", "mug", "bottle", "bag", "shirt", "shoes", "gear", "device",
  "equipment", "supply", "supplies", "lamp", "desk", "under",
];

const RECIPIENT_WORDS: Record<string, string> = {
  mom: "Mom", mother: "Mom", mum: "Mom", mama: "Mom", nanay: "Mom",
  dad: "Dad", father: "Dad", papa: "Dad", tatay: "Dad",
  wife: "Wife", husband: "Husband", partner: "Partner", spouse: "Partner",
  boyfriend: "Boyfriend", girlfriend: "Girlfriend",
  friend: "Friend", bestfriend: "Best friend", barkada: "Friends",
  kid: "Kid", child: "Kid", children: "Kids", toddler: "Toddler", baby: "Baby",
  brother: "Brother", sister: "Sister", sibling: "Sibling",
  teacher: "Teacher", colleague: "Colleague", boss: "Boss", myself: "Myself",
};

const OCCASION_WORDS: Record<string, string> = {
  birthday: "Birthday", bday: "Birthday", anniversary: "Anniversary",
  christmas: "Christmas", xmas: "Christmas", graduation: "Graduation",
  wedding: "Wedding", housewarming: "Housewarming", valentine: "Valentine",
  "mother's": "Mother's Day", "father's": "Father's Day",
};

const LOCATION_WORDS = [
  "manila", "quezon city", "makati", "cebu", "davao", "pasig", "taguig",
  "bgc", "alabang", "mandaluyong", "iloilo", "baguio", "pampanga",
  "bacolod", "caloocan", "paranaque", "muntinlupa", "antipolo", "lapu-lapu",
  "near me", "nearby",
];

const ATTRIBUTE_PATTERNS: Array<{ re: RegExp; name: string; value: string }> = [
  { re: /\b(battery life|battery)\b[^,.;]{0,30}\b(long|lasts?|all[- ]day|8\+? ?hrs?|10\+? ?hrs?|12\+? ?hrs?|24\+? ?hrs?)\b/i, name: "Battery", value: "Long-lasting" },
  { re: /\bwaterproof\b/i, name: "Water resistance", value: "Waterproof" },
  { re: /\b(minimalist|minimal|simple design|clean design)\b/i, name: "Style", value: "Minimalist" },
  { re: /\b(lightweight|light[- ]weight|portable)\b/i, name: "Portability", value: "Lightweight" },
  { re: /\b(durable|sturdy|long[- ]lasting|hardwearing)\b/i, name: "Durability", value: "Durable" },
  { re: /\b(ergonomic)\b/i, name: "Ergonomics", value: "Ergonomic" },
  { re: /\b(organic|eco[- ]friendly|sustainable)\b/i, name: "Sustainability", value: "Eco-friendly" },
  { re: /\b(wireless|bluetooth|cordless)\b/i, name: "Connectivity", value: "Wireless" },
  { re: /\b(compact|small space|apartment[- ]friendly)\b/i, name: "Size", value: "Compact" },
  { re: /\b(fast charging|quick charge|fast[- ]charge)\b/i, name: "Charging", value: "Fast charging" },
  { re: /\b(stainless steel|aluminum|aluminium|bamboo|ceramic|cotton|leather|oak|walnut)\b/i, name: "Material", value: "" },
  { re: /\b(4k|ultra[- ]hd|uhd)\b/i, name: "Display", value: "4K" },
  { re: /\b(reusable|zero waste|plastic[- ]free)\b/i, name: "Sustainability", value: "Reusable" },
  { re: /\b(vegan|cruelty[- ]free|paraben[- ]free)\b/i, name: "Formulation", value: "Clean" },
  { re: /\b(beginner[- ]friendly|for beginners)\b/i, name: "Skill level", value: "Beginner" },
  { re: /\b(indoor)\b/i, name: "Placement", value: "Indoor" },
  { re: /\b(outdoor|outdoors|patio)\b/i, name: "Placement", value: "Outdoor" },
  { re: /\b(great (?:for|with) (?:long|all[- ]day))\b/i, name: "Battery", value: "Long-lasting" },
];

const FULFILMENT_WORDS: Record<string, string> = {
  delivery: "Delivery", deliver: "Delivery", ship: "Delivery",
  pickup: "Pickup", "pick up": "Pickup",
  "on-site": "On-site", onsite: "On-site", "in person": "On-site", "in-person": "On-site",
  online: "Online", virtual: "Online", remote: "Online",
};

// ---------------------------------------------------------------------------
// Money parsing (whole pesos)
// ---------------------------------------------------------------------------

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "");
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)k$/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const plain = cleaned.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) return Math.round(parseFloat(plain[1]));
  return null;
}

function extractBudget(text: string): { max: number | null; min: number | null } {
  let max: number | null = null;
  let min: number | null = null;

  const maxPatterns = [
    /(?:under|below|less than|up to|max(?:imum)?|budget(?: of| is|:)?|within|no more than|not more than)\s*(?:₱|php|pesos?|p)?\s*([\d.,]+\s*[kK]?)/g,
    /₱\s*([\d.,]+\s*[kK]?)\s*(?:or less|and under|and below)/g,
  ];
  for (const re of maxPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const v = parseAmount(m[1]);
      if (v != null && v <= 10_000_000 && (max == null || v < max)) max = v;
    }
  }

  const minPatterns = [
    /(?:over|above|more than|at least|min(?:imum)?|from)\s*(?:₱|php|pesos?|p)?\s*([\d.,]+\s*[kK]?)/g,
  ];
  for (const re of minPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const v = parseAmount(m[1]);
      if (v != null && v <= 10_000_000 && (min == null || v > min)) min = v;
    }
  }
  if (min != null && max != null && min > max) min = null;
  return { max, min };
}

function detectItemType(text: string): {
  itemType: SearchIntent["itemType"];
  explicit: boolean;
} {
  const lower = text.toLowerCase();
  if (/\b(products? only|only products?|just products?|things|items|goods)\b/.test(lower)) {
    return { itemType: "PRODUCT", explicit: true };
  }
  if (/\b(services? only|only services?|just services?|experiences? only|only experiences?|classes only|activities only)\b/.test(lower)) {
    return { itemType: "SERVICE", explicit: true };
  }
  if (/\b(both|products? and services?|products? & services?)\b/.test(lower)) {
    return { itemType: "BOTH", explicit: true };
  }
  const serviceScore = SERVICE_HINT_WORDS.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0);
  const productScore = PRODUCT_HINT_WORDS.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0);
  if (serviceScore > productScore) return { itemType: "SERVICE", explicit: false };
  if (productScore > serviceScore) return { itemType: "PRODUCT", explicit: false };
  return { itemType: "BOTH", explicit: false };
}

function detectCategories(text: string): string[] {
  const lower = text.toLowerCase();
  const slugs: string[] = [];
  for (const { slug, words } of CATEGORY_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) slugs.push(slug);
  }
  return slugs;
}

function detectAttributes(text: string): {
  required: IntentAttribute[];
  optional: IntentAttribute[];
} {
  const required: IntentAttribute[] = [];
  const optional: IntentAttribute[] = [];
  const requiredCues = /\b(?:with|that (?:has|have)|must (?:have|be)|needs?|requires?|I want (?:it )?to)\b/i;
  const optionalCues = /\b(?:prefer(?:ably)?|ideally|nice to have|if possible|or at least|optionally)\b/i;

  for (const { re, name, value } of ATTRIBUTE_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const v = value || m[1]?.toLowerCase() || "Yes";
    const start = Math.max(0, (m.index ?? 0) - 40);
    const context = text.slice(start, (m.index ?? 0) + m[0].length + 10);
    const isOptional = optionalCues.test(context) && !requiredCues.test(context);
    const attr = { name, value: v.charAt(0).toUpperCase() + v.slice(1) };
    (isOptional ? optional : required).push(attr);
  }
  return { required, optional };
}

function detectRating(text: string): number | undefined {
  const star = text.match(/(\d(?:\.\d)?)\s*(?:star|stars|★)/i);
  if (star) {
    const v = parseFloat(star[1]);
    if (v >= 1 && v <= 5) return v;
  }
  if (/\b(top[- ]rated|highly rated|well[- ]rated|best reviewed)\b/i.test(text)) return 4.5;
  return undefined;
}

function detectRecipient(text: string): string | null {
  const tokens = tokenize(text);
  for (const t of tokens) {
    const stemT = stem(t);
    for (const [word, label] of Object.entries(RECIPIENT_WORDS)) {
      if (t === word || stemT === stem(word)) return label;
    }
  }
  const m = text.match(/\bfor (?:my|a|our)\s+(\w+)/i);
  if (m) {
    const w = m[1].toLowerCase();
    return RECIPIENT_WORDS[w] ?? null;
  }
  return null;
}

function detectOccasion(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [word, label] of Object.entries(OCCASION_WORDS)) {
    if (new RegExp(`\\b${word.replace("'", "'")}\\b`, "i").test(lower)) return label;
  }
  if (/\bgift(?:ing)?\b/i.test(lower)) return "Gift";
  return null;
}

function detectLocation(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const loc of LOCATION_WORDS) {
    if (lower.includes(loc)) return loc === "near me" || loc === "nearby" ? "near me" : titleCase(loc);
  }
  const m = lower.match(/\bin\s+([a-z][a-z\s]{2,30}?)(?=[,.]|$|\s+and\b|\s+that\b)/);
  if (m) {
    const candidate = m[1].trim();
    if (candidate.length >= 3 && !/^\d/.test(candidate)) return titleCase(candidate);
  }
  return undefined;
}

function detectBrand(text: string): string | undefined {
  const m = text.match(/\b(?:from|by)\s+([A-Z][A-Za-z0-9&]{1,25}(?:\s+[A-Z][A-Za-z0-9&]{1,25})?)/);
  return m ? m[1].trim() : undefined;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function interestsForCategories(slugs: string[]): string[] {
  const labels = slugs.map((slug) => CATEGORY_TO_INTEREST[slug]).filter(Boolean) as string[];
  return [...new Set(labels)];
}

function typeLabel(itemType: SearchIntent["itemType"]): string {
  return itemType === "BOTH" ? "products and services" : itemType === "PRODUCT" ? "products" : "services";
}

function buildSummary(intent: Omit<SearchIntent, "summary">): string {
  const focus = intent.categorySlugs
    .map((slug) => CATEGORY_NAME[slug])
    .filter(Boolean);
  const base = `Looking across ${typeLabel(intent.itemType)}`;
  if (focus.length === 0) return `${base} that best match your description.`;
  const joined = focus.length === 1 ? focus[0] : `${focus.slice(0, -1).join(", ")} and ${focus[focus.length - 1]}`;
  return `${base} with a focus on ${joined}.`;
}

function buildChips(intent: {
  itemType: SearchIntent["itemType"];
  itemTypeExplicit: boolean;
  categorySlugs: string[];
  maxPrice?: number;
  minPrice?: number;
  location?: string;
  requiredAttributes: IntentAttribute[];
  recipient: string | null;
  occasion: string | null;
  interests: string[];
}): string[] {
  const chips: string[] = [];
  if (intent.recipient) chips.push(`For ${intent.recipient}`);
  else if (intent.occasion) chips.push(`${intent.occasion} pick`);
  if (intent.interests.length > 0) chips.push(`Loves ${intent.interests[0]}`);
  if (intent.maxPrice != null) chips.push(`Budget up to ₱${intent.maxPrice.toLocaleString("en-PH")}`);
  if (intent.minPrice != null) chips.push(`From ₱${intent.minPrice.toLocaleString("en-PH")}`);
  if (intent.itemTypeExplicit && intent.itemType !== "BOTH") {
    chips.push(intent.itemType === "PRODUCT" ? "Products only" : "Services only");
  }
  if (intent.requiredAttributes.length > 0) {
    chips.push(`${intent.requiredAttributes[0].name}: ${intent.requiredAttributes[0].value}`);
  }
  if (intent.location && intent.location !== "near me") chips.push(`Near ${intent.location}`);
  return chips.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Local extraction
// ---------------------------------------------------------------------------

export function extractIntentLocal(query: string): SearchIntent {
  const rawQuery = query.trim();
  const { max, min } = extractBudget(rawQuery);
  const { required, optional } = detectAttributes(rawQuery);
  const { itemType, explicit } = detectItemType(rawQuery);
  const categorySlugs = detectCategories(rawQuery);
  const recipient = detectRecipient(rawQuery);
  const occasion = detectOccasion(rawQuery);
  const location = detectLocation(rawQuery);
  const keywords = tokenize(rawQuery).slice(0, 12);
  const interests = interestsForCategories(categorySlugs);
  const minRating = detectRating(rawQuery);

  const assumptions: string[] = [];
  if (!explicit) {
    assumptions.push(
      itemType === "BOTH"
        ? "Including both products and services"
        : `Read this as a request for ${typeLabel(itemType)}`
    );
  }
  if (location === "near me") {
    assumptions.push("“Near me” will use your saved location when you're signed in");
  }

  const signals =
    (categorySlugs.length ? 1 : 0) +
    (max != null || min != null ? 1 : 0) +
    (explicit ? 1 : 0) +
    (required.length || optional.length ? 1 : 0) +
    (location ? 1 : 0) +
    (recipient || occasion ? 1 : 0);
  const needsClarification = keywords.length < 2 && categorySlugs.length === 0 && max == null;
  const confidence = needsClarification
    ? 0.4
    : Math.min(0.95, 0.55 + signals * 0.08);

  const base: Omit<SearchIntent, "summary"> = {
    rawQuery,
    keywords,
    categorySlugs,
    itemType,
    interests,
    requiredAttributes: required,
    optionalAttributes: optional,
    ...(max != null ? { maxPrice: max } : {}),
    ...(min != null ? { minPrice: min } : {}),
    ...(minRating != null ? { minRating } : {}),
    ...(location ? { location } : {}),
    ...(detectBrand(rawQuery) ? { brand: detectBrand(rawQuery) } : {}),
    mode: "local",
    confidence,
    chips: buildChips({
      itemType,
      itemTypeExplicit: explicit,
      categorySlugs,
      ...(max != null ? { maxPrice: max } : {}),
      ...(min != null ? { minPrice: min } : {}),
      ...(location ? { location } : {}),
      requiredAttributes: required,
      recipient,
      occasion,
      interests,
    }),
    assumptions,
    needsClarification,
    ...(needsClarification
      ? {
          clarification:
            "Could you share a little more — what kind of thing are you after, and is there a budget I should keep in mind?",
        }
      : {}),
  };

  return { ...base, summary: buildSummary(base) };
}

// ---------------------------------------------------------------------------
// Public extraction (OpenAI when configured, local otherwise)
// ---------------------------------------------------------------------------

const INTENT_PROMPT = `You extract structured search intent from a shopper's natural-language request.
Return ONLY a JSON object with exactly these fields:
{
  "itemType": "PRODUCT" | "SERVICE" | "BOTH",
  "categorySlugs": array chosen from: home-garden, gifts, classes-workshops, home-services, electronics, travel-experiences, food-drink, wellness-fitness, fashion, books-learning, pets (empty if unclear),
  "keywords": up to 10 lowercase keywords from the request,
  "requiredAttributes": array of {"name": short label, "value": short value} for MUST-HAVE traits (e.g. "with excellent battery life" -> {"name":"Battery","value":"Long-lasting"}),
  "optionalAttributes": array of {"name","value"} for nice-to-have traits,
  "maxPrice": integer whole PHP pesos only if a budget is stated, else omit,
  "minPrice": integer whole PHP pesos only if a minimum is stated, else omit,
  "minRating": number (e.g. 4.5 for "4.5 stars") or omit,
  "location": place name mentioned, or omit,
  "brand": brand name mentioned, or omit,
  "recipient": lowercase recipient (mom, dad, friend...) or omit,
  "occasion": lowercase occasion (gift, birthday...) or omit,
  "assumptions": short strings for anything you inferred that is not literally in the text,
  "needsClarification": boolean,
  "clarification": question to ask the user when needsClarification is true, else omit,
  "confidence": number 0..1
Rules: never invent prices, ratings, or attributes that are not in the text. Currency in the request is PHP (₱).`;

export async function extractIntent(query: string): Promise<SearchIntent> {
  if (!process.env.OPENAI_API_KEY) return extractIntentLocal(query);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: INTENT_PROMPT },
            { role: "user", content: query },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      const parsed = JSON.parse(json.choices[0]?.message?.content ?? "{}");
      return normalizeOpenAIIntent(query, parsed);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.warn("[ai] OpenAI intent extraction failed, using local engine:", err);
    return extractIntentLocal(query);
  }
}

function normalizeOpenAIIntent(query: string, raw: Record<string, unknown>): SearchIntent {
  const local = extractIntentLocal(query);
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
  const attrPairs = (v: unknown): IntentAttribute[] =>
    (Array.isArray(v) ? v : [])
      .filter(
        (x): x is Record<string, unknown> =>
          !!x && typeof x === "object" && typeof (x as { name?: unknown }).name === "string"
      )
      .map((x) => ({
        name: String(x.name).slice(0, 40),
        value: String(x.value ?? "Yes").slice(0, 60),
      }))
      .slice(0, 8);
  const strArr = (v: unknown): string[] =>
    (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").slice(0, 12);

  const itemType =
    raw.itemType === "PRODUCT" || raw.itemType === "SERVICE" || raw.itemType === "BOTH"
      ? raw.itemType
      : local.itemType;
  const explicit = raw.itemType === "PRODUCT" || raw.itemType === "SERVICE" || raw.itemType === "BOTH";
  const recipient = str(raw.recipient) ?? null;
  const occasion = str(raw.occasion) ?? null;
  const maxPrice = num(raw.maxPrice);
  const minPrice = num(raw.minPrice);
  const location = str(raw.location);
  const requiredAttributes = attrPairs(raw.requiredAttributes);
  const optionalAttributes = attrPairs(raw.optionalAttributes);
  const categorySlugs = strArr(raw.categorySlugs).filter((slug) => slug in CATEGORY_NAME);
  const interests = interestsForCategories(categorySlugs);
  const assumptions = strArr(raw.assumptions);
  if (!explicit) assumptions.unshift("Including both products and services");

  const base: Omit<SearchIntent, "summary"> = {
    rawQuery: query.trim(),
    keywords: strArr(raw.keywords).length ? strArr(raw.keywords) : local.keywords,
    categorySlugs: categorySlugs.length ? categorySlugs : local.categorySlugs,
    itemType,
    interests: interests.length ? interests : local.interests,
    requiredAttributes: requiredAttributes.length ? requiredAttributes : local.requiredAttributes,
    optionalAttributes: optionalAttributes.length ? optionalAttributes : local.optionalAttributes,
    ...(maxPrice != null ? { maxPrice } : local.maxPrice != null ? { maxPrice: local.maxPrice } : {}),
    ...(minPrice != null ? { minPrice } : {}),
    ...(num(raw.minRating) != null ? { minRating: num(raw.minRating)! } : local.minRating != null ? { minRating: local.minRating } : {}),
    ...(location ? { location } : local.location ? { location: local.location } : {}),
    ...(str(raw.brand) ? { brand: raw.brand as string } : local.brand ? { brand: local.brand } : {}),
    mode: "openai",
    confidence: Math.min(1, Math.max(0, num(raw.confidence) ?? 0.8)),
    chips: buildChips({
      itemType,
      itemTypeExplicit: explicit,
      categorySlugs: base0(categorySlugs, local.categorySlugs),
      ...(maxPrice != null ? { maxPrice } : {}),
      ...(minPrice != null ? { minPrice } : {}),
      ...(location ? { location } : {}),
      requiredAttributes,
      recipient,
      occasion,
      interests,
    }),
    assumptions,
    needsClarification: raw.needsClarification === true,
    ...(typeof raw.clarification === "string" ? { clarification: raw.clarification } : {}),
  };

  return { ...base, summary: buildSummary(base) };
}

function base0(a: string[], b: string[]): string[] {
  return a.length ? a : b;
}

// ---------------------------------------------------------------------------
// Conversational refinement (synchronous merge)
// ---------------------------------------------------------------------------

const FRESH_START = /\b(something else|different|no longer|actually i want|change of mind|show me something else|reset)\b/i;
const CHEAPER = /\b(cheaper|less expensive|more affordable|lower price|best price|more budget[- ]friendly)\b/i;
const HIGHER_RATED = /\b(higher rated|better rated|more highly rated|best rated|top rated)\b/i;
const NEAR_ME = /\b(near me|nearby|in my area|in my city|local)\b/i;
const THIS_WEEK = /\b(this week|asap|urgent|available now|today|tomorrow|deliver(?:y)? (?:this|next) week)\b/i;
const TYPE_PHRASES: Array<{ re: RegExp; itemType: SearchIntent["itemType"] }> = [
  { re: /\b(only|just|limit(?:ed)? to)?\s*(experiences?|services?|classes|activities|lessons|tours)\b/i, itemType: "SERVICE" },
  { re: /\b(only|just|limit(?:ed)? to)?\s*(products?|things|items|goods|gear)\b/i, itemType: "PRODUCT" },
  { re: /\bboth\b/i, itemType: "BOTH" },
];

/**
 * Merge the prior turn's intent with a refinement message. Explicit new
 * values win; constraints the user didn't repeat are inherited. Comparative
 * language ("cheaper", "only experiences", "under ₱1,000") is applied here.
 */
export function refineIntent(previous: SearchIntent, query: string): SearchIntent {
  const message = query.trim();
  const lower = message.toLowerCase();
  const next = extractIntentLocal(message);

  if (FRESH_START.test(message)) {
    const fresh: SearchIntent = {
      ...next,
      itemType: next.itemType,
      categorySlugs: next.categorySlugs,
      maxPrice: next.maxPrice,
      minPrice: next.minPrice,
      requiredAttributes: next.requiredAttributes,
      optionalAttributes: next.optionalAttributes,
      interests: next.interests,
      assumptions: ["Started fresh from your new description"],
      mode: "local",
    };
    return { ...fresh, summary: buildSummary(fresh) };
  }

  // Type: explicit phrase wins, else inherit.
  let itemType = previous.itemType;
  let typeExplicit = false;
  for (const { re, itemType: t } of TYPE_PHRASES) {
    if (re.test(message)) {
      itemType = t;
      typeExplicit = true;
      break;
    }
  }
  if (!typeExplicit && next.itemType !== "BOTH" && detectItemType(message).explicit) {
    itemType = next.itemType;
    typeExplicit = true;
  }

  // Budget.
  let maxPrice = previous.maxPrice;
  const assumptions = [...next.assumptions];
  if (next.maxPrice != null) {
    maxPrice = next.maxPrice;
  } else if (CHEAPER.test(message)) {
    if (previous.maxPrice != null) {
      maxPrice = Math.max(100, Math.round(previous.maxPrice * 0.7));
      assumptions.push(`Tightened your budget to ₱${maxPrice.toLocaleString("en-PH")}`);
    } else {
      assumptions.push("Prioritised better-value options");
    }
  }

  // Rating.
  let minRating = previous.minRating;
  if (next.minRating != null) minRating = next.minRating;
  else if (HIGHER_RATED.test(message)) minRating = Math.max(previous.minRating ?? 0, 4.5);

  // Location.
  let location = previous.location;
  if (next.location) location = next.location;
  else if (NEAR_ME.test(message)) location = location ?? "near me";

  // Availability-flavoured keyword: keep "this week" so the ranker can boost
  // in-stock/bookable items on this turn.
  const keywords = [...new Set([...previous.keywords, ...next.keywords])].slice(0, 12);
  if (THIS_WEEK.test(message) && !keywords.includes("week")) keywords.push("week");

  const categorySlugs = next.categorySlugs.length > 0 ? next.categorySlugs : previous.categorySlugs;
  const interests = [...new Set([...previous.interests, ...next.interests])];
  const requiredAttributes = dedupeAttrs([...previous.requiredAttributes, ...next.requiredAttributes]);
  const optionalAttributes = dedupeAttrs([...previous.optionalAttributes, ...next.optionalAttributes]);
  const recipient = next.chips.find((c) => c.startsWith("For "))?.slice(4) ?? previous.chips.find((c) => c.startsWith("For "))?.slice(4) ?? null;
  const occasion = previous.chips.find((c) => c.endsWith(" pick"))?.replace(" pick", "") ?? null;

  if (Object.keys(next).length > 0 && previous.rawQuery !== message) {
    const inherited =
      maxPrice === previous.maxPrice &&
      itemType === previous.itemType &&
      categorySlugs === previous.categorySlugs;
    if (inherited && assumptions.length === 0) {
      assumptions.push("Kept your earlier preferences and re-ranked");
    }
  }

  const base: Omit<SearchIntent, "summary"> = {
    rawQuery: message,
    keywords,
    categorySlugs,
    itemType,
    interests,
    requiredAttributes,
    optionalAttributes,
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(previous.minPrice != null ? { minPrice: previous.minPrice } : {}),
    ...(minRating != null ? { minRating } : {}),
    ...(location ? { location } : {}),
    ...(previous.brand ? { brand: previous.brand } : {}),
    mode: "local",
    confidence: Math.max(previous.confidence, next.confidence, 0.7),
    chips: buildChips({
      itemType,
      itemTypeExplicit: typeExplicit,
      categorySlugs,
      ...(maxPrice != null ? { maxPrice } : {}),
      ...(location ? { location } : {}),
      requiredAttributes,
      recipient,
      occasion,
      interests,
    }),
    assumptions: [...new Set(assumptions)].slice(0, 3),
    needsClarification: false,
  };

  return { ...base, summary: buildSummary(base) };
}

function dedupeAttrs(attrs: IntentAttribute[]): IntentAttribute[] {
  const seen = new Map<string, IntentAttribute>();
  for (const attr of attrs) seen.set(attr.name, attr);
  return [...seen.values()];
}

/** Contextual follow-up chips, e.g. ["Only experiences", "Under ₱1,000", "Arrives this week"]. */
export function refinementSuggestions(intent: SearchIntent): string[] {
  const suggestions: string[] = [];

  if (intent.itemType === "BOTH") suggestions.push("Only experiences");
  else if (intent.itemType === "PRODUCT") suggestions.push("Include services");
  else suggestions.push("Include products");

  if (intent.maxPrice != null) {
    const tighter = Math.max(100, Math.round(intent.maxPrice * 0.7));
    suggestions.push(`Under ₱${tighter.toLocaleString("en-PH")}`);
  } else {
    suggestions.push("Under ₱1,000");
  }

  if (intent.minRating != null) suggestions.push("Even higher rated");
  else suggestions.push("4.5★ and up");

  if (!intent.location) suggestions.push("Near me");
  else suggestions.push("Arrives this week");

  return suggestions.slice(0, 4);
}

/** Category slug -> interest label (also used to infer new interests). */
export { CATEGORY_TO_INTEREST };
