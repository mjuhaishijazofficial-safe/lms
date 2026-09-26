"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { SubjectCatalogue } from "@/server/services/subjects";
import { TERMS } from "@/lib/terms";

export type StudentPreset = { id: string; name: string; subjectIds: string[] };
type CatalogueSubject = SubjectCatalogue[number]["subjects"][number];

/**
 * Picks the exact subjects one student studies. Leaving every box unticked is meaningful: the student then
 * falls back to seeing whatever their semester allows (see server/services/visibility.ts).
 *
 * Subjects are grouped by program. With more than one program, a row of tabs (BSCS, BBA, BBIT…) shows one
 * program's subjects at a time instead of a long stacked list. Searching looks across every program at once,
 * since that is when the tab you want is not obvious.
 */
export function SubjectPicker({ catalogue, presets, initial }: {
  catalogue: SubjectCatalogue; presets: StudentPreset[]; initial: string[];
}) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(initial));
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<string>(() => {
    // Land on the program this student's current picks belong to, so opening an existing student doesn't hide them.
    let best = catalogue[0]?.id ?? "";
    let bestCount = -1;
    for (const g of catalogue) {
      const count = g.subjects.filter((s) => initial.includes(s.id)).length;
      if (count > bestCount) { bestCount = count; best = g.id; }
    }
    return best;
  });

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const searchGroups = useMemo(() => {
    if (!searching) return [];
    return catalogue
      .map((g) => ({ ...g, subjects: g.subjects.filter((s) => s.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) }))
      .filter((g) => g.subjects.length);
  }, [catalogue, q, searching]);

  if (catalogue.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-page/50 p-4 text-sm text-muted">
        No subjects exist yet. Add a {TERMS.programLower} and its subjects first, then come back to pick this student&apos;s subjects.
      </div>
    );
  }

  const active = catalogue.find((g) => g.id === tab) ?? catalogue[0];
  const shown = searching ? searchGroups.flatMap((g) => g.subjects) : active.subjects;
  const shownIds = new Set(shown.map((s) => s.id));
  // A subject ticked on another tab (or hidden by the search box) still has to reach the form, or switching
  // tabs before saving would silently untick it.
  const hiddenChosen = [...chosen].filter((id) => !shownIds.has(id));

  const option = (s: CatalogueSubject) => (
    <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
      <input
        type="checkbox" name="subjectIds" value={s.id}
        checked={chosen.has(s.id)} onChange={() => toggle(s.id)}
        className="size-4 shrink-0 accent-[var(--color-primary)]"
      />
      <span className="min-w-0 truncate">
        {s.name}
        {s.semester && <span className="ml-1.5 text-xs text-muted">{s.semester}</span>}
      </span>
    </label>
  );

  return (
    <div className="space-y-3">
      {/* Unticked boxes are not submitted, so an empty pick still needs to reach the server. */}
      <input type="hidden" name="subjectIds" value="" />
      {hiddenChosen.map((id) => <input key={id} type="hidden" name="subjectIds" value={id} />)}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects…" aria-label="Search subjects" className="input h-10 pl-9 text-sm"
          />
        </div>
        {presets.length > 0 && (
          <select
            className="select h-10 w-auto text-sm" defaultValue=""
            aria-label="Copy subjects from another student"
            onChange={(e) => {
              const preset = presets.find((p) => p.id === e.target.value);
              if (preset) setChosen(new Set(preset.subjectIds));
              e.target.value = "";
            }}
          >
            <option value="">Copy from another student…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.subjectIds.length})</option>
            ))}
          </select>
        )}
      </div>

      {!searching && catalogue.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={`${TERMS.programLower} programs`}>
          {catalogue.map((g) => {
            const count = g.subjects.filter((s) => chosen.has(s.id)).length;
            const isActive = g.id === active.id;
            return (
              <button
                key={g.id} type="button" role="tab" aria-selected={isActive} onClick={() => setTab(g.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  isActive ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "border-line text-muted hover:bg-surface"
                }`}
              >
                {g.name}
                {count > 0 && <span className="ml-1.5 text-xs">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="max-h-80 space-y-4 overflow-y-auto rounded-xl border border-line bg-page/40 p-4">
        {searching ? (
          <>
            {searchGroups.length === 0 && <p className="text-sm text-muted">No subject matches “{query}”.</p>}
            {searchGroups.map((group) => (
              <fieldset key={group.id}>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.name}</legend>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{group.subjects.map(option)}</div>
              </fieldset>
            ))}
          </>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {shown.length === 0 && <p className="text-sm text-muted">No subjects in {active.name} yet.</p>}
            {shown.map(option)}
          </div>
        )}
      </div>

      <p className="text-sm text-muted">
        {chosen.size > 0
          ? `${chosen.size} subject${chosen.size === 1 ? "" : "s"} chosen. This student sees only these.`
          : `No subjects chosen, so this student sees every subject of their ${TERMS.semesterLower} and earlier ones.`}
      </p>
    </div>
  );
}
