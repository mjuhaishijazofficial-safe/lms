import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";

const SIZES = {
  sm: "size-9 rounded-lg [&>svg]:size-4.5",
  md: "size-11 rounded-xl [&>svg]:size-5.5",
  lg: "size-12 rounded-xl [&>svg]:size-6",
  xl: "size-20 rounded-2xl [&>svg]:size-10",
} as const;

/** Soft tinted rounded square holding an icon, as used on the stat cards and subject headers. */
export function IconTile({ icon: Icon, className, size = "md" }: { icon: LucideIcon; className?: string; size?: keyof typeof SIZES }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], className ?? "tile-blue")}>
      <Icon aria-hidden strokeWidth={2} />
    </span>
  );
}
