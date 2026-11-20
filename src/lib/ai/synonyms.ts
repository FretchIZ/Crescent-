/**
 * Lexical-semantic resources for the local (no-API-key) search engine.
 *
 * The local engine expands tokens through these synonym groups so that
 * "laptop" retrieves "notebook", "gift" retrieves "present", etc. This is a
 * lightweight, deterministic form of semantic expansion — not a neural model,
 * but real retrieval behavior rather than exact-string matching.
 */

/** Synonym groups: any member maps to the group's canonical concept. */
export const SYNONYM_GROUPS: string[][] = [
  // Computing
  ["laptop", "notebook", "ultrabook", "chromebook", "macbook", "computer"],
  ["phone", "smartphone", "mobile", "cellphone", "handset"],
  ["tablet", "ipad", "slate"],
  ["headphones", "earphones", "earbuds", "headset", "airpods"],
  ["camera", "dslr", "mirrorless", "webcam"],
  ["keyboard", "mechanical keyboard"],
  ["mouse", "trackpad"],

  // Home & garden
  ["garden", "gardening", "horticulture", "horticultural", "plants", "planting"],
  ["planter", "pot", "planter pot", "flowerpot"],
  ["herb", "herbs", "herbal"],
  ["indoor", "houseplant", "houseplant", "foliage"],
  ["soil", "compost", "potting mix"],
  ["watering", "irrigation", "sprinkler"],

  // Gifting & occasions
  ["gift", "present", "gifts", "presents", "gift-giving"],
  ["birthday", "birthdays"],
  ["anniversary", "memorial day"],
  ["christmas", "xmas", "holiday", "yuletide"],

  // Food & kitchen
  ["cook", "cooking", "cookery", "culinary", "kitchen"],
  ["recipe", "recipes", "cookbook"],
  ["coffee", "espresso", "brew"],
  ["tea", "tealeaf", "herbal tea"],
  ["bake", "baking", "pastry", "bakery"],

  // Fitness & wellness
  ["fitness", "workout", "exercise", "training", "gym"],
  ["yoga", "pilates", "meditation"],
  ["running", "jogging", "trail run"],
  ["cycling", "bike", "bicycle"],

  // Beauty & care
  ["skincare", "skin care", "serum", "moisturizer"],
  ["spa", "massage", "wellness", "pampering"],
  ["haircut", "hair", "salon", "barber"],

  // Learning & experiences
  ["class", "classes", "course", "courses", "workshop", "workshops", "lesson", "lessons", "tutorial"],
  ["learn", "learning", "study", "master"],
  ["experience", "experiences", "activity", "adventure", "things to do"],

  // Home services
  ["repair", "fix", "fixing", "maintenance", "mend"],
  ["plumbing", "plumber", "leak", "sink"],
  ["cleaning", "clean", "housekeeping", "deep clean"],
  ["electrician", "electrical", "wiring"],
  ["handyman", "handyperson", "carpentry", "carpenter"],
  ["laundry", "wash"],

  // Travel
  ["travel", "trip", "vacation", "getaway", "tour"],
  ["hotel", "stay", "lodging", "accommodation"],
  ["flight", "airline", "plane"],

  // Quality / value language
  ["cheap", "affordable", "budget", "inexpensive", "economical", "value", "mura"],
  ["premium", "luxury", "high-end", "high end", "top-of-the-line", "upscale", "deluxe"],
  ["durable", "sturdy", "long-lasting", "hardwearing", "robust"],
  ["lightweight", "light-weight", "portable", "travel-friendly"],
  ["minimalist", "minimal", "simple", "understated", "clean design"],
  ["eco", "eco-friendly", "sustainable", "organic", "environmentally friendly"],
  ["wireless", "cordless", "bluetooth"],
  ["waterproof", "water-resistant", "splash-proof"],

  // People / recipients
  ["mom", "mother", "mum", "mama", "nanay"],
  ["dad", "father", "papa", "tatay"],
  ["partner", "spouse", "wife", "husband", "boyfriend", "girlfriend"],
  ["friend", "barkada", "best friend"],
  ["kid", "child", "children", "toddler", "baby"],
  ["sibling", "brother", "sister"],
];

/** token -> canonical concept tokens (the group it belongs to). */
const SYNONYM_MAP = new Map<string, Set<string>>();
for (const group of SYNONYM_GROUPS) {
  const set = new Set(group);
  for (const member of group) {
    const existing = SYNONYM_MAP.get(member) ?? new Set<string>();
    for (const g of group) existing.add(g);
    SYNONYM_MAP.set(member, existing);
    void set;
  }
}

export function expandToken(token: string): string[] {
  const group = SYNONYM_MAP.get(token);
  return group ? [token, ...group] : [token];
}

/** Very small English stemmer: strips plural/gerund suffixes for matching. */
export function stem(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  if (token.endsWith("ed") && token.length > 4) return token.slice(0, -2);
  return token;
}

const STOPWORDS = new Set(
  `a an the and or but if then than that this these those of in on at to for from with
   without by as is are was were be been being it its into over under about me my your
   his her their we us they i you he she do does did doing have has had who whom which
   what when where why how not no yes very much more most some any all each other such
   can could should would will just also up out off again further here there now`
    .split(/\s+/)
    .filter(Boolean)
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
