import { notFound } from "next/navigation";
import { ItemDetailClient } from "@/components/item-detail-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getItemBySlugOrId, toPublicItem } from "@/lib/items";

function isItemType(value: string): value is "PRODUCT" | "SERVICE" {
  return value === "PRODUCT" || value === "SERVICE";
}

export const metadata = async ({ params }: { params: Promise<{ type: string; slug: string }> }) => {
  const { slug } = await params;
  return {
    title: `${slug.replace(/-/g, " ")} · Brandmark`,
    description: `View details for ${slug.replace(/-/g, " ")} in the Brandmark catalog.`,
  };
};

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  if (!isItemType(type)) notFound();

  const user = await getCurrentUser();
  const item = await getItemBySlugOrId(type, slug);
  if (!item) notFound();

  return (
    <ItemDetailClient
      item={toPublicItem(item)}
      itemType={type}
      itemId={item.id}
      signedIn={Boolean(user)}
    />
  );
}
