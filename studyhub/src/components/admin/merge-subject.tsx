"use client";

import { useState } from "react";
import { Merge } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { mergeSubjectAction } from "@/app/admin/subjects/actions";

type Option = { key: string; course: string; subjects: { id: string; name: string }[] };

/** Folds a copy of a subject into the real one. Everything it holds moves across; the copy is then removed. */
export function MergeSubject({ subjectId, subjectName, options }: { subjectId: string; subjectName: string; options: Option[] }) {
  const [targetId, setTargetId] = useState("");
  const targetName = options.flatMap((g) => g.subjects).find((s) => s.id === targetId)?.name;

  return (
    <div className="card max-w-2xl space-y-4 p-6 sm:p-8">
      <div>
        <h2 className="text-lg font-semibold">Merge into another subject</h2>
        <p className="mt-1 text-sm text-muted">
          Use this when the same subject was added twice. Its chapters and files, and the students who take it, move to the subject you choose,
          and this copy is removed.
        </p>
      </div>
      <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="select" aria-label="Subject to merge into">
        <option value="">Choose the subject to keep…</option>
        {options.map((g) => (
          <optgroup key={g.key} label={g.course}>
            {g.subjects.filter((s) => s.id !== subjectId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
        ))}
      </select>
      {targetId ? (
        <ConfirmDialog
          trigger={<><Merge className="size-4.5" aria-hidden /> Merge into {targetName}</>}
          triggerClassName="btn-outline"
          title={`Merge ${subjectName} into ${targetName}?`}
          description={`Everything in "${subjectName}" moves to "${targetName}", then "${subjectName}" is deleted. This cannot be undone.`}
          confirmLabel="Merge subjects"
          action={mergeSubjectAction}
          fields={{ id: subjectId, targetId }}
        />
      ) : (
        <button type="button" disabled className="btn-outline">Merge</button>
      )}
    </div>
  );
}
