import { cn, initials } from "@/lib/format";

// Stable soft colour per person, derived from their name.
const PALETTE = ["tile-blue", "tile-purple", "tile-green", "tile-amber", "tile-red", "tile-sky"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const dims = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-10 text-sm";
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", dims, PALETTE[hash % PALETTE.length])}>
      {initials(name)}
    </span>
  );
}
