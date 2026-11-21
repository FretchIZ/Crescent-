import { Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", className)} aria-label="Brandmark home">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-white shadow-[0_1px_2px_rgba(24,24,20,0.18)]">
        <Sparkles className="h-4 w-4" aria-hidden />
      </span>
      {!compact ? <span className="text-[17px] font-bold tracking-[-0.02em]">Brandmark</span> : null}
    </Link>
  );
}
