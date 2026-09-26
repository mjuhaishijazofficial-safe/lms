import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { IconTile } from "./icon-tile";

export function StatCard({ icon, tile, label, value, hint, href }: {
  icon: LucideIcon; tile: string; label: string; value: React.ReactNode; hint?: string; href?: string;
}) {
  const body = (
    <div className={`card flex h-full items-center gap-4 p-5 transition${href ? " hover:border-primary/30 hover:shadow-md" : ""}`}>
      <IconTile icon={icon} size="lg" className={tile} />
      <div className="min-w-0">
        <p className="truncate text-2xl font-bold leading-tight tracking-tight text-ink">{value}</p>
        <p className="mt-0.5 truncate text-sm text-muted">{label}</p>
        {hint && <p className="truncate text-xs text-muted/80">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">{body}</Link> : body;
}
