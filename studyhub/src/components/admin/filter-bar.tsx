import Link from "next/link";
import { Search } from "lucide-react";

/** Plain GET form: filters live in the URL, so they survive refresh, back and sharing — and need no JavaScript. */
export function FilterBar({ basePath, q, placeholder, children, active }: {
  basePath: string; q?: string; placeholder: string; children?: React.ReactNode; active: boolean;
}) {
  return (
    <form method="get" action={basePath} className="mb-5 flex flex-wrap items-end gap-3" role="search">
      <div className="relative min-w-56 flex-1">
        <label htmlFor="q" className="sr-only">Search</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
        <input id="q" name="q" defaultValue={q} placeholder={placeholder} className="input pl-11" />
      </div>
      {children}
      <button className="btn-primary">Apply</button>
      {active && <Link href={basePath} className="btn-outline">Clear</Link>}
    </form>
  );
}

export function FilterSelect({ name, label, value, children }: { name: string; label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="w-full sm:w-auto">
      <label htmlFor={`f-${name}`} className="sr-only">{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} className="select sm:min-w-44">{children}</select>
    </div>
  );
}
