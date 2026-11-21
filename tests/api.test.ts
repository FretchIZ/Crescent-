import { describe, test, expect, beforeAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth/session";
import { cookieStore } from "./setup";
import { randomBytes } from "node:crypto";

// Test environment is configured in tests/setup.ts (setupFiles)
const j = JSON.stringify;

const USER_TABLES = [
  "AuditLog",
  "AIMessage",
  "SearchResult",
  "SearchQuery",
  "SearchSession",
  "ItemView",
  "Recommendation",
  "Review",
  "Favorite",
  "Booking",
  "Interest",
  "UserProfile",
  "Session",
  "PasswordResetToken",
  "EmailVerificationToken",
  "User",
];

let categoryId: string;
let sellerId: string;

async function seedCatalog() {
  const category = await db.category.upsert({
    where: { slug: "home-garden" },
    update: {},
    create: { slug: "home-garden", name: "Home & Garden", kind: "BOTH", sortOrder: 0 },
  });
  categoryId = category.id;

  const seller = await db.seller.upsert({
    where: { slug: "green-thumb" },
    update: {},
    create: { slug: "green-thumb", name: "Green Thumb Nursery", verified: true },
  });
  sellerId = seller.id;

  const createProduct = (data: any) =>
    db.product.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...data,
        tags: j(data.tags),
        attributes: j(data.attributes),
      },
    });

  await createProduct({
    slug: "terracotta-pot",
    name: "Terracotta Plant Pot",
    summary: "Classic terracotta pot for houseplants",
    description: "A classic unglazed terracotta plant pot, perfect for herbs and succulents.",
    priceCents: 250,
    currency: "PHP",
    categoryId,
    sellerId,
    imageUrl: "/placeholder.svg",
    tags: ["garden", "pot", "terracotta"],
    attributes: { material: "terracotta", color: "brown" },
    ratingAvg: 4.5,
    ratingCount: 12,
    availability: "IN_STOCK",
    location: "Manila",
    verified: true,
    descriptionSource: "PROVIDER",
    isFeatured: true,
  });

  await createProduct({
    slug: "gardening-trowel",
    name: "Gardening Trowel",
    summary: "Hand trowel for digging and planting",
    description: "Stainless steel hand trowel with wooden handle for garden planting.",
    priceCents: 450,
    currency: "PHP",
    categoryId,
    sellerId,
    imageUrl: "/placeholder.svg",
    tags: ["garden", "tool", "trowel"],
    attributes: { material: "steel", use: "digging" },
    ratingAvg: 4.2,
    ratingCount: 8,
    availability: "IN_STOCK",
    location: "Manila",
    verified: true,
    descriptionSource: "PROVIDER",
  });

  await createProduct({
    slug: "snake-plant",
    name: "Snake Plant",
    summary: "Easy-care indoor snake plant",
    description: "Hardy snake plant that thrives in low light and requires minimal watering.",
    priceCents: 350,
    currency: "PHP",
    categoryId,
    sellerId,
    imageUrl: "/placeholder.svg",
    tags: ["plant", "indoor", "snake plant", "air-purifying"],
    attributes: { type: "indoor", care: "low" },
    ratingAvg: 4.7,
    ratingCount: 20,
    availability: "LOW_STOCK",
    location: "Quezon City",
    verified: true,
    descriptionSource: "PROVIDER",
  });

  await createProduct({
    slug: "organic-compost",
    name: "Organic Compost Mix",
    summary: "Nutrient-rich organic compost for garden beds",
    description: "Premium organic compost mix for enriching garden soil.",
    priceCents: 180,
    currency: "PHP",
    categoryId,
    sellerId,
    imageUrl: "/placeholder.svg",
    tags: ["compost", "soil", "organic", "garden"],
    attributes: { type: "organic", volume: "5kg" },
    ratingAvg: 4.0,
    ratingCount: 15,
    availability: "IN_STOCK",
    location: "Manila",
    verified: false,
    descriptionSource: "PROVIDER",
  });

  await db.service.upsert({
    where: { slug: "garden-consultation" },
    update: {},
    create: {
      slug: "garden-consultation",
      name: "Garden Consultation",
      summary: "30-minute garden design consultation",
      description: "Book a 30-minute consultation with a garden design expert.",
      priceCents: 1000,
      priceUnit: "session",
      currency: "PHP",
      categoryId,
      sellerId,
      imageUrl: "/placeholder.svg",
      tags: j(["garden", "consultation", "design"]),
      attributes: j({}),
      ratingAvg: 4.8,
      ratingCount: 6,
      availability: "AVAILABLE",
      location: "Manila",
      deliveryMode: "ONSITE",
      durationMinutes: 30,
      verified: true,
      descriptionSource: "PROVIDER",
    },
  });
}

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate --force-reset", {
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db", NODE_ENV: "test" },
    stdio: "ignore",
  });
  await seedCatalog();
});

