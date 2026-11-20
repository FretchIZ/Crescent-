import { apiHandler, jsonOk, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { preferencesSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  const [profile, interests] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.interest.findMany({ where: { userId: user.id }, orderBy: { weight: "desc" } }),
  ]);

  return jsonOk({
    profile: profile
      ? {
          budgetMin: profile.budgetMin,
          budgetMax: profile.budgetMax,
          location: profile.location,
          locationConsent: profile.locationConsent,
          personalizationConsent: profile.personalizationConsent,
          bio: profile.bio,
        }
      : null,
    interests: interests.map((interest) => ({
      label: interest.label,
      weight: interest.weight,
      source: interest.source,
    })),
  });
});

export const PUT = apiHandler(async (request) => {
  const user = await requireUser();
  const body = await readJson(request, preferencesSchema);

  const unique = new Map<string, { label: string; weight: number }>();
  for (const interest of body.interests) {
    const label = interest.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!unique.has(key)) unique.set(key, { label, weight: interest.weight ?? 1 });
  }

  await db.$transaction(async (tx) => {
    await tx.userProfile.upsert({
      where: { userId: user.id },
      update: {
        budgetMin: body.budgetMin ?? null,
        budgetMax: body.budgetMax ?? null,
        location: body.location?.trim() || null,
        locationConsent: body.locationConsent ?? false,
        personalizationConsent: body.personalizationConsent ?? true,
      },
      create: {
        userId: user.id,
        budgetMin: body.budgetMin ?? null,
        budgetMax: body.budgetMax ?? null,
        location: body.location?.trim() || null,
        locationConsent: body.locationConsent ?? false,
        personalizationConsent: body.personalizationConsent ?? true,
      },
    });

    await tx.interest.deleteMany({ where: { userId: user.id } });
    if (unique.size > 0) {
      await tx.interest.createMany({
        data: [...unique.values()].map((interest) => ({
          userId: user.id,
          label: interest.label,
          weight: interest.weight,
          source: "manual",
        })),
      });
    }

    if (body.personalizationConsent === false) {
      await tx.recommendation.deleteMany({ where: { userId: user.id } });
    }
  });

  await audit({ actorId: user.id, action: "preferences.update", request });
  return jsonOk({ updated: true });
});

export const DELETE = apiHandler(async (request) => {
  const user = await requireUser();
  await db.$transaction([
    db.interest.deleteMany({ where: { userId: user.id } }),
    db.recommendation.deleteMany({ where: { userId: user.id } }),
    db.userProfile.upsert({
      where: { userId: user.id },
      update: {
        budgetMin: null,
        budgetMax: null,
        location: null,
        locationConsent: false,
        personalizationConsent: false,
      },
      create: { userId: user.id, personalizationConsent: false },
    }),
  ]);
  await audit({ actorId: user.id, action: "preferences.delete", request });
  return jsonOk({ cleared: true });
});
