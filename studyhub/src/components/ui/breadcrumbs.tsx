import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {c.href && !last ? (
                <Link href={c.href} className="text-muted transition hover:text-primary">{c.label}</Link>
              ) : (
                <span className={last ? "font-semibold text-ink" : "text-muted"} aria-current={last ? "page" : undefined}>{c.label}</span>
              )}
              {!last && <ChevronRight className="size-4 text-muted" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
