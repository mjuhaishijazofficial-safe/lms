import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download, GraduationCap, Plus } from "lucide-react";
import { programCards } from "@/server/services/programs";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { MoveButtons } from "@/components/admin/row-actions";
import { moveCourseAction } from "./actions";

export const metadata: Metadata = { title: TERMS.programs };

const TILES = ["bg-tile-blue text-primary", "bg-tile-purple text-violet-800", "bg-tile-green text-teal-700", "bg-tile-amber text-amber-800", "bg-tile-red text-rose-800"];

export default async function ProgramsPage({ searchParams }: PageProps<"/admin/courses">) {
  const programs = await programCards();

  return (
    <>
      <PageHeader
        title={TERMS.programs}
        description={`Each ${TERMS.programLower} is a degree, like BS Computer Science or BBA. Open one to see its ${TERMS.semesters.toLowerCase()} and the courses in each.`}
        actions={
          <>
            <Link href="/admin/courses/vu" className="btn-outline"><Download className="size-4.5" aria-hidden /> Add from VU</Link>
            <Link href="/admin/courses/new" className="btn-primary"><Plus className="size-4.5" aria-hidden /> New {TERMS.programLower}</Link>
          </>
        }
      />
      <Notice searchParams={await searchParams} />

      {programs.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GraduationCap}
            title={`No ${TERMS.programs.toLowerCase()} yet`}
            description={`Pick one of Virtual University's degrees and its ${TERMS.semesters.toLowerCase()} and courses are filled in for you. Or start an empty one.`}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/admin/courses/vu" className="btn-primary"><Download className="size-4.5" aria-hidden /> Add from VU</Link>
                <Link href="/admin/courses/new" className="btn-outline">Start an empty one</Link>
              </div>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {programs.map((p, i) => (
            <li key={p.id} className="card relative flex flex-col p-5 transition hover:border-primary/40 hover:shadow-lg">
              <div className="flex items-start gap-4">
                <IconTile icon={GraduationCap} className={TILES[i % TILES.length]} />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold leading-snug">
                    {/* The whole card is the link (the ::after covers it); the move buttons sit above it. */}
                    <Link href={`/admin/courses/${p.id}`} className="after:absolute after:inset-0 after:rounded-card hover:text-primary">{p.name}</Link>
                  </h2>
                  {p.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.description}</p>}
                </div>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted" aria-hidden />
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  [TERMS.semesters, p._count.semesters],
                  ["Courses", p._count.subjects],
                  ["Students", p._count.enrollments],
                ].map(([label, n]) => (
                  <div key={label} className="rounded-xl bg-page px-2 py-2.5">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="text-lg font-bold">{n}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex items-center justify-between">
                <StatusBadge status={p.status} />
                <div className="relative z-10">
                  <MoveButtons id={p.id} action={moveCourseAction} returnTo="/admin/courses" first={i === 0} last={i === programs.length - 1} label={p.name} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
