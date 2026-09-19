import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";

export type TabItem = { key: string; label: string; icon: LucideIcon; href: string };

/** Tabs that are plain links (the active tab lives in the URL), so they work with back/forward and no JavaScript. */
export function Tabs({ items, active, label }: { items: TabItem[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map(({ key, label: text, icon: Icon, href }) => {
        const on = key === active;
        return (
          <Link
            key={key} href={href} aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2.5 border-b-2 px-5 py-3.5 font-medium transition",
              on ? "border-primary text-primary" : "border-transparent text-ink/70 hover:text-ink",
            )}
          >
            <Icon className="size-5" aria-hidden /> {text}
          </Link>
        );
      })}
    </nav>
  );
}
