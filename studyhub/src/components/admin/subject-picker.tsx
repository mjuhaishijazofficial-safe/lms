"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { SubjectCatalogue } from "@/server/services/subjects";
import { TERMS } from "@/lib/terms";

export type StudentPreset = { id: string; name: string; subjectIds: string[] };

/**
 * Picks the exact subjects one student studies. Leaving every box unticked is meaningful: the student then
 * falls back to seeing whatever their semester allows (see server/services/visibility.ts).
 */
export function SubjectPicker({ catalogue, presets, initial }: {
  catalogue: SubjectCatalogue; presets: StudentPreset[]; initial: string[];
}) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(initial));
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalogue;
    return catalogue
      .map((g) => ({ ...g, subjects: g.subjects.filter((s) => s.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) }))
      .filter((g) => g.subjects.length);
  }, [catalogue, query]);

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  if (catalogue.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-page/50 p-4 text-sm text-muted">
        No subjects exist yet. Add a {TERMS.programLower} and its subjects first, then come back to pick this student&apos;s subjects.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Unticked boxes are not submitted, so an empty pick still needs to reach the server. */}
      <input type="hidden" name="subjectIds" value="" />

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

      <div className="max-h-80 space-y-4 overflow-y-auto rounded-xl border border-line bg-page/40 p-4">
        {groups.length === 0 && <p className="text-sm text-muted">No subject matches “{query}”.</p>}
        {groups.map((group) => (
          <fieldset key={group.id}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.name}</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {group.subjects.map((s) => (
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
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <p className="text-sm text-muted">
        {chosen.size > 0
          ? `${chosen.size} subject${chosen.size === 1 ? "" : "s"} chosen. This student sees only these.`
          : `No subjects chosen, so this student sees every subject of their ${TERMS.semesterLower} and earlier ones.`}
      </p>
    </div>
  );
}