beforeEach(async () => {
  for (const table of USER_TABLES) {
    try {
      await (db as any)[table].deleteMany();
    } catch {
      // ignore
    }
  }
  cookieStore.clear();
  await seedCatalog();
});

/** Create a user + session directly in the DB and set the session cookie. */
async function createAuthenticatedUser(overrides: {
  email: string;
  password: string;
  name: string;
  role?: "CUSTOMER" | "SELLER" | "ADMIN";
} = { email: "user@example.com", password: "SecurePass123!", name: "Test User" }) {
  const { email, password, name, role = "CUSTOMER" } = overrides;

  const { hashPassword } = await import("@/lib/auth/password");
  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: { email, name, passwordHash, role, emailVerified: true },
  });

  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  cookieStore.set("bm_session", token);

  return { user, token };
}

async function registerUser(email: string, password: string, name: string) {
  const { POST } = await import("@/app/api/auth/register/route");
  const res = await (POST as any)(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    }),
    { params: Promise.resolve({}) }
  );
  const json = await res.json();
  return { status: res.status, data: json.data, error: json.error };
}

async function loginUser(email: string, password: string) {
  const { POST } = await import("@/app/api/auth/login/route");
  const res = await (POST as any)(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    { params: Promise.resolve({}) }
  );
  const json = await res.json();
  const sessionCookie = cookieStore.get("bm_session");
  return { status: res.status, data: json.data, error: json.error, cookie: sessionCookie ?? undefined };
}

function mockRequest(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  url: string,
  body?: unknown,
  cookie?: string
) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (body && method !== "GET") headers.set("content-type", "application/json");
  return new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

function callHandler(handler: any, req: Request, cookie?: string) {
  if (cookie && !req.headers.has("cookie")) {
    req.headers.set("cookie", cookie);
  }
  return handler(req, { params: Promise.resolve({}) });
}

