import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";

const SIZES = {
  sm: "size-9 rounded-lg [&>svg]:size-4.5",
  md: "size-12 rounded-xl [&>svg]:size-6",
  lg: "size-16 rounded-full [&>svg]:size-7",
  xl: "size-24 rounded-3xl [&>svg]:size-11",
} as const;

/** Soft tinted square/circle holding an icon, as used on the stat cards and subject headers. */
export function IconTile({ icon: Icon, className, size = "md" }: { icon: LucideIcon; className?: string; size?: keyof typeof SIZES }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], className ?? "bg-tile-blue text-primary")}>
      <Icon aria-hidden strokeWidth={2} />
    </span>
  );
}
