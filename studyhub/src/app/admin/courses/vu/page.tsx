import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, GraduationCap, Sparkles } from "lucide-react";
import { programCodes } from "@/server/services/programs";
import { findVuProgram, VU_PROGRAMS, type VuProgram } from "@/lib/vu-catalog";
import { matchProgram } from "@/lib/vu-import";
import { idParam, one } from "@/lib/params";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { IconTile } from "@/components/ui/icon-tile";
import { VuImportForm } from "@/components/admin/vu-import-form";

export const metadata: Metadata = { title: "Add from Virtual University" };

function SchemeCard({ p, href, suggested }: { p: VuProgram; href: string; suggested?: boolean }) {
  const courses = p.semesters.flat();
  return (
    <li>
      <Link href={href} className="card flex h-full items-center gap-4 p-4 transition hover:border-primary/40 hover:shadow-lg">
        <IconTile icon={GraduationCap} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{p.name}</span>
          <span className="text-sm text-muted">
            {plural(p.semesters.length, TERMS.semesterLower)} · {courses.filter((c) => c.kind === "R").length} required, {courses.filter((c) => c.kind !== "R").length} optional
          </span>
          {suggested && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><Sparkles className="size-3.5" aria-hidden /> Looks like your {TERMS.programLower}</span>}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

export default async function VuImportPage({ searchParams }: PageProps<"/admin/courses/vu">) {
  const sp = await searchParams;
  const programs = await programCodes();
  const programId = idParam(sp, "program");
  const into = programs.find((p) => p.id === programId);
  const scheme = findVuProgram(one(sp, "scheme"));
  const qs = (slug: string) => `/admin/courses/vu?scheme=${slug}${into ? `&program=${into.id}` : ""}`;
  const crumbs = [
    { label: TERMS.programs, href: "/admin/courses" },
    ...(into ? [{ label: into.name, href: `/admin/courses/${into.id}` }] : []),
    { label: "Add from VU" },
  ];

  if (!scheme) {
    const suggested = into ? VU_PROGRAMS.find((p) => matchProgram(p, [into])) : undefined;
    return (
      <>
        <PageHeader
          title="Add from Virtual University"
          crumbs={crumbs}
        />
        {suggested && (
          <ul className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><SchemeCard p={suggested} href={qs(suggested.slug)} suggested /></ul>
        )}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {VU_PROGRAMS.filter((p) => p !== suggested).map((p) => <SchemeCard key={p.slug} p={p} href={qs(p.slug)} />)}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Course lists come from each degree&apos;s scheme of study on vu.edu.pk. VU updates them now and then, so you can still add, rename or remove courses by hand afterwards.
        </p>
      </>
    );
  }

  const defaultTarget = into?.id ?? matchProgram(scheme, programs)?.id ?? "new";
  return (
    <>
      <PageHeader
        title={scheme.name}
        crumbs={[...crumbs.slice(0, -1), { label: "Add from VU", href: `/admin/courses/vu${into ? `?program=${into.id}` : ""}` }, { label: scheme.name }]}
      />
      <VuImportForm
        scheme={{ slug: scheme.slug, name: scheme.name, sourceUrl: scheme.sourceUrl, semesters: scheme.semesters }}
        programs={programs}
        defaultTarget={defaultTarget}
        backHref={`/admin/courses/vu${into ? `?program=${into.id}` : ""}`}
      />
    </>
  );
}
