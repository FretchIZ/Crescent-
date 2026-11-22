import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password";
import { ITEM_TYPES, SORT_VALUES } from "@/lib/constants";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter your email address")
  .max(254, "Email is too long")
  .email("Enter a valid email address");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80, "Name is too long"),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "This reset link is invalid").max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20, "This verification link is invalid").max(200),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(400).optional().or(z.literal("")),
  budgetMin: z.number().int().min(0).max(50_000_000).optional().nullable(),
  budgetMax: z.number().int().min(0).max(50_000_000).optional().nullable(),
  location: z.string().trim().max(80).optional().or(z.literal("")),
  locationConsent: z.boolean().optional(),
});

export const preferencesSchema = z
  .object({
    interests: z
      .array(
        z.object({
          label: z.string().trim().min(2).max(40),
          weight: z.number().min(0).max(3).optional(),
        })
      )
      .max(20)
      .default([]),
    budgetMin: z.number().int().min(0).max(50_000_000).nullable().optional(),
    budgetMax: z.number().int().min(0).max(50_000_000).nullable().optional(),
    location: z.string().trim().max(80).nullable().optional(),
    locationConsent: z.boolean().optional(),
    personalizationConsent: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.budgetMin === undefined ||
      value.budgetMin === null ||
      value.budgetMax === undefined ||
      value.budgetMax === null ||
      value.budgetMax >= value.budgetMin,
    { message: "Maximum budget must be greater than the minimum", path: ["budgetMax"] }
  );

export const searchFiltersSchema = z.object({
  minPrice: z.number().min(0).max(50_000_000).optional(),
  maxPrice: z.number().min(0).max(50_000_000).optional(),
  minRating: z.number().min(1).max(5).optional(),
  category: z.string().max(60).optional(),
  availability: z.string().max(40).optional(),
  location: z.string().max(80).optional(),
  brand: z.string().max(80).optional(),
  delivery: z.enum(["online", "onsite"]).optional(),
});

export const searchSchema = z.object({
  query: z.string().trim().min(3, "Describe what you are looking for").max(500, "Keep it under 500 characters"),
  sessionId: z.string().min(5).max(60).optional(),
  itemType: z.enum(["PRODUCT", "SERVICE", "BOTH"]).optional(),
  filters: searchFiltersSchema.optional(),
  sort: z.enum(SORT_VALUES).optional(),
  page: z.number().int().min(1).max(50).optional(),
  pageSize: z.number().int().min(1).max(48).optional(),
  refine: z.boolean().optional(),
});

export const favoriteSchema = z.object({
  itemType: z.enum(ITEM_TYPES),
  itemId: z.string().min(1).max(60),
});

export const bookingSchema = z.object({
  serviceId: z.string().min(1).max(60),
  preferredAt: z.coerce.date().refine((date) => date.getTime() > Date.now() + 60 * 60 * 1000, {
    message: "Choose a time at least an hour from now",
  }).refine((date) => date.getTime() < Date.now() + 365 * 24 * 60 * 60 * 1000, {
    message: "Choose a time within the next year",
  }),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  // Optional idempotency key; the Idempotency-Key header is preferred.
  idempotencyKey: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9._:-]+$/).optional(),
});

export const bookingActionSchema = z.object({
  action: z.enum(["cancel", "confirm", "complete"]),
});

export const reviewSchema = z.object({
  itemType: z.enum(ITEM_TYPES),
  itemId: z.string().min(1).max(60),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional().or(z.literal("")),
  body: z.string().trim().min(10, "Tell us a little more").max(1500, "Keep it under 1,500 characters"),
});

export const catalogQuerySchema = z.object({
  q: z.string().max(120).optional(),
  type: z.enum(["PRODUCT", "SERVICE", "ALL"]).optional(),
  category: z.string().max(60).optional(),
  seller: z.string().max(60).optional(),
  brand: z.string().max(80).optional(),
  minPrice: z.coerce.number().min(0).max(50_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(50_000_000).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  location: z.string().max(80).optional(),
  availability: z.string().max(40).optional(),
  delivery: z.enum(["online", "onsite"]).optional(),
  sort: z.enum(SORT_VALUES).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(48).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