describe("Authentication", () => {
  test("registers a new customer successfully", async () => {
    const result = await registerUser("alice@example.com", "SecurePass123!", "Alice User");
    expect(result.status).toBe(201);
    expect(result.data.user.email).toBe("alice@example.com");
    expect(result.data.user.role).toBe("CUSTOMER");
    expect(result.data.user.name).toBe("Alice User");
    expect(result.data.user.passwordHash).toBeUndefined();
  });

  test("rejects duplicate email registration", async () => {
    await registerUser("bob@example.com", "SecurePass123!", "Bob User");
    const result = await registerUser("bob@example.com", "SecurePass123!", "Bob User");
    expect(result.status).toBe(409);
    expect(result.error.code).toBe("email_taken");
  });

  test("rejects weak passwords", async () => {
    const result = await registerUser("weak@example.com", "password", "Weak User");
    expect(result.status).toBe(400);
  });

  test("logs in with valid credentials", async () => {
    await registerUser("carol@example.com", "SecurePass123!", "Carol User");
    const result = await loginUser("carol@example.com", "SecurePass123!");
    expect(result.status).toBe(200);
    expect(result.data.user.email).toBe("carol@example.com");
    expect(result.cookie).toBeDefined();
  });

  test("rejects invalid credentials", async () => {
    await registerUser("dave@example.com", "SecurePass123!", "Dave User");
    const result = await loginUser("dave@example.com", "WrongPassword123!");
    expect(result.status).toBe(401);
    expect(result.error.code).toBe("invalid_credentials");
  });

  test("returns current user from session", async () => {
    await createAuthenticatedUser({
      email: "eve@example.com",
      password: "SecurePass123!",
      name: "Eve User",
    });

    const { GET } = await import("@/app/api/auth/me/route");
    const res = await callHandler(GET, mockRequest("GET", "http://localhost/api/auth/me"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.user.email).toBe("eve@example.com");
  });

  test("returns null user when no session", async () => {
    const { GET } = await import("@/app/api/auth/me/route");
    const res = await callHandler(GET, mockRequest("GET", "http://localhost/api/auth/me"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.user).toBeNull();
  });

  test("logs out and clears session", async () => {
    await createAuthenticatedUser({
      email: "frank@example.com",
      password: "SecurePass123!",
      name: "Frank User",
    });

    const { POST: logout } = await import("@/app/api/auth/logout/route");
    const res = await callHandler(logout, mockRequest("POST", "http://localhost/api/auth/logout"));
    expect(res.status).toBe(200);
  });
});

describe("Search", () => {
  let token: string;

  beforeEach(async () => {
    const result = await createAuthenticatedUser({
      email: "searcher@example.com",
      password: "SecurePass123!",
      name: "Searcher",
    });
    token = result.token;
  });

  test("returns real catalog results for natural language query", async () => {
    const { POST } = await import("@/app/api/search/route");
    const res = await callHandler(
      POST,
      mockRequest("POST", "http://localhost/api/search", {
        query: "gardening gift under ₱2000",
      }),
      `bm_session=${token}`
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
    expect(json.data.items.length).toBeGreaterThan(0);
    expect(json.data.intent.rawQuery).toBe("gardening gift under ₱2000");
    expect(json.data.agent.reply).toBeTruthy();
  });

  test("extracts intent with category and budget", async () => {
    const { POST } = await import("@/app/api/search/route");
    const res = await callHandler(
      POST,
      mockRequest("POST", "http://localhost/api/search", {
        query: "terracotta pot under ₱500",
      }),
      `bm_session=${token}`
    );
    const json = await res.json();
    expect(json.data.intent.maxPrice).toBe(500);
    expect(json.data.intent.itemType).toBe("PRODUCT");
    expect(json.data.items.length).toBeGreaterThan(0);
    for (const item of json.data.items) {
      expect(item.priceCents / 100).toBeLessThanOrEqual(500);
    }
  });

  test("applies price filters correctly", async () => {
    const { POST } = await import("@/app/api/search/route");
    const res = await callHandler(
      POST,
      mockRequest("POST", "http://localhost/api/search", {
        query: "garden tool",
        filters: { minPrice: 100, maxPrice: 500 },
      }),
      `bm_session=${token}`
    );
    const json = await res.json();
    for (const item of json.data.items) {
      const price = item.priceCents / 100;
      expect(price).toBeGreaterThanOrEqual(100);
      expect(price).toBeLessThanOrEqual(500);
    }
  });

  test("rejects queries shorter than 3 characters", async () => {
    const { POST } = await import("@/app/api/search/route");
    const res = await callHandler(
      POST,
      mockRequest("POST", "http://localhost/api/search", {
        query: "hi",
      }),
      `bm_session=${token}`
    );
    expect(res.status).toBe(400);
  });
});

describe("Favorites", () => {
  let token: string;
  let itemId: string;
  let itemType: "PRODUCT" | "SERVICE";

  beforeEach(async () => {
    const result = await createAuthenticatedUser({
      email: "favoriteuser@example.com",
      password: "SecurePass123!",
      name: "Favorite User",
    });
    token = result.token;

    const { GET } = await import("@/app/api/items/route");
    const res = await callHandler(GET, mockRequest("GET", "http://localhost/api/items?type=PRODUCT"));
    const json = await res.json();
    const item = json.data.items[0];
    itemId = item.id;
    itemType = item.type;
  });

  test("adds and removes a favorite", async () => {
    const { POST: addFavorite, DELETE: removeFavorite } = await import("@/app/api/favorites/route");

    const addRes = await callHandler(
      addFavorite,
      mockRequest("POST", "http://localhost/api/favorites", { itemType, itemId }),
      `bm_session=${token}`
    );
    expect(addRes.status).toBe(200);
    const addJson = await addRes.json();
    expect(addJson.data.favorited).toBe(true);

    const removeRes = await callHandler(
      removeFavorite,
      mockRequest(
        "DELETE",
        `http://localhost/api/favorites?itemType=${itemType}&itemId=${encodeURIComponent(itemId)}`
      ),
      `bm_session=${token}`
    );
    expect(removeRes.status).toBe(200);
  });

  test("rejects unauthenticated favorite requests", async () => {
    cookieStore.clear();
    const { POST } = await import("@/app/api/favorites/route");
    const res = await callHandler(
      POST,
      mockRequest("POST", "http://localhost/api/favorites", { itemType, itemId })
    );
    expect(res.status).toBe(401);
  });

  test("lists user favorites", async () => {
    const { POST: addFavorite, GET: listFavorites } = await import("@/app/api/favorites/route");

    await callHandler(
      addFavorite,
      mockRequest("POST", "http://localhost/api/favorites", { itemType, itemId }),
      `bm_session=${token}`
    );

    const listRes = await callHandler(
      listFavorites,
      mockRequest("GET", "http://localhost/api/favorites"),
      `bm_session=${token}`
    );
    expect(listRes.status).toBe(200);
    const json = await listRes.json();
    expect(json.data.count).toBeGreaterThanOrEqual(1);
  });
});

describe("Authorization", () => {
  test("rejects admin-only endpoints for customers", async () => {
    await createAuthenticatedUser({
      email: "cust@example.com",
      password: "SecurePass123!",
      name: "Customer",
      role: "CUSTOMER",
    });

    const { GET } = await import("@/app/api/admin/stats/route");
    const res = await callHandler(GET, mockRequest("GET", "http://localhost/api/admin/stats"));
    expect(res.status).toBe(403);
  });

  test("rejects access to protected endpoints without session", async () => {
    const { GET } = await import("@/app/api/auth/me/route");
    const res = await callHandler(GET, mockRequest("GET", "http://localhost/api/auth/me"));
    const json = await res.json();
    expect(json.data.user).toBeNull();

    const { GET: favGet } = await import("@/app/api/favorites/route");
    const favRes = await callHandler(favGet, mockRequest("GET", "http://localhost/api/favorites"));
    expect(favRes.status).toBe(401);
  });
});

describe("Bookings", () => {
  let token: string;

  beforeEach(async () => {
    const result = await createAuthenticatedUser({
      email: "booker@example.com",
      password: "SecurePass123!",
      name: "Booker",
    });
    token = result.token;
  });

  test("creates a booking for a service", async () => {
    const service = await db.service.findFirst({ where: { slug: "garden-consultation" } });
    expect(service).not.toBeNull();

    const { POST } = await import("@/app/api/bookings/route");
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const res = await callHandler(
      POST,
      mockRequest("POST", "http://localhost/api/bookings", {
        serviceId: service!.id,
        preferredAt: tomorrow,
        notes: "Please confirm availability",
      }),
      `bm_session=${token}`
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.booking.status).toBe("PENDING");
  });
});
