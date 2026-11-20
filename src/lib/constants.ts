/** Shared domain constants. Stored as validated strings in the database. */

export const ROLES = ["CUSTOMER", "SELLER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ITEM_TYPES = ["PRODUCT", "SERVICE"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const AVAILABILITY = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  MADE_TO_ORDER: "Made to order",
  OUT_OF_STOCK: "Out of stock",
  AVAILABLE: "Available",
  WAITLIST: "Waitlist",
  UNAVAILABLE: "Unavailable",
} as const;
export type Availability = keyof typeof AVAILABILITY;

export const DELIVERY_MODES = {
  ONLINE: "Online",
  ONSITE: "On-site",
  BOTH: "Online or on-site",
} as const;

export const BOOKING_STATUS = {
  PENDING: "Pending confirmation",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
} as const;

export const SORT_VALUES = ["relevance", "price_asc", "price_desc", "rating", "newest"] as const;
export type SortOption = (typeof SORT_VALUES)[number];

export const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "price_asc", label: "Lowest price" },
  { value: "price_desc", label: "Highest price" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
] as const satisfies ReadonlyArray<{ value: SortOption; label: string }>;

export const PRICE_BANDS = [
  { label: "Under ₱500", min: 0, max: 500 },
  { label: "₱500 – ₱1,500", min: 500, max: 1500 },
  { label: "₱1,500 – ₱5,000", min: 1500, max: 5000 },
  { label: "₱5,000 – ₱20,000", min: 5000, max: 20000 },
  { label: "Over ₱20,000", min: 20000, max: null },
] as const;

export const POPULAR_INTERESTS = [
  "Gardening",
  "Home cooking",
  "Travel",
  "Fitness",
  "Reading",
  "Photography",
  "Arts & crafts",
  "Tech & programming",
  "Pets",
  "Wellness",
] as const;

/** Category slug -> display name (single source of truth for the catalog). */
export const CATEGORY_NAME: Record<string, string> = {
  "home-garden": "Home & Garden",
  gifts: "Gifts & Keepsakes",
  "classes-workshops": "Classes & Workshops",
  "home-services": "Home Services",
  electronics: "Tech & Electronics",
  "travel-experiences": "Travel & Experiences",
  "food-drink": "Food & Drink",
  "wellness-fitness": "Wellness & Fitness",
  fashion: "Fashion & Accessories",
  "books-learning": "Books & Learning",
  pets: "Pets & Animals",
};

/** Category slug -> the saved-interest label it maps to (personalization). */
export const CATEGORY_TO_INTEREST: Record<string, string> = {
  "home-garden": "Gardening",
  "food-drink": "Home cooking",
  "travel-experiences": "Travel",
  "wellness-fitness": "Wellness",
  electronics: "Tech & programming",
  "books-learning": "Reading",
  pets: "Pets",
  fashion: "Fashion",
  "classes-workshops": "Arts & crafts",
  gifts: "Gifts",
  "home-services": "Home services",
};

export const EXAMPLE_QUERIES = [
  "A gift for my mom who loves gardening, under ₱2,000",
  "Minimalist laptop for programming with great battery life",
  "Weekend activity that feels like me",
  "Someone to fix my kitchen sink today",
  "Things I'd love under ₱1,000",
] as const;

/** Simple, grounded labels — never claim a review is verified unless it is. */
export const DESCRIPTION_SOURCE_LABEL = {
  PROVIDER: "Provider-supplied details",
  PLATFORM: "Platform-generated summary",
} as const;

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isItemType(value: string): value is ItemType {
  return (ITEM_TYPES as readonly string[]).includes(value);
}

export function availabilityLabel(value: string): string {
  return (AVAILABILITY as Record<string, string>)[value] ?? value;
}

export function sortLabel(value: string): string {
  return SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Most relevant";
}
