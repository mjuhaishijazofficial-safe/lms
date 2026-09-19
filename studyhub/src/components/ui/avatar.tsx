import { cn, initials } from "@/lib/format";

// Stable soft colour per person, derived from their name.
const PALETTE = ["bg-tile-blue text-primary", "bg-tile-purple text-violet-700", "bg-tile-green text-emerald-700", "bg-tile-amber text-amber-700", "bg-tile-red text-red-700", "bg-sky-100 text-sky-700"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const dims = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-lg" : "size-10 text-sm";
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", dims, PALETTE[hash % PALETTE.length])}>
      {initials(name)}
    </span>
  );
}
