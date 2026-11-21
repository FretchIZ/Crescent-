"use client";

import {
  Bookmark,
  ChevronDown,
  Compass,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ShellUser = { name: string; email: string; role: string } | null;

const primaryNav = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/products", label: "Products", icon: Package },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/saved", label: "Saved items", icon: Bookmark },
  { href: "/history", label: "Search history", icon: History },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Main">
      {primaryNav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink"
            )}
          >
            <item.icon className={cn("h-[18px] w-[18px]", active ? "text-accent" : "text-muted")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountBlock({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="space-y-2">
        <Link href="/login" onClick={onNavigate} className={buttonClass("primary", "md", "w-full")}>
          Sign in
        </Link>
        <Link href="/register" onClick={onNavigate} className={buttonClass("outline", "md", "w-full")}>
          Create account
        </Link>
      </div>
    );
  }

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      onNavigate?.();
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <Link
        href="/profile"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-ink/[0.04]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">
          {initials || "U"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-muted">{user.email}</span>
        </span>
      </Link>
      <Link
        href="/settings"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-ink/[0.04] hover:text-ink"
      >
        <Settings className="h-[18px] w-[18px]" aria-hidden /> Settings
      </Link>
      {user.role === "ADMIN" ? (
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-ink/[0.04] hover:text-ink"
        >
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden /> Admin
        </Link>
      ) : null}
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-ink/[0.04] hover:text-ink disabled:opacity-60"
      >
        <LogOut className="h-[18px] w-[18px]" aria-hidden /> {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-panel/80 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <div className="mt-7 flex-1 overflow-y-auto scroll-thin">
          <NavList />
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Account</p>
            <AccountBlock user={user} />
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-canvas p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden /> Grounded answers
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Matches come from the indexed catalog. Prices, ratings and availability are never invented.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-panel/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-1.5">
          <Link href="/search" aria-label="Search" className={buttonClass("ghost", "icon")}>
            <Search className="h-[18px] w-[18px]" />
          </Link>
          <Link href={user ? "/profile" : "/login"} aria-label={user ? "Your profile" : "Sign in"} className={buttonClass("ghost", "icon")}>
            <User className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className={buttonClass("ghost", "icon")}
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-panel px-4 py-5 shadow-lift">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className={buttonClass("ghost", "icon")}>
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto scroll-thin">
              <NavList onNavigate={() => setOpen(false)} />
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Account</p>
                <AccountBlock user={user} onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        <main id="main" className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-[1240px] flex-col gap-2 border-t border-line px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Brandmark · products and services, one search.</p>
          <p>Prices in PHP · data from the indexed catalog.</p>
        </footer>
      </div>
    </div>
  );
}

export { ChevronDown };
