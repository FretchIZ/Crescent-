import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Renders a rating with a star. Never invents a value: pass the stored one. */
export function Rating({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  if (!value) {
    return <span className={cn("text-xs text-muted", className)}>No rating yet</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-ink", className)}>
      <Star className="h-3.5 w-3.5 fill-[#f5b301] text-[#f5b301]" aria-hidden />
      {value.toFixed(1)}
      {typeof count === "number" ? <span className="font-normal text-muted">({count})</span> : null}
    </span>
  );
}
