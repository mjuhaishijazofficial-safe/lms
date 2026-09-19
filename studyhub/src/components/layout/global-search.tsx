import { Search } from "lucide-react";

/** Plain GET form (no JavaScript needed) in the student top bar, matching the reference design. */
export function GlobalSearch() {
  return (
    <form method="get" action="/search" role="search" className="hidden w-full max-w-xl md:block">
      <label htmlFor="global-q" className="sr-only">Search subjects, chapters or materials</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
        <input id="global-q" name="q" placeholder="Search subjects, chapters or materials…" className="input rounded-full pl-11" />
      </div>
    </form>
  );
}
