import type { Metadata } from "next";
import { ChevronRight, Mail, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your Brandmark account profile and preferences.",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={User}
          title="Sign in to view your profile"
          description="Your account details, saved items, and search history live here."
          action={
            <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
              Sign in <ChevronRight className="h-3 w-3" />
            </Link>
          }
        />
      </div>
    );
  }

  const { db } = await import("@/lib/db");
  const [favoritesCount, bookingsCount, interestsCount] =
    await Promise.all([
      db.favorite.count({ where: { userId: user.id } }),
      db.booking.count({ where: { userId: user.id } }),
      db.interest.count({ where: { userId: user.id } }),
    ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Profile</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Manage your account details and see your activity at a glance.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="surface p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">
                {user.name.split(/\s+/).map((p) => p[0]).join("").toUpperCase() || "U"}
              </span>
              <div>
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-muted">{user.email}</p>
                <BadgeTone value={user.role} />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">
              Member since {new Date(user.createdAt).toLocaleDateString("en-PH", {
                month: "long",
                year: "numeric",
              })}
            </p>
            {user.emailVerified ? (
              <p className="text-xs flex items-center gap-1 text-good">
                <ShieldCheck className="h-3 w-3" aria-hidden /> Email verified
              </p>
            ) : (
              <p className="text-xs flex items-center gap-1 text-warn">
                <Mail className="h-3 w-3" aria-hidden /> Email not verified
              </p>
            )}
          </div>

          <div className="surface p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your activity</p>
            <div className="grid grid-cols-3 gap-2">
              <Stat value={favoritesCount} label="Saved" />
              <Stat value={bookingsCount} label="Bookings" />
              <Stat value={interestsCount} label="Interests" />
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <section className="surface p-5">
            <h2 className="text-lg font-semibold mb-4">Account details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  defaultValue={user.name}
                  disabled
                  className="bg-canvas text-ink"
                  aria-describedby="name-hint"
                />
                <span id="name-hint" className="text-[11px] text-muted">
                  Edit your name in Settings.
                </span>
              </Field>
              <Field label="Email address">
                <Input
                  type="email"
                  defaultValue={user.email}
                  disabled
                  className="bg-canvas text-ink"
                />
              </Field>
              <Field label="Role">
                <Input
                  defaultValue={user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                  disabled
                  className="bg-canvas text-ink"
                />
              </Field>
              <Field label="Email verified">
                <Input
                  type="text"
                  defaultValue={user.emailVerified ? "Yes" : "No"}
                  disabled
                  className="bg-canvas text-ink"
                />
              </Field>
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="text-lg font-semibold mb-4">Quick actions</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/saved" className={buttonLink()}>
                View saved items
              </Link>
              <Link href="/history" className={buttonLink()}>
                View search history
              </Link>
              <Link href="/settings" className={buttonLink()}>
                Edit preferences
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function BadgeTone({ value }: { value: string }) {
  const tones: Record<string, string> = {
    CUSTOMER: "neutral",
    SELLER: "accent",
    ADMIN: "dark",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
      tones[value] === "accent"
        ? "border-accent/25 bg-accent-soft text-accent-ink"
        : tones[value] === "dark"
          ? "border-ink bg-ink text-white"
          : "border-line bg-panel text-muted"
    }`}>
    {value}
  </span>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-3">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function buttonLink() {
  return "inline-flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas";
}
