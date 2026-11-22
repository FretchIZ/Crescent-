import { apiHandler, jsonOk, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { z } from "zod";

const viewSchema = z.object({
  itemType: z.enum(["PRODUCT", "SERVICE"]),
  itemId: z.string().min(1).max(60),
});

export const POST = apiHandler(async (request) => {
  const user = await requireUser();
  const body = await readJson(request, viewSchema);

  const visitorKey = user.id;
  await db.itemView.upsert({
    where: {
      viewerKey_itemType_itemId: {
        viewerKey: visitorKey,
        itemType: body.itemType,
        itemId: body.itemId,
      },
    },
    update: { viewedAt: new Date() },
    create: {
      viewerKey: visitorKey,
      userId: user.id,
      itemType: body.itemType,
      itemId: body.itemId,
    },
  });

  // Bound history per user
  const extra = await db.itemView.findMany({
    where: { viewerKey: visitorKey },
    orderBy: { viewedAt: "desc" },
    skip: 50,
    select: { id: true },
  });
  if (extra.length > 0) {
    await db.itemView.deleteMany({ where: { id: { in: extra.map((row) => row.id) } } });
  }

  return jsonOk({ recorded: true });
});
