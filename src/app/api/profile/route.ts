import { apiHandler, jsonOk, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { profileUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const PUT = apiHandler(async (request) => {
  const user = await requireUser();
  const body = await readJson(request, profileUpdateSchema);

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { name: body.name } }),
    db.userProfile.upsert({
      where: { userId: user.id },
      update: {
        bio: body.bio?.trim() || null,
        ...(body.budgetMin !== undefined ? { budgetMin: body.budgetMin } : {}),
        ...(body.budgetMax !== undefined ? { budgetMax: body.budgetMax } : {}),
        ...(body.location !== undefined ? { location: body.location?.trim() || null } : {}),
        ...(body.locationConsent !== undefined ? { locationConsent: body.locationConsent } : {}),
      },
      create: {
        userId: user.id,
        bio: body.bio?.trim() || null,
        budgetMin: body.budgetMin ?? null,
        budgetMax: body.budgetMax ?? null,
        location: body.location?.trim() || null,
        locationConsent: body.locationConsent ?? false,
      },
    }),
  ]);

  await audit({ actorId: user.id, action: "profile.update", request });
  return jsonOk({ updated: true });
});
