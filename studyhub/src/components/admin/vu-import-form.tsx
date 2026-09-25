"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import type { FormState } from "@/server/action-result";
import { importVuAction } from "@/app/admin/courses/program-actions";
import type { VuCourse, VuCourseKind } from "@/lib/vu-catalog";
import { normalizeCode } from "@/lib/student-import";
import { cn, plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { Alert } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";

type Program = { id: string; name: string; codes: string[] };
type Scheme = { slug: string; name: string; sourceUrl: string; semesters: VuCourse[][] };

const KIND: Record<VuCourseKind, { label: string; cls: string } | null> = {
  R: null,
  E: { label: "Elective", cls: "bg-blue-50 text-blue-700" },
  D: { label: "Deficiency", cls: "bg-amber-50 text-amber-800" },
};

/**
 * Every course of one VU scheme, grouped by semester, with a tick box each. Required courses start ticked; electives and
 * deficiency courses start unticked because each student takes only some of them. Courses the chosen program already
 * has are shown but can't be ticked, so nothing is ever added twice.
 */
export function VuImportForm({ scheme, programs, defaultTarget, backHref }: { scheme: Scheme; programs: Program[]; defaultTarget: string; backHref: string }) {
  const [state, action] = useActionState<FormState, FormData>(importVuAction, {});
  const [target, setTarget] = useState(defaultTarget);
  const all = useMemo(() => scheme.semesters.flat(), [scheme]);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(all.filter((c) => c.kind === "R").map((c) => c.code)));

  const have = useMemo(() => new Set(programs.find((p) => p.id === target)?.codes ?? []), [programs, target]);
  const exists = (c: VuCourse) => have.has(normalizeCode(c.code));
  const chosen = all.filter((c) => ticked.has(c.code) && !exists(c));

  const setMany = (courses: VuCourse[], on: boolean) => setTicked((prev) => {
    const next = new Set(prev);
    for (const c of courses) if (on) next.add(c.code); else next.delete(c.code);
    return next;
  });
  const quick = (pick: (c: VuCourse) => boolean) => setTicked(new Set(all.filter(pick).map((c) => c.code)));
  const targetName = target === "new" ? scheme.name : programs.find((p) => p.id === target)?.name ?? scheme.name;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={scheme.slug} />
      {chosen.map((c) => <input key={c.code} type="hidden" name="codes" value={c.code} />)}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <div className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="target" className="mb-1.5 block text-sm font-medium">Add the courses to</label>
          <select id="target" name="target" value={target} onChange={(e) => setTarget(e.target.value)} className="select">
            <option value="new">A new {TERMS.programLower}: {scheme.name}</option>
            {programs.length > 0 && (
              <optgroup label={`Your ${TERMS.programs.toLowerCase()}`}>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium">Students can see them</label>
          <select id="status" name="status" defaultValue="PUBLISHED" className="select">
            <option value="PUBLISHED">Straight away</option>
            <option value="DRAFT">Not yet, I&apos;ll publish them myself</option>
          </select>
        </div>
        <a href={scheme.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost justify-self-start">
          <ExternalLink className="size-4" aria-hidden /> VU&apos;s scheme of study
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-muted">Tick:</span>
        <button type="button" className="rounded-full border border-line bg-surface px-3 py-1 font-medium hover:border-primary/40 hover:text-primary" onClick={() => quick((c) => c.kind === "R")}>Required courses</button>
        <button type="button" className="rounded-full border border-line bg-surface px-3 py-1 font-medium hover:border-primary/40 hover:text-primary" onClick={() => quick(() => true)}>Everything</button>
        <button type="button" className="rounded-full border border-line bg-surface px-3 py-1 font-medium hover:border-primary/40 hover:text-primary" onClick={() => quick(() => false)}>Nothing</button>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {scheme.semesters.map((courses, i) => {
          const open = courses.filter((c) => !exists(c));
          const n = open.filter((c) => ticked.has(c.code)).length;
          return (
            <fieldset key={i} className="card">
              <legend className="sr-only">{TERMS.semester} {i + 1}</legend>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-tile-blue text-sm font-bold text-primary" aria-hidden>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{TERMS.semester} {i + 1}</p>
                  <p className="text-xs text-muted">{n} of {plural(open.length, "course")} ticked</p>
                </div>
                <button type="button" className="btn-ghost !px-2 text-xs" onClick={() => setMany(open, n < open.length)} disabled={!open.length}>
                  {n < open.length ? "Tick all" : "Untick all"}
                </button>
              </div>
              <ul className="divide-y divide-line">
                {courses.map((c) => {
                  const already = exists(c);
                  const kind = KIND[c.kind];
                  const id = `vu-${c.code}`;
                  return (
                    <li key={c.code}>
                      <label htmlFor={id} className={cn("flex items-start gap-3 px-4 py-2.5 sm:px-5", already ? "opacity-60" : "cursor-pointer hover:bg-page/60")}>
                        <input
                          id={id} type="checkbox" className="mt-1 size-4 shrink-0 accent-primary"
                          checked={!already && ticked.has(c.code)} disabled={already}
                          onChange={(e) => setMany([c], e.target.checked)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-mono text-xs font-semibold text-muted">{c.code}</span>
                            <span className="font-medium">{c.title}</span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            {plural(c.credits, "credit hour")}
                            {kind && <span className={cn("rounded-full px-2 py-0.5 font-medium", kind.cls)}>{kind.label}</span>}
                            {c.tracks.length > 0 && <span>· {c.tracks.join(", ")}</span>}
                          </span>
                        </span>
                        {already && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700"><Check className="size-3.5" aria-hidden /> Already added</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-semibold">{plural(chosen.length, "course")}</span> will be added to <span className="font-semibold">{targetName}</span>, each in its {TERMS.semesterLower}.
          </p>
          <div className="flex gap-3">
            <Link href={backHref} className="btn-outline">Back</Link>
            <SubmitButton pendingText="Adding…" className={cn(!chosen.length && "pointer-events-none opacity-50")}>
              Add {plural(chosen.length, "course")}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}
