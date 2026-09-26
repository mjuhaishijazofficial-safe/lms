import { Children, type CSSProperties } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

/**
 * Plain GET form: filters live in the URL, so they survive refresh, back and sharing — and need no JavaScript.
 * On wide screens up to three filters sit on one row with the search box and buttons; more than that
 * fall into even 4-column rows, so every page's controls line up the same way.
 */
export function FilterBar({ basePath, q, placeholder, children, active }: {
  basePath: string; q?: string; placeholder: string; children?: React.ReactNode; active: boolean;
}) {
  const n = Children.count(children);
  const cols = n <= 3 ? `minmax(0,1.6fr) repeat(${n},minmax(0,1fr)) auto` : "repeat(4,minmax(0,1fr))";
  return (
    <form method="get" action={basePath} style={{ "--filter-cols": cols } as CSSProperties}
      className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-(--filter-cols)" role="search">
      <div className="relative col-span-2 lg:col-span-1">
        <label htmlFor="q" className="sr-only">Search</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input id="q" name="q" defaultValue={q} placeholder={placeholder} className="input pl-10" />
      </div>
      {children}
      {/* Below lg the selects pair up two per row; the buttons take the leftover cell, or a full row. */}
      <div className={`flex gap-3${n % 2 === 0 ? " col-span-2 lg:col-span-1" : ""}`}>
        <button className="btn-primary flex-1 lg:flex-none">Apply</button>
        {active && <Link href={basePath} className="btn-outline flex-1 lg:flex-none">Clear</Link>}
      </div>
    </form>
  );
}

export function FilterSelect({ name, label, value, children }: { name: string; label: string; value?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="sr-only">{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} className="select">{children}</select>
    </div>
  );
}
