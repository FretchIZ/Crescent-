import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "good" | "warn" | "muted" | "dark";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-panel text-ink",
  accent: "border-accent/15 bg-accent-soft text-accent-ink",
  good: "border-[#bbe3c9] bg-[#eef9f2] text-good",
  warn: "border-[#f5ddb0] bg-[#fff7e8] text-warn",
  muted: "border-line bg-canvas text-muted",
  dark: "border-ink bg-ink text-white",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
