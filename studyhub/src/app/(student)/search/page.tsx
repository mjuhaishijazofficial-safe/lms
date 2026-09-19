import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ListOrdered, Search as SearchIcon, Layers } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { searchLibrary } from "@/server/services/search";
import { one } from "@/lib/params";
import { subjectIcon } from "@/lib/subject-icons";
import { describeMaterial } from "@/lib/material-types";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";

export const metadata: Metadata = { title: "Search" };

function ResultRow({ href, icon, tile, title, subtitle }: { href: string; icon: React.ComponentProps<typeof IconTile>["icon"]; tile: string; title: string; subtitle: string }) {
  return (
    <Link href={href} prefetch={false} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:border-primary/40">
      <IconTile icon={icon} className={tile} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        <p className="truncate text-sm text-muted">{subtitle}</p>
      </div>
    </Link>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const user = await requireStudent();
  const q = one(await searchParams, "q") ?? "";
  const results = await searchLibrary(user.id, q);
  const empty = !results.subjects.length && !results.chapters.length && !results.materials.length;

  return (
    <>
      <PageHeader title="Search" description={q ? `Results for "${q}"` : "Search your subjects, chapters and materials."} />

      <form method="get" action="/search" role="search" className="mb-8 max-w-xl">
        <label htmlFor="q" className="sr-only">Search</label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
          <input id="q" name="q" defaultValue={q} placeholder="Search subjects, chapters or materials…" className="input rounded-full pl-12" autoFocus />
        </div>
      </form>

      {!q ? null : empty ? (
        <div className="card"><EmptyState icon={SearchIcon} title="No results found." description="Try a different search term." /></div>
      ) : (
        <div className="space-y-8">
          {results.subjects.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Layers className="size-5" aria-hidden /> Subjects</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.subjects.map((s) => {
                  const icon = subjectIcon(s.icon);
                  return <ResultRow key={s.id} href={`/subjects/${s.id}`} icon={icon.icon} tile={icon.tile} title={s.name} subtitle={s.courseName} />;
                })}
              </div>
            </section>
          )}

          {results.chapters.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><ListOrdered className="size-5" aria-hidden /> Chapters</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.chapters.map((c) => (
                  <ResultRow key={c.id} href={`/subjects/${c.subjectId}?chapter=${c.id}#chapter-${c.id}`} icon={ListOrdered} tile="bg-tile-blue text-primary" title={`${c.chapterNumber}. ${c.title}`} subtitle={c.subjectName} />
                ))}
              </div>
            </section>
          )}

          {results.materials.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><BookOpen className="size-5" aria-hidden /> Materials</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.materials.map((m) => {
                  const d = describeMaterial(m);
                  return <ResultRow key={m.id} href={`/materials/${m.id}`} icon={d.icon} tile={d.tile} title={m.title} subtitle={`${m.subjectName} · ${m.chapterTitle}`} />;
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
