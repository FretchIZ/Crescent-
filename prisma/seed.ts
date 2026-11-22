/**
 * Development seed. Refuses to run in production.
 *
 * Creates demo accounts, the demo partner catalog, community reviews,
 * interests, favorites, and recommendation rows. All catalog rows are marked
 * with their description source; ratings are provider-supplied demo data.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import {
  CATEGORY_SEED,
  SELLER_SEED,
  PRODUCT_SEED,
  SERVICE_SEED,
  REVIEW_SEED,
  DEMO_CUSTOMER_NAMES,
} from "../src/lib/catalog-data";
import { buildSearchText } from "../src/lib/search-text";
import { bumpCatalogVersion } from "../src/lib/catalog-version";

// Load .env for `tsx` (Next.js loads it automatically, tsx does not).
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2];
  }
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed a production database. Run this against a development database only.");
  process.exit(1);
}

const db = new PrismaClient();

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  console.log("→ Seeding categories…");
  const categories = new Map<string, string>();
  for (const category of CATEGORY_SEED) {
    const row = await db.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        kind: category.kind,
        icon: category.icon,
        sortOrder: category.sortOrder,
      },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        kind: category.kind,
        icon: category.icon,
        sortOrder: category.sortOrder,
      },
      select: { id: true },
    });
    categories.set(category.slug, row.id);
  }

  console.log("→ Seeding sellers…");
  const sellers = new Map<string, string>();
  for (const seller of SELLER_SEED) {
    const row = await db.seller.upsert({
      where: { slug: seller.slug },
      update: {
        name: seller.name,
        description: seller.description,
        location: seller.location,
        verified: seller.verified,
        ratingAvg: seller.ratingAvg,
        ratingCount: seller.ratingCount,
        website: seller.website ?? null,
      },
      create: {
        slug: seller.slug,
        name: seller.name,
        description: seller.description,
        location: seller.location,
        verified: seller.verified,
        ratingAvg: seller.ratingAvg,
        ratingCount: seller.ratingCount,
        website: seller.website ?? null,
      },
      select: { id: true },
    });
    sellers.set(seller.slug, row.id);
  }

  console.log("→ Seeding accounts…");
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@brandmark.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "AdminPass123!";
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? "demo@brandmark.local";
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? "DemoPass123!";
  const sellerEmail = process.env.SEED_SELLER_EMAIL ?? "seller@brandmark.local";
  const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? "SellerPass123!";

  await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", emailVerified: true, name: "Brandmark Admin" },
    create: {
      email: adminEmail,
      name: "Brandmark Admin",
      role: "ADMIN",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 12),
      profile: { create: { personalizationConsent: false } },
    },
    select: { id: true },
  });

  const customer = await db.user.upsert({
    where: { email: customerEmail },
    update: { role: "CUSTOMER", emailVerified: true, name: "Mara Santos" },
    create: {
      email: customerEmail,
      name: "Mara Santos",
      role: "CUSTOMER",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(customerPassword, 12),
      profile: {
        create: {
          bio: "Product designer in Makati. Mostly here for plants and good coffee.",
          budgetMin: 500,
          budgetMax: 5000,
          location: "Makati",
          locationConsent: true,
          personalizationConsent: true,
        },
      },
    },
    select: { id: true },
  });

  const sellerUser = await db.user.upsert({
    where: { email: sellerEmail },
    update: { role: "SELLER", emailVerified: true, name: "Green Patch Co." },
    create: {
      email: sellerEmail,
      name: "Green Patch Co.",
      role: "SELLER",
      emailVerified: true,
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(sellerPassword, 12),
      profile: { create: { personalizationConsent: false } },
    },
    select: { id: true },
  });

  await db.seller.update({ where: { slug: "green-patch" }, data: { userId: sellerUser.id } });

  // Community reviewers (demo content, clearly labelled as unverified purchases).
  const reviewerIds = new Map<string, string>();
  for (const person of DEMO_CUSTOMER_NAMES) {
    const existing = await db.user.findUnique({ where: { email: person.email }, select: { id: true } });
    if (existing) {
      reviewerIds.set(person.email, existing.id);
      continue;
    }
    const created = await db.user.create({
      data: {
        email: person.email,
        name: person.name,
        role: "CUSTOMER",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: await bcrypt.hash(randomBytes(24).toString("base64url"), 12),
        profile: { create: { personalizationConsent: true } },
      },
      select: { id: true },
    });
    reviewerIds.set(person.email, created.id);
  }

  console.log("→ Seeding products…");
  const productIds = new Map<string, string>();
  for (const product of PRODUCT_SEED) {
    const categoryId = categories.get(product.categorySlug);
    const sellerId = sellers.get(product.sellerSlug);
    if (!categoryId || !sellerId) throw new Error(`Missing category/seller for ${product.slug}`);
    const categoryName = CATEGORY_SEED.find((c) => c.slug === product.categorySlug)?.name;
    const sellerName = SELLER_SEED.find((s) => s.slug === product.sellerSlug)?.name;
    const searchText = buildSearchText({
      name: product.name,
      summary: product.summary,
      description: product.description,
      brand: product.brand,
      tags: product.tags,
      attributes: product.attributes,
      categoryName,
      sellerName,
      location: product.location,
    });
    const data = {
      name: product.name,
      summary: product.summary,
      description: product.description,
      priceCents: product.priceCents,
      compareAtCents: product.compareAtCents ?? null,
      brand: product.brand,
      categoryId,
      sellerId,
      imageUrl: `https://images.unsplash.com/photo-${product.imageId}?auto=format&fit=crop&w=1000&q=72`,
      images: JSON.stringify(
        [product.imageId, ...product.galleryIds].map(
          (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=72`
        )
      ),
      attributes: JSON.stringify(product.attributes),
      tags: JSON.stringify(product.tags),
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      availability: product.availability,
      location: product.location,
      deliveryOptions: JSON.stringify(product.deliveryOptions),
      descriptionSource: "PROVIDER",
      verified: product.verified,
      isActive: true,
      isFeatured: product.featured ?? false,
      searchText,
    };
    const row = await db.product.upsert({
      where: { slug: product.slug },
      update: data,
      create: { slug: product.slug, ...data, createdAt: daysAgo(product.createdAtDaysAgo) },
      select: { id: true },
    });
    productIds.set(product.slug, row.id);
  }

  console.log("→ Seeding services…");
  const serviceIds = new Map<string, string>();
  for (const service of SERVICE_SEED) {
    const categoryId = categories.get(service.categorySlug);
    const sellerId = sellers.get(service.sellerSlug);
    if (!categoryId || !sellerId) throw new Error(`Missing category/seller for ${service.slug}`);
    const categoryName = CATEGORY_SEED.find((c) => c.slug === service.categorySlug)?.name;
    const sellerName = SELLER_SEED.find((s) => s.slug === service.sellerSlug)?.name;
    const searchText = buildSearchText({
      name: service.name,
      summary: service.summary,
      description: service.description,
      tags: service.tags,
      attributes: service.attributes,
      categoryName,
      sellerName,
      location: service.location,
      priceUnit: service.priceUnit,
    });
    const data = {
      name: service.name,
      summary: service.summary,
      description: service.description,
      priceCents: service.priceCents,
      priceUnit: service.priceUnit,
      categoryId,
      sellerId,
      imageUrl: `https://images.unsplash.com/photo-${service.imageId}?auto=format&fit=crop&w=1000&q=72`,
      images: JSON.stringify(
        [service.imageId, ...service.galleryIds].map(
          (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=72`
        )
      ),
      attributes: JSON.stringify(service.attributes),
      tags: JSON.stringify(service.tags),
      ratingAvg: service.ratingAvg,
      ratingCount: service.ratingCount,
      availability: service.availability,
      location: service.location,
      deliveryMode: service.deliveryMode,
      durationMinutes: service.durationMinutes ?? null,
      nextAvailableAt: daysFromNow(service.nextAvailableDays),
      descriptionSource: "PROVIDER",
      verified: service.verified,
      isActive: true,
      isFeatured: service.featured ?? false,
      searchText,
    };
    const row = await db.service.upsert({
      where: { slug: service.slug },
      update: data,
      create: { slug: service.slug, ...data, createdAt: daysAgo(service.createdAtDaysAgo) },
      select: { id: true },
    });
    serviceIds.set(service.slug, row.id);
  }

  console.log("→ Seeding community reviews…");
  for (const review of REVIEW_SEED) {
    const userId = reviewerIds.get(review.authorEmail);
    if (!userId) continue;
    const productId = review.productSlug ? productIds.get(review.productSlug) : undefined;
    const serviceId = review.serviceSlug ? serviceIds.get(review.serviceSlug) : undefined;
    if (!productId && !serviceId) continue;
    const where = productId
      ? { userId_productId: { userId, productId } }
      : { userId_serviceId: { userId, serviceId: serviceId! } };
    const data = {
      rating: review.rating,
      title: review.title,
      body: review.body,
      verifiedPurchase: review.verifiedPurchase,
      createdAt: daysAgo(review.daysAgo),
    };
    await db.review.upsert({
      where,
      update: data,
      create: {
        userId,
        productId: productId ?? null,
        serviceId: serviceId ?? null,
        ...data,
      },
    });
  }

  console.log("→ Seeding demo preferences, favorites, and history…");
  await db.interest.deleteMany({ where: { userId: customer.id } });
  await db.interest.createMany({
    data: [
      { userId: customer.id, label: "Gardening", weight: 1, source: "manual" },
      { userId: customer.id, label: "Home cooking", weight: 0.8, source: "manual" },
      { userId: customer.id, label: "Travel", weight: 0.6, source: "manual" },
      { userId: customer.id, label: "Fitness", weight: 0.4, source: "manual" },
    ],
  });

  await db.favorite.deleteMany({ where: { userId: customer.id } });
  const favoriteSlugs = ["clay-root-planter-set", "green-patch-herb-kit", "urban-sprout-weekend-gardening"];
  for (const slug of favoriteSlugs) {
    const productId = productIds.get(slug);
    const serviceId = serviceIds.get(slug);
    if (productId) {
      await db.favorite.create({ data: { userId: customer.id, itemType: "PRODUCT", itemId: productId } });
    } else if (serviceId) {
      await db.favorite.create({ data: { userId: customer.id, itemType: "SERVICE", itemId: serviceId } });
    }
  }

  await db.recommendation.deleteMany({ where: { userId: customer.id } });
  const recommended = [
    { slug: "clay-root-planter-set", type: "PRODUCT", reason: "Because you love gardening" },
    { slug: "green-patch-gardener-hamper", type: "PRODUCT", reason: "A gift that fits your saved interests" },
    { slug: "urban-sprout-weekend-gardening", type: "SERVICE", reason: "A weekend class near Makati" },
    { slug: "kape-benguet-single-origin", type: "PRODUCT", reason: "Popular with people who like home cooking" },
  ];
  await db.recommendation.createMany({
    data: recommended.map((entry) => ({
      userId: customer.id,
      itemType: entry.type,
      itemId: (entry.type === "PRODUCT" ? productIds.get(entry.slug) : serviceIds.get(entry.slug))!,
      score: 90,
      reason: entry.reason,
      source: "interests",
      expiresAt: daysFromNow(30),
    })),
  });

  // A small, honest search history for the demo account.
  const existingSession = await db.searchSession.findFirst({ where: { userId: customer.id }, select: { id: true } });
  if (!existingSession) {
    const session = await db.searchSession.create({
      data: {
        userId: customer.id,
        title: "A gift for my mom who loves gardening",
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
      select: { id: true },
    });
    const demoQueries = [
      {
        text: "A gift for my mom who loves gardening, under ₱2,000",
        intent: {
          rawQuery: "A gift for my mom who loves gardening, under ₱2,000",
          keywords: ["gift", "mom", "gardening"],
          categorySlugs: ["gifts", "home-garden"],
          itemType: "BOTH",
          interests: ["Gardening"],
          requiredAttributes: [],
          optionalAttributes: [],
          maxPrice: 2000,
          mode: "local",
          confidence: 0.8,
          summary: "Looking across products and services with a focus on Gifts & Keepsakes and Home & Garden.",
          chips: ["For Mom", "Loves Gardening", "Budget up to ₱2,000"],
          assumptions: [],
          needsClarification: false,
        },
        resultCount: 6,
        days: 2,
      },
      {
        text: "Minimalist laptop for programming with great battery life",
        intent: {
          rawQuery: "Minimalist laptop for programming with great battery life",
          keywords: ["minimalist", "laptop", "programming", "battery"],
          categorySlugs: ["electronics"],
          itemType: "PRODUCT",
          interests: ["Tech & programming"],
          requiredAttributes: [],
          optionalAttributes: [
            { name: "Style", value: "Minimalist" },
            { name: "Battery", value: "Long-lasting" },
          ],
          mode: "local",
          confidence: 0.82,
          summary: "Looking across products with a focus on Tech & Electronics.",
          chips: ["Products only", "Style: Minimalist"],
          assumptions: [],
          needsClarification: false,
        },
        resultCount: 4,
        days: 5,
      },
      {
        text: "Weekend activity that feels like me",
        intent: {
          rawQuery: "Weekend activity that feels like me",
          keywords: ["weekend", "activity"],
          categorySlugs: [],
          itemType: "SERVICE",
          interests: [],
          requiredAttributes: [],
          optionalAttributes: [{ name: "Scheduling", value: "Weekend" }],
          mode: "local",
          confidence: 0.55,
          summary: "Looking across services that best match your description.",
          chips: ["Services only"],
          assumptions: [],
          needsClarification: false,
        },
        resultCount: 5,
        days: 9,
      },
    ];
    for (const demo of demoQueries) {
      await db.searchQuery.create({
        data: {
          sessionId: session.id,
          userId: customer.id,
          queryText: demo.text,
          intent: JSON.stringify(demo.intent),
          resultCount: demo.resultCount,
          mode: "local",
          durationMs: 42,
          createdAt: daysAgo(demo.days),
        },
      });
    }
    await db.aIMessage.createMany({
      data: [
        { sessionId: session.id, role: "user", content: "A gift for my mom who loves gardening, under ₱2,000" },
        {
          sessionId: session.id,
          role: "assistant",
          content: "I checked the indexed catalog and kept gifts and home & garden items within ₱2,000. The hand-thrown planter set and the gardener's hamper were the strongest fits.",
        },
      ],
    });
  }

  // Catalog writes must invalidate warm snapshots; the version key is shared
  // with every serverless instance when Redis/KV is configured.
  await bumpCatalogVersion();

  const counts = await Promise.all([
    db.product.count(),
    db.service.count(),
    db.category.count(),
    db.seller.count(),
    db.user.count(),
    db.review.count(),
  ]);

  console.log("\n✓ Seed complete");
  console.log(`  ${counts[0]} products · ${counts[1]} services · ${counts[2]} categories · ${counts[3]} sellers`);
  console.log(`  ${counts[4]} users · ${counts[5]} reviews`);
  console.log("\n  Demo accounts (development only):");
  console.log(`  Customer  ${customerEmail} / ${customerPassword}`);
  console.log(`  Seller    ${sellerEmail} / ${sellerPassword}`);
  console.log(`  Admin     ${adminEmail} / ${adminPassword}`);
  console.log("\n  Provider ratings and catalog copy are demo feed data — replace with a real feed before launch.\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
