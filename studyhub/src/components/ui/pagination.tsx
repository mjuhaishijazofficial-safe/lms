import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";

/** Previous/next links that keep the current filters. */
export function Pagination({ page, total, pageSize, basePath, params }: {
  page: number; total: number; pageSize: number; basePath: string; params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const link = "inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-primary/40 hover:text-primary";
  const off = "pointer-events-none opacity-40";
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-line px-5 py-3 text-sm text-muted">
      <p>Showing {from}–{to} of {total}</p>
      <div className="flex gap-2">
        <Link href={href(page - 1)} className={cn(link, page <= 1 && off)} aria-disabled={page <= 1}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
        <Link href={href(page + 1)} className={cn(link, page >= pages && off)} aria-disabled={page >= pages}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
