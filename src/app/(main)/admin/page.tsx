import type { Metadata } from "next";
import { ChevronRight, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin dashboard",
  description: "Platform statistics and audit trail.",
};

async function fetchAdminStats() {
  const res = await fetch("/api/admin/stats", { cache: "no-store" });
  if (!res.ok) return { totals: {}, recentUsers: [], recentAudit: [] };
  const data = await res.json();
  return data.data ?? { totals: {}, recentUsers: [], recentAudit: [] };
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return notAuthorized();
  }

  const stats = await fetchAdminStats();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Admin dashboard</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Platform overview and audit trail. Access restricted to administrators.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { label: "Users", value: stats.totals.users, icon: Users, tone: "neutral" },
          { label: "Products", value: stats.totals.products, icon: ShieldCheck, tone: "accent" },
          { label: "Services", value: stats.totals.services, icon: ShieldCheck, tone: "accent" },
          { label: "Bookings", value: stats.totals.bookings, icon: ChevronRight, tone: "neutral" },
        ].map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="text-lg font-semibold mb-4">Recent activity</h2>
          <div className="space-y-3">
            {stats.recentAudit.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-line bg-canvas">
                <span className="mt-0.5 shrink-0 text-xs text-muted">{log.createdAt.slice(5, 16)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{log.actor}</p>
                  <p className="text-xs text-muted">{log.action}</p>
                  {log.entityType && (
                    <span className="text-[10px] font-semibold text-muted uppercase">{log.entityType}</span>
                  )}
                </div>
              </div>
            ))}
            {stats.recentAudit.length === 0 && (
              <p className="text-sm text-muted">No recent audit events.</p>
            )}
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="text-lg font-semibold mb-4">Recent users</h2>
          <div className="space-y-3">
            {stats.recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-line bg-canvas">
                <div>
                  <p className="text-sm font-semibold">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                  <BadgeRole value={u.role} />
                </div>
                <span className="text-[11px] text-muted">{new Date(u.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {stats.recentUsers.length === 0 && (
              <p className="text-sm text-muted">No users yet.</p>
            )}
          </div>
        </section>
      </div>

      <section className="surface p-5">
        <h2 className="text-lg font-semibold mb-4">Totals</h2>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(stats.totals as Record<string, number | string>).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-line bg-canvas p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{key}</p>
              <p className="text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function notAuthorized() {
  return (
    <div className="space-y-6">
      <EmptyState
        icon={ShieldCheck}
        title="Administrator access required"
        description="This area is restricted to platform administrators. Sign in with an admin account to continue."
        action={
          <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
            Sign in <ChevronRight className="h-3 w-3" />
          </Link>
        }
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const toneColors: Record<string, string> = {
    neutral: "text-muted",
    accent: "text-accent-ink",
  };
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
        <span className={`grid h-8 w-8 place-items-center rounded-full bg-accent-soft ${toneColors[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function BadgeRole({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
      value === "ADMIN" ? "border-ink bg-ink text-white" : value === "SELLER" ? "border-accent/25 bg-accent-soft text-accent-ink" : "border-line bg-panel text-muted"
    }`}>
    {value}
  </span>
  );
}
