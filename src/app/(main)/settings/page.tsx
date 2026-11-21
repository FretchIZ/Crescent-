import type { Metadata } from "next";
import { ChevronRight, Mail, ShieldCheck, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Brandmark preferences and account settings.",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={User}
          title="Sign in to access settings"
          description="Your preferences, interests, and personalization options live here."
          action={
            <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
              Sign in <ChevronRight className="h-3 w-3" />
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Settings</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Manage your preferences, interests, and personalization settings.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <SettingsNav active="preferences" />
        </aside>

        <main className="space-y-6">
          <PreferencesForm user={user} />
          <AccountSecurity user={user} />
          <DataControls user={user} />
        </main>
      </div>
    </div>
  );
}

function SettingsNav({ active }: { active: string }) {
  const items = [
    { href: "/settings", label: "Preferences", icon: Sparkles, active: active === "preferences" },
    { href: "/settings/account", label: "Account", icon: User, active: active === "account" },
  ] as const;
  return (
    <div className="surface p-4 space-y-2">
      {items.map((item) => {
        const Icon = item.icon as React.ComponentType<{ className?: string }>;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              item.active
                ? "bg-accent-soft text-accent-ink"
                : "text-muted hover:bg-ink/[0.04] hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function PreferencesForm({ user }: { user: any }) {
  return (
    <section className="surface p-5">
      <h2 className="text-lg font-semibold mb-4">Search preferences</h2>
      <p className="mb-4 text-sm text-muted">
        Your interests shape recommendations across the catalog. Add or remove interests at any time.
      </p>
      <form className="space-y-4">
        <Field label="Interests">
          <div className="flex flex-wrap gap-2">
            {["Gardening", "Home cooking", "Travel", "Fitness", "Reading", "Photography", "Arts & crafts", "Tech & programming", "Pets", "Wellness"].map((interest) => (
              <button
                key={interest}
                type="button"
                className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/30 hover:text-accent-ink"
              >
                {interest}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted">
            Select the topics you care about. These are used only for your own recommendations.
          </span>
        </Field>
        <Field label="Budget range">
          <div className="flex items-center gap-2">
            <Input placeholder="Min (₱)" type="number" className="flex-1" />
            <span className="text-xs text-muted">–</span>
            <Input placeholder="Max (₱)" type="number" className="flex-1" />
          </div>
        </Field>
        <Field label="Location">
          <Input placeholder="City or area" className="bg-panel" />
          <span className="text-[11px] text-muted">
            Optional. Used to surface nearby services and delivery options.
          </span>
        </Field>
        <Field label="Personalization">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked
              className="accent-[#5438f5] h-4 w-4 shrink-0"
            />
            <span className="text-sm">Use my interests and history to personalize recommendations</span>
          </div>
          <span className="text-[11px] text-muted">
            You can disable this at any time. Your data is never sold or shared.
          </span>
        </Field>
        <Button type="submit" className="w-full">
          Save preferences
        </Button>
      </form>
    </section>
  );
}

function AccountSecurity({ user }: { user: any }) {
  return (
    <section className="surface p-5">
      <h2 className="text-lg font-semibold mb-4">Account &amp; security</h2>
      <p className="mb-4 text-sm text-muted">Update your email, password, and session settings.</p>
      <div className="space-y-4">
        <Field label="Email address">
          <Input type="email" defaultValue={user.email} disabled className="bg-canvas text-ink" />
          <p className="mt-1 text-[11px] text-muted">
            Email changes require re-verification. Contact support to request a change.
          </p>
        </Field>
        <Field label="Password">
          <Input type="password" placeholder="••••••••" disabled className="bg-canvas text-ink" />
          <Link href="/settings/password" className="inline-block text-xs font-semibold text-accent-ink hover:underline">
            Change password
          </Link>
        </Field>
        <Field label="Email verification">
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {user.emailVerified ? "Verified" : "Not verified"}
            </span>
            {!user.emailVerified ? (
              <Link href="/settings/verify" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline">
                Resend verification <ChevronRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            A verified email helps secure your account and enables password recovery.
          </p>
        </Field>
      </div>
    </section>
  );
}

function DataControls({ user }: { user: any }) {
  return (
    <section className="surface p-5">
      <h2 className="text-lg font-semibold mb-4">Data &amp; privacy</h2>
      <p className="mb-4 text-sm text-muted">Control what Brandmark stores about you.</p>
      <div className="space-y-4">
        <Field label="Download your data">
          <Button type="button" variant="outline" size="sm">
            Request data export
          </Button>
          <p className="mt-1 text-[11px] text-muted">
            Receive a copy of your profile, preferences, and activity in JSON format.
          </p>
        </Field>
        <Field label="Delete account">
          <Button type="button" variant="danger" size="sm">
            Delete my account
          </Button>
          <p className="mt-1 text-[11px] text-muted">
            Permanently removes your profile, preferences, and activity. This cannot be undone.
          </p>
        </Field>
      </div>
    </section>
  );
}
